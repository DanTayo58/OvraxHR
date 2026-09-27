import React, { useState, useEffect, useRef } from 'react';
import { ProjectFile, User, AppSettings, StaffMember, LeaveRequest } from './types';
import { INITIAL_PROJECT_FILES } from './data/seedProjects';
import { INITIAL_STAFF_MEMBERS, INITIAL_LEAVES } from './data/seedStaff';
import { Preloader } from './components/Preloader';
import { LoginView } from './components/LoginView';
import { WelcomeModal } from './components/WelcomeModal';
import { InteractiveTutorialOverlay } from './components/InteractiveTutorialOverlay';
import { AddNewModal } from './components/AddNewModal';
import { DashboardView } from './components/DashboardView';
import { ProjectWorkspaceView } from './components/ProjectWorkspaceView';
import { AdminPortalView } from './components/AdminPortalView';
import { WebsiteView } from './components/WebsiteView';
import { CompanyLicenseModal } from './components/CompanyLicenseModal';
import { verifyCompanyMemberAccess } from './utils/licensing';
import { ToastProvider, emitGlobalToast } from './context/ToastContext';
import { safeSaveLocalStorage, purgeObsoleteStorageKeys } from './utils/storage';
import { syncStaffAndProjects } from './utils/rosterSync';
import { reconcileStaffAndLeaves } from './utils/leaveUtils';
import {
  loadCompanyData,
  saveCompanyData,
  STORAGE_KEYS,
  clearCompanySpecificData,
  getActiveSessionCompany,
  normalizeCompanyKey,
  normalizeCompanyId,
  deriveCompanyIdFromName,
  purgeAllSampleAndGhostData,
  migrateAllCompanyData,
} from './utils/companyStorage';
import { saveCentralCompanyLogo } from './utils/logoStorage';
import { purgeSampleUserAccounts } from './utils/userManagement';

const STORAGE_KEY = 'taima_projects_v4';
const STAFF_KEY = 'skima_staff_v1';
const LEAVES_KEY = 'skima_leaves_v1';
const ONBOARDING_KEY = 'taima_onboarded_v3';
const USER_KEY = 'taima_user_session';
const SETTINGS_KEY = 'taima_app_settings_v3';
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 Minutes

// Known legacy seed staff identifiers and names to automatically purge from genuine user databases
const SEED_STAFF_IDS = new Set([
  'staff-1',
  'staff-2',
  'staff-3',
  'staff-4',
  'staff-5',
  'staff-6',
  'SKM-101',
  'SKM-102',
  'SKM-103',
  'SKM-104',
  'SKM-105',
  'SKM-106',
  'SKM-1004',
]);

const SEED_STAFF_NAMES = new Set([
  'sarah jenkins',
  'david chen',
  'amina diallo',
  'marcus vance',
  'elena rostova',
  'kofi mensah',
]);

const SEED_LEAVE_IDS = new Set(['LV-1001', 'LV-1002']);

export const isSeedStaffRecord = (staff: StaffMember): boolean => {
  if (!staff) return false;
  if (SEED_STAFF_IDS.has(staff.id) || SEED_STAFF_IDS.has(staff.employeeId)) return true;
  const lowerName = (staff.name || '').trim().toLowerCase();
  if (SEED_STAFF_NAMES.has(lowerName)) return true;
  return false;
};

const ensureUniqueStaffIds = (list: StaffMember[]): StaffMember[] => {
  const seen = new Set<string>();
  return list.map((staff, idx) => {
    let id = staff.id;
    if (!id || seen.has(id)) {
      id = `${staff.id || 'staff'}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
    }
    seen.add(id);

    const rawDept = (staff.department || '').trim();
    const isUnassigned =
      !rawDept ||
      rawDept.toLowerCase() === 'unassigned' ||
      rawDept.toLowerCase() === 'n/a' ||
      rawDept.toLowerCase() === 'none' ||
      rawDept.toLowerCase() === 'null' ||
      rawDept.toLowerCase() === 'undefined';
    const finalDept = isUnassigned ? 'General' : rawDept;

    return id === staff.id && finalDept === staff.department
      ? staff
      : { ...staff, id, department: finalDept };
  });
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  resumptionTime: '08:00',
  closingTime: '17:00',
  gracePeriodMinutes: 15,
  defaultColumns: ['Full Name', 'Employee ID', 'Check-In', 'Check-Out'],
  autoSyncStaffFromAttendance: false,
  shifts: [
    {
      id: 'shift-default-morning',
      name: 'Morning Shift',
      startTime: '08:00',
      endTime: '17:00',
      gracePeriodMinutes: 15,
      isDefault: true,
    },
  ],
  savedShiftPresets: [
    {
      id: 'preset-standard-1',
      presetName: 'Standard Single Shift',
      shifts: [
        {
          id: 'shift-s1',
          name: 'Morning Shift',
          startTime: '08:00',
          endTime: '17:00',
          gracePeriodMinutes: 15,
          isDefault: true,
        },
      ],
      createdAt: new Date().toISOString().split('T')[0],
    },
    {
      id: 'preset-factory-3',
      presetName: 'Factory 3-Rotation (Morning / Afternoon / Night)',
      shifts: [
        {
          id: 'shift-f1',
          name: 'Morning Shift',
          startTime: '06:00',
          endTime: '14:00',
          gracePeriodMinutes: 10,
        },
        {
          id: 'shift-f2',
          name: 'Afternoon Shift',
          startTime: '14:00',
          endTime: '22:00',
          gracePeriodMinutes: 10,
        },
        {
          id: 'shift-f3',
          name: 'Night Shift',
          startTime: '22:00',
          endTime: '06:00',
          gracePeriodMinutes: 15,
        },
      ],
      createdAt: new Date().toISOString().split('T')[0],
    },
  ],
  savedRosterTemplates: [
    {
      id: 'template-1',
      name: 'Template 1',
      assignments: {},
      createdAt: new Date().toISOString().split('T')[0],
    },
  ],
  activeTemplateId: 'template-1',
};

export default function App() {
  const [showPreloader, setShowPreloader] = useState(true);
  const [preloaderDuration, setPreloaderDuration] = useState<number | undefined>(undefined);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [isAddNewModalOpen, setIsAddNewModalOpen] = useState(false);
  const [showWebsiteView, setShowWebsiteView] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseAccessOverride, setLicenseAccessOverride] = useState(false);

  // Authentication State
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem(USER_KEY);
      if (savedUser) return JSON.parse(savedUser);
    } catch (e) {
      console.error('Failed to load user session:', e);
    }
    return null;
  });

  const [sessionExpiredMsg, setSessionExpiredMsg] = useState<string | null>(null);

  // Check if active session is in explicit demo mode
  const isDemoSessionActive = () => {
    try {
      return localStorage.getItem('skima_is_demo_session') === 'true';
    } catch {
      return false;
    }
  };

  const currentCompanyName = (user?.company && user.company.trim()) || (user ? 'Default Organization' : '');

  // Ref tracking which company's data is currently active in memory
  const activeLoadedCompanyRef = useRef<string | null>(user ? (user.companyId || currentCompanyName) : null);

  // Staff List State - Scoped strictly by active company
  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    if (!user || !currentCompanyName) return [];
    try {
      const isDemo = isDemoSessionActive();
      const compId = user.companyId || currentCompanyName;
      const parsed = loadCompanyData<StaffMember[]>(STORAGE_KEYS.STAFF, compId, []);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (!isDemo) {
          const cleaned = parsed.filter((s: StaffMember) => !isSeedStaffRecord(s));
          saveCompanyData(STORAGE_KEYS.STAFF, cleaned, compId);
          return ensureUniqueStaffIds(cleaned);
        }
        return ensureUniqueStaffIds(parsed);
      }
    } catch (e) {
      console.error('Failed to parse saved staff list:', e);
    }
    return [];
  });

  const handleUpdateStaffList = (action: StaffMember[] | ((prev: StaffMember[]) => StaffMember[])) => {
    setStaffList((prev) => {
      const updated = typeof action === 'function' ? action(prev) : action;
      const deduplicated = ensureUniqueStaffIds(updated);
      const { updatedStaff } = reconcileStaffAndLeaves(deduplicated, leaves);
      return updatedStaff;
    });
  };

  const handleUpdateLeaves = (action: LeaveRequest[] | ((prev: LeaveRequest[]) => LeaveRequest[])) => {
    setLeaves((prevLeaves) => {
      const updated = typeof action === 'function' ? action(prevLeaves) : action;
      // Reconcile leaves and staff statuses together
      setStaffList((prevStaff) => {
        const { updatedStaff, hasStaffChanged } = reconcileStaffAndLeaves(prevStaff, updated);
        return hasStaffChanged ? updatedStaff : prevStaff;
      });
      const { updatedLeaves } = reconcileStaffAndLeaves([], updated);
      return updatedLeaves;
    });
  };

  // Leaves State - Scoped strictly by active company
  const [leaves, setLeaves] = useState<LeaveRequest[]>(() => {
    if (!user || !currentCompanyName) return [];
    try {
      const isDemo = isDemoSessionActive();
      const compId = user.companyId || currentCompanyName;
      const parsed = loadCompanyData<LeaveRequest[]>(STORAGE_KEYS.LEAVES, compId, []);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (!isDemo) {
          const cleaned = parsed.filter(
            (l: LeaveRequest) =>
              !SEED_LEAVE_IDS.has(l.id) &&
              !SEED_STAFF_NAMES.has((l.employeeName || '').trim().toLowerCase()) &&
              !SEED_STAFF_IDS.has(l.employeeId)
          );
          saveCompanyData(STORAGE_KEYS.LEAVES, cleaned, compId);
          return cleaned;
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved leaves:', e);
    }
    return [];
  });

  // App Settings State - Scoped strictly by active company
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    if (!user || !currentCompanyName) return DEFAULT_APP_SETTINGS;
    try {
      const compId = user.companyId || currentCompanyName;
      const parsed = loadCompanyData<AppSettings>(STORAGE_KEYS.SETTINGS, compId, null as any);
      if (parsed) {
        if (!parsed.shifts || parsed.shifts.length === 0) {
          parsed.shifts = [
            {
              id: 'shift-default-morning',
              name: 'Morning Shift',
              startTime: parsed.resumptionTime || '08:00',
              endTime: parsed.closingTime || '17:00',
              gracePeriodMinutes: parsed.gracePeriodMinutes || 15,
              isDefault: true,
            },
          ];
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load app settings:', e);
    }
    return DEFAULT_APP_SETTINGS;
  });

  // Load Projects from Company-Scoped Storage
  const [projects, setProjects] = useState<ProjectFile[]>(() => {
    if (!user || !currentCompanyName) return [];
    try {
      const compId = user.companyId || currentCompanyName;
      const parsed = loadCompanyData<ProjectFile[]>(STORAGE_KEYS.PROJECTS, compId, []);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved projects:', e);
    }
    return [];
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Automatically sync datasets whenever active logged in company changes
  useEffect(() => {
    if (!user || !currentCompanyName) {
      activeLoadedCompanyRef.current = null;
      setStaffList([]);
      setProjects([]);
      setLeaves([]);
      setAppSettings(DEFAULT_APP_SETTINGS);
      return;
    }

    const compIdentifier = user.companyId || currentCompanyName;
    if (activeLoadedCompanyRef.current !== compIdentifier) {
      activeLoadedCompanyRef.current = compIdentifier;
      const isDemo = isDemoSessionActive();
      
      const loadedStaff = loadCompanyData<StaffMember[]>(STORAGE_KEYS.STAFF, compIdentifier, []);
      const loadedProjects = loadCompanyData<ProjectFile[]>(STORAGE_KEYS.PROJECTS, compIdentifier, []);
      const loadedLeaves = loadCompanyData<LeaveRequest[]>(STORAGE_KEYS.LEAVES, compIdentifier, []);
      const loadedSettings = loadCompanyData<AppSettings>(STORAGE_KEYS.SETTINGS, compIdentifier, DEFAULT_APP_SETTINGS);

      const cleanedStaff = isDemo
        ? ensureUniqueStaffIds(loadedStaff || [])
        : ensureUniqueStaffIds((loadedStaff || []).filter((s) => !isSeedStaffRecord(s)));

      const cleanedLeaves = isDemo
        ? loadedLeaves || []
        : (loadedLeaves || []).filter(
            (l) =>
              !SEED_LEAVE_IDS.has(l.id) &&
              !SEED_STAFF_NAMES.has((l.employeeName || '').trim().toLowerCase()) &&
              !SEED_STAFF_IDS.has(l.employeeId)
          );

      const reconciled = reconcileStaffAndLeaves(cleanedStaff, cleanedLeaves);

      setStaffList(reconciled.updatedStaff);
      setProjects(loadedProjects || []);
      setLeaves(reconciled.updatedLeaves);
      setAppSettings(loadedSettings || DEFAULT_APP_SETTINGS);
    }
  }, [user, currentCompanyName]);

  // Save Staff List strictly when active loaded company matches
  useEffect(() => {
    const compIdentifier = user?.companyId || currentCompanyName;
    if (user && compIdentifier && activeLoadedCompanyRef.current === compIdentifier) {
      saveCompanyData(STORAGE_KEYS.STAFF, staffList, compIdentifier);
    }
  }, [staffList, currentCompanyName, user]);

  // Save Leaves strictly when active loaded company matches
  useEffect(() => {
    const compIdentifier = user?.companyId || currentCompanyName;
    if (user && compIdentifier && activeLoadedCompanyRef.current === compIdentifier) {
      saveCompanyData(STORAGE_KEYS.LEAVES, leaves, compIdentifier);
    }
  }, [leaves, currentCompanyName, user]);

  // Save Projects strictly when active loaded company matches
  useEffect(() => {
    const compIdentifier = user?.companyId || currentCompanyName;
    if (user && compIdentifier && activeLoadedCompanyRef.current === compIdentifier) {
      saveCompanyData(STORAGE_KEYS.PROJECTS, projects, compIdentifier);
    }
  }, [projects, currentCompanyName, user]);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
    const compIdentifier = user?.companyId || currentCompanyName;
    if (compIdentifier) {
      saveCompanyData(STORAGE_KEYS.SETTINGS, newSettings, compIdentifier);
      if (newSettings.companyLogo) {
        saveCentralCompanyLogo(newSettings.companyLogo, compIdentifier);
      }
    }

    // Synchronize company name and company ID if updated
    if (newSettings.companyName || newSettings.companyId) {
      const trimmedCompany = (newSettings.companyName || '').trim();
      const cleanCompanyId = normalizeCompanyId(newSettings.companyId) || deriveCompanyIdFromName(trimmedCompany);

      const oldCompany = user?.company || '';
      const oldCompanyId = user?.companyId || '';

      if ((cleanCompanyId && cleanCompanyId !== oldCompanyId) || (trimmedCompany && trimmedCompany !== oldCompany)) {
        // Automatically migrate all company data from previous to new identifier
        migrateAllCompanyData(oldCompany, trimmedCompany, oldCompanyId, cleanCompanyId);
        activeLoadedCompanyRef.current = cleanCompanyId;
        // Save current in-memory data to the new company ID immediately
        if (cleanCompanyId) {
          saveCompanyData(STORAGE_KEYS.STAFF, staffList, cleanCompanyId);
          saveCompanyData(STORAGE_KEYS.LEAVES, leaves, cleanCompanyId);
          saveCompanyData(STORAGE_KEYS.PROJECTS, projects, cleanCompanyId);
          saveCompanyData(STORAGE_KEYS.SETTINGS, newSettings, cleanCompanyId);
        }
      }

      setUser((prevUser) => {
        if (prevUser) {
          const updatedUser = {
            ...prevUser,
            company: trimmedCompany || prevUser.company,
            companyId: cleanCompanyId || prevUser.companyId,
          };
          safeSaveLocalStorage(USER_KEY, updatedUser);
          safeSaveLocalStorage('skima_user_session', updatedUser);
          safeSaveLocalStorage('skima_current_user', updatedUser);
          return updatedUser;
        }
        return prevUser;
      });
    }

    // Only re-validate staff shift names if shifts list in settings was explicitly updated
    const previousShifts = appSettings.shifts || [];
    const newShifts = newSettings.shifts || [];
    const shiftsChanged = JSON.stringify(newShifts) !== JSON.stringify(previousShifts);

    if (shiftsChanged && newShifts.length > 0) {
      const validShiftNames = newShifts.map((s) => s.name);
      const defaultShiftName = newShifts[0].name;

      setStaffList((prevStaff) => {
        const cleanedStaff = prevStaff.map((staff) => {
          if (
            staff.shiftSchedule &&
            staff.shiftSchedule !== 'N/A' &&
            staff.shiftSchedule !== 'Dynamic Shift' &&
            staff.shiftSchedule !== 'Flexible' &&
            staff.shiftSchedule !== 'Off'
          ) {
            const sTrim = staff.shiftSchedule.toLowerCase().trim();
            // Check exact or partial matches
            const matched = validShiftNames.find((v) => {
              const vTrim = v.toLowerCase().trim();
              if (vTrim === sTrim) return true;
              if (sTrim.length >= 3 && (vTrim.includes(sTrim) || sTrim.includes(vTrim))) return true;
              return false;
            });
            if (matched) {
              return { ...staff, shiftSchedule: matched };
            }
            return { ...staff, shiftSchedule: defaultShiftName };
          }
          return staff;
        });
        const compIdentifier = user?.companyId || currentCompanyName;
        if (compIdentifier) {
          saveCompanyData(STORAGE_KEYS.STAFF, cleanedStaff, compIdentifier);
        }
        return cleanedStaff;
      });
    }

    if (newSettings.autoSyncStaffFromAttendance && projects.length > 0) {
      setStaffList((prevStaff) => {
        const { updatedStaffList, updatedProjects } = syncStaffAndProjects(prevStaff, projects);
        const compIdentifier = user?.companyId || currentCompanyName;
        if (compIdentifier) {
          saveCompanyData(STORAGE_KEYS.STAFF, updatedStaffList, compIdentifier);
          setProjects(updatedProjects);
          saveCompanyData(STORAGE_KEYS.PROJECTS, updatedProjects, compIdentifier);
        }
        return updatedStaffList;
      });
    }
  };

  // Sync theme class to document root for Tailwind dark mode
  useEffect(() => {
    if (appSettings.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [appSettings.theme]);

  // 10-Minute Inactivity Auto Logout
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        handleLogout('Session expired due to 10 minutes of inactivity for your security.');
      }, INACTIVITY_TIMEOUT_MS);
    }
  };

  useEffect(() => {
    if (!user) return;

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleUserActivity = () => resetInactivityTimer();

    events.forEach((evt) => window.addEventListener(evt, handleUserActivity));
    resetInactivityTimer();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [user]);

  // Preloader completion handler
  const handlePreloaderComplete = () => {
    setShowPreloader(false);
    setPreloaderDuration(undefined);

    const hasSeenWelcome = localStorage.getItem(ONBOARDING_KEY);
    if (!hasSeenWelcome && user) {
      setShowWelcomeModal(true);
      localStorage.setItem(ONBOARDING_KEY, 'true');
    }
  };

  // Trigger 3-second refresh preloader
  const handleTrigger3SecRefresh = () => {
    setPreloaderDuration(3000); // 3 seconds
    setShowPreloader(true);
  };

  // Purge obsolete legacy storage keys once on load
  useEffect(() => {
    purgeObsoleteStorageKeys();
  }, []);

  // Handle Login Success
  const handleLoginSuccess = (loggedInUser: User, isDemo: boolean = false) => {
    setUser(loggedInUser);
    localStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));
    localStorage.setItem('skima_user_session', JSON.stringify(loggedInUser));
    localStorage.setItem('skima_current_user', JSON.stringify(loggedInUser));
    setSessionExpiredMsg(null);
    setLicenseAccessOverride(false);

    const compName = (loggedInUser.company && loggedInUser.company.trim()) || 'Default Organization';
    const compIdentifier = loggedInUser.companyId || compName;
    activeLoadedCompanyRef.current = compIdentifier;

    if (isDemo) {
      localStorage.setItem('skima_is_demo_session', 'true');
      // User explicitly requested DEMO mode from login: populate sample database
      const demoStaff = ensureUniqueStaffIds(INITIAL_STAFF_MEMBERS);
      const demoProjects = INITIAL_PROJECT_FILES;
      const demoLeaves = INITIAL_LEAVES;
      const demoDepartments = [
        {
          id: 'dept-prod',
          name: 'Production',
          code: 'PROD',
          headOfDepartment: 'Production Lead',
          description: 'Core factory production operations, manufacturing lines, machinery management, and daily physical output.',
          roles: [
            { id: 'r-p1', title: 'Production Operator', jobDescription: 'Operates manufacturing equipment and line packaging.' },
            { id: 'r-p2', title: 'Production Supervisor', jobDescription: 'Monitors production metrics, line throughput, and shift adherence.' },
            { id: 'r-p3', title: 'Machine Technician', jobDescription: 'Performs technical line calibrations and preventative maintenance.' },
          ],
        },
        {
          id: 'dept-1',
          name: 'Operations',
          code: 'OPS',
          headOfDepartment: 'John Doe',
          description: 'Workforce logistics, attendance compliance, and site operational workflows.',
        },
        {
          id: 'dept-2',
          name: 'Engineering',
          code: 'ENG',
          headOfDepartment: 'Sarah Jenkins',
          description: 'Technical equipment maintenance, biometric systems, and hardware software support.',
        },
        {
          id: 'dept-3',
          name: 'Administration',
          code: 'ADM',
          headOfDepartment: 'Michael Vance',
          description: 'General administrative duties, HR compliance, and facility management.',
        },
        {
          id: 'dept-4',
          name: 'Quality Assurance',
          code: 'QA',
          headOfDepartment: 'Elena Rostova',
          description: 'Process auditing, safety standards, and daily output quality control.',
        },
      ];
      const demoTransfers = [
        {
          id: 'TRF-SKM-2026-001',
          employeeId: 'SKM-102',
          staffName: 'David Chen',
          fromDepartment: 'Engineering',
          toDepartment: 'Operations',
          effectiveDate: new Date().toISOString().split('T')[0],
          reason: 'Operational realignment and workforce scaling.',
          authorizedBy: 'HR Administration',
          createdAt: new Date().toISOString(),
        },
      ];

      setStaffList(demoStaff);
      saveCompanyData(STORAGE_KEYS.STAFF, demoStaff, compIdentifier);

      setProjects(demoProjects);
      saveCompanyData(STORAGE_KEYS.PROJECTS, demoProjects, compIdentifier);

      setLeaves(demoLeaves);
      saveCompanyData(STORAGE_KEYS.LEAVES, demoLeaves, compIdentifier);

      try {
        saveCompanyData(STORAGE_KEYS.DEPARTMENTS, demoDepartments, compIdentifier);
        saveCompanyData(STORAGE_KEYS.TRANSFERS, demoTransfers, compIdentifier);
      } catch (e) {
        console.error('Failed to save demo departments/transfers:', e);
      }
    } else {
      // Genuine user account: clear demo session flag and load company-scoped dataset
      localStorage.removeItem('skima_is_demo_session');
      const loadedStaff = loadCompanyData<StaffMember[]>(STORAGE_KEYS.STAFF, compIdentifier, []);
      const loadedProjects = loadCompanyData<ProjectFile[]>(STORAGE_KEYS.PROJECTS, compIdentifier, []);
      const loadedLeaves = loadCompanyData<LeaveRequest[]>(STORAGE_KEYS.LEAVES, compIdentifier, []);
      const loadedSettings = loadCompanyData<AppSettings>(STORAGE_KEYS.SETTINGS, compIdentifier, DEFAULT_APP_SETTINGS);

      const cleanedStaff = ensureUniqueStaffIds((loadedStaff || []).filter((s) => !isSeedStaffRecord(s)));
      const cleanedLeaves = (loadedLeaves || []).filter(
        (l) =>
          !SEED_LEAVE_IDS.has(l.id) &&
          !SEED_STAFF_NAMES.has((l.employeeName || '').trim().toLowerCase()) &&
          !SEED_STAFF_IDS.has(l.employeeId)
      );

      setStaffList(cleanedStaff);
      saveCompanyData(STORAGE_KEYS.STAFF, cleanedStaff, compIdentifier);

      setProjects(loadedProjects || []);
      saveCompanyData(STORAGE_KEYS.PROJECTS, loadedProjects || [], compIdentifier);

      setLeaves(cleanedLeaves);
      saveCompanyData(STORAGE_KEYS.LEAVES, cleanedLeaves, compIdentifier);

      if (loadedSettings) {
        setAppSettings(loadedSettings);
      } else {
        setAppSettings(DEFAULT_APP_SETTINGS);
      }
    }
  };

  // Handle Logout
  const handleLogout = (msg?: string) => {
    activeLoadedCompanyRef.current = null;
    setUser(null);
    setLicenseAccessOverride(false);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('skima_user_session');
    localStorage.removeItem('skima_current_user');
    localStorage.removeItem('skima_is_demo_session');
    setActiveProjectId(null);
    setStaffList([]);
    setProjects([]);
    setLeaves([]);
    setAppSettings(DEFAULT_APP_SETTINGS);
    if (msg) {
      setSessionExpiredMsg(msg);
    } else {
      setSessionExpiredMsg(null);
    }
  };

  // Clear All Database Data for Active Company (Preserves User Account)
  const handleClearAllData = () => {
    const currentUser = user;
    const compIdentifier = currentUser?.companyId || currentCompanyName;
    try {
      if (compIdentifier) {
        clearCompanySpecificData(compIdentifier);
        // Explicitly set clean empty structures for this company
        saveCompanyData(STORAGE_KEYS.STAFF, [], compIdentifier);
        saveCompanyData(STORAGE_KEYS.PROJECTS, [], compIdentifier);
        saveCompanyData(STORAGE_KEYS.LEAVES, [], compIdentifier);
        saveCompanyData(STORAGE_KEYS.DEPARTMENTS, [], compIdentifier);
        saveCompanyData(STORAGE_KEYS.TRANSFERS, [], compIdentifier);
        saveCompanyData(STORAGE_KEYS.KPI_RATINGS, {}, compIdentifier);
        saveCompanyData(STORAGE_KEYS.FEEDING, {}, compIdentifier);
      }
    } catch (e) {
      console.error('Error clearing company storage:', e);
    }
    setProjects([]);
    setStaffList([]);
    setLeaves([]);
    setActiveProjectId(null);
    window.location.reload();
  };

  // Add new project file
  const handleCreateProject = (newProject: ProjectFile) => {
    const updatedProjectList = [newProject, ...projects];
    setActiveProjectId(newProject.id);

    const compIdentifier = user?.companyId || currentCompanyName;

    // If autoSyncStaffFromAttendance is enabled, auto sync staff list and projects
    if (appSettings.autoSyncStaffFromAttendance) {
      const { updatedStaffList, updatedProjects } = syncStaffAndProjects(staffList, updatedProjectList);
      setStaffList(updatedStaffList);
      if (compIdentifier) {
        saveCompanyData(STORAGE_KEYS.STAFF, updatedStaffList, compIdentifier);
      }
      setProjects(updatedProjects);
      if (compIdentifier) {
        saveCompanyData(STORAGE_KEYS.PROJECTS, updatedProjects, compIdentifier);
      }
    } else {
      setProjects(updatedProjectList);
      if (compIdentifier) {
        saveCompanyData(STORAGE_KEYS.PROJECTS, updatedProjectList, compIdentifier);
      }
    }
  };

  // Toggle Lock with password
  const handleToggleLockWithPassword = (projectId: string, password?: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            isLocked: !p.isLocked,
            lockPassword: password ?? p.lockPassword ?? '',
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      })
    );
  };

  // Confirm Unlock Password match
  const handleConfirmUnlockPassword = (projectId: string, passwordAttempt: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return false;
    if (!proj.lockPassword) return true; // No password set
    return proj.lockPassword === passwordAttempt;
  };

  // Rename project
  const handleRenameProject = (projectId: string, newName: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId && !p.isLocked) {
          const finalName = newName.endsWith('.csv') ? newName : `${newName}.csv`;
          return {
            ...p,
            name: finalName,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      })
    );
  };

  // Delete project
  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
    }
  };

  // Update whole project
  const handleUpdateProject = (updatedProject: ProjectFile) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
  };

  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Check company license & access guarding
  const accessCheck =
    user && !user.isSuperAdmin && user.role !== 'SuperAdmin' && !licenseAccessOverride
      ? verifyCompanyMemberAccess(user)
      : { allowed: true, message: undefined, disturbanceType: undefined, companyName: user?.company || 'Organization' };

  // OvraxHR Public Landing Page & Pricing
  if (showWebsiteView) {
    return (
      <ToastProvider>
        <WebsiteView
          onBackToApp={() => setShowWebsiteView(false)}
          onOpenLogin={() => setShowWebsiteView(false)}
        />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className={appSettings.theme === 'light' ? "bg-slate-100 min-h-screen text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white" : "bg-slate-950 min-h-screen text-slate-100 font-sans antialiased selection:bg-blue-600 selection:text-white"}>
        {/* OvraxHR Pre-loader */}
      {showPreloader && (
        <Preloader
          onComplete={handlePreloaderComplete}
          timedDurationMs={preloaderDuration}
        />
      )}

      {/* Index Login Screen if not authenticated */}
      {!user ? (
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          sessionExpiredMsg={sessionExpiredMsg}
          onOpenWebsite={() => setShowWebsiteView(true)}
        />
      ) : user.isSuperAdmin || user.role === 'SuperAdmin' || user.isInternalCrew ? (
        <AdminPortalView
          user={user}
          onLogout={() => handleLogout()}
          onOpenWebsite={() => setShowWebsiteView(true)}
        />
      ) : (
        <>
          {/* Company License & Access Guard Modal */}
          {user && (!accessCheck.allowed || showLicenseModal) && (
            <CompanyLicenseModal
              user={user}
              guardResult={accessCheck}
              isOpen={!accessCheck.allowed || showLicenseModal}
              companyId={user.companyId || user.company || 'CMP'}
              companyName={user.company || 'My Organization'}
              userEmail={user.email}
              userName={user.name}
              userRole={user.role}
              disturbanceMessage={!accessCheck.allowed ? accessCheck.message : undefined}
              onClose={() => {
                setShowLicenseModal(false);
                if (!accessCheck.allowed) {
                  setLicenseAccessOverride(true);
                }
              }}
              onActivated={() => {
                setShowLicenseModal(false);
                setLicenseAccessOverride(true);
              }}
              onLicenseActivated={() => {
                setShowLicenseModal(false);
                setLicenseAccessOverride(true);
              }}
              onLogout={() => handleLogout()}
            />
          )}

          {/* Onboarding Welcome / Guide Modal */}
          <WelcomeModal
            isOpen={showWelcomeModal}
            onClose={() => setShowWelcomeModal(false)}
            onStartTutorial={() => {
              setShowWelcomeModal(false);
              setIsTutorialActive(true);
            }}
          />

          {/* Interactive Guided Tutorial Overlay */}
          <InteractiveTutorialOverlay
            isOpen={isTutorialActive}
            onClose={() => setIsTutorialActive(false)}
          />

          {/* Add New Project Modal */}
          <AddNewModal
            isOpen={isAddNewModalOpen}
            onClose={() => setIsAddNewModalOpen(false)}
            onCreateProject={handleCreateProject}
            existingProjects={projects}
            settings={appSettings}
          />

          {/* Workspace vs Dashboard */}
          {activeProject ? (
            <ProjectWorkspaceView
              project={activeProject}
              staffList={staffList}
              onUpdateStaffList={handleUpdateStaffList}
              leaves={leaves}
              onBack={() => setActiveProjectId(null)}
              onUpdateProject={handleUpdateProject}
              settings={appSettings}
              onSaveSettings={handleSaveSettings}
              onClearAllData={handleClearAllData}
            />
          ) : (
            <DashboardView
              user={user}
              projects={projects}
              onUpdateProjects={(updated) => setProjects(updated)}
              staffList={staffList}
              onUpdateStaffList={handleUpdateStaffList}
              leaves={leaves}
              onUpdateLeaves={handleUpdateLeaves}
              onOpenProject={(proj) => setActiveProjectId(proj.id)}
              onAddNewClick={() => setIsAddNewModalOpen(true)}
              onToggleLockWithPassword={handleToggleLockWithPassword}
              onConfirmUnlockPassword={handleConfirmUnlockPassword}
              onRenameProject={handleRenameProject}
              onDeleteProject={handleDeleteProject}
              onOpenHelp={() => setShowWelcomeModal(true)}
              onRefreshTriggered={handleTrigger3SecRefresh}
              onLogout={() => handleLogout()}
              settings={appSettings}
              onSaveSettings={handleSaveSettings}
              onClearAllData={handleClearAllData}
            />
          )}
        </>
      )}
    </div>
    </ToastProvider>
  );
}
