import { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { addToQueue, processSyncQueue } from '../lib/sync';

export default function FormWizard() {
  const router = useRouter();
  const { type } = useLocalSearchParams(); // MORNING | EVENING

  // State
  const [loadingMsg, setLoadingMsg] = useState('Fetching GPS / Recherche GPS...');
  const [gps, setGps] = useState<any>(null);
  const [gpsError, setGpsError] = useState('');

  const [attendance, setAttendance] = useState({
    worker1: 'PRESENT', worker2: 'PRESENT', worker3: 'PRESENT', worker4: 'PRESENT'
  });
  
  const [livestock, setLivestock] = useState({ goats: '0', poultry: '0', cattle: '0' });
  const [tasks, setTasks] = useState('');
  const [notes, setNotes] = useState('');

  const [photos, setPhotos] = useState<string[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncingMedia, setSyncingMedia] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');
  const [overallPct, setOverallPct] = useState(0);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsError('Permission to access location was denied');
        setLoadingMsg('');
        return;
      }

      try {
        let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        setGps({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracyMeters: location.coords.accuracy,
          isWithinGeofence: true
        });
      } catch (e: any) {
        setGpsError(e.message);
      }
      setLoadingMsg('');
    })();
  }, []);

  const takePhoto = async () => {
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const recordVideo = async () => {
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 60,
    });
    if (!result.canceled) {
      setVideo(result.assets[0].uri);
    }
  };

  const startVoiceRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopVoiceRecording = async () => {
    setRecording(null);
    if (recording) {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setVoice(uri);
    }
  };

  const submitForm = async () => {
    if (photos.length < 2) {
      Alert.alert('Error / Erreur', 'Please take at least 2 photos.');
      return;
    }
    setSubmitting(true);
    try {
      const currentUser = auth.currentUser;
      let tenantId = 'default_tenant';
      if (currentUser) {
        const { getUserProfile } = await import('../lib/tenant');
        const prof = await getUserProfile(currentUser.uid);
        if (prof?.tenantId) tenantId = prof.tenantId;
      }

      const logRef = doc(collection(db, 'agbelouve-farm-daily-logs'));
      const logId = logRef.id;

      const payload = {
        logId,
        tenantId,
        managerId: currentUser?.uid || 'manager_uid_123',
        logType: type || 'MORNING',
        clientTimestamp: new Date().toISOString(),
        serverTimestamp: serverTimestamp(),
        location: gps || {},
        attendance: {
          worker1_mechanist: attendance.worker1,
          worker2_herdsman_1: attendance.worker2,
          worker3_herdsman_2: attendance.worker3,
          worker4_forester: attendance.worker4,
        },
        livestock: {
          goatsTotal: Number(livestock.goats),
          poultryTotal: Number(livestock.poultry),
          cattleTotal: Number(livestock.cattle),
          healthIssues: notes,
          eggsCollected: 0
        },
        operations: {
          plannedTasks: type === 'MORNING' ? tasks : '',
          completedTasks: type === 'EVENING' ? tasks : '',
          tractorFuelLevel: 'N/A',
          equipmentIssues: 'None'
        },
        financials: { amountSpentXOF: 0, expenseReason: '' },
        mediaUrls: { photos: [], video: '', voice: '' },
        managerNotes: notes
      };

      // 1. Save JSON to firestore (works offline with persistent cache)
      await setDoc(logRef, payload);

      // 2. Queue Media files into AsyncStorage with tenantId
      const queueItems: any[] = [];
      photos.forEach((uri, i) => queueItems.push({ id: Date.now()+i+'', logId, tenantId, localUri: uri, type: 'photo' as const, fileName: `photo_${i}.jpg` }));
      if (video) queueItems.push({ id: Date.now()+'v', logId, tenantId, localUri: video, type: 'video' as const, fileName: `video.mp4` });
      if (voice) queueItems.push({ id: Date.now()+'a', logId, tenantId, localUri: voice, type: 'voice' as const, fileName: `voice.m4a` });

      for (const item of queueItems) {
        await addToQueue(item);
      }


      // 3. Attempt immediate sync with progress feedback if online
      setSyncingMedia(true);
      setUploadProgressMsg('Uploading media files / Envoi des fichiers media...');
      const totalCount = queueItems.length;
      let completedCount = 0;

      const syncResult = await processSyncQueue((_itemId, progress, status) => {
        if (status === 'uploading') {
          setUploadProgressMsg(`Uploading media (${completedCount + 1}/${totalCount}) - ${progress}%`);
          setOverallPct(Math.round(((completedCount + progress / 100) / totalCount) * 100));
        } else if (status === 'completed') {
          completedCount++;
          setOverallPct(Math.round((completedCount / totalCount) * 100));
        }
      });

      setSyncingMedia(false);

      if (syncResult.count === totalCount) {
        Alert.alert('Success / Succès', 'Daily log & all media uploaded successfully!');
      } else {
        Alert.alert(
          'Log Saved Offline / Enregistré Hors Ligne',
          `${totalCount - syncResult.count} media file(s) saved in offline queue. Upload will complete automatically when connection is restored.`
        );
      }
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
      setSyncingMedia(false);
    }
  };

  if (loadingMsg) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-4">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-2xl font-bold mt-4 text-center">{loadingMsg}</Text>
      </View>
    );
  }

  const WorkerRow = ({ label, id }: any) => (
    <View className="mb-4">
      <Text className="font-bold text-xl mb-2">{label}</Text>
      <View className="flex-row justify-between">
        {['PRESENT', 'ABSENT', 'SICK'].map(status => (
           <TouchableOpacity 
             key={status}
             // @ts-ignore
             onPress={() => setAttendance({...attendance, [id]: status})}
             // @ts-ignore
             className={`flex-1 py-4 border-2 border-black items-center mx-1 ${attendance[id] === status ? 'bg-safety-yellow' : 'bg-gray-100'}`}
           >
             <Text className="font-bold">{status}</Text>
           </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-white p-4">
      <Text className="text-3xl font-extrabold mb-6">GPS: {gps ? 'OK \u2714' : 'FAILED \u2716'}</Text>
      
      <Text className="text-2xl font-bold bg-black text-white p-2 mb-4">ATTENDANCE</Text>
      <WorkerRow label="Worker 1 (Mechanist)" id="worker1" />
      <WorkerRow label="Worker 2 (Herdsman)" id="worker2" />
      <WorkerRow label="Worker 3 (Herdsman)" id="worker3" />
      <WorkerRow label="Worker 4 (Forester)" id="worker4" />

      <Text className="text-2xl font-bold bg-black text-white p-2 mb-4 mt-4">LIVESTOCK</Text>
      <View className="flex-row justify-between mb-4">
        {['goats', 'poultry', 'cattle'].map(key => (
          <View key={key} className="flex-1 items-center">
            <Text className="font-bold text-lg mb-2 capitalize">{key}</Text>
            <TextInput 
              keyboardType="numeric"
              className="border-4 border-black text-2xl p-2 w-20 text-center font-bold"
              // @ts-ignore
              value={livestock[key]}
              // @ts-ignore
              onChangeText={val => setLivestock({...livestock, [key]: val})}
            />
          </View>
        ))}
      </View>

      <Text className="text-2xl font-bold bg-black text-white p-2 mb-4 mt-4">TASKS / TÂCHES</Text>
      <TextInput 
        multiline
        numberOfLines={4}
        className="border-4 border-black p-4 text-xl font-bold mb-4 min-h-[120px]"
        placeholder="Details..."
        value={tasks}
        onChangeText={setTasks}
        textAlignVertical="top"
      />

      <Text className="text-2xl font-bold bg-black text-white p-2 mb-4 mt-4">NOTES</Text>
      <TextInput 
        multiline
        numberOfLines={3}
        className="border-4 border-black p-4 text-xl font-bold mb-4 min-h-[100px]"
        placeholder="Issues, health etc..."
        value={notes}
        onChangeText={setNotes}
        textAlignVertical="top"
      />

      <Text className="text-2xl font-bold bg-black text-white p-2 mb-4 mt-4">MEDIA UPLOAD</Text>
      
      <TouchableOpacity onPress={takePhoto} className="bg-gray-300 p-6 items-center mb-4 border-2 border-black">
        <Text className="font-bold text-xl">TAKE PHOTO ({photos.length}/2+)</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={recordVideo} className="bg-gray-300 p-6 items-center mb-4 border-2 border-black">
        <Text className="font-bold text-xl">RECORD VIDEO {video ? '(OK)' : ''}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={recording ? stopVoiceRecording : startVoiceRecording} className={`${recording ? 'bg-red-500' : 'bg-gray-300'} p-6 items-center mb-6 border-2 border-black`}>
        <Text className="font-bold text-xl">{recording ? 'STOP RECORDING' : 'RECORD VOICE NOTE'} {voice && !recording ? '(OK)' : ''}</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={submitForm}
        disabled={submitting}
        className="bg-black py-8 items-center rounded-xl mb-12 shadow-md"
      >
        <Text className="text-safety-yellow font-extrabold text-3xl">SUBMIT LOG</Text>
      </TouchableOpacity>

      <Modal visible={syncingMedia} transparent animationType="fade">
        <View className="flex-1 bg-black/80 justify-center items-center p-6">
          <View className="bg-white rounded-2xl p-6 w-full items-center border-4 border-safety-yellow shadow-2xl">
            <ActivityIndicator size="large" color="#FFCC00" />
            <Text className="text-2xl font-extrabold mt-4 text-center text-black">UPLOADING MEDIA</Text>
            <Text className="text-lg font-bold text-gray-700 text-center mt-2">{uploadProgressMsg}</Text>
            <View className="w-full bg-gray-200 h-6 rounded-full mt-6 overflow-hidden border-2 border-black">
              <View className="bg-safety-yellow h-full" style={{ width: `${overallPct}%` }} />
            </View>
            <Text className="text-xl font-extrabold mt-2 text-black">{overallPct}%</Text>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

