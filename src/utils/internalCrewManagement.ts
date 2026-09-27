import { User } from '../types';

export type AdminTabKey =
  | 'dashboard'
  | 'overview'
  | 'users'
  | 'vouchers'
  | 'reviews'
  | 'tickets'
  | 'crew'
  | 'system';

export interface RheivaDepartment {
  id: string;
  name: string;
  description: string;
  assignedTabs: AdminTabKey[];
  createdAt: string;
}

export interface InternalCrewAccount {
  id: string;
  name: string;
  username: string; // Guaranteed to start with "entry-rheivatech-"
  email: string;
  password?: string;
  departmentId: string;
  departmentName: string;
  roleTitle: string; // e.g. "Support Agent", "Billing Coordinator", "System Auditor"
  isInternalCrew: true;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

const DEPARTMENTS_STORAGE_KEY = 'ovraxhr_internal_departments_v2';
const CREW_ACCOUNTS_STORAGE_KEY = 'ovraxhr_internal_crew_accounts_v1';
export const CREW_USERNAME_PREFIX = 'entry-rheivatech-';

export const ALL_ADMIN_TAB_DEFINITIONS: { id: AdminTabKey; label: string; description: string }[] = [
  { id: 'dashboard', label: 'Staff Dashboard', description: 'Personalized crew operational dashboard, quick ticket triage, and system activity' },
  { id: 'overview', label: 'Executive Overview', description: 'System-wide analytics, operational metrics, and quick diagnostics' },
  { id: 'users', label: 'Client User Accounts', description: 'Multi-organization account registry, verification audits, and password resets' },
  { id: 'vouchers', label: 'Promo Vouchers & Billing', description: 'Subscription discounts, promotional campaign engine, and redemption logs' },
  { id: 'reviews', label: 'User Feedback & Reviews', description: 'Public platform reviews, star ratings, and official OvraxHR responses' },
  { id: 'tickets', label: 'Helpdesk Support Desk', description: 'Conversational support chats, triage queues, and real-time response thread' },
  { id: 'crew', label: 'Crew & Departments', description: 'Internal staff accounts, departmental access, and tab permission matrix' },
  { id: 'system', label: 'System & Maintenance', description: 'Raw database diagnostics, localStorage health, and maintenance purge' },
];

export const INITIAL_DEPARTMENTS: RheivaDepartment[] = [
  {
    id: 'dept-support-01',
    name: 'Customer Support & Helpdesk',
    description: 'Handles client inquiries, user feedback, and resolves support helpdesk tickets.',
    assignedTabs: ['dashboard', 'tickets', 'reviews'],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-billing-02',
    name: 'Billing & License Management',
    description: 'Oversees organization licensing, subscription vouchers, and promo code campaign logs.',
    assignedTabs: ['dashboard', 'users', 'vouchers'],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-qa-03',
    name: 'Platform Quality & Moderation',
    description: 'Monitors user satisfaction metrics, reviews client feedback, and posts official replies.',
    assignedTabs: ['dashboard', 'overview', 'reviews'],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-ops-04',
    name: 'Technical Operations & Audit',
    description: 'Audits client organizations, oversees account verifications, and manages system health.',
    assignedTabs: ['dashboard', 'overview', 'users', 'system'],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const INITIAL_CREW_ACCOUNTS: InternalCrewAccount[] = [
  {
    id: 'crew-001',
    name: 'Rheiva Support Lead',
    username: 'entry-rheivatech-support',
    email: 'support.lead@rheivatech.com',
    password: 'password123',
    departmentId: 'dept-support-01',
    departmentName: 'Customer Support & Helpdesk',
    roleTitle: 'Customer Support Specialist',
    isInternalCrew: true,
    isEmailVerified: true,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'crew-002',
    name: 'Rheiva Billing Desk',
    username: 'entry-rheivatech-billing',
    email: 'billing@rheivatech.com',
    password: 'password123',
    departmentId: 'dept-billing-02',
    departmentName: 'Billing & License Management',
    roleTitle: 'Billing Coordinator',
    isInternalCrew: true,
    isEmailVerified: true,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

// Load departments
export function loadInternalDepartments(): RheivaDepartment[] {
  try {
    const saved = localStorage.getItem(DEPARTMENTS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load internal departments:', e);
  }

  saveInternalDepartments(INITIAL_DEPARTMENTS);
  return INITIAL_DEPARTMENTS;
}

// Save departments
export function saveInternalDepartments(depts: RheivaDepartment[]): void {
  try {
    localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(depts));
    window.dispatchEvent(new CustomEvent('ovraxhr_crew_updated'));
  } catch (e) {
    console.error('Failed to save internal departments:', e);
  }
}

// Create department
export function createInternalDepartment(params: {
  name: string;
  description: string;
  assignedTabs: AdminTabKey[];
}): { success: boolean; department?: RheivaDepartment; error?: string } {
  const trimmedName = (params.name || '').trim();
  if (!trimmedName) {
    return { success: false, error: 'Department name is required.' };
  }

  const all = loadInternalDepartments();
  if (all.some((d) => d.name.toLowerCase() === trimmedName.toLowerCase())) {
    return { success: false, error: `A department named "${trimmedName}" already exists.` };
  }

  const newDept: RheivaDepartment = {
    id: `dept-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: trimmedName,
    description: (params.description || '').trim(),
    assignedTabs: params.assignedTabs.length > 0 ? params.assignedTabs : ['tickets'],
    createdAt: new Date().toISOString(),
  };

  const updated = [...all, newDept];
  saveInternalDepartments(updated);
  return { success: true, department: newDept };
}

// Update department
export function updateInternalDepartment(
  id: string,
  updates: Partial<Pick<RheivaDepartment, 'name' | 'description' | 'assignedTabs'>>
): boolean {
  const all = loadInternalDepartments();
  let found = false;
  const updated = all.map((d) => {
    if (d.id === id) {
      found = true;
      return {
        ...d,
        ...updates,
      };
    }
    return d;
  });

  if (found) {
    saveInternalDepartments(updated);
    // Also sync departmentName in crew accounts if name changed
    if (updates.name) {
      const crew = loadInternalCrewAccounts();
      const updatedCrew = crew.map((c) =>
        c.departmentId === id ? { ...c, departmentName: updates.name! } : c
      );
      saveInternalCrewAccounts(updatedCrew);
    }
  }
  return found;
}

// Delete department
export function deleteInternalDepartment(id: string): boolean {
  const all = loadInternalDepartments();
  const filtered = all.filter((d) => d.id !== id);
  if (filtered.length !== all.length) {
    saveInternalDepartments(filtered);
    return true;
  }
  return false;
}

// Load internal crew accounts
export function loadInternalCrewAccounts(): InternalCrewAccount[] {
  try {
    const saved = localStorage.getItem(CREW_ACCOUNTS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load internal crew accounts:', e);
  }

  saveInternalCrewAccounts(INITIAL_CREW_ACCOUNTS);
  return INITIAL_CREW_ACCOUNTS;
}

// Save internal crew accounts
export function saveInternalCrewAccounts(accounts: InternalCrewAccount[]): void {
  try {
    localStorage.setItem(CREW_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    window.dispatchEvent(new CustomEvent('ovraxhr_crew_updated'));
  } catch (e) {
    console.error('Failed to save internal crew accounts:', e);
  }
}

// Normalize username to guarantee entry-rheivatech- prefix
export function formatCrewUsername(rawUsername: string): string {
  let clean = (rawUsername || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  if (!clean.startsWith(CREW_USERNAME_PREFIX)) {
    // Strip partial prefix if entered
    if (clean.startsWith('entry-rheivatech')) {
      clean = clean.replace(/^entry-rheivatech-?/, '');
    } else if (clean.startsWith('rheivatech-')) {
      clean = clean.replace(/^rheivatech-?/, '');
    }
    clean = `${CREW_USERNAME_PREFIX}${clean}`;
  }
  return clean;
}

// Create internal crew account
export function createInternalCrewAccount(params: {
  name: string;
  rawUsername: string;
  email: string;
  password?: string;
  departmentId: string;
  roleTitle?: string;
}): { success: boolean; account?: InternalCrewAccount; error?: string } {
  const trimmedName = (params.name || '').trim();
  const trimmedEmail = (params.email || '').trim().toLowerCase();
  const fullUsername = formatCrewUsername(params.rawUsername);

  if (!trimmedName) {
    return { success: false, error: 'Full name is required.' };
  }
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return { success: false, error: 'Valid company email address is required.' };
  }

  const cleanSuffix = fullUsername.slice(CREW_USERNAME_PREFIX.length);
  if (!cleanSuffix || cleanSuffix.length < 2) {
    return { success: false, error: 'Username must contain at least 2 alphanumeric characters after the prefix.' };
  }

  const allDepartments = loadInternalDepartments();
  const dept = allDepartments.find((d) => d.id === params.departmentId);
  if (!dept) {
    return { success: false, error: 'Please select a valid OvraxHR internal department.' };
  }

  const allAccounts = loadInternalCrewAccounts();
  if (allAccounts.some((a) => a.username.toLowerCase() === fullUsername.toLowerCase())) {
    return { success: false, error: `Account username "${fullUsername}" is already taken.` };
  }
  if (allAccounts.some((a) => a.email.toLowerCase() === trimmedEmail)) {
    return { success: false, error: `An internal crew account with email "${trimmedEmail}" already exists.` };
  }

  const newAccount: InternalCrewAccount = {
    id: `crew-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: trimmedName,
    username: fullUsername,
    email: trimmedEmail,
    password: params.password?.trim() || 'password123',
    departmentId: dept.id,
    departmentName: dept.name,
    roleTitle: (params.roleTitle || '').trim() || 'Support Agent',
    isInternalCrew: true,
    isEmailVerified: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const updated = [...allAccounts, newAccount];
  saveInternalCrewAccounts(updated);
  return { success: true, account: newAccount };
}

// Update internal crew account
export function updateInternalCrewAccount(
  id: string,
  updates: Partial<Pick<InternalCrewAccount, 'name' | 'email' | 'password' | 'departmentId' | 'roleTitle' | 'isActive'>>
): boolean {
  const all = loadInternalCrewAccounts();
  const allDepts = loadInternalDepartments();
  let found = false;

  const updated = all.map((acc) => {
    if (acc.id === id) {
      found = true;
      let deptName = acc.departmentName;
      if (updates.departmentId && updates.departmentId !== acc.departmentId) {
        const d = allDepts.find((item) => item.id === updates.departmentId);
        if (d) deptName = d.name;
      }

      return {
        ...acc,
        ...updates,
        departmentName: deptName,
      };
    }
    return acc;
  });

  if (found) {
    saveInternalCrewAccounts(updated);
  }
  return found;
}

// Delete internal crew account
export function deleteInternalCrewAccount(id: string): boolean {
  const all = loadInternalCrewAccounts();
  const filtered = all.filter((a) => a.id !== id);
  if (filtered.length !== all.length) {
    saveInternalCrewAccounts(filtered);
    return true;
  }
  return false;
}

// Lookup crew account by identifier (username or email)
export function findInternalCrewByIdentifier(identifier: string): InternalCrewAccount | null {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();
  const all = loadInternalCrewAccounts();

  return (
    all.find(
      (a) =>
        a.username.toLowerCase() === clean ||
        a.email.toLowerCase() === clean ||
        (clean.startsWith(CREW_USERNAME_PREFIX) && a.username.toLowerCase() === clean)
    ) || null
  );
}

// Authenticate internal crew member
export function authenticateInternalCrew(identifier: string, password?: string): User | null {
  const account = findInternalCrewByIdentifier(identifier);
  if (!account) return null;
  if (!account.isActive) return null;

  if (account.password && password && account.password !== password) {
    return null;
  }

  // Find department to extract mapped tabs
  const allDepts = loadInternalDepartments();
  const dept = allDepts.find((d) => d.id === account.departmentId);
  const assignedTabs = dept && dept.assignedTabs.length > 0 ? dept.assignedTabs : ['dashboard'];

  const crewUser: User = {
    id: account.id,
    name: account.name,
    email: account.email,
    username: account.username,
    company: 'OvraxHR Operations (Rheivatech)',
    companyId: 'RHEIVATECH',
    role: account.roleTitle || 'Support Agent',
    isAdmin: false,
    isSuperAdmin: false,
    isInternalCrew: true,
    isEmailVerified: true,
    departmentId: account.departmentId,
    departmentName: dept?.name || account.departmentName,
    assignedTabs,
    createdAt: account.createdAt,
  };

  return crewUser;
}
