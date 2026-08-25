import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from './firebase';

export type UserRole = 'owner' | 'admin' | 'supervisor' | 'worker';

export interface UserProfile {
  uid: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

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
  name: string;
  ownerId: string;
  ownerEmail: string;
  createdAt: string;
  license: LicenseQuota;
}

export interface NewTeamMemberInput {
  email: string;
  password?: string;
  displayName: string;
  role: UserRole;
}

/**
 * Creates a new tenant farm organization along with its Owner account
 */
export const createTenantAccount = async (
  farmName: string,
  ownerEmail: string,
  ownerPassword: string,
  ownerDisplayName: string,
  initialTeamMembers: NewTeamMemberInput[] = []
): Promise<{ tenant: Tenant; ownerProfile: UserProfile }> => {
  // 1. Create Firebase Auth user for Owner
  const authRes = await createUserWithEmailAndPassword(auth, ownerEmail, ownerPassword);
  const ownerUid = authRes.user.uid;
  const tenantId = `tenant_${Date.now()}`;

  // 2. Build Tenant Document
  const tenantDoc: Tenant = {
    tenantId,
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

  // 3. Save Tenant Document in Firestore
  await setDoc(doc(db, 'tenants', tenantId), tenantDoc);

  // 4. Save Owner User Profile Document
  const ownerProfile: UserProfile = {
    uid: ownerUid,
    tenantId,
    email: ownerEmail,
    displayName: ownerDisplayName || 'Farm Owner',
    role: 'owner',
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'users', ownerUid), ownerProfile);

  // 5. Optionally create initial team members (Note: In production app, these would be invited via cloud function or secondary auth instance)
  for (const member of initialTeamMembers) {
    if (member.email && member.password) {
      try {
        const memberAuth = await createUserWithEmailAndPassword(auth, member.email, member.password);
        const memberProfile: UserProfile = {
          uid: memberAuth.user.uid,
          tenantId,
          email: member.email,
          displayName: member.displayName || member.role.toUpperCase(),
          role: member.role,
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', memberAuth.user.uid), memberProfile);
      } catch (err) {
        console.warn(`Failed to auto-create auth user for ${member.email}:`, err);
      }
    }
  }

  return { tenant: tenantDoc, ownerProfile };
};

/**
 * Adds a new user to an existing tenant organization
 */
export const addUserToTenant = async (
  tenantId: string,
  email: string,
  password: string,
  displayName: string,
  role: UserRole
): Promise<UserProfile> => {
  // Verify quota limits before adding user
  const quotaCheck = await checkLicenseQuota(tenantId);
  if (!quotaCheck.allowed) {
    throw new Error(`License limit reached: ${quotaCheck.reason}`);
  }

  // Create auth account
  const authRes = await createUserWithEmailAndPassword(auth, email, password);
  const uid = authRes.user.uid;

  const userProfile: UserProfile = {
    uid,
    tenantId,
    email,
    displayName: displayName || email.split('@')[0],
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
