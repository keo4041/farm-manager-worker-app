import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'fr' | 'en';

const LANGUAGE_KEY = '@farm_manager_language';

export const translations = {
  en: {
    // Common / Navigation
    appName: 'AGBELOUVE FARM',
    appSubtitle: 'FARM MANAGER',
    portalSubtitle: 'Worker & Manager Portal',
    loading: 'Loading...',
    loadingSession: 'Loading session...',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    remove: 'Remove',
    retry: 'Retry',
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    continue: 'Continue',
    back: 'Back',
    all: 'All',
    close: 'Close',
    apply: 'Apply',
    submit: 'Submit',

    // Dashboard (index.tsx)
    workerPortal: 'Worker Portal',
    farmCode: 'Farm Code',
    allMediaSynced: 'All Media Synced',
    mediaPending: '{{count}} Media Item(s) Pending',
    offlineReady: 'Offline Ready',
    reportsAndLogs: 'REPORTS & LOGS',
    reportsSubtitle: 'Daily timeline, weekly rollup & customizable view',
    viewHub: 'VIEW HUB 📊',
    teamManagement: 'TEAM MANAGEMENT',
    teamSubtitle: 'Manage Admins, Supervisors & Workers',
    usersAndQuotas: 'USERS & QUOTAS',
    startMorningLog: 'START MORNING LOG',
    startMorningLogSub: 'Morning field inspection & tasks',
    startEveningLog: 'START EVENING LOG',
    startEveningLogSub: 'Evening tally & tools return',
    viewSyncQueue: 'View Sync Queue',
    logOut: 'Log Out',
    logOutConfirmTitle: 'Log Out',
    logOutConfirmMsg: 'Are you sure you want to log out?',

    // Login (login.tsx)
    loginTitle: 'LOGIN',
    emailOrUsername: 'Email or Username',
    emailPlaceholder: 'e.g. koffi or manager@farm.com',
    emailLoginBadge: 'EMAIL LOGIN',
    usernameLoginBadge: 'WORKER USERNAME',
    farmCodeRequiredHint: 'Ask your farm owner/manager for your 6-8 character farm code (e.g. AGBE4921).',
    farmCodePlaceholder: 'e.g. AGBE4921',
    password: 'Password',
    passwordMinLength: 'Password must be at least 6 characters.',
    enterEmailOrUsername: 'Please enter your email or username.',
    enterPassword: 'Please enter your password.',
    enterFarmCode: 'Farm Code is required for username login.',
    farmNotFound: 'Farm with code "{{code}}" not found. Please verify with your admin.',
    invalidCredentials: 'Invalid credentials or Farm Code. Please check your details.',
    registerNewTenant: 'Register New Farm Tenant',

    // Register Tenant (register-tenant.tsx)
    registerTitle: 'REGISTER FARM TENANT',
    registerSubtitle: 'Create a new farm and owner account',
    farmDetailsHeader: 'FARM DETAILS',
    farmOrgName: 'Farm Organization Name *',
    farmOrgPlaceholder: 'e.g. Agbelouve Teak & Livestock Farm',
    ownerName: 'Owner Name',
    ownerNamePlaceholder: 'e.g. Jean Dupont',
    ownerEmail: 'Owner Email *',
    ownerPassword: 'Owner Password *',
    initialTeamHeader: 'INITIAL TEAM MEMBERS (OPTIONAL)',
    initialTeamSubtitle: 'You can pre-add Admins, Supervisors, or Workers with email or username.',
    createTenantBtn: 'CREATE TENANT ACCOUNT',
    tenantCreatedTitle: 'Tenant Account Created!',
    tenantCreatedMsg: 'Welcome to {{farmName}}!\n\nYour Farm Code is: {{farmCode}}\n\nShare this Farm Code with your workers so they can log in using their username.',

    // Team Management (team-management.tsx)
    teamTitle: 'Team Members',
    addUser: '+ ADD USER',
    addMemberModalTitle: 'Add Team Member',
    accountType: 'Account Type',
    usernameNoEmail: 'USERNAME (No Email)',
    emailAddress: 'EMAIL ADDRESS',
    fullName: 'Full Name',
    usernameLabel: 'Username *',
    usernamePlaceholder: 'e.g. koffi',
    workerLoginHint: 'Worker logs in with: Farm Code ({{code}}) + Username + Password',
    selectRole: 'Select Role',
    saveUser: 'SAVE USER',
    userAddedSuccess: 'User {{name}} added as {{role}}!',

    // Form Wizard (form-wizard.tsx)
    morningShiftTitle: '🌅 MORNING SHIFT',
    eveningShiftTitle: '🌙 EVENING SHIFT',
    morningSubtitle: 'Morning report',
    eveningSubtitle: 'Evening report',
    gpsOk: '📍 GPS OK',
    noGps: '⚠️ NO GPS',
    attendanceHeader: '👥 Attendance',
    present: 'PRESENT',
    absent: 'ABSENT',
    sick: 'SICK',
    livestockHeader: '🐐 Livestock Population',
    operationsMorning: '🚜 Planned Tasks',
    operationsEvening: '🚜 Completed Tasks',
    quickChecklist: 'Quick Checklist (Tap to add):',
    taskPlaceholder: 'Type task details or tap checklist chips above...',
    expensesHeader: '💰 Field Expenses (XOF)',
    amountSpentPlaceholder: 'Amount spent in XOF (e.g. 5000)...',
    expenseReasonPlaceholder: 'Expense reason (e.g. Fuel purchase, emergency medicine)...',
    notesHeader: '📝 Manager Notes',
    notesPlaceholder: 'Issues, animal health, weather observations...',
    mediaHeader: '📸 Media Verification',
    takePhoto: '📷 TAKE PHOTO ({{count}}/{{min}} required)',
    recordVideo: '🎥 RECORD SHORT VIDEO',
    videoRecorded: '✓ VIDEO RECORDED',
    recordVoice: '🎙️ RECORD VOICE NOTE',
    stopRecording: '🛑 STOP RECORDING',
    voiceSaved: '✓ AUDIO NOTE SAVED',
    playVoice: '▶ PLAY PREVIEW',
    pauseVoice: '⏸ PAUSE',
    deleteVoice: '🗑️ DELETE AUDIO',
    submitLog: 'SUBMIT LOG',
    submittingMedia: 'STREAMING MEDIA',
    uploadSuccess: 'Daily log & all media uploaded successfully!',
    offlineSaved: '{{count}} media file(s) saved in offline queue. Upload will complete automatically when connection is restored.',
    photoRequirementError: 'Please take at least {{min}} photo(s).',
    videoRequirementError: 'Video recording is required for this log.',
    voiceRequirementError: 'Voice audio note is required for this log.',

    // Sync Status (sync-status.tsx)
    syncQueueTitle: 'Sync Queue',
    clearCompleted: 'Clear Completed',
    syncNow: 'SYNC NOW',
    retryAndSync: 'RETRY {{count}} FAILED & SYNC',
    uploadingMediaBtn: 'UPLOADING MEDIA...',
    noPendingUploads: 'No Pending Uploads 🎉',
    allSyncedDesc: 'All farm log media files are synced.',
  },
  fr: {
    // Common / Navigation
    appName: 'FERME D\'AGBELOUVE',
    appSubtitle: 'GESTIONNAIRE AGRICOLE',
    portalSubtitle: 'Portail Ouvriers & Gestionnaires',
    loading: 'Chargement...',
    loadingSession: 'Chargement de la session...',
    cancel: 'Annuler',
    save: 'Enregistrer',
    delete: 'Supprimer',
    remove: 'Retirer',
    retry: 'Réessayer',
    success: 'Succès',
    error: 'Erreur',
    warning: 'Attention',
    continue: 'Continuer',
    back: 'Retour',
    all: 'Tous',
    close: 'Fermer',
    apply: 'Appliquer',
    submit: 'Envoyer',

    // Dashboard (index.tsx)
    workerPortal: 'Portail Ouvrier',
    farmCode: 'Code Ferme',
    allMediaSynced: 'Tous les médias synchronisés',
    mediaPending: '{{count}} Média(s) en attente',
    offlineReady: 'Prêt hors-ligne',
    reportsAndLogs: 'RAPPORTS & JOURNAUX',
    reportsSubtitle: 'Fil chronologique, synthèse hebdo & vue personnalisable',
    viewHub: 'VOIR LES RAPPORTS 📊',
    teamManagement: 'GESTION D\'ÉQUIPE',
    teamSubtitle: 'Gérer Administrateurs, Superviseurs & Ouvriers',
    usersAndQuotas: 'UTILISATEURS & QUOTAS',
    startMorningLog: 'RAPPORT DU MATIN',
    startMorningLogSub: 'Inspection du matin & tâches prévues',
    startEveningLog: 'RAPPORT DU SOIR',
    startEveningLogSub: 'Bilan du soir & retour des outils',
    viewSyncQueue: 'File d\'attente de synchronisation',
    logOut: 'Déconnexion',
    logOutConfirmTitle: 'Déconnexion',
    logOutConfirmMsg: 'Voulez-vous vraiment vous déconnecter ?',

    // Login (login.tsx)
    loginTitle: 'CONNEXION',
    emailOrUsername: 'Email ou Nom d\'utilisateur',
    emailPlaceholder: 'ex. koffi ou responsable@ferme.com',
    emailLoginBadge: 'CONNEXION EMAIL',
    usernameLoginBadge: 'NOM D\'UTILISATEUR',
    farmCodeRequiredHint: 'Demandez à votre propriétaire/gérant votre code ferme de 6 à 8 caractères (ex. AGBE4921).',
    farmCodePlaceholder: 'ex. AGBE4921',
    password: 'Mot de passe',
    passwordMinLength: 'Le mot de passe doit comporter au moins 6 caractères.',
    enterEmailOrUsername: 'Veuillez entrer votre email ou nom d\'utilisateur.',
    enterPassword: 'Veuillez entrer votre mot de passe.',
    enterFarmCode: 'Le Code Ferme est obligatoire pour la connexion par nom d\'utilisateur.',
    farmNotFound: 'Ferme avec le code "{{code}}" introuvable. Veuillez vérifier avec votre administrateur.',
    invalidCredentials: 'Identifiants ou Code Ferme invalides. Veuillez vérifier vos données.',
    registerNewTenant: 'Créer une Nouvelle Ferme',

    // Register Tenant (register-tenant.tsx)
    registerTitle: 'ENREGISTRER UNE FERME',
    registerSubtitle: 'Créer une nouvelle ferme et compte propriétaire',
    farmDetailsHeader: 'COORDONNÉES DE LA FERME',
    farmOrgName: 'Nom de l\'exploitation agricole *',
    farmOrgPlaceholder: 'ex. Ferme Agro-pastorale d\'Agbelouve',
    ownerName: 'Nom du Propriétaire',
    ownerNamePlaceholder: 'ex. Jean Dupont',
    ownerEmail: 'Email du Propriétaire *',
    ownerPassword: 'Mot de passe Propriétaire *',
    initialTeamHeader: 'MEMBRES DE L\'ÉQUIPE INITIALE (OPTIONNEL)',
    initialTeamSubtitle: 'Vous pouvez pré-ajouter des Administrateurs, Superviseurs ou Ouvriers par email ou nom d\'utilisateur.',
    createTenantBtn: 'CRÉER LE COMPTE FERME',
    tenantCreatedTitle: 'Compte Ferme Créé !',
    tenantCreatedMsg: 'Bienvenue sur {{farmName}} !\n\nVotre Code Ferme est : {{farmCode}}\n\nPartagez ce Code Ferme avec vos ouvriers pour qu\'ils puissent se connecter avec leur nom d\'utilisateur.',

    // Team Management (team-management.tsx)
    teamTitle: 'Membres de l\'Équipe',
    addUser: '+ AJOUTER',
    addMemberModalTitle: 'Ajouter un Collaborateur',
    accountType: 'Type de Compte',
    usernameNoEmail: 'NOM D\'UTILISATEUR (Sans email)',
    emailAddress: 'ADRESSE EMAIL',
    fullName: 'Nom Complet',
    usernameLabel: 'Nom d\'utilisateur *',
    usernamePlaceholder: 'ex. koffi',
    workerLoginHint: 'L\'ouvrier se connecte avec : Code Ferme ({{code}}) + Nom d\'utilisateur + Mot de passe',
    selectRole: 'Sélectionner le Rôle',
    saveUser: 'ENREGISTRER',
    userAddedSuccess: 'Utilisateur {{name}} ajouté comme {{role}} !',

    // Form Wizard (form-wizard.tsx)
    morningShiftTitle: '🌅 RAPPORT DU MATIN',
    eveningShiftTitle: '🌙 RAPPORT DU SOIR',
    morningSubtitle: 'Inspection matinale',
    eveningSubtitle: 'Bilan de fin de journée',
    gpsOk: '📍 GPS ACTIF',
    noGps: '⚠️ PAS DE GPS',
    attendanceHeader: '👥 Présence des Ouvriers',
    present: 'PRÉSENT',
    absent: 'ABSENT',
    sick: 'MALADE',
    livestockHeader: '🐐 Effectif du Cheptel',
    operationsMorning: '🚜 Tâches Prévues',
    operationsEvening: '🚜 Tâches Réalisées',
    quickChecklist: 'Liste Rapide (Tapez pour ajouter) :',
    taskPlaceholder: 'Saisissez les détails ou tapez sur les tâches suggérées ci-dessus...',
    expensesHeader: '💰 Dépenses Terrain (FCFA / XOF)',
    amountSpentPlaceholder: 'Montant dépensé en FCFA (ex. 5000)...',
    expenseReasonPlaceholder: 'Motif de la dépense (ex. Achat carburant, soins d\'urgence)...',
    notesHeader: '📝 Remarques du Responsable',
    notesPlaceholder: 'Incidents, santé animale, météo...',
    mediaHeader: '📸 Vérification Médias',
    takePhoto: '📷 PRENDRE PHOTO ({{count}}/{{min}} requis)',
    recordVideo: '🎥 ENREGISTRER UNE VIDÉO',
    videoRecorded: '✓ VIDÉO ENREGISTRÉE',
    recordVoice: '🎙️ ENREGISTRER NOTE VOCALE',
    stopRecording: '🛑 ARRÊTER L\'ENREGISTREMENT',
    voiceSaved: '✓ NOTE VOCALE ENREGISTRÉE',
    playVoice: '▶ ÉCOUTER L\'APERÇU',
    pauseVoice: '⏸ PAUSE',
    deleteVoice: '🗑️ SUPPRIMER VOCAL',
    submitLog: 'ENVOYER LE RAPPORT',
    submittingMedia: 'ENVOI DES MÉDIAS',
    uploadSuccess: 'Rapport quotidien et médias téléversés avec succès !',
    offlineSaved: '{{count}} fichier(s) média enregistrés hors-ligne. L\'envoi s\'effectuera automatiquement dès le retour du réseau.',
    photoRequirementError: 'Veuillez prendre au moins {{min}} photo(s).',
    videoRequirementError: 'L\'enregistrement vidéo est obligatoire pour ce rapport.',
    voiceRequirementError: 'La note vocale est obligatoire pour ce rapport.',

    // Sync Status (sync-status.tsx)
    syncQueueTitle: 'File de Synchronisation',
    clearCompleted: 'Effacer Terminés',
    syncNow: 'SYNCHRONISER MAINTENANT',
    retryAndSync: 'RÉESSAYER {{count}} ÉCHECS & SYNC',
    uploadingMediaBtn: 'ENVOI DES MÉDIAS...',
    noPendingUploads: 'Aucun média en attente 🎉',
    allSyncedDesc: 'Tous les fichiers médias sont synchronisés.',
  },
};

let currentLanguage: Language = 'fr';
const listeners: Array<(lang: Language) => void> = [];

export const getLanguage = (): Language => currentLanguage;

export const setLanguage = async (lang: Language): Promise<void> => {
  currentLanguage = lang;
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch (e) {
    console.warn('Failed to save language preference', e);
  }
  listeners.forEach(cb => cb(lang));
};

export const initLanguage = async (): Promise<Language> => {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (saved === 'fr' || saved === 'en') {
      currentLanguage = saved;
    }
  } catch (e) {
    console.warn('Failed to load language preference', e);
  }
  return currentLanguage;
};

export const t = (key: keyof typeof translations.en, params?: Record<string, string | number>): string => {
  const dict = translations[currentLanguage] || translations.fr;
  let text = (dict as any)[key] || (translations.en as any)[key] || key;
  if (params) {
    Object.entries(params).forEach(([pKey, pVal]) => {
      text = text.replace(new RegExp(`{{${pKey}}}`, 'g'), String(pVal));
    });
  }
  return text;
};

export const useTranslation = () => {
  const [lang, setLangState] = useState<Language>(currentLanguage);

  useEffect(() => {
    initLanguage().then(l => setLangState(l));
    const listener = (newLang: Language) => setLangState(newLang);
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, []);

  const changeLanguage = (newLang: Language) => {
    setLanguage(newLang);
  };

  return {
    t,
    currentLanguage: lang,
    changeLanguage,
    isFrench: lang === 'fr',
  };
};
