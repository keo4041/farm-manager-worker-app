import { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { addToQueue, processSyncQueue } from '../lib/sync';
import { getTenantFormConfig, getUserProfile, TenantFormConfig, DEFAULT_FORM_CONFIG } from '../lib/tenant';

export default function FormWizard() {
  const router = useRouter();
  const { type } = useLocalSearchParams(); // MORNING | EVENING
  const isMorning = (type || 'MORNING') === 'MORNING';

  // Dynamic Form Config
  const [formConfig, setFormConfig] = useState<TenantFormConfig>(DEFAULT_FORM_CONFIG);
  const [tenantId, setTenantId] = useState('default_tenant');

  // State
  const [loadingMsg, setLoadingMsg] = useState('Loading Form / Chargement...');
  const [gps, setGps] = useState<any>(null);
  const [gpsError, setGpsError] = useState('');

  const [attendance, setAttendance] = useState<Record<string, string>>({
    worker1: 'PRESENT',
    worker2: 'PRESENT',
    worker3: 'PRESENT',
    worker4: 'PRESENT',
  });

  const [livestock, setLivestock] = useState<Record<string, string>>({
    goats: '0',
    poultry: '0',
    cattle: '0',
  });

  const [tasks, setTasks] = useState('');
  const [notes, setNotes] = useState('');
  const [amountSpent, setAmountSpent] = useState('');
  const [expenseReason, setExpenseReason] = useState('');

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
      // 1. Fetch user tenant and form configuration
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const prof = await getUserProfile(currentUser.uid);
          if (prof?.tenantId) {
            setTenantId(prof.tenantId);
            const cfg = await getTenantFormConfig(prof.tenantId);
            setFormConfig(cfg);

            // Initialize dynamic livestock state from configured categories
            const initialLivestock: Record<string, string> = {};
            cfg.livestockCategories.forEach(cat => {
              initialLivestock[cat.id] = '0';
            });
            setLivestock(initialLivestock);
          }
        }
      } catch (e) {
        console.warn('Error loading form config:', e);
      }

      // 2. Fetch GPS if enabled
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
          isWithinGeofence: true,
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

  const handleToggleChecklistTask = (taskText: string) => {
    if (tasks.includes(taskText)) {
      // Remove task
      const updated = tasks
        .split('\n')
        .filter(t => t.trim() !== `• ${taskText}` && t.trim() !== taskText)
        .join('\n');
      setTasks(updated);
    } else {
      // Add task
      const line = `• ${taskText}`;
      setTasks(prev => (prev.trim() ? `${prev.trim()}\n${line}` : line));
    }
  };

  const submitForm = async () => {
    const minPhotos = formConfig.enabledSections.photos ? formConfig.minPhotos : 0;
    if (photos.length < minPhotos) {
      Alert.alert('Error / Erreur', `Please take at least ${minPhotos} photo(s). / Veuillez prendre au moins ${minPhotos} photo(s).`);
      return;
    }

    if (formConfig.requireVideo && !video) {
      Alert.alert('Error / Erreur', 'Video recording is required for this log.');
      return;
    }

    if (formConfig.requireVoice && !voice) {
      Alert.alert('Error / Erreur', 'Voice audio note is required for this log.');
      return;
    }

    setSubmitting(true);
    try {
      const currentUser = auth.currentUser;
      const logRef = doc(collection(db, 'agbelouve-farm-daily-logs'));
      const logId = logRef.id;

      // Format dynamic livestock numbers
      const formattedLivestock: Record<string, number> = {};
      Object.entries(livestock).forEach(([key, val]) => {
        formattedLivestock[`${key}Total`] = Number(val || 0);
      });

      const payload = {
        logId,
        tenantId,
        managerId: currentUser?.uid || 'manager_uid_123',
        logType: type || 'MORNING',
        clientTimestamp: new Date().toISOString(),
        serverTimestamp: serverTimestamp(),
        location: formConfig.enabledSections.gps ? gps || {} : {},
        attendance: formConfig.enabledSections.attendance
          ? {
              worker1_mechanist: attendance.worker1,
              worker2_herdsman_1: attendance.worker2,
              worker3_herdsman_2: attendance.worker3,
              worker4_forester: attendance.worker4,
            }
          : {},
        livestock: formConfig.enabledSections.livestock
          ? {
              ...formattedLivestock,
              healthIssues: notes,
              eggsCollected: 0,
            }
          : {},
        operations: formConfig.enabledSections.operations
          ? {
              plannedTasks: isMorning ? tasks : '',
              completedTasks: !isMorning ? tasks : '',
              tractorFuelLevel: 'N/A',
              equipmentIssues: 'None',
            }
          : {},
        financials: formConfig.enabledSections.financials
          ? {
              amountSpentXOF: Number(amountSpent || 0),
              expenseReason: expenseReason || '',
            }
          : { amountSpentXOF: 0, expenseReason: '' },
        mediaUrls: { photos: [], video: '', voice: '' },
        managerNotes: notes,
      };

      // 1. Save JSON to firestore (works offline with persistent cache)
      await setDoc(logRef, payload);

      // 2. Queue Media files into AsyncStorage with tenantId
      const queueItems: any[] = [];
      if (formConfig.enabledSections.photos) {
        photos.forEach((uri, i) =>
          queueItems.push({
            id: Date.now() + i + '',
            logId,
            tenantId,
            localUri: uri,
            type: 'photo' as const,
            fileName: `photo_${i}.jpg`,
          })
        );
      }
      if (formConfig.enabledSections.video && video) {
        queueItems.push({
          id: Date.now() + 'v',
          logId,
          tenantId,
          localUri: video,
          type: 'video' as const,
          fileName: `video.mp4`,
        });
      }
      if (formConfig.enabledSections.voice && voice) {
        queueItems.push({
          id: Date.now() + 'a',
          logId,
          tenantId,
          localUri: voice,
          type: 'voice' as const,
          fileName: `voice.m4a`,
        });
      }

      for (const item of queueItems) {
        await addToQueue(item);
      }

      // 3. Attempt immediate sync with progress feedback if online
      if (queueItems.length > 0) {
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
      } else {
        Alert.alert('Success / Succès', 'Daily log submitted successfully!');
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
    <View className="mb-3">
      <Text className="font-extrabold text-sm mb-1.5">{label}</Text>
      <View className="flex-row justify-between">
        {['PRESENT', 'ABSENT', 'SICK'].map(status => (
          <TouchableOpacity
            key={status}
            onPress={() => setAttendance({ ...attendance, [id]: status })}
            className={`flex-1 py-2.5 border-2 border-black items-center mx-1 rounded-xl ${
              attendance[id] === status ? 'bg-safety-yellow shadow-sm' : 'bg-gray-100'
            }`}
          >
            <Text className="font-extrabold text-xs">{status}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const activeChecklist = isMorning
    ? formConfig.customChecklistMorning || []
    : formConfig.customChecklistEvening || [];

  return (
    <ScrollView className="flex-1 bg-white p-4">
      {/* Shift Banner & GPS Header */}
      <View className="bg-black p-4 rounded-2xl border-2 border-safety-yellow mb-4 shadow-md flex-row justify-between items-center">
        <View>
          <Text className="text-safety-yellow font-extrabold text-xl">
            {isMorning ? '🌅 MORNING SHIFT' : '🌙 EVENING SHIFT'}
          </Text>
          <Text className="text-gray-300 font-bold text-xs">
            {isMorning ? 'Rapport du matin' : 'Rapport du soir'}
          </Text>
        </View>

        {formConfig.enabledSections.gps && (
          <View className={`px-3 py-1.5 rounded-full border ${gps ? 'bg-green-500 border-black' : 'bg-red-500 border-white'}`}>
            <Text className="text-black font-extrabold text-xs">
              {gps ? '📍 GPS OK' : '⚠️ NO GPS'}
            </Text>
          </View>
        )}
      </View>

      {/* 1. ATTENDANCE SECTION */}
      {formConfig.enabledSections.attendance && (
        <View className="mb-6 bg-gray-50 p-4 rounded-2xl border-2 border-gray-200 shadow-sm">
          <Text className="text-base font-extrabold text-black uppercase mb-3">👥 Attendance / Présence</Text>
          <WorkerRow label="Worker 1 (Mechanist)" id="worker1" />
          <WorkerRow label="Worker 2 (Herdsman 1)" id="worker2" />
          <WorkerRow label="Worker 3 (Herdsman 2)" id="worker3" />
          <WorkerRow label="Worker 4 (Forester)" id="worker4" />
        </View>
      )}

      {/* 2. LIVESTOCK POPULATION SECTION */}
      {formConfig.enabledSections.livestock && formConfig.livestockCategories.length > 0 && (
        <View className="mb-6 bg-gray-50 p-4 rounded-2xl border-2 border-gray-200 shadow-sm">
          <Text className="text-base font-extrabold text-black uppercase mb-3">🐐 Livestock Population</Text>
          <View className="flex-row flex-wrap justify-between gap-3">
            {formConfig.livestockCategories.map(cat => (
              <View key={cat.id} className="min-w-[45%] flex-1 items-center bg-white p-3 rounded-xl border border-gray-300">
                <Text className="font-extrabold text-xs mb-2 text-center">
                  {cat.icon || '🐾'} {cat.label}
                </Text>
                <TextInput
                  keyboardType="numeric"
                  className="border-2 border-black text-xl p-2 w-24 text-center font-extrabold rounded-lg bg-gray-50"
                  value={livestock[cat.id] || '0'}
                  onChangeText={val => setLivestock({ ...livestock, [cat.id]: val })}
                />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 3. TASKS & CHECKLISTS SECTION */}
      {formConfig.enabledSections.operations && (
        <View className="mb-6 bg-gray-50 p-4 rounded-2xl border-2 border-gray-200 shadow-sm">
          <Text className="text-base font-extrabold text-black uppercase mb-2">
            🚜 {isMorning ? 'Planned Tasks / Tâches Prévues' : 'Completed Tasks / Tâches Réalisées'}
          </Text>

          {/* Quick-Tap Checklist Chips */}
          {activeChecklist.length > 0 && (
            <View className="mb-3">
              <Text className="text-gray-500 font-extrabold text-xs uppercase mb-1.5">Quick Checklist (Tap to add):</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {activeChecklist.map((taskItem, idx) => {
                  const isChecked = tasks.includes(taskItem);
                  return (
                    <TouchableOpacity
                      key={idx}
                      className={`px-3 py-1.5 rounded-full border ${
                        isChecked
                          ? 'bg-safety-yellow border-black shadow-sm'
                          : 'bg-white border-gray-300'
                      }`}
                      onPress={() => handleToggleChecklistTask(taskItem)}
                    >
                      <Text className="font-extrabold text-xs text-black">
                        {isChecked ? '✓ ' : '+ '} {taskItem}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <TextInput
            multiline
            numberOfLines={4}
            className="border-2 border-black p-3.5 text-base font-bold rounded-xl bg-white min-h-[100px]"
            placeholder="Type task details or tap checklist chips above..."
            placeholderTextColor="#888888"
            value={tasks}
            onChangeText={setTasks}
            textAlignVertical="top"
          />
        </View>
      )}

      {/* 4. FINANCIALS / EXPENSES SECTION */}
      {formConfig.enabledSections.financials && (
        <View className="mb-6 bg-purple-50 p-4 rounded-2xl border-2 border-purple-200 shadow-sm">
          <Text className="text-base font-extrabold text-purple-950 uppercase mb-3">💰 Field Expenses (XOF)</Text>
          <TextInput
            keyboardType="numeric"
            className="border-2 border-purple-400 p-3 text-lg font-extrabold rounded-xl bg-white mb-2 text-purple-950"
            placeholder="Amount spent in XOF (e.g. 5000)..."
            placeholderTextColor="#999999"
            value={amountSpent}
            onChangeText={setAmountSpent}
          />
          <TextInput
            className="border-2 border-purple-400 p-3 text-sm font-bold rounded-xl bg-white text-purple-950"
            placeholder="Expense reason (e.g. Fuel purchase, emergency medicine)..."
            placeholderTextColor="#999999"
            value={expenseReason}
            onChangeText={setExpenseReason}
          />
        </View>
      )}

      {/* 5. NOTES SECTION */}
      <View className="mb-6 bg-gray-50 p-4 rounded-2xl border-2 border-gray-200 shadow-sm">
        <Text className="text-base font-extrabold text-black uppercase mb-2">📝 Manager Notes / Remarques</Text>
        <TextInput
          multiline
          numberOfLines={3}
          className="border-2 border-black p-3.5 text-sm font-bold rounded-xl bg-white min-h-[80px]"
          placeholder="Issues, animal health, weather observations..."
          placeholderTextColor="#888888"
          value={notes}
          onChangeText={setNotes}
          textAlignVertical="top"
        />
      </View>

      {/* 6. MEDIA UPLOAD SECTION */}
      <View className="mb-6 bg-gray-50 p-4 rounded-2xl border-2 border-gray-200 shadow-sm">
        <Text className="text-base font-extrabold text-black uppercase mb-3">📸 Media Verification</Text>

        {formConfig.enabledSections.photos && (
          <TouchableOpacity
            onPress={takePhoto}
            className="bg-safety-yellow py-3.5 px-4 items-center mb-3 rounded-xl border-2 border-black shadow-sm"
          >
            <Text className="font-extrabold text-black text-sm uppercase">
              📷 TAKE PHOTO ({photos.length}/{formConfig.minPhotos} required)
            </Text>
          </TouchableOpacity>
        )}

        {formConfig.enabledSections.video && (
          <TouchableOpacity
            onPress={recordVideo}
            className={`py-3.5 px-4 items-center mb-3 rounded-xl border-2 border-black ${
              video ? 'bg-green-100 border-green-600' : 'bg-gray-200'
            }`}
          >
            <Text className="font-extrabold text-black text-sm uppercase">
              🎥 {video ? '✓ VIDEO RECORDED' : 'RECORD SHORT VIDEO'}
            </Text>
          </TouchableOpacity>
        )}

        {formConfig.enabledSections.voice && (
          <TouchableOpacity
            onPress={recording ? stopVoiceRecording : startVoiceRecording}
            className={`py-3.5 px-4 items-center mb-2 rounded-xl border-2 border-black ${
              recording ? 'bg-red-500' : voice ? 'bg-green-100 border-green-600' : 'bg-gray-200'
            }`}
          >
            <Text className={`font-extrabold text-sm uppercase ${recording ? 'text-white' : 'text-black'}`}>
              🎙️ {recording ? 'STOP RECORDING' : voice ? '✓ AUDIO NOTE SAVED' : 'RECORD VOICE NOTE'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* SUBMIT BUTTON */}
      <TouchableOpacity
        onPress={submitForm}
        disabled={submitting}
        className="bg-black py-5 items-center rounded-2xl mb-12 border-2 border-safety-yellow shadow-xl"
      >
        {submitting ? (
          <ActivityIndicator size="large" color="#FFCC00" />
        ) : (
          <Text className="text-safety-yellow font-extrabold text-2xl tracking-wider uppercase">
            SUBMIT LOG / ENVOYER
          </Text>
        )}
      </TouchableOpacity>

      {/* MODAL: MEDIA UPLOADING PROGRESS */}
      <Modal visible={syncingMedia} transparent animationType="fade">
        <View className="flex-1 bg-black/80 justify-center items-center p-6">
          <View className="bg-white rounded-3xl p-6 w-full items-center border-4 border-safety-yellow shadow-2xl">
            <ActivityIndicator size="large" color="#FFCC00" />
            <Text className="text-xl font-extrabold mt-4 text-center text-black">STREAMING MEDIA</Text>
            <Text className="text-sm font-bold text-gray-700 text-center mt-2">{uploadProgressMsg}</Text>
            <View className="w-full bg-gray-200 h-5 rounded-full mt-6 overflow-hidden border-2 border-black">
              <View className="bg-safety-yellow h-full" style={{ width: `${overallPct}%` }} />
            </View>
            <Text className="text-lg font-extrabold mt-2 text-black">{overallPct}%</Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}


