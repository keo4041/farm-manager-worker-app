import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Switch,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  getUserProfile,
  getTenantDetails,
  getTenantFormConfig,
  updateTenantFormConfig,
  UserProfile,
  Tenant,
  TenantFormConfig,
  DEFAULT_FORM_CONFIG,
  LivestockCategory,
} from '../lib/tenant';

interface DailyLogItem {
  id: string;
  logId?: string;
  tenantId: string;
  managerId?: string;
  logType: 'MORNING' | 'EVENING';
  clientTimestamp: string;
  serverTimestamp?: any;
  location?: {
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    isWithinGeofence?: boolean;
  };
  attendance?: Record<string, string>;
  livestock?: Record<string, any>;
  operations?: {
    plannedTasks?: string;
    completedTasks?: string;
    tractorFuelLevel?: string;
    equipmentIssues?: string;
  };
  financials?: {
    amountSpentXOF?: number;
    expenseReason?: string;
  };
  mediaUrls?: {
    photos?: string[];
    video?: string;
    voice?: string;
  };
  managerNotes?: string;
}

export default function AdminReports() {
  const router = useRouter();

  // Auth & Tenant State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'template'>('daily');

  // Logs Data State
  const [logs, setLogs] = useState<DailyLogItem[]>([]);

  // Daily Logs Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [shiftFilter, setShiftFilter] = useState<'ALL' | 'MORNING' | 'EVENING'>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK'>('ALL');

  // Daily View Customization Modal State
  const [viewCustomizerVisible, setViewCustomizerVisible] = useState(false);
  const [visibleSections, setVisibleSections] = useState({
    attendance: true,
    livestock: true,
    operations: true,
    financials: true,
    media: true,
    location: true,
    notes: true,
  });

  // Photo Zoom Modal State
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);

  // Weekly Rollup State (0 = Current Week, -1 = Last Week, etc.)
  const [weekOffset, setWeekOffset] = useState(0);

  // Form Template Config State (for Tab 3)
  const [formConfig, setFormConfig] = useState<TenantFormConfig>(DEFAULT_FORM_CONFIG);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [newAnimalName, setNewAnimalName] = useState('');
  const [newMorningTask, setNewMorningTask] = useState('');
  const [newEveningTask, setNewEveningTask] = useState('');

  // Initial Data Fetch
  const loadData = async (uid: string) => {
    try {
      setLoading(true);
      const prof = await getUserProfile(uid);
      setCurrentUser(prof);

      if (prof?.tenantId) {
        const [tenantData, configData] = await Promise.all([
          getTenantDetails(prof.tenantId),
          getTenantFormConfig(prof.tenantId),
        ]);
        setTenant(tenantData);
        setFormConfig(configData);

        // Fetch logs for this tenant
        await fetchTenantLogs(prof.tenantId);
      }
    } catch (err) {
      console.error('Error loading reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantLogs = async (tenantId: string) => {
    try {
      const q = query(
        collection(db, 'agbelouve-farm-daily-logs'),
        where('tenantId', '==', tenantId)
      );
      const snap = await getDocs(q);
      const fetchedLogs: DailyLogItem[] = [];
      snap.forEach(d => {
        fetchedLogs.push({ id: d.id, ...(d.data() as any) });
      });

      // Sort client-side by timestamp descending
      fetchedLogs.sort((a, b) => {
        const dateA = new Date(a.clientTimestamp || 0).getTime();
        const dateB = new Date(b.clientTimestamp || 0).getTime();
        return dateB - dateA;
      });

      setLogs(fetchedLogs);
    } catch (e) {
      console.error('Error fetching logs:', e);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) {
        loadData(user.uid);
      } else {
        router.replace('/login');
      }
    });
    return unsub;
  }, []);

  const onRefresh = async () => {
    if (currentUser?.tenantId) {
      setRefreshing(true);
      await fetchTenantLogs(currentUser.tenantId);
      setRefreshing(false);
    }
  };

  const isOwnerOrAdmin = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  // ---------------------------------------------------------------------------
  // Daily Logs Filtering & Computation
  // ---------------------------------------------------------------------------
  const filteredDailyLogs = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return logs.filter(log => {
      // Shift filter
      if (shiftFilter !== 'ALL' && log.logType !== shiftFilter) return false;

      // Date filter
      const logDate = (log.clientTimestamp || '').split('T')[0];
      if (selectedDateFilter === 'TODAY' && logDate !== todayStr) return false;
      if (selectedDateFilter === 'YESTERDAY' && logDate !== yesterdayStr) return false;
      if (selectedDateFilter === 'WEEK') {
        const logTime = new Date(log.clientTimestamp || 0).getTime();
        if (logTime < sevenDaysAgo.getTime()) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const planned = log.operations?.plannedTasks?.toLowerCase() || '';
        const completed = log.operations?.completedTasks?.toLowerCase() || '';
        const notes = log.managerNotes?.toLowerCase() || '';
        const shift = log.logType?.toLowerCase() || '';
        if (!planned.includes(q) && !completed.includes(q) && !notes.includes(q) && !shift.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, shiftFilter, selectedDateFilter, searchQuery]);

  // ---------------------------------------------------------------------------
  // Weekly Rollup Computation
  // ---------------------------------------------------------------------------
  const weeklyData = useMemo(() => {
    const now = new Date();
    // Calculate week start (Monday) and end (Sunday) based on weekOffset
    const currentDayOfWeek = (now.getDay() + 6) % 7; // 0 = Monday, 6 = Sunday
    const targetMonday = new Date(now);
    targetMonday.setDate(now.getDate() - currentDayOfWeek + weekOffset * 7);
    targetMonday.setHours(0, 0, 0, 0);

    const targetSunday = new Date(targetMonday);
    targetSunday.setDate(targetMonday.getDate() + 6);
    targetSunday.setHours(23, 59, 59, 999);

    const weekLogs = logs.filter(log => {
      const logTime = new Date(log.clientTimestamp || 0).getTime();
      return logTime >= targetMonday.getTime() && logTime <= targetSunday.getTime();
    });

    let totalMorningShifts = 0;
    let totalEveningShifts = 0;
    let totalPresentCount = 0;
    let totalWorkerSlots = 0;
    let totalExpensesXOF = 0;
    let plannedTasksList: string[] = [];
    let completedTasksList: string[] = [];

    // Livestock tracking across the week
    const latestLivestock: Record<string, number> = {};

    weekLogs.forEach(log => {
      if (log.logType === 'MORNING') totalMorningShifts++;
      if (log.logType === 'EVENING') totalEveningShifts++;

      // Attendance
      if (log.attendance) {
        Object.values(log.attendance).forEach(status => {
          totalWorkerSlots++;
          if (status === 'PRESENT') totalPresentCount++;
        });
      }

      // Financials
      if (log.financials?.amountSpentXOF) {
        totalExpensesXOF += Number(log.financials.amountSpentXOF);
      }

      // Tasks
      if (log.operations?.plannedTasks) plannedTasksList.push(log.operations.plannedTasks);
      if (log.operations?.completedTasks) completedTasksList.push(log.operations.completedTasks);

      // Livestock (take most recent values)
      if (log.livestock) {
        Object.entries(log.livestock).forEach(([key, val]) => {
          if (typeof val === 'number' && latestLivestock[key] === undefined) {
            latestLivestock[key] = val;
          }
        });
      }
    });

    const attendanceRate = totalWorkerSlots > 0 ? Math.round((totalPresentCount / totalWorkerSlots) * 100) : 100;

    // 7 Days list for day-by-day rollup
    const daysList = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(targetMonday);
      d.setDate(targetMonday.getDate() + i);
      const dStr = d.toISOString().split('T')[0];
      const dLogs = weekLogs.filter(l => (l.clientTimestamp || '').startsWith(dStr));
      daysList.push({
        date: d,
        dateStr: dStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        logs: dLogs,
        hasMorning: dLogs.some(l => l.logType === 'MORNING'),
        hasEvening: dLogs.some(l => l.logType === 'EVENING'),
      });
    }

    return {
      monday: targetMonday,
      sunday: targetSunday,
      weekLogs,
      totalMorningShifts,
      totalEveningShifts,
      totalShifts: weekLogs.length,
      attendanceRate,
      totalExpensesXOF,
      latestLivestock,
      plannedTasksList,
      completedTasksList,
      daysList,
    };
  }, [logs, weekOffset]);

  // ---------------------------------------------------------------------------
  // Delete Log Handler (Owner/Admin)
  // ---------------------------------------------------------------------------
  const handleDeleteLog = (logId: string) => {
    if (!isOwnerOrAdmin) return;

    Alert.alert(
      'Delete Daily Log / Supprimer le rapport',
      'Are you sure you want to delete this log? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'agbelouve-farm-daily-logs', logId));
              setLogs(prev => prev.filter(l => l.id !== logId));
              Alert.alert('Success', 'Log deleted successfully.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete log.');
            }
          },
        },
      ]
    );
  };

  // ---------------------------------------------------------------------------
  // Save Form Template Handler
  // ---------------------------------------------------------------------------
  const handleSaveTemplate = async () => {
    if (!tenant?.tenantId) return;
    setSavingTemplate(true);
    try {
      await updateTenantFormConfig(tenant.tenantId, formConfig);
      Alert.alert('Success / Succès', 'Daily log form template updated successfully!');
    } catch (err: any) {
      Alert.alert('Error Updating Template', err.message || 'Failed to save template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleAddLivestockCategory = () => {
    if (!newAnimalName.trim()) return;
    const cleanId = newAnimalName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newCategory: LivestockCategory = {
      id: cleanId,
      label: newAnimalName.trim(),
      icon: '🐾',
    };
    setFormConfig(prev => ({
      ...prev,
      livestockCategories: [...prev.livestockCategories, newCategory],
    }));
    setNewAnimalName('');
  };

  const handleRemoveLivestockCategory = (id: string) => {
    setFormConfig(prev => ({
      ...prev,
      livestockCategories: prev.livestockCategories.filter(c => c.id !== id),
    }));
  };

  const handleAddMorningChecklist = () => {
    if (!newMorningTask.trim()) return;
    setFormConfig(prev => ({
      ...prev,
      customChecklistMorning: [...prev.customChecklistMorning, newMorningTask.trim()],
    }));
    setNewMorningTask('');
  };

  const handleRemoveMorningChecklist = (index: number) => {
    setFormConfig(prev => ({
      ...prev,
      customChecklistMorning: prev.customChecklistMorning.filter((_, i) => i !== index),
    }));
  };

  const handleAddEveningChecklist = () => {
    if (!newEveningTask.trim()) return;
    setFormConfig(prev => ({
      ...prev,
      customChecklistEvening: [...prev.customChecklistEvening, newEveningTask.trim()],
    }));
    setNewEveningTask('');
  };

  const handleRemoveEveningChecklist = (index: number) => {
    setFormConfig(prev => ({
      ...prev,
      customChecklistEvening: prev.customChecklistEvening.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#000000" />
        <Text className="font-extrabold text-black mt-3">Loading Reports / Chargement des rapports...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Top Header Tabs */}
      <View className="bg-black pt-2 pb-3 px-4 border-b-2 border-safety-yellow shadow-md">
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className="text-safety-yellow font-extrabold text-xl tracking-wide">
              {tenant?.name || 'Agbelouve Farm'}
            </Text>
            <Text className="text-gray-400 font-bold text-xs uppercase">Reports & Logs Hub</Text>
          </View>
          <View className="bg-safety-yellow px-3 py-1 rounded-full border border-black">
            <Text className="text-black font-extrabold text-xs uppercase">{currentUser?.role || 'ADMIN'}</Text>
          </View>
        </View>

        {/* Tab Selector Buttons */}
        <View className="flex-row bg-gray-900 p-1 rounded-xl border border-gray-800">
          <TouchableOpacity
            className={`flex-1 py-2 rounded-lg items-center ${
              activeTab === 'daily' ? 'bg-safety-yellow shadow' : 'bg-transparent'
            }`}
            onPress={() => setActiveTab('daily')}
          >
            <Text className={`font-extrabold text-xs ${activeTab === 'daily' ? 'text-black' : 'text-gray-400'}`}>
              DAILY LOGS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-2 rounded-lg items-center ${
              activeTab === 'weekly' ? 'bg-safety-yellow shadow' : 'bg-transparent'
            }`}
            onPress={() => setActiveTab('weekly')}
          >
            <Text className={`font-extrabold text-xs ${activeTab === 'weekly' ? 'text-black' : 'text-gray-400'}`}>
              WEEKLY SUMMARY
            </Text>
          </TouchableOpacity>

          {isOwnerOrAdmin && (
            <TouchableOpacity
              className={`flex-1 py-2 rounded-lg items-center ${
                activeTab === 'template' ? 'bg-safety-yellow shadow' : 'bg-transparent'
              }`}
              onPress={() => setActiveTab('template')}
            >
              <Text className={`font-extrabold text-xs ${activeTab === 'template' ? 'text-black' : 'text-gray-400'}`}>
                FORM SETTINGS
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY LOGS VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'daily' && (
        <ScrollView
          className="flex-1 p-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Search & Customizer Bar */}
          <View className="bg-white p-4 rounded-2xl border-2 border-gray-200 mb-4 shadow-sm">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="font-extrabold text-black text-base">Filter Logs / Filtrer</Text>
              <TouchableOpacity
                className="bg-purple-100 border border-purple-600 px-3 py-1.5 rounded-lg flex-row items-center"
                onPress={() => setViewCustomizerVisible(true)}
              >
                <Text className="text-purple-900 font-extrabold text-xs">⚙️ Customize View</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <TextInput
              className="bg-gray-100 border border-gray-300 rounded-xl px-4 py-2.5 text-black font-bold mb-3"
              placeholder="Search tasks, notes, keywords..."
              placeholderTextColor="#888888"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {/* Shift Filter Pills */}
            <View className="flex-row gap-2 mb-2">
              {(['ALL', 'MORNING', 'EVENING'] as const).map(shift => (
                <TouchableOpacity
                  key={shift}
                  className={`px-3 py-1.5 rounded-full border ${
                    shiftFilter === shift
                      ? 'bg-black border-black'
                      : 'bg-gray-100 border-gray-300'
                  }`}
                  onPress={() => setShiftFilter(shift)}
                >
                  <Text
                    className={`font-extrabold text-xs ${
                      shiftFilter === shift ? 'text-safety-yellow' : 'text-gray-700'
                    }`}
                  >
                    {shift === 'ALL' ? 'All Shifts' : shift === 'MORNING' ? '🌅 Morning' : '🌙 Evening'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date Range Pills */}
            <View className="flex-row gap-2">
              {(['ALL', 'TODAY', 'YESTERDAY', 'WEEK'] as const).map(df => (
                <TouchableOpacity
                  key={df}
                  className={`px-3 py-1 rounded-md border ${
                    selectedDateFilter === df
                      ? 'bg-safety-yellow border-black'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setSelectedDateFilter(df)}
                >
                  <Text className="font-extrabold text-xs text-black">
                    {df === 'ALL' ? 'All Dates' : df === 'TODAY' ? 'Today' : df === 'YESTERDAY' ? 'Yesterday' : 'Last 7 Days'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Logs Feed */}
          {filteredDailyLogs.length === 0 ? (
            <View className="bg-white p-8 rounded-2xl border-2 border-dashed border-gray-300 items-center justify-center my-6">
              <Text className="text-4xl mb-2">📋</Text>
              <Text className="text-black font-extrabold text-lg text-center">No logs match your filter</Text>
              <Text className="text-gray-500 font-bold text-xs text-center mt-1">
                Aucun rapport quotidien trouvé pour ces critères.
              </Text>
            </View>
          ) : (
            filteredDailyLogs.map(log => {
              const formattedDate = new Date(log.clientTimestamp || Date.now()).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <View
                  key={log.id}
                  className="bg-white rounded-2xl p-4 mb-4 border-2 border-gray-200 shadow-sm"
                >
                  {/* Card Header */}
                  <View className="flex-row items-center justify-between border-b border-gray-100 pb-3 mb-3">
                    <View className="flex-row items-center space-x-2">
                      <View
                        className={`px-3 py-1 rounded-full border ${
                          log.logType === 'MORNING'
                            ? 'bg-safety-yellow border-black'
                            : 'bg-black border-black'
                        }`}
                      >
                        <Text
                          className={`font-extrabold text-xs uppercase ${
                            log.logType === 'MORNING' ? 'text-black' : 'text-safety-yellow'
                          }`}
                        >
                          {log.logType}
                        </Text>
                      </View>
                      <Text className="text-gray-600 font-extrabold text-xs ml-2">{formattedDate}</Text>
                    </View>

                    {isOwnerOrAdmin && (
                      <TouchableOpacity
                        onPress={() => handleDeleteLog(log.id)}
                        className="bg-red-50 p-1.5 rounded-lg border border-red-200"
                      >
                        <Text className="text-red-600 font-extrabold text-xs">🗑️ Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Location & Geofence Section */}
                  {visibleSections.location && log.location && (
                    <View className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 mb-3 flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <Text className="text-sm mr-2">📍</Text>
                        <Text className="text-xs font-bold text-gray-700">
                          {log.location.latitude?.toFixed(4)}, {log.location.longitude?.toFixed(4)}
                        </Text>
                      </View>
                      <View
                        className={`px-2 py-0.5 rounded-full ${
                          log.location.isWithinGeofence ? 'bg-green-100' : 'bg-amber-100'
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-extrabold ${
                            log.location.isWithinGeofence ? 'text-green-800' : 'text-amber-800'
                          }`}
                        >
                          {log.location.isWithinGeofence ? 'Within Farm Geofence' : 'Off-Site Location'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Attendance Section */}
                  {visibleSections.attendance && log.attendance && Object.keys(log.attendance).length > 0 && (
                    <View className="mb-3">
                      <Text className="font-extrabold text-black text-xs uppercase mb-1.5">👥 Attendance / Présence</Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        {Object.entries(log.attendance).map(([workerKey, status]) => {
                          const cleanLabel = workerKey.replace('worker', 'W').replace('_', ' ');
                          const isPresent = status === 'PRESENT';
                          return (
                            <View
                              key={workerKey}
                              className={`px-2.5 py-1 rounded-lg border flex-row items-center ${
                                isPresent
                                  ? 'bg-green-50 border-green-300'
                                  : 'bg-red-50 border-red-300'
                              }`}
                            >
                              <Text
                                className={`font-extrabold text-xs mr-1 ${
                                  isPresent ? 'text-green-800' : 'text-red-800'
                                }`}
                              >
                                {cleanLabel}:
                              </Text>
                              <Text
                                className={`font-bold text-xs ${
                                  isPresent ? 'text-green-700' : 'text-red-700'
                                }`}
                              >
                                {status}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Livestock Section */}
                  {visibleSections.livestock && log.livestock && (
                    <View className="mb-3">
                      <Text className="font-extrabold text-black text-xs uppercase mb-1.5">🐐 Livestock Population</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {Object.entries(log.livestock).map(([animalKey, count]) => {
                          if (typeof count !== 'number') return null;
                          const cleanName = animalKey.replace('Total', '').replace('_', ' ');
                          return (
                            <View
                              key={animalKey}
                              className="bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-xl flex-row items-center"
                            >
                              <Text className="font-extrabold text-amber-950 text-xs uppercase mr-1">
                                {cleanName}:
                              </Text>
                              <Text className="font-extrabold text-amber-900 text-sm">{count}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Operations & Tasks Section */}
                  {visibleSections.operations && log.operations && (
                    <View className="bg-gray-50 p-3 rounded-xl border border-gray-200 mb-3">
                      <Text className="font-extrabold text-black text-xs uppercase mb-1">🚜 Operations & Tasks</Text>
                      {log.operations.plannedTasks ? (
                        <Text className="text-gray-800 font-bold text-xs mb-1">
                          <Text className="font-extrabold text-blue-900">Planned:</Text> {log.operations.plannedTasks}
                        </Text>
                      ) : null}
                      {log.operations.completedTasks ? (
                        <Text className="text-gray-800 font-bold text-xs mb-1">
                          <Text className="font-extrabold text-green-900">Completed:</Text>{' '}
                          {log.operations.completedTasks}
                        </Text>
                      ) : null}
                      {log.operations.tractorFuelLevel && log.operations.tractorFuelLevel !== 'N/A' && (
                        <Text className="text-gray-600 font-bold text-xs">
                          ⛽ Fuel Level: {log.operations.tractorFuelLevel}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Financials Section */}
                  {visibleSections.financials && log.financials && Number(log.financials.amountSpentXOF || 0) > 0 && (
                    <View className="bg-purple-50 p-3 rounded-xl border border-purple-200 mb-3 flex-row justify-between items-center">
                      <View>
                        <Text className="font-extrabold text-purple-950 text-xs uppercase">💰 Expenses Logged</Text>
                        <Text className="text-purple-800 font-bold text-xs">
                          {log.financials.expenseReason || 'Operational expense'}
                        </Text>
                      </View>
                      <View className="bg-purple-200 px-3 py-1 rounded-lg">
                        <Text className="text-purple-950 font-extrabold text-sm">
                          {Number(log.financials.amountSpentXOF).toLocaleString()} XOF
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Media Attachments Section */}
                  {visibleSections.media && log.mediaUrls && (
                    <View className="mb-2">
                      {log.mediaUrls.photos && log.mediaUrls.photos.length > 0 && (
                        <View className="mb-2">
                          <Text className="font-extrabold text-black text-xs uppercase mb-1">
                            📸 Photos ({log.mediaUrls.photos.length})
                          </Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                            {log.mediaUrls.photos.map((uri, idx) => (
                              <TouchableOpacity key={idx} onPress={() => setZoomPhotoUrl(uri)}>
                                <Image
                                  source={{ uri }}
                                  className="w-20 h-20 rounded-xl border border-gray-300 mr-2"
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      <View className="flex-row gap-2 mt-1">
                        {log.mediaUrls.video ? (
                          <View className="bg-black px-3 py-1.5 rounded-lg flex-row items-center border border-safety-yellow">
                            <Text className="text-safety-yellow font-extrabold text-xs mr-1">🎥</Text>
                            <Text className="text-white font-extrabold text-xs">Video Attached</Text>
                          </View>
                        ) : null}

                        {log.mediaUrls.voice ? (
                          <View className="bg-gray-200 px-3 py-1.5 rounded-lg flex-row items-center border border-gray-400">
                            <Text className="text-black font-extrabold text-xs mr-1">🎙️</Text>
                            <Text className="text-black font-extrabold text-xs">Audio Note</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  )}

                  {/* Manager Notes */}
                  {visibleSections.notes && log.managerNotes ? (
                    <View className="bg-yellow-50 p-2.5 rounded-xl border border-yellow-200 mt-2">
                      <Text className="font-extrabold text-yellow-950 text-xs uppercase mb-0.5">📝 Notes</Text>
                      <Text className="text-yellow-900 font-medium text-xs">{log.managerNotes}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: WEEKLY SUMMARY VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'weekly' && (
        <ScrollView
          className="flex-1 p-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Week Navigation Selector */}
          <View className="bg-black p-4 rounded-2xl border-2 border-safety-yellow mb-4 shadow-md">
            <View className="flex-row items-center justify-between mb-2">
              <TouchableOpacity
                className="bg-gray-800 px-3 py-2 rounded-xl border border-safety-yellow"
                onPress={() => setWeekOffset(prev => prev - 1)}
              >
                <Text className="text-safety-yellow font-extrabold text-xs">◀ Prev Week</Text>
              </TouchableOpacity>

              <View className="items-center">
                <Text className="text-safety-yellow font-extrabold text-base">
                  {weeklyData.monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                  {weeklyData.sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <Text className="text-gray-400 font-bold text-xs mt-0.5">
                  {weekOffset === 0 ? 'Current Week / Semaine en cours' : `Week Offset: ${weekOffset}`}
                </Text>
              </View>

              <TouchableOpacity
                className={`px-3 py-2 rounded-xl border ${
                  weekOffset >= 0 ? 'bg-gray-900 border-gray-700 opacity-50' : 'bg-gray-800 border-safety-yellow'
                }`}
                disabled={weekOffset >= 0}
                onPress={() => setWeekOffset(prev => prev + 1)}
              >
                <Text className="text-safety-yellow font-extrabold text-xs">Next Week ▶</Text>
              </TouchableOpacity>
            </View>

            {weekOffset !== 0 && (
              <TouchableOpacity
                className="bg-safety-yellow py-1.5 rounded-lg items-center mt-2"
                onPress={() => setWeekOffset(0)}
              >
                <Text className="text-black font-extrabold text-xs uppercase">Jump to Current Week</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Aggregated KPI Cards */}
          <View className="flex-row flex-wrap gap-2 mb-4">
            {/* Shifts Logged */}
            <View className="flex-1 min-w-[45%] bg-white p-4 rounded-2xl border-2 border-gray-200 shadow-sm">
              <Text className="text-gray-500 font-extrabold text-xs uppercase">Shifts Logged</Text>
              <Text className="text-black font-extrabold text-3xl mt-1">{weeklyData.totalShifts}</Text>
              <Text className="text-xs font-bold text-gray-500 mt-1">
                🌅 {weeklyData.totalMorningShifts} Morn / 🌙 {weeklyData.totalEveningShifts} Eve
              </Text>
            </View>

            {/* Attendance Rate */}
            <View className="flex-1 min-w-[45%] bg-white p-4 rounded-2xl border-2 border-gray-200 shadow-sm">
              <Text className="text-gray-500 font-extrabold text-xs uppercase">Attendance Rate</Text>
              <Text className="text-green-700 font-extrabold text-3xl mt-1">{weeklyData.attendanceRate}%</Text>
              <Text className="text-xs font-bold text-gray-500 mt-1">Present on duty</Text>
            </View>

            {/* Total Expenses */}
            <View className="w-full bg-purple-900 p-4 rounded-2xl border-2 border-black shadow-md flex-row justify-between items-center">
              <View>
                <Text className="text-purple-200 font-extrabold text-xs uppercase">Total Weekly Expenses</Text>
                <Text className="text-white font-extrabold text-2xl mt-0.5">
                  {weeklyData.totalExpensesXOF.toLocaleString()} XOF
                </Text>
              </View>
              <View className="bg-safety-yellow px-3 py-1.5 rounded-xl">
                <Text className="text-black font-extrabold text-xs">FINANCIALS</Text>
              </View>
            </View>
          </View>

          {/* Weekly Livestock Status */}
          {Object.keys(weeklyData.latestLivestock).length > 0 && (
            <View className="bg-white p-4 rounded-2xl border-2 border-gray-200 mb-4 shadow-sm">
              <Text className="font-extrabold text-black text-sm uppercase mb-3">🐐 Latest Livestock Tally</Text>
              <View className="flex-row flex-wrap gap-2">
                {Object.entries(weeklyData.latestLivestock).map(([k, val]) => (
                  <View key={k} className="bg-amber-50 border border-amber-300 px-3.5 py-2 rounded-xl flex-row items-center">
                    <Text className="text-amber-950 font-extrabold text-xs uppercase mr-1.5">
                      {k.replace('Total', '')}:
                    </Text>
                    <Text className="text-amber-900 font-extrabold text-base">{val}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 7-Day Shift Timeline */}
          <View className="bg-white p-4 rounded-2xl border-2 border-gray-200 mb-8 shadow-sm">
            <Text className="font-extrabold text-black text-sm uppercase mb-3">📅 7-Day Shift Breakdown</Text>
            <View className="space-y-2 flex-col gap-2">
              {weeklyData.daysList.map((day, idx) => (
                <View
                  key={idx}
                  className="flex-row items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200"
                >
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-lg bg-black items-center justify-center mr-3">
                      <Text className="text-safety-yellow font-extrabold text-xs">{day.dayName}</Text>
                    </View>
                    <View>
                      <Text className="text-black font-extrabold text-sm">{day.dateStr}</Text>
                      <Text className="text-gray-500 font-bold text-xs">{day.logs.length} Log(s) recorded</Text>
                    </View>
                  </View>

                  <View className="flex-row gap-1.5">
                    <View
                      className={`px-2 py-1 rounded-md border ${
                        day.hasMorning
                          ? 'bg-safety-yellow border-black'
                          : 'bg-gray-200 border-gray-300 opacity-40'
                      }`}
                    >
                      <Text className="text-[10px] font-extrabold text-black">AM</Text>
                    </View>

                    <View
                      className={`px-2 py-1 rounded-md border ${
                        day.hasEvening
                          ? 'bg-black border-black'
                          : 'bg-gray-200 border-gray-300 opacity-40'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-extrabold ${
                          day.hasEvening ? 'text-safety-yellow' : 'text-gray-400'
                        }`}
                      >
                        PM
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: FORM TEMPLATE CUSTOMIZATION (OWNER/ADMIN ONLY) */}
      {/* ========================================================================= */}
      {activeTab === 'template' && isOwnerOrAdmin && (
        <ScrollView className="flex-1 p-4">
          <View className="bg-white p-5 rounded-2xl border-2 border-gray-200 mb-4 shadow-sm">
            <Text className="font-extrabold text-black text-lg mb-1">Custom Form Template</Text>
            <Text className="text-gray-500 font-bold text-xs mb-4">
              Configure which sections, livestock types, and checklists appear on worker shift logs.
            </Text>

            {/* 1. Toggleable Sections */}
            <Text className="font-extrabold text-black text-sm uppercase mb-3 border-b pb-1">
              1. Enable / Disable Form Sections
            </Text>

            <View className="space-y-3 flex-col gap-3 mb-6">
              {[
                { key: 'attendance', label: '👥 Attendance Tracking', desc: 'Worker roll-call statuses' },
                { key: 'livestock', label: '🐐 Livestock Populations', desc: 'Daily herd/flock counts' },
                { key: 'operations', label: '🚜 Equipment & Operations', desc: 'Planned/completed tasks & fuel' },
                { key: 'financials', label: '💰 Financials & Expenses', desc: 'Field XOF spend tracking' },
                { key: 'photos', label: '📸 Photo Attachments', desc: 'Camera capture verification' },
                { key: 'video', label: '🎥 Video Recording', desc: 'Field video capture' },
                { key: 'voice', label: '🎙️ Voice Audio Notes', desc: 'Spoken shift notes' },
                { key: 'gps', label: '📍 GPS Geofencing', desc: 'Location tag validation' },
              ].map(sec => (
                <View key={sec.key} className="flex-row items-center justify-between p-2 rounded-xl bg-gray-50">
                  <View className="flex-1 pr-2">
                    <Text className="text-black font-extrabold text-xs">{sec.label}</Text>
                    <Text className="text-gray-500 text-[10px] font-bold">{sec.desc}</Text>
                  </View>
                  <Switch
                    value={(formConfig.enabledSections as any)[sec.key]}
                    onValueChange={val =>
                      setFormConfig(prev => ({
                        ...prev,
                        enabledSections: {
                          ...prev.enabledSections,
                          [sec.key]: val,
                        },
                      }))
                    }
                    trackColor={{ false: '#CCCCCC', true: '#FFCC00' }}
                    thumbColor={(formConfig.enabledSections as any)[sec.key] ? '#000000' : '#888888'}
                  />
                </View>
              ))}
            </View>

            {/* 2. Dynamic Livestock Categories */}
            <Text className="font-extrabold text-black text-sm uppercase mb-3 border-b pb-1">
              2. Dynamic Livestock Categories
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {formConfig.livestockCategories.map(cat => (
                <View
                  key={cat.id}
                  className="bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-xl flex-row items-center"
                >
                  <Text className="text-black font-extrabold text-xs mr-2">
                    {cat.icon || '🐾'} {cat.label}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemoveLivestockCategory(cat.id)}>
                    <Text className="text-red-600 font-extrabold text-xs ml-1">✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Add Livestock Category Input */}
            <View className="flex-row gap-2 mb-6">
              <TextInput
                className="flex-1 bg-gray-100 border border-gray-300 rounded-xl px-4 py-2 text-black font-bold text-xs"
                placeholder="e.g. Sheep / Moutons, Pigs, Fish..."
                placeholderTextColor="#888888"
                value={newAnimalName}
                onChangeText={setNewAnimalName}
              />
              <TouchableOpacity
                className="bg-black px-4 py-2 rounded-xl items-center justify-center border border-safety-yellow"
                onPress={handleAddLivestockCategory}
              >
                <Text className="text-safety-yellow font-extrabold text-xs">+ Add</Text>
              </TouchableOpacity>
            </View>

            {/* 3. Media Submission Rules */}
            <Text className="font-extrabold text-black text-sm uppercase mb-3 border-b pb-1">
              3. Media Submission Requirements
            </Text>
            <View className="mb-6">
              <Text className="text-gray-700 font-extrabold text-xs mb-2">Minimum Required Photos:</Text>
              <View className="flex-row gap-2">
                {[1, 2, 3].map(num => (
                  <TouchableOpacity
                    key={num}
                    className={`flex-1 py-2 rounded-xl border items-center ${
                      formConfig.minPhotos === num
                        ? 'bg-safety-yellow border-black shadow-sm'
                        : 'bg-gray-100 border-gray-300'
                    }`}
                    onPress={() => setFormConfig(prev => ({ ...prev, minPhotos: num }))}
                  >
                    <Text className="font-extrabold text-xs text-black">{num} Photo(s)</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 4. Custom Task Checklists */}
            <Text className="font-extrabold text-black text-sm uppercase mb-3 border-b pb-1">
              4. Quick-Tap Task Checklists
            </Text>

            {/* Morning Checklist */}
            <View className="mb-4">
              <Text className="font-extrabold text-black text-xs uppercase mb-2">🌅 Morning Shift Tasks:</Text>
              {formConfig.customChecklistMorning.map((task, idx) => (
                <View key={idx} className="flex-row items-center justify-between bg-gray-50 p-2 rounded-lg mb-1.5 border border-gray-200">
                  <Text className="text-gray-800 font-bold text-xs flex-1 mr-2">• {task}</Text>
                  <TouchableOpacity onPress={() => handleRemoveMorningChecklist(idx)}>
                    <Text className="text-red-500 font-bold text-xs">✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View className="flex-row gap-2 mt-1">
                <TextInput
                  className="flex-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-1.5 text-black font-bold text-xs"
                  placeholder="Add morning task..."
                  value={newMorningTask}
                  onChangeText={setNewMorningTask}
                />
                <TouchableOpacity
                  className="bg-gray-800 px-3 py-1.5 rounded-lg items-center justify-center"
                  onPress={handleAddMorningChecklist}
                >
                  <Text className="text-white font-extrabold text-xs">+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Evening Checklist */}
            <View className="mb-6">
              <Text className="font-extrabold text-black text-xs uppercase mb-2">🌙 Evening Shift Tasks:</Text>
              {formConfig.customChecklistEvening.map((task, idx) => (
                <View key={idx} className="flex-row items-center justify-between bg-gray-50 p-2 rounded-lg mb-1.5 border border-gray-200">
                  <Text className="text-gray-800 font-bold text-xs flex-1 mr-2">• {task}</Text>
                  <TouchableOpacity onPress={() => handleRemoveEveningChecklist(idx)}>
                    <Text className="text-red-500 font-bold text-xs">✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View className="flex-row gap-2 mt-1">
                <TextInput
                  className="flex-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-1.5 text-black font-bold text-xs"
                  placeholder="Add evening task..."
                  value={newEveningTask}
                  onChangeText={setNewEveningTask}
                />
                <TouchableOpacity
                  className="bg-gray-800 px-3 py-1.5 rounded-lg items-center justify-center"
                  onPress={handleAddEveningChecklist}
                >
                  <Text className="text-white font-extrabold text-xs">+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Save Template Button */}
            <TouchableOpacity
              className="bg-black py-4 rounded-xl items-center justify-center border-2 border-safety-yellow shadow-lg"
              disabled={savingTemplate}
              onPress={handleSaveTemplate}
            >
              {savingTemplate ? (
                <ActivityIndicator color="#FFCC00" />
              ) : (
                <Text className="text-safety-yellow font-extrabold text-base tracking-wider">
                  SAVE FORM TEMPLATE / ENREGISTRER
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: VIEW CUSTOMIZER (DAILY LOGS SECTIONS TOGGLE) */}
      {/* ========================================================================= */}
      <Modal visible={viewCustomizerVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-6 border-t-4 border-safety-yellow">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="font-extrabold text-black text-lg">Customize Daily Log View</Text>
              <TouchableOpacity onPress={() => setViewCustomizerVisible(false)}>
                <Text className="text-black font-extrabold text-base">✕</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-gray-500 font-bold text-xs mb-4">
              Toggle which card sections are visible on your daily log feed.
            </Text>

            <View className="space-y-3 flex-col gap-2.5 mb-6">
              {[
                { key: 'attendance', label: '👥 Worker Attendance' },
                { key: 'livestock', label: '🐐 Livestock Population Tallies' },
                { key: 'operations', label: '🚜 Operations & Planned Tasks' },
                { key: 'financials', label: '💰 Expenses & Financials' },
                { key: 'media', label: '📸 Photos & Media Attachments' },
                { key: 'location', label: '📍 GPS Location Coordinates' },
                { key: 'notes', label: '📝 Manager Notes' },
              ].map(item => (
                <View key={item.key} className="flex-row items-center justify-between py-1.5 border-b border-gray-100">
                  <Text className="font-extrabold text-black text-sm">{item.label}</Text>
                  <Switch
                    value={(visibleSections as any)[item.key]}
                    onValueChange={val =>
                      setVisibleSections(prev => ({ ...prev, [item.key]: val }))
                    }
                    trackColor={{ false: '#CCCCCC', true: '#FFCC00' }}
                    thumbColor={(visibleSections as any)[item.key] ? '#000000' : '#888888'}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity
              className="bg-black py-3.5 rounded-xl items-center border-2 border-safety-yellow"
              onPress={() => setViewCustomizerVisible(false)}
            >
              <Text className="text-safety-yellow font-extrabold text-sm">APPLY VIEW / APPLIQUER</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: FULL PHOTO ZOOM MODAL */}
      {/* ========================================================================= */}
      <Modal visible={!!zoomPhotoUrl} transparent animationType="fade">
        <View className="flex-1 bg-black/90 items-center justify-center p-4">
          <TouchableOpacity
            className="absolute top-12 right-6 bg-gray-800 p-3 rounded-full z-10"
            onPress={() => setZoomPhotoUrl(null)}
          >
            <Text className="text-white font-extrabold text-lg">✕</Text>
          </TouchableOpacity>
          {zoomPhotoUrl && (
            <Image
              source={{ uri: zoomPhotoUrl }}
              className="w-full h-4/5 rounded-2xl"
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
