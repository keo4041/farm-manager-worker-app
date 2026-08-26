import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import app, { db, auth } from './firebase';

export type UserRole = 'owner' | 'admin' | 'supervisor' | 'worker';
export type AuthMethod = 'email' | 'username';

export const PSEUDO_EMAIL_DOMAIN = 'agbelouve.app';

/**
 * Builds a deterministic, RFC-compliant pseudo-email for workers without standard email.
 * Format: {cleanUsername}.{cleanTenant}@agbelouve.app
 * Example: koffi.tenant1724622938@agbelouve.app
 */
export const buildPseudoEmail = (username: string, tenantId: string): string => {
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  const cleanTenant = tenantId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `${cleanUsername}.${cleanTenant}@${PSEUDO_EMAIL_DOMAIN}`;
};

/**
 * Helper to get an isolated secondary auth instance for provisioning team members
 * without logging out the currently active admin/owner.
 */
const getSecondaryAuth = () => {
  const secondaryAppName = 'SecondaryProvisioningApp';
  const existingApp = getApps().find(a => a.name === secondaryAppName);
  const secondaryApp = existingApp || initializeApp(app.options, secondaryAppName);
  return getAuth(secondaryApp);
};

export interface UserProfile {
  uid: string;
  tenantId: string;
  email: string;
  username?: string;
  authMethod: AuthMethod;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface LivestockCategory {
  id: string; // e.g. 'goats', 'poultry', 'cattle', 'sheep', 'pigs'
  label: string; // e.g. 'Goats / Chèvres'
  icon?: string;
}

export interface FormSectionsConfig {
  attendance: boolean;
  livestock: boolean;
  operations: boolean;
  financials: boolean;
  photos: boolean;
  video: boolean;
  voice: boolean;
  gps: boolean;
}

export interface TenantFormConfig {
  enabledSections: FormSectionsConfig;
  livestockCategories: LivestockCategory[];
  minPhotos: number;
  requireVideo: boolean;
  requireVoice: boolean;
  customChecklistMorning: string[];
  customChecklistEvening: string[];
  updatedAt?: string;
}

export const DEFAULT_FORM_CONFIG: TenantFormConfig = {
  enabledSections: {
    attendance: true,
    livestock: true,
    operations: true,
    financials: true,
    photos: true,
    video: true,
    voice: true,
    gps: true,
  },
  livestockCategories: [
    { id: 'goats', label: 'Goats / Chèvres', icon: '🐐' },
    { id: 'poultry', label: 'Poultry / Volailles', icon: '🐔' },
    { id: 'cattle', label: 'Cattle / Bovins', icon: '🐄' },
  ],
  minPhotos: 2,
  requireVideo: false,
  requireVoice: false,
  customChecklistMorning: [
    'Feed livestock & check water troughs',
    'Inspect teak rows 1-5 for weed growth',
    'Chop 3 drums of silage',
    'Check tractor fuel & oil levels',
  ],
  customChecklistEvening: [
    'Count & secure all goats in pens',
    'Lock poultry coops & collect remaining eggs',
    'Store all field tools in warehouse',
    'Log daily fuel consumption',
  ],
};

export interface LicenseQuota {
  planType: 'unlimited_preview' | 'tier1_standard' | 'enterprise';
  maxUsers: number | null; // null = unlimited
  maxStorageBytes: number | null; // null = unlimited
  currentUsersCount: number;
  currentStorageBytes: number;
  enforced: boolean;
}

export interface Tenant {
  tenantId: string;
  farmCode: string; // e.g. AGBE4821
  name: string;
  ownerId: string;
  ownerEmail: string;
  createdAt: string;
  license: LicenseQuota;
  formConfig?: TenantFormConfig;
}

export interface NewTeamMemberInput {
  email?: string;
  username?: string;
  password?: string;
  displayName: string;
  role: UserRole;
  authMethod?: AuthMethod;
}

export interface FarmCodeRecord {
  farmCode: string;
  tenantId: string;
  name: string;
}

/**
 * Looks up a tenant organization by its unique Farm Code safely via public index
 */
export const lookupTenantByFarmCode = async (farmCode: string): Promise<Tenant | FarmCodeRecord | null> => {
  try {
    const cleanCode = farmCode.trim().toUpperCase();
    if (!cleanCode) return null;

    // 1. Try fetching from sanitized public /farm-codes/{farmCode} document first
    const codeDoc = await getDoc(doc(db, 'farm-codes', cleanCode));
    if (codeDoc.exists()) {
      return codeDoc.data() as FarmCodeRecord;
    }

    // 2. Fallback query on tenants collection (works if user is authenticated member)
    const q = query(collection(db, 'tenants'), where('farmCode', '==', cleanCode));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as Tenant;
    }
    return null;
  } catch (err) {
    console.error('Error looking up tenant by farm code:', err);
    return null;
  }
};

/**
 * Generates an automatic, collision-free unique Farm Code
 * Format: [PREFIX][4-digit random number] (e.g. AGBE4921)
 */
export const generateUniqueFarmCode = async (farmName: string): Promise<string> => {
  const cleanName = farmName.replace(/[^a-zA-Z]/g, '').toUpperCase();
  const prefix = (cleanName.length >= 3 ? cleanName.substring(0, 4) : 'FARM').padEnd(3, 'X');

  let attempts = 0;
  while (attempts < 10) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const candidateCode = `${prefix}${randomSuffix}`;

    const existing = await lookupTenantByFarmCode(candidateCode);
    if (!existing) {
      return candidateCode;
    }
    attempts++;
  }

  // Guaranteed timestamp fallback in rare case of high collision
  return `${prefix}${Date.now().toString().slice(-4)}`;
};

/**
 * Creates a new tenant farm organization along with its Owner account
 */
export const createTenantAccount = async (
  farmName: string,
  ownerEmail: string,
  ownerPassword: string,
  ownerDisplayName: string,
  initialTeamMembers: NewTeamMemberInput[] = [],
  customFarmCode?: string
): Promise<{ tenant: Tenant; ownerProfile: UserProfile }> => {
  // 1. Create Firebase Auth user for Owner
  const authRes = await createUserWithEmailAndPassword(auth, ownerEmail, ownerPassword);
  const ownerUid = authRes.user.uid;
  const tenantId = `tenant_${Date.now()}`;

  // 2. Generate unique Farm Code
  let farmCode = customFarmCode?.trim().toUpperCase();
  if (!farmCode) {
    farmCode = await generateUniqueFarmCode(farmName);
  } else {
    // If custom code provided, check for duplicate
    const existing = await lookupTenantByFarmCode(farmCode);
    if (existing) {
      farmCode = await generateUniqueFarmCode(farmName);
    }
  }

  // 3. Build Tenant Document
  const tenantDoc: Tenant = {
    tenantId,
    farmCode,
    name: farmName,
    ownerId: ownerUid,
    ownerEmail,
    createdAt: new Date().toISOString(),
    license: {
      planType: 'unlimited_preview',
      maxUsers: null,
      maxStorageBytes: null,
      currentUsersCount: 1 + initialTeamMembers.length,
      currentStorageBytes: 0,
      enforced: false,
    },
  };

  // 4. Save Tenant Document and Public Farm Code Index in Firestore
  await setDoc(doc(db, 'tenants', tenantId), tenantDoc);
  await setDoc(doc(db, 'farm-codes', farmCode), {
    farmCode,
    tenantId,
    name: farmName,
  });

  // 5. Save Owner User Profile Document
  const ownerProfile: UserProfile = {
    uid: ownerUid,
    tenantId,
    email: ownerEmail,
    authMethod: 'email',
    displayName: ownerDisplayName || 'Farm Owner',
    role: 'owner',
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'users', ownerUid), ownerProfile);

  // 6. Optionally create initial team members (Email or Username-based)
  const secondaryAuth = getSecondaryAuth();
  for (const member of initialTeamMembers) {
    if (member.password) {
      let memberEmail = member.email?.trim();
      let cleanUsername: string | undefined;
      let memberAuthMethod: AuthMethod = 'email';

      if (member.username?.trim()) {
        cleanUsername = member.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
        memberEmail = buildPseudoEmail(cleanUsername, tenantId);
        memberAuthMethod = 'username';
      } else if (memberEmail) {
        memberAuthMethod = 'email';
      }

      if (memberEmail) {
        try {
          const memberAuth = await createUserWithEmailAndPassword(secondaryAuth, memberEmail, member.password);
          const memberProfile: UserProfile = {
            uid: memberAuth.user.uid,
            tenantId,
            email: memberEmail,
            ...(cleanUsername ? { username: cleanUsername } : {}),
            authMethod: memberAuthMethod,
            displayName: member.displayName || cleanUsername || member.role.toUpperCase(),
            role: member.role,
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', memberAuth.user.uid), memberProfile);
          await signOut(secondaryAuth);
        } catch (err) {
          console.warn(`Failed to auto-create auth user for ${memberEmail}:`, err);
        }
      }
    }
  }

  return { tenant: tenantDoc, ownerProfile };
};

/**
 * Adds a new user to an existing tenant organization (supports email or username)
 */
export const addUserToTenant = async (
  tenantId: string,
  identifier: string, // Email or Username
  password: string,
  displayName: string,
  role: UserRole,
  isUsername = !identifier.includes('@')
): Promise<UserProfile> => {
  // Verify quota limits before adding user
  const quotaCheck = await checkLicenseQuota(tenantId);
  if (!quotaCheck.allowed) {
    throw new Error(`License limit reached: ${quotaCheck.reason}`);
  }

  let authEmail: string;
  let authMethod: AuthMethod;
  let cleanUsername: string | undefined;

  if (isUsername) {
    cleanUsername = identifier.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (!cleanUsername) {
      throw new Error('Valid username is required.');
    }
    authEmail = buildPseudoEmail(cleanUsername, tenantId);
    authMethod = 'username';
  } else {
    authEmail = identifier.trim();
    if (!authEmail) {
      throw new Error('Valid email is required.');
    }
    authMethod = 'email';
  }

  // Create Firebase Auth user using isolated secondary instance so admin session remains intact
  const secondaryAuth = getSecondaryAuth();
  const authRes = await createUserWithEmailAndPassword(secondaryAuth, authEmail, password);
  const uid = authRes.user.uid;
  try {
    await signOut(secondaryAuth);
  } catch {}

  const userProfile: UserProfile = {
    uid,
    tenantId,
    email: authEmail,
    ...(cleanUsername ? { username: cleanUsername } : {}),
    authMethod,
    displayName: displayName || cleanUsername || authEmail.split('@')[0],
    role,
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'users', uid), userProfile);

  // Increment current user count in tenant doc
  const tenantRef = doc(db, 'tenants', tenantId);
  const tenantSnap = await getDoc(tenantRef);
  if (tenantSnap.exists()) {
    const data = tenantSnap.data() as Tenant;
    const updatedCount = (data.license?.currentUsersCount || 0) + 1;
    await updateDoc(tenantRef, { 'license.currentUsersCount': updatedCount });
  }

  return userProfile;
};

/**
 * Fetches user profile for a given Firebase Auth UID
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return null;
  }
};

/**
 * Fetches tenant details for a given tenantId
 */
export const getTenantDetails = async (tenantId: string): Promise<Tenant | null> => {
  try {
    const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
    if (tenantDoc.exists()) {
      return tenantDoc.data() as Tenant;
    }
    return null;
  } catch (err) {
    console.error('Error fetching tenant details:', err);
    return null;
  }
};

/**
 * Fetches all users belonging to a tenant
 */
export const getTenantUsers = async (tenantId: string): Promise<UserProfile[]> => {
  try {
    const q = query(collection(db, 'users'), where('tenantId', '==', tenantId));
    const querySnapshot = await getDocs(q);
    const users: UserProfile[] = [];
    querySnapshot.forEach(d => {
      users.push(d.data() as UserProfile);
    });
    return users;
  } catch (err) {
    console.error('Error fetching tenant users:', err);
    return [];
  }
};

/**
 * Evaluates license quotas (users and storage bytes) for a tenant
 */
export const checkLicenseQuota = async (
  tenantId: string
): Promise<{ allowed: boolean; reason?: string; tenant?: Tenant }> => {
  const tenant = await getTenantDetails(tenantId);
  if (!tenant) {
    return { allowed: true }; // Fallback
  }

  const { license } = tenant;
  if (!license || !license.enforced) {
    return { allowed: true, tenant }; // Unlimited Preview Mode
  }

  if (license.maxUsers !== null && license.currentUsersCount >= license.maxUsers) {
    return {
      allowed: false,
      reason: `Maximum user limit reached (${license.currentUsersCount}/${license.maxUsers}). Please upgrade plan.`,
      tenant,
    };
  }

  if (license.maxStorageBytes !== null && license.currentStorageBytes >= license.maxStorageBytes) {
    return {
      allowed: false,
      reason: `Storage quota exceeded (${Math.round(license.currentStorageBytes / (1024 * 1024))}MB). Please upgrade storage.`,
      tenant,
    };
  }

  return { allowed: true, tenant };
};

/**
 * Fetches tenant form template configuration with default fallbacks
 */
export const getTenantFormConfig = async (tenantId: string): Promise<TenantFormConfig> => {
  try {
    const tenant = await getTenantDetails(tenantId);
    if (tenant?.formConfig) {
      return {
        ...DEFAULT_FORM_CONFIG,
        ...tenant.formConfig,
        enabledSections: {
          ...DEFAULT_FORM_CONFIG.enabledSections,
          ...(tenant.formConfig.enabledSections || {}),
        },
      };
    }
    return DEFAULT_FORM_CONFIG;
  } catch (err) {
    console.error('Error fetching tenant form config:', err);
    return DEFAULT_FORM_CONFIG;
  }
};

/**
 * Updates tenant form template configuration
 */
export const updateTenantFormConfig = async (
  tenantId: string,
  config: Partial<TenantFormConfig>
): Promise<void> => {
  const tenantRef = doc(db, 'tenants', tenantId);
  const current = await getTenantFormConfig(tenantId);
  const merged: TenantFormConfig = {
    ...current,
    ...config,
    enabledSections: {
      ...current.enabledSections,
      ...(config.enabledSections || {}),
    },
    updatedAt: new Date().toISOString(),
  };
  await updateDoc(tenantRef, { formConfig: merged });
};
