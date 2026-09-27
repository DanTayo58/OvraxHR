import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Building2,
  Users,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Download,
  Search,
  CheckCircle2,
  X,
  UserCheck,
  Briefcase,
  Layers,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  History,
  FileText,
  Printer,
  Copy,
  BarChart3,
  BadgeDollarSign,
  ShieldAlert,
  Check,
  Star,
  Filter,
  Target,
  Calculator,
  Scale,
  Copy as CopyIcon,
  Sliders
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { StaffMember, AppSettings, DepartmentRole, DepartmentInfo, JobDescriptionItem, User } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { SearchableStaffSelect } from './SearchableStaffSelect';
import { getActiveOrganizationName } from '../utils/documentTemplates';
import { loadCompanyData, saveCompanyData, STORAGE_KEYS } from '../utils/companyStorage';
import { emitGlobalToast } from '../context/ToastContext';
import { getCompanyCurrencySymbol, loadCompanyPayrollConfig, deriveStaffPayGrade } from '../utils/payrollUtils';
import { getCleanDepartments, saveCleanDepartments, deduplicateDepartments } from '../utils/departmentUtils';

export type { DepartmentRole, DepartmentInfo };

export interface DepartmentTransferRecord {
  id: string;
  employeeId: string;
  staffName: string;
  fromDepartment: string;
  toDepartment: string;
  fromRole?: string;
  toRole?: string;
  previousSalary?: number;
  newSalary?: number;
  effectiveDate: string;
  reason: string;
  authorizedBy: string;
  createdAt: string;
  isReversed?: boolean;
  reversedAt?: string;
  reversedBy?: string;
}

/**
 * Autocalculates weights for role duties based on the number of duties in the role.
 * Calculates an average based on the number of duties.
 * Key duties are given higher but equal weights, while lower duties are given lower but equal weights.
 * Total summation is guaranteed not to exceed 100%.
 */
export function autoCalculateDutyWeights(items: JobDescriptionItem[]): JobDescriptionItem[] {
  if (!items || items.length === 0) return items;
  const n = items.length;
  const keyItems = items.filter((it) => !!it.isKey);
  const k = keyItems.length;
  const l = n - k;

  if (k === 0) {
    // No key duties: each duty receives equal weight = 100 / n
    const baseWeight = Math.floor((100 / n) * 10) / 10;
    return items.map((it, idx) => {
      if (idx === n - 1) {
        const allocated = baseWeight * (n - 1);
        const remainder = Math.round((100 - allocated) * 10) / 10;
        return { ...it, weight: Math.max(0, remainder) };
      }
      return { ...it, weight: baseWeight };
    });
  }

  if (l === 0) {
    // All duties are key duties: each receives equal higher weight = 100 / k
    const baseWeight = Math.floor((100 / k) * 10) / 10;
    return items.map((it, idx) => {
      if (idx === k - 1) {
        const allocated = baseWeight * (k - 1);
        const remainder = Math.round((100 - allocated) * 10) / 10;
        return { ...it, weight: Math.max(0, remainder) };
      }
      return { ...it, weight: baseWeight };
    });
  }

  // Both key duties and lower duties exist:
  // Key duties are given higher equal weights (2x of lower duties)
  // k * (2 * w_low) + l * w_low = 100 => w_low = 100 / (2k + l)
  const rawLower = 100 / (2 * k + l);
  const lowerWeight = Math.floor(rawLower * 10) / 10;
  const keyWeight = Math.floor(2 * lowerWeight * 10) / 10;

  let allocated = 0;
  return items.map((it, idx) => {
    if (idx === n - 1) {
      const remainder = Math.round((100 - allocated) * 10) / 10;
      return { ...it, weight: Math.max(0, remainder) };
    }
    const w = it.isKey ? keyWeight : lowerWeight;
    allocated += w;
    return { ...it, weight: w };
  });
}

interface DepartmentsViewProps {
  staffList: StaffMember[];
  onUpdateStaffList: (updated: StaffMember[]) => void;
  isLight?: boolean;
  settings?: AppSettings;
  user?: User;
}

const DEPARTMENTS_STORAGE_KEY = 'skima_departments_v2';
const TRANSFERS_STORAGE_KEY = 'skima_dept_transfers_v2';

export const INITIAL_DEPARTMENTS: DepartmentInfo[] = [];

/**
 * Searchable, dynamic reports-to selector across all departments and roles.
 */
const SearchableReportsToSelect: React.FC<{
  value?: string;
  onChange: (value: string) => void;
  options: { role: string; department: string }[];
  currentRoleTitle?: string;
}> = ({ value, onChange, options, currentRoleTitle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredOptions = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    return options.filter((opt) => {
      if (currentRoleTitle && opt.role.toLowerCase() === currentRoleTitle.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      return (
        opt.role.toLowerCase().includes(q) ||
        opt.department.toLowerCase().includes(q)
      );
    });
  }, [options, query, currentRoleTitle]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer max-w-[170px] sm:max-w-[210px] truncate ${
          value
            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
        }`}
        title={value ? `Reports to: ${value}` : 'Select Reports To supervisor role'}
      >
        <UserCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <span className="truncate">{value ? `To: ${value}` : 'Reports to...'}</span>
        <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 sm:left-0 sm:right-auto mt-1 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2 z-50 space-y-1.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search roles or departments..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="w-full text-left px-2 py-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Clear Reports To</span>
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="p-2 text-center text-xs text-slate-400">
                <p>No matching roles found.</p>
                {query.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(query.trim());
                      setIsOpen(false);
                    }}
                    className="mt-1 px-2 py-1 rounded bg-blue-600 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Set custom: "{query.trim()}"
                  </button>
                )}
              </div>
            ) : (
              filteredOptions.map((opt, oIdx) => {
                const isSelected = value?.toLowerCase().trim() === opt.role.toLowerCase().trim();
                return (
                  <button
                    key={`${opt.role}-${opt.department}-${oIdx}`}
                    type="button"
                    onClick={() => {
                      onChange(opt.role);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="truncate flex-1">
                      <div className="font-semibold truncate">{opt.role}</div>
                      <div
                        className={`text-[10px] truncate ${
                          isSelected ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {opt.department}
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const DepartmentsView: React.FC<DepartmentsViewProps> = ({
  staffList,
  onUpdateStaffList,
  isLight = false,
  settings,
  user,
}) => {
  const companyName =
    (user?.company && user.company.trim()) ||
    (settings?.companyName && settings.companyName.trim()) ||
    getActiveOrganizationName(settings);
  const currencySymbol = getCompanyCurrencySymbol(companyName);
  const payrollConfig = loadCompanyPayrollConfig(companyName);
  const configuredPayGrades = payrollConfig.payGrades || [];
  // Departments State - Deduped and cleaned by default, loaded per active company
  const [departments, setDepartments] = useState<DepartmentInfo[]>(() => {
    try {
      return getCleanDepartments(companyName);
    } catch (e) {
      console.error('Failed to load saved departments:', e);
    }
    return [];
  });

  // Transfers History State - Empty by default, loaded per active company
  const [transfersHistory, setTransfersHistory] = useState<DepartmentTransferRecord[]>(() => {
    try {
      const isDemo = typeof window !== 'undefined' && localStorage.getItem('skima_is_demo_session') === 'true';
      const parsed = loadCompanyData<DepartmentTransferRecord[]>(STORAGE_KEYS.TRANSFERS, companyName, []);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (!isDemo) {
          const cleaned = parsed.filter(
            (t: DepartmentTransferRecord) =>
              t.id !== 'TRF-SKM-2026-001' &&
              !['david chen', 'sarah jenkins', 'elena rostova', 'amina diallo', 'marcus vance', 'kofi mensah'].includes(
                (t.staffName || '').trim().toLowerCase()
              )
          );
          saveCompanyData(STORAGE_KEYS.TRANSFERS, cleaned, companyName);
          return cleaned;
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load transfers history:', e);
    }
    return [];
  });

  // Sync state if company changes
  const activeCompanyRef = useRef(companyName);
  useEffect(() => {
    if (activeCompanyRef.current !== companyName) {
      activeCompanyRef.current = companyName;
      const isDemo = typeof window !== 'undefined' && localStorage.getItem('skima_is_demo_session') === 'true';
      const cleanDepts = getCleanDepartments(companyName);
      const loadedTransfers = loadCompanyData<DepartmentTransferRecord[]>(STORAGE_KEYS.TRANSFERS, companyName, []);
      
      const cleanTransfers = Array.isArray(loadedTransfers)
        ? isDemo
          ? loadedTransfers
          : loadedTransfers.filter(
              (t: DepartmentTransferRecord) =>
                t.id !== 'TRF-SKM-2026-001' &&
                !['david chen', 'sarah jenkins', 'elena rostova', 'amina diallo', 'marcus vance', 'kofi mensah'].includes(
                  (t.staffName || '').trim().toLowerCase()
                )
            )
        : [];

      setDepartments(cleanDepts);
      setTransfersHistory(cleanTransfers);
    }
  }, [companyName]);

  // Listen for external undo/transfer changes
  useEffect(() => {
    const handleTransfersUpdated = () => {
      const refreshed = loadCompanyData<DepartmentTransferRecord[]>(STORAGE_KEYS.TRANSFERS, companyName, []);
      if (Array.isArray(refreshed)) {
        setTransfersHistory(refreshed);
      }
    };
    window.addEventListener('skima_transfers_updated', handleTransfersUpdated);
    window.addEventListener('skima_move_undone', handleTransfersUpdated);
    return () => {
      window.removeEventListener('skima_transfers_updated', handleTransfersUpdated);
      window.removeEventListener('skima_move_undone', handleTransfersUpdated);
    };
  }, [companyName]);

  // Save departments to company scoped storage with duplicate prevention
  useEffect(() => {
    if (activeCompanyRef.current === companyName && departments.length > 0) {
      try {
        saveCleanDepartments(departments, companyName);
      } catch (e) {
        console.error('Failed to save departments:', e);
      }
    }
  }, [departments, companyName]);

  // Save transfers to company scoped storage
  useEffect(() => {
    if (activeCompanyRef.current === companyName) {
      try {
        saveCompanyData(STORAGE_KEYS.TRANSFERS, transfersHistory, companyName);
      } catch (e) {
        console.error('Failed to save transfers history:', e);
      }
    }
  }, [transfersHistory, companyName]);

  // Ensure departments from staff list exist in department structure without creating ghost sample entries
  useEffect(() => {
    const existingNames = new Set(departments.map((d) => d.name.toLowerCase()));
    const existingCodes = new Set(departments.map((d) => (d.code || '').toUpperCase()));
    const missingDepts: DepartmentInfo[] = [];

    staffList.forEach((s) => {
      const deptName = (s.department || '').trim();
      if (
        deptName &&
        !['unassigned', 'n/a', 'none', 'null', 'undefined'].includes(deptName.toLowerCase()) &&
        !existingNames.has(deptName.toLowerCase())
      ) {
        existingNames.add(deptName.toLowerCase());
        const baseCode = deptName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'DPT';
        let code = baseCode;
        let counter = 1;
        while (existingCodes.has(code)) {
          code = `${baseCode}${counter++}`;
        }
        existingCodes.add(code);

        missingDepts.push({
          id: `dept-${code.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: deptName,
          code: code,
          headOfDepartment: '',
          description: `Department for ${deptName}`,
        });
      }
    });

    if (missingDepts.length > 0) {
      setDepartments((prev) => [...prev, ...missingDepts]);
    }
  }, [staffList, departments]);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);

  // Per-department active role filter inside department cards (multi-select up to 2 roles)
  const [selectedDeptRoles, setSelectedDeptRoles] = useState<Record<string, string[]>>({});
  const [openRoleFilterDeptId, setOpenRoleFilterDeptId] = useState<string | null>(null);

  // Accordion state for roles in Edit/Add department modal (only one role dropdown open at once)
  const [openRoleIndex, setOpenRoleIndex] = useState<number | null>(0);

  // Role Details, Description & Reporting Structure Modal
  const [activeRoleSummaryModal, setActiveRoleSummaryModal] = useState<{
    roleIndex: number;
    roleTitle: string;
    summary: string;
    targets?: string;
    reportsToDept: string;
    reportsToRole: string;
    customReportsToRole: string;
    isCustomRole: boolean;
  } | null>(null);

  // Map Duty to Generic KPI Radar Parameters Modal state
  const [paramMappingTarget, setParamMappingTarget] = useState<{ roleIndex: number; dutyIndex: number } | null>(null);

  // Generic KPI parameters for Radar Chart comparison & Employee of the Month
  const GENERIC_KPI_PARAMETERS = useMemo(
    () => [
      {
        id: 'Regularity',
        name: 'Regularity',
        description: 'Attendance consistency, active scheduled shifts & minimal absenteeism',
      },
      {
        id: 'Punctuality',
        name: 'Punctuality',
        description: 'On-time clock-ins rigidly mapped across all uploaded attendance worksheets',
      },
      {
        id: 'Task Execution',
        name: 'Task Execution',
        description: 'Appraisal completion scores on core role duties and defined deliverables',
      },
      {
        id: 'Discipline & Compliance',
        name: 'Discipline & Compliance',
        description: 'Code of conduct adherence, absence of queries, disciplinary warnings & fines',
      },
      {
        id: 'Operational Output',
        name: 'Operational Output',
        description: 'Measurable productivity and deliverable completion on weighted duties',
      },
      {
        id: 'Initiative & Cooperation',
        name: 'Initiative & Cooperation',
        description: 'Team collaboration, proactive leadership and active welfare engagement',
      },
    ],
    []
  );

  // Dynamically search through all departments, roles, and executive positions
  const allOrgRolesAndDepts = React.useMemo(() => {
    const list: { role: string; department: string }[] = [
      { role: 'CEO / Managing Director', department: 'Executive Management' },
      { role: 'Chief Operating Officer (COO)', department: 'Executive Management' },
      { role: 'Chief Technology Officer (CTO)', department: 'Executive Management' },
      { role: 'Chief Financial Officer (CFO)', department: 'Executive Management' },
      { role: 'Board of Directors', department: 'Executive Governance' },
      { role: 'Head of Department', department: 'Department Leadership' },
    ];

    departments.forEach((d) => {
      if (d.headOfDepartment && d.headOfDepartment.trim() && d.headOfDepartment !== 'Unassigned') {
        const leadTitle = `Head of ${d.name} (${d.headOfDepartment.trim()})`;
        if (!list.some((it) => it.role.toLowerCase() === leadTitle.toLowerCase())) {
          list.push({ role: leadTitle, department: d.name });
        }
      }
      (d.roles || []).forEach((r) => {
        if (r.title && r.title.trim()) {
          const title = r.title.trim();
          if (!list.some((it) => it.role.toLowerCase() === title.toLowerCase() && it.department.toLowerCase() === d.name.toLowerCase())) {
            list.push({ role: title, department: d.name });
          }
        }
      });
    });

    staffList.forEach((s) => {
      if (s.role && s.role.trim() && s.role !== 'N/A') {
        const title = s.role.trim();
        const deptName = s.department || 'General';
        if (!list.some((it) => it.role.toLowerCase() === title.toLowerCase())) {
          list.push({ role: title, department: deptName });
        }
      }
    });

    return list;
  }, [departments, staffList]);

  // Toggle role filter on department card (max 2 roles)
  const handleToggleRoleFilter = (deptId: string, roleTitle: string) => {
    const current = selectedDeptRoles[deptId] || [];
    const isSelected = current.some((r) => r.toLowerCase().trim() === roleTitle.toLowerCase().trim());
    
    if (isSelected) {
      setSelectedDeptRoles((prev) => ({
        ...prev,
        [deptId]: (prev[deptId] || []).filter((r) => r.toLowerCase().trim() !== roleTitle.toLowerCase().trim()),
      }));
    } else {
      if (current.length >= 2) {
        emitGlobalToast('You can select a maximum of 2 roles per department filter.', 'warning');
        return;
      }
      setSelectedDeptRoles((prev) => ({
        ...prev,
        [deptId]: [...(prev[deptId] || []), roleTitle],
      }));
      setExpandedDeptId(deptId);
    }
  };

  const handleClearRoleFilter = (deptId: string) => {
    setSelectedDeptRoles((prev) => ({
      ...prev,
      [deptId]: [],
    }));
  };

  // Click outside to close role filter dropdown
  useEffect(() => {
    const handleFilterClickOutside = (e: MouseEvent) => {
      if (openRoleFilterDeptId && !(e.target as HTMLElement).closest('.role-filter-dropdown-container')) {
        setOpenRoleFilterDeptId(null);
      }
    };
    if (openRoleFilterDeptId) {
      document.addEventListener('mousedown', handleFilterClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleFilterClickOutside);
    };
  }, [openRoleFilterDeptId]);

  // Modals state
  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
  const [isUploadDeptModalOpen, setIsUploadDeptModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isRecentTransfersModalOpen, setIsRecentTransfersModalOpen] = useState(false);
  const [transferHistoryFilter, setTransferHistoryFilter] = useState<'all' | '30days'>('all');
  const [selectedTransferForLetter, setSelectedTransferForLetter] = useState<DepartmentTransferRecord | null>(null);
  const [editingDept, setEditingDept] = useState<DepartmentInfo | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<DepartmentInfo | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<{ roleIndex: number; roleTitle: string } | null>(null);
  const [copiedLetterNotice, setCopiedLetterNotice] = useState(false);
  const [letterSalaryInput, setLetterSalaryInput] = useState<number>(0);
  const [salaryUpdateNotice, setSalaryUpdateNotice] = useState<string | null>(null);

  // Sync letterSalaryInput when selectedTransferForLetter changes
  useEffect(() => {
    if (selectedTransferForLetter) {
      const currentStaff = staffList.find(
        (s) => s.employeeId === selectedTransferForLetter.employeeId || s.name === selectedTransferForLetter.staffName
      );
      const currentSal =
        selectedTransferForLetter.newSalary !== undefined
          ? selectedTransferForLetter.newSalary
          : (currentStaff?.estimatedMonthlySalary || 0);
      setLetterSalaryInput(currentSal);
    }
  }, [selectedTransferForLetter, staffList]);

  // Department Form State
  const [deptForm, setDeptForm] = useState<{
    name: string;
    code: string;
    headOfDepartment: string;
    description: string;
    roles: DepartmentRole[];
  }>({
    name: '',
    code: '',
    headOfDepartment: '',
    description: '',
    roles: [],
  });

  // Client tenant departments (dynamically retrieved from client-created departments including the current one being edited)
  const tenantDepartments = React.useMemo(() => {
    const list: { id: string; name: string; headOfDepartment?: string; roles: string[] }[] = [];
    const seenNames = new Set<string>();

    // 1. Client-created departments from tenant storage
    departments.forEach((d) => {
      const dName = (d.name || '').trim();
      if (dName && !seenNames.has(dName.toLowerCase())) {
        seenNames.add(dName.toLowerCase());
        const rTitles = (d.roles || []).map((r) => r.title?.trim()).filter(Boolean) as string[];
        list.push({
          id: d.id,
          name: dName,
          headOfDepartment: d.headOfDepartment?.trim(),
          roles: rTitles,
        });
      }
    });

    // 2. Client-created current department being edited in deptForm
    const curName = (deptForm.name || '').trim() || (editingDept?.name || '').trim();
    if (curName) {
      const curRoles = deptForm.roles.map((r) => r.title?.trim()).filter(Boolean) as string[];
      const existingIdx = list.findIndex((it) => it.name.toLowerCase() === curName.toLowerCase());
      if (existingIdx >= 0) {
        list[existingIdx] = {
          ...list[existingIdx],
          name: curName,
          headOfDepartment: deptForm.headOfDepartment?.trim() || list[existingIdx].headOfDepartment,
          roles: Array.from(new Set([...list[existingIdx].roles, ...curRoles])),
        };
      } else {
        list.push({
          id: editingDept?.id || 'current-dept',
          name: curName,
          headOfDepartment: deptForm.headOfDepartment?.trim(),
          roles: curRoles,
        });
      }
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [departments, deptForm.name, deptForm.headOfDepartment, deptForm.roles, editingDept]);

  // Available roles for the currently selected reports-to department in activeRoleSummaryModal
  const availableRolesForSelectedDept = React.useMemo(() => {
    if (!activeRoleSummaryModal) return [];
    const deptName = activeRoleSummaryModal.reportsToDept;
    if (!deptName) return [];
    const found = tenantDepartments.find((d) => d.name.toLowerCase() === deptName.toLowerCase());
    if (!found) return [];
    const rolesList: string[] = [];
    if (found.headOfDepartment && found.headOfDepartment.trim() && found.headOfDepartment !== 'Unassigned') {
      rolesList.push(`Head of ${found.name} (${found.headOfDepartment.trim()})`);
    }
    found.roles.forEach((rTitle) => {
      // Don't report to itself if it's the exact same role in the current department
      if (
        found.name.toLowerCase() === (deptForm.name || '').trim().toLowerCase() &&
        rTitle.toLowerCase() === activeRoleSummaryModal.roleTitle.toLowerCase()
      ) {
        return;
      }
      if (!rolesList.some((existing) => existing.toLowerCase() === rTitle.toLowerCase())) {
        rolesList.push(rTitle);
      }
    });
    return rolesList;
  }, [activeRoleSummaryModal, tenantDepartments, deptForm.name]);

  // Helper to resolve department and role from existing reportsTo string
  const parseReportsTo = (reportsToStr?: string) => {
    if (!reportsToStr || !reportsToStr.trim()) {
      return { dept: '', role: '', isCustom: false };
    }
    const trimmed = reportsToStr.trim();
    // Check if format has (Department)
    const match = trimmed.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      return { role: match[1].trim(), dept: match[2].trim(), isCustom: false };
    }
    for (const d of tenantDepartments) {
      if (d.roles && d.roles.some((ro) => ro.toLowerCase() === trimmed.toLowerCase())) {
        return { dept: d.name, role: trimmed, isCustom: false };
      }
      if (d.headOfDepartment && d.headOfDepartment.toLowerCase() === trimmed.toLowerCase()) {
        return { dept: d.name, role: trimmed, isCustom: false };
      }
    }
    return { dept: '', role: trimmed, isCustom: true };
  };

  // Transfer Form State
  const [transferForm, setTransferForm] = useState({
    staffId: '',
    toDepartment: '',
    toRole: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    reason: '',
    authorizedBy: 'HR Administration',
    newSalary: 0,
  });

  // Batch Upload Input
  const [uploadCsvText, setUploadCsvText] = useState('');

  // Filtered departments by search
  const filteredDepts = departments.filter((d) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      d.name.toLowerCase().includes(term) ||
      d.code.toLowerCase().includes(term) ||
      d.headOfDepartment.toLowerCase().includes(term) ||
      d.description.toLowerCase().includes(term)
    );
  });

  // Open Add Department Modal
  const handleOpenAddModal = () => {
    setDeptForm({
      name: '',
      code: '',
      headOfDepartment: '',
      description: '',
      roles: [],
    });
    setEditingDept(null);
    setOpenRoleIndex(null);
    setIsAddDeptModalOpen(true);
  };

  // Open Edit Department Modal
  const handleOpenEditModal = (dept: DepartmentInfo) => {
    // Deep clone roles and ensure stable role IDs
    const clonedRoles = (dept.roles || []).map((r, idx) => ({
      ...r,
      id: r.id || `role-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      reportsTo: r.reportsTo || '',
      summary: r.summary || r.jobDescription || '',
      targets: r.targets || '',
      items: (r.items || []).map((it, itemIdx) => ({
        ...it,
        id: it.id || `item-${Date.now()}-${itemIdx}`,
        target: it.target || '',
        weight: typeof it.weight === 'number' ? it.weight : (it.isKey ? 25 : 15),
      })),
    }));

    const clonedDept: DepartmentInfo = {
      ...dept,
      roles: clonedRoles,
    };

    setEditingDept(clonedDept);
    setDeptForm({
      name: dept.name,
      code: dept.code,
      headOfDepartment: dept.headOfDepartment,
      description: dept.description,
      roles: JSON.parse(JSON.stringify(clonedRoles)),
    });
    setOpenRoleIndex(clonedRoles.length > 0 ? 0 : null);
    setIsAddDeptModalOpen(true);
  };

  // Save / Update Department
  const handleSaveDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    const newName = deptForm.name.trim();
    if (!newName) {
      emitGlobalToast('Please enter a valid Department Name.', 'warning');
      return;
    }

    const proposedCode =
      deptForm.code.trim().toUpperCase() ||
      newName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() ||
      'DEPT';

    const isSameDept = (d: DepartmentInfo) => {
      if (!editingDept) return false;
      if (editingDept.id && d.id && editingDept.id === d.id) return true;
      if (editingDept.name && d.name && editingDept.name.trim().toLowerCase() === d.name.trim().toLowerCase()) return true;
      return false;
    };

    // Validate unique department code / ID
    const isCodeDuplicate = departments.some(
      (d) => !isSameDept(d) && d.code.trim().toUpperCase() === proposedCode
    );
    if (isCodeDuplicate) {
      emitGlobalToast(`Department Code / ID "${proposedCode}" is already in use by another department. All Department IDs must be unique.`, 'warning');
      return;
    }

    // Validate unique department name
    const isNameDuplicate = departments.some(
      (d) => !isSameDept(d) && d.name.trim().toLowerCase() === newName.toLowerCase()
    );
    if (isNameDuplicate) {
      emitGlobalToast(`Department name "${newName}" already exists. Please enter a unique department name.`, 'warning');
      return;
    }

    // Validate unique role titles in department
    const roleTitlesLower = deptForm.roles
      .map((r) => (r.title || '').trim().toLowerCase())
      .filter(Boolean);
    const hasDuplicateRoles = roleTitlesLower.some(
      (title, idx) => roleTitlesLower.indexOf(title) !== idx
    );
    if (hasDuplicateRoles) {
      emitGlobalToast('Role names must be unique within a department. Please resolve duplicate role titles before saving.', 'warning');
      return;
    }

    const cleanedRoles = deptForm.roles
      .filter((r) => (r.title || '').trim() !== '')
      .map((r) => {
        const title = (r.title || '').trim();
        const items = (r.items || [])
          .filter((it) => it.text && it.text.trim() !== '')
          .map((it) => ({
            ...it,
            text: it.text.trim(),
            keyword: (it.keyword || '').trim(),
            isKey: !!it.isKey,
            target: (it.target || '').trim(),
            weight: typeof it.weight === 'number' ? it.weight : (it.isKey ? 25 : 15),
          }));
        const summary = (r.summary || r.jobDescription || '').trim();
        const targets = (r.targets || '').trim();
        const reportsTo = (r.reportsTo || '').trim();
        const jobDescription =
          summary ||
          (r.jobDescription || '').trim() ||
          (items.length > 0 ? items.map((it) => it.text).join('; ') : '');
        return {
          ...r,
          title,
          summary,
          targets,
          reportsTo,
          jobDescription,
          items,
        };
      });

    // Validate that summation of duty weights for each role does not exceed 100%
    for (const role of cleanedRoles) {
      const sum = (role.items || []).reduce((acc, it) => acc + (typeof it.weight === 'number' ? it.weight : (it.isKey ? 25 : 15)), 0);
      if (sum > 100.05) {
        emitGlobalToast(`The summation of duty weights for role "${role.title}" is ${Math.round(sum * 10) / 10}%, which is greater than 100%. The summation must not be greater than 100%. Please adjust weights or auto-calculate.`, 'warning');
        return;
      }
    }

    let updatedDepts: DepartmentInfo[] = [];

    if (editingDept) {
      const oldName = editingDept.name;
      const oldRoles = editingDept.roles || [];

      // Map renamed role titles (by role ID or index fallback)
      const roleRenameMap = new Map<string, string>();
      oldRoles.forEach((oldR, idx) => {
        const oldTitle = (oldR.title || '').trim();
        let newR = cleanedRoles.find((r) => r.id && oldR.id && r.id === oldR.id);
        if (!newR && cleanedRoles[idx]) {
          newR = cleanedRoles[idx];
        }
        if (
          newR &&
          oldTitle !== '' &&
          (newR.title || '').trim() !== '' &&
          oldTitle.toLowerCase() !== (newR.title || '').trim().toLowerCase()
        ) {
          roleRenameMap.set(oldTitle.toLowerCase(), (newR.title || '').trim());
        }
      });

      updatedDepts = departments.map((d) =>
        isSameDept(d)
          ? {
              ...d,
              id: d.id || editingDept.id || `dept-${Date.now()}`,
              name: newName,
              code: proposedCode,
              headOfDepartment: deptForm.headOfDepartment.trim() || 'Unassigned',
              description: deptForm.description.trim(),
              roles: cleanedRoles,
            }
          : d
      );
      setDepartments(updatedDepts);

      const validRoleTitles = cleanedRoles.map((r) => (r.title || '').trim().toLowerCase());
      const updatedStaff = staffList.map((s) => {
        const sDept = (s.department || '').trim().toLowerCase();
        const isDeptMatch =
          sDept === oldName.trim().toLowerCase() || sDept === newName.trim().toLowerCase();

        if (isDeptMatch) {
          const sRoleLower = (s.role || '').trim().toLowerCase();
          let updatedRole = s.role;

          if (roleRenameMap.has(sRoleLower)) {
            updatedRole = roleRenameMap.get(sRoleLower)!;
          } else if (sRoleLower !== '' && sRoleLower !== 'n/a') {
            const isRoleValid = validRoleTitles.includes(sRoleLower);
            if (!isRoleValid) {
              updatedRole = cleanedRoles.length > 0 ? cleanedRoles[0].title : 'N/A';
            }
          }

          return {
            ...s,
            department: newName,
            role: updatedRole,
          };
        }
        return s;
      });

      onUpdateStaffList(updatedStaff);
      emitGlobalToast(`Department "${newName}" updated successfully`, 'success');
    } else {
      // Check if a department with this name already exists
      const existingDept = departments.find(
        (d) => d.name.trim().toLowerCase() === newName.toLowerCase()
      );
      if (existingDept) {
        emitGlobalToast(`Department "${newName}" already exists. Please edit the existing department.`, 'warning');
        return;
      }

      const safeId = `dept-${proposedCode.toLowerCase()}-${Date.now()}`;
      const newDept: DepartmentInfo = {
        id: safeId,
        name: newName,
        code: proposedCode,
        headOfDepartment: deptForm.headOfDepartment.trim() || 'Unassigned',
        description: deptForm.description.trim() || 'Standard operational unit.',
        roles: cleanedRoles,
      };
      updatedDepts = deduplicateDepartments([...departments, newDept]);
      setDepartments(updatedDepts);
      emitGlobalToast(`Department "${newName}" created successfully`, 'success');
    }

    try {
      saveCleanDepartments(updatedDepts, companyName);
    } catch (err) {
      console.error('Failed saving departments to storage:', err);
    }

    setIsAddDeptModalOpen(false);
    setEditingDept(null);
  };

  // Delete Department - SET ALL ASSIGNED STAFF TO 'Unassigned'
  const handleDeleteDept = (dept: DepartmentInfo) => {
    const staffInDept = staffList.filter((s) => s.department === dept.name);
    if (staffInDept.length > 0) {
      const updatedStaff = staffList.map((s) =>
        s.department === dept.name ? { ...s, department: 'Unassigned', role: 'N/A' } : s
      );
      onUpdateStaffList(updatedStaff);
    }
    setDepartments(departments.filter((d) => d.id !== dept.id));
    emitGlobalToast(`Department "${dept.name}" deleted`, 'warning');
  };

  // Open Transfer Modal with optional preset staff
  const handleOpenTransferModal = (preselectedStaffId?: string) => {
    const firstStaff =
      staffList.find((s) => s.id === preselectedStaffId || s.employeeId === preselectedStaffId) ||
      staffList[0];
    const currentDept = firstStaff?.department || 'Unassigned';
    const availableTargets = departments.filter((d) => d.name !== currentDept);
    const targetDept = availableTargets[0];
    const targetDeptObj = targetDept ? departments.find((d) => d.name === targetDept.name) : null;
    const initialRole = targetDeptObj?.roles?.[0]?.title || firstStaff?.role || '';

    setTransferForm({
      staffId: firstStaff ? firstStaff.id : '',
      toDepartment: targetDept ? targetDept.name : '',
      toRole: initialRole,
      effectiveDate: new Date().toISOString().split('T')[0],
      reason: '',
      authorizedBy: 'HR Administration',
      newSalary: firstStaff ? (firstStaff.estimatedMonthlySalary || 0) : 0,
    });
    setIsTransferModalOpen(true);
  };

  // Execute Department Transfer
  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const staffMember = staffList.find(
      (s) => s.id === transferForm.staffId || s.employeeId === transferForm.staffId
    );
    if (!staffMember) {
      emitGlobalToast('Please select a staff member to transfer.', 'warning');
      return;
    }

    const oldDept = staffMember.department || 'Unassigned';
    let newDept = transferForm.toDepartment;

    if (!newDept || newDept === oldDept) {
      const validTarget = departments.find((d) => d.name !== oldDept);
      if (!validTarget) {
        emitGlobalToast('Destination department must be different from current department. Please add more departments first.', 'warning');
        return;
      }
      newDept = validTarget.name;
    }

    const assignedRole = transferForm.toRole.trim() || staffMember.role || 'Staff Member';
    const previousSalary = staffMember.estimatedMonthlySalary || 0;
    const finalNewSalary =
      Number(transferForm.newSalary) >= 0 ? Number(transferForm.newSalary) : previousSalary;

    // Update staff list
    const updatedStaffList = staffList.map((s) =>
      s.id === staffMember.id || (staffMember.employeeId && s.employeeId === staffMember.employeeId)
        ? { ...s, department: newDept, role: assignedRole, estimatedMonthlySalary: finalNewSalary }
        : s
    );
    onUpdateStaffList(updatedStaffList);

    // Create transfer log entry
    const newRecord: DepartmentTransferRecord = {
      id: `TRF-SKM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      employeeId: staffMember.employeeId,
      staffName: staffMember.name,
      fromDepartment: oldDept,
      toDepartment: newDept,
      fromRole: staffMember.role || 'Staff Member',
      toRole: assignedRole,
      previousSalary,
      newSalary: finalNewSalary,
      effectiveDate: transferForm.effectiveDate || new Date().toISOString().split('T')[0],
      reason: transferForm.reason.trim() || 'Internal departmental realignment and operational assignment.',
      authorizedBy: transferForm.authorizedBy.trim() || 'HR Administration',
      createdAt: new Date().toISOString(),
    };

    setTransfersHistory([newRecord, ...transfersHistory]);
    setIsTransferModalOpen(false);
    emitGlobalToast(`Transfer confirmed: ${staffMember.name} transferred to ${newDept} as ${assignedRole}`, 'success');
    window.dispatchEvent(new CustomEvent('skima_transfers_updated'));

    // Automatically open Transfer Letter Modal
    setSelectedTransferForLetter(newRecord);
  };

  // Update Salary Directly from Letter View Modal
  const handleUpdateSalaryInLetterModal = (newSal: number) => {
    if (!selectedTransferForLetter) return;

    const currentStaff = staffList.find(
      (s) => s.employeeId === selectedTransferForLetter.employeeId || s.name === selectedTransferForLetter.staffName
    );

    const prevSal =
      selectedTransferForLetter.previousSalary !== undefined
        ? selectedTransferForLetter.previousSalary
        : (currentStaff?.estimatedMonthlySalary || newSal);

    const updatedRecord: DepartmentTransferRecord = {
      ...selectedTransferForLetter,
      previousSalary: prevSal,
      newSalary: newSal,
    };

    setSelectedTransferForLetter(updatedRecord);

    const updatedHistory = transfersHistory.map((t) =>
      t.id === updatedRecord.id ? updatedRecord : t
    );
    setTransfersHistory(updatedHistory);

    if (currentStaff) {
      const updatedStaffList = staffList.map((s) =>
        s.id === currentStaff.id ? { ...s, estimatedMonthlySalary: newSal } : s
      );
      onUpdateStaffList(updatedStaffList);
    }

    setSalaryUpdateNotice('Salary updated and synced across staff directory & lists!');
    emitGlobalToast('Salary updated and synchronized across all records', 'success');
    setTimeout(() => setSalaryUpdateNotice(null), 3500);
  };

  // Helper to parse standard CSV row handling quotes and delimiters
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === ',' || (!line.includes(',') && char === '\t')) && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Process Batch CSV Upload (Includes Roles & Job Descriptions)
  const handleProcessUploadDepartments = (text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
    if (lines.length === 0) return;

    const deptsMap = new Map<string, DepartmentInfo>();
    departments.forEach((d) => {
      deptsMap.set(d.name.toLowerCase().trim(), {
        ...d,
        roles: (d.roles || []).map((r) => ({
          ...r,
          items: r.items ? [...r.items] : [],
        })),
      });
    });

    const firstLineCols = parseCsvLine(lines[0]).map((c) => c.toLowerCase());
    const isHeader =
      firstLineCols.some((c) => c.includes('name') || c.includes('department') || c.includes('code') || c.includes('role'));
    const startIdx = isHeader ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = parseCsvLine(lines[i]);
      if (parts.length >= 1 && parts[0]) {
        const name = parts[0];
        const code = parts[1] || name.slice(0, 3).toUpperCase();
        const head = parts[2] || 'Unassigned';
        const desc = parts[3] || 'Uploaded department unit';
        const roleTitle = parts[4] || '';

        const items: JobDescriptionItem[] = [];
        for (let c = 5; c < parts.length; c++) {
          if (parts[c] && parts[c].trim() !== '') {
            items.push({
              id: `item-csv-${Date.now()}-${i}-${c}`,
              text: parts[c].trim(),
              isKey: items.length === 0,
            });
          }
        }

        const deptKey = name.toLowerCase().trim();
        let dept = deptsMap.get(deptKey);
        if (!dept) {
          dept = {
            id: `dept-upload-${Date.now()}-${i}`,
            name,
            code: code.toUpperCase(),
            headOfDepartment: head,
            description: desc,
            roles: [],
          };
          deptsMap.set(deptKey, dept);
        } else {
          if (code && code !== dept.code) dept.code = code.toUpperCase();
          if (head && head !== 'Unassigned') dept.headOfDepartment = head;
          if (desc && desc !== 'Uploaded department unit') dept.description = desc;
        }

        if (roleTitle && roleTitle.trim() !== '') {
          const currentRoles = dept.roles || [];
          const existingRole = currentRoles.find(
            (r) => (r.title || '').toLowerCase().trim() === roleTitle.toLowerCase().trim()
          );

          if (!existingRole) {
            currentRoles.push({
              id: `role-csv-${Date.now()}-${i}`,
              title: roleTitle.trim(),
              items: items.length > 0 ? items : [
                { id: `item-default-${Date.now()}-${i}`, text: `Core deliverables for ${roleTitle.trim()}`, isKey: true },
              ],
              jobDescription: items.length > 0 ? items.map((it) => it.text).join('; ') : `Core deliverables for ${roleTitle.trim()}`,
            });
            dept.roles = currentRoles;
          } else if (items.length > 0) {
            const existingTexts = new Set((existingRole.items || []).map((it) => it.text.toLowerCase().trim()));
            const newItems = items.filter((it) => !existingTexts.has(it.text.toLowerCase().trim()));
            if (newItems.length > 0) {
              existingRole.items = [...(existingRole.items || []), ...newItems];
              existingRole.jobDescription = existingRole.items.map((it) => it.text).join('; ');
            }
          }
        }
      }
    }

    const updatedList = deduplicateDepartments(Array.from(deptsMap.values()));
    setDepartments(updatedList);
    try {
      saveCleanDepartments(updatedList, companyName);
    } catch (e) {
      console.error(e);
    }

    emitGlobalToast(`Department batch import processed successfully! Total active departments: ${updatedList.length}.`, 'success');
    setUploadCsvText('');
    setIsUploadDeptModalOpen(false);
  };

  // Filter transfers for history and last 30 days
  const currentYearMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-08"
  const recentTransfersThisMonth = transfersHistory.filter((t) => {
    if (!t.effectiveDate) return true;
    return t.effectiveDate.startsWith(currentYearMonth);
  });

  const transfersLast30Days = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDateStr = thirtyDaysAgo.toISOString().slice(0, 10);
    return transfersHistory.filter((t) => {
      if (!t.effectiveDate) return true;
      return t.effectiveDate >= cutoffDateStr;
    });
  }, [transfersHistory]);

  const displayedTransfers = transferHistoryFilter === '30days' ? transfersLast30Days : transfersHistory;

  // Export Departments & Roles CSV in the exact format compatible with batch import
  const handleExportCSV = () => {
    const headers = [
      'Department Name',
      'Department Code',
      'Head of Department',
      'Description',
      'Role Title',
      'Key Duty 1',
      'Key Duty 2',
      'Key Duty 3',
      'Key Duty 4',
      'Key Duty 5',
    ];

    const escapeCsv = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows: string[] = [];

    departments.forEach((dept) => {
      const headStaff = staffList.find((s) => s.name === dept.headOfDepartment || s.id === dept.headOfDepartment);
      const headName = headStaff?.status === 'Suspended' && !dept.headOfDepartment.includes('(suspended)')
        ? `${dept.headOfDepartment} (suspended)`
        : dept.headOfDepartment;

      if (!dept.roles || dept.roles.length === 0) {
        rows.push([
          escapeCsv(dept.name),
          escapeCsv(dept.code),
          escapeCsv(headName),
          escapeCsv(dept.description),
          escapeCsv(''),
          escapeCsv(''),
          escapeCsv(''),
          escapeCsv(''),
          escapeCsv(''),
          escapeCsv(''),
        ].join(','));
      } else {
        dept.roles.forEach((role) => {
          const dutyTexts: string[] = [];
          if (role.items && role.items.length > 0) {
            role.items.forEach((it) => {
              if (it.text && it.text.trim()) dutyTexts.push(it.text.trim());
            });
          } else if (role.jobDescription && role.jobDescription.trim()) {
            const lines = role.jobDescription
              .split(/\r?\n|•|;|\t/)
              .map((l) => l.trim().replace(/^[-*•\d.]\s*/, ''))
              .filter((l) => l.length > 0);
            if (lines.length > 0) {
              dutyTexts.push(...lines);
            } else {
              dutyTexts.push(role.jobDescription.trim());
            }
          }

          const dutyCols: string[] = [];
          for (let i = 0; i < 5; i++) {
            dutyCols.push(escapeCsv(dutyTexts[i] || ''));
          }

          rows.push([
            escapeCsv(dept.name),
            escapeCsv(dept.code),
            escapeCsv(headName),
            escapeCsv(dept.description),
            escapeCsv(role.title),
            ...dutyCols,
          ].join(','));
        });
      }
    });

    const csvContent = '\ufeff' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${companyName.replace(/\s+/g, '_')}_Departments_and_Roles_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    emitGlobalToast('Departments and roles exported to CSV', 'success');
  };

  // Payroll Calculation Data
  const deptPayroll = staffList.reduce((acc, staff) => {
    const dept = staff.department || 'Unassigned';
    acc[dept] = (acc[dept] || 0) + (staff.estimatedMonthlySalary || 0);
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(deptPayroll).map(([department, totalSalary]) => ({
    department,
    totalSalary,
    staffCount: staffList.filter((s) => (s.department || 'Unassigned') === department).length,
  }));

  const totalPayrollWeight = staffList.reduce(
    (sum, s) => sum + (s.estimatedMonthlySalary || 0),
    0
  );
  const avgMonthlySalary =
    staffList.length > 0 ? Math.round(totalPayrollWeight / staffList.length) : 0;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Letter copy helper
  const handleCopyLetter = (transfer: DepartmentTransferRecord) => {
    const currentStaff = staffList.find(
      (s) => s.employeeId === transfer.employeeId || s.name === transfer.staffName
    );

    const prevSal = transfer.previousSalary !== undefined ? transfer.previousSalary : (currentStaff?.estimatedMonthlySalary || 0);
    const newSal = transfer.newSalary !== undefined ? transfer.newSalary : (currentStaff?.estimatedMonthlySalary || prevSal);
    const hasSalaryChange = prevSal !== newSal && transfer.previousSalary !== undefined && transfer.newSalary !== undefined;

    let salarySummaryText = '';
    if (!hasSalaryChange || prevSal === newSal) {
      salarySummaryText = `SUMMARY OF SALARY & COMPENSATION:
-------------------------------------------------------------------
Salary Status:        UNCHANGED / PRESERVED
Monthly Base Salary:  #${newSal.toLocaleString()}
Adjustment Note:      No compensation modifications were applied during this transfer.`;
    } else {
      const diff = newSal - prevSal;
      salarySummaryText = `SUMMARY OF SALARY & COMPENSATION:
-------------------------------------------------------------------
Salary Status:        REVISED / ADJUSTED
Previous Base Salary: #${prevSal.toLocaleString()}
New Revised Salary:   #${newSal.toLocaleString()}
Monthly Adjustment:   ${diff > 0 ? '+' : ''}#${diff.toLocaleString()}/month (${diff > 0 ? 'Salary Increase' : 'Salary Reduction'})`;
    }

    const text = `===================================================================
                 ${companyName.toUpperCase()}
           OFFICIAL DEPARTMENTAL TRANSFER NOTIFICATION
===================================================================

Ref: ${transfer.id}
Date: ${new Date(transfer.createdAt || transfer.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

TO: ${transfer.staffName} (Employee ID: ${transfer.employeeId})
SUBJECT: NOTICE OF INTERNAL DEPARTMENTAL REASSIGNMENT

Dear ${transfer.staffName},

This document serves as formal confirmation of your internal transfer within the organization.

TRANSFER DETAILS:
-------------------------------------------------------------------
Current Department: ${transfer.fromDepartment}
New Department:     ${transfer.toDepartment}
New Assigned Role:  ${transfer.toRole || 'Staff Member'}
Effective Date:     ${transfer.effectiveDate}
Authorization Ref:  ${transfer.authorizedBy || 'HR Administration'}

${salarySummaryText}

OPERATIONAL JUSTIFICATION / REASON:
${transfer.reason || 'Operational workforce reallocation and departmental optimization.'}

COMPENSATION & TERMS:
Please report to your new Department Lead on the effective date.

Sincerely,

________________________________________
${transfer.authorizedBy || 'HR Department Lead'}
${companyName} Operations & Management
===================================================================`;

    navigator.clipboard.writeText(text);
    setCopiedLetterNotice(true);
    setTimeout(() => setCopiedLetterNotice(false), 3000);
  };

  // Download Letter as Word Document (.doc) - Strictly Black & White
  const handleDownloadDoc = (transfer: DepartmentTransferRecord) => {
    const currentStaff = staffList.find(
      (s) => s.employeeId === transfer.employeeId || s.name === transfer.staffName
    );

    const prevSal = transfer.previousSalary !== undefined ? transfer.previousSalary : (currentStaff?.estimatedMonthlySalary || 0);
    const newSal = transfer.newSalary !== undefined ? transfer.newSalary : (currentStaff?.estimatedMonthlySalary || prevSal);
    const diff = newSal - prevSal;
    const isChanged = diff !== 0;

    const htmlDocument = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Departmental Transfer & Compensation Memorandum</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #000000; margin: 40px; line-height: 1.6; background: #ffffff; }
          .header { text-align: center; border-bottom: 2px solid #000000; padding-bottom: 15px; margin-bottom: 25px; }
          .logo { font-size: 20px; font-weight: 800; color: #000000; text-transform: uppercase; letter-spacing: 1.5px; }
          .sub-logo { font-size: 11px; color: #333333; font-weight: 700; text-transform: uppercase; margin-top: 4px; }
          .ref-box { display: flex; justify-content: space-between; font-size: 12px; color: #000000; font-family: monospace; margin-bottom: 25px; border-bottom: 1px solid #000000; padding-bottom: 8px; }
          .section-title { font-size: 13px; font-weight: bold; color: #000000; text-transform: uppercase; margin-top: 20px; margin-bottom: 10px; letter-spacing: 0.5px; border-bottom: 1px solid #000000; padding-bottom: 4px; }
          .table { width: 100%; border-collapse: collapse; margin: 15px 0 25px 0; }
          .table th, .table td { border: 1px solid #000000; padding: 10px 14px; font-size: 13px; color: #000000; }
          .table th { background-color: #f5f5f5; font-weight: bold; text-align: left; width: 35%; color: #000000; }
          .table td { background-color: #ffffff; }
          .salary-box { background: #ffffff; border: 1px solid #000000; padding: 16px; margin: 20px 0; }
          .badge-revised, .badge-preserved { border: 1px solid #000000; color: #000000; font-weight: bold; padding: 3px 8px; font-size: 11px; }
          .reason-box { background: #ffffff; border-left: 3px solid #000000; padding: 12px 16px; margin: 15px 0; font-style: italic; font-size: 13px; color: #000000; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #000000; display: flex; justify-content: space-between; align-items: flex-end; }
          .signature-line { margin-top: 35px; border-top: 1px solid #000000; width: 240px; font-size: 12px; font-weight: bold; text-align: center; padding-top: 5px; color: #000000; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo"><strong>${companyName.toUpperCase()}</strong></div>
          <div class="sub-logo">Official Executive Memorandum & Departmental Reassignment Directive</div>
        </div>

        <div class="ref-box">
          <div><strong>DOCUMENT REF:</strong> ${transfer.id}</div>
          <div><strong>DATE OF ISSUANCE:</strong> ${new Date(transfer.createdAt || transfer.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>

        <p><strong>TO:</strong> ${transfer.staffName} (${transfer.employeeId})<br>
        <strong>SUBJECT:</strong> OFFICIAL NOTICE OF INTERNAL DEPARTMENTAL REASSIGNMENT</p>

        <p>Dear <strong>${transfer.staffName}</strong>,</p>
        <p>This memorandum serves as formal notification of your internal departmental transfer within ${companyName}. Please review the official reassignment directives below:</p>

        <div class="section-title">Departmental Reassignment Overview</div>
        <table class="table">
          <tr><th>Staff Member:</th><td>${transfer.staffName} (ID: ${transfer.employeeId})</td></tr>
          <tr><th>Current Department:</th><td>${transfer.fromDepartment}</td></tr>
          <tr><th>New Assigned Department:</th><td><strong>${transfer.toDepartment}</strong></td></tr>
          <tr><th>New Assigned Role:</th><td><strong>${transfer.toRole || 'Staff Member'}</strong></td></tr>
          <tr><th>Effective Date:</th><td><strong>${transfer.effectiveDate}</strong></td></tr>
          <tr><th>Authorized HR Lead:</th><td>${transfer.authorizedBy || 'HR Administration'}</td></tr>
        </table>

        <div class="section-title">Summary of Salary & Base Compensation</div>
        <div class="salary-box">
          <table style="width: 100%; border: none;">
            <tr>
              <td style="border: none; background: transparent; width: 35%;"><strong>Compensation Status:</strong></td>
              <td style="border: none; background: transparent;">
                ${isChanged
                  ? '<span class="badge-revised">REVISED / ADJUSTED</span>'
                  : '<span class="badge-preserved">UNCHANGED / PRESERVED</span>'}
              </td>
            </tr>
            <tr>
              <td style="border: none; background: transparent;"><strong>Base Salary Bridge:</strong></td>
              <td style="border: none; background: transparent; font-size: 14px;">
                <strong>#${prevSal.toLocaleString()}</strong> &nbsp;&nbsp;&nbsp;&mdash;&gt;&nbsp;&nbsp;&nbsp; <strong>#${newSal.toLocaleString()}</strong>
              </td>
            </tr>
            <tr>
              <td style="border: none; background: transparent;"><strong>Monthly Adjustment:</strong></td>
              <td style="border: none; background: transparent; font-size: 12px; color: #000000;">
                ${isChanged
                  ? (diff > 0 ? `+#${diff.toLocaleString()}/month (Salary Increase)` : `-#${Math.abs(diff).toLocaleString()}/month (Salary Reduction)`)
                  : 'No monthly base compensation change applied during this transfer.'}
              </td>
            </tr>
          </table>
        </div>

        <div class="section-title">Operational Justification</div>
        <div class="reason-box">
          "${transfer.reason || 'Workforce structural balance, operational resource reallocation, and departmental capacity optimization.'}"
        </div>

        <p style="font-size: 12px; color: #000000; margin-top: 20px;">
          Please report directly to the Department Lead of <strong>${transfer.toDepartment}</strong> on the effective date. For any administrative inquiries, please contact HR Operations.
        </p>

        <div class="footer">
          <div>
            <div class="signature-line">${transfer.authorizedBy || 'HR Administration'}</div>
            <div style="font-size: 10px; color: #333333; text-align: center; margin-top: 2px;">Authorized HR Officer</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #000000; font-weight: bold;">
            ✔ VERIFIED CORPORATE DIRECTIVE
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlDocument], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${companyName.replace(/\s+/g, '_')}_Transfer_Letter_${transfer.employeeId}_${transfer.id}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download Letter as PDF / Trigger Print - Strictly Black & White
  const handleDownloadPdf = (transfer: DepartmentTransferRecord) => {
    const currentStaff = staffList.find(
      (s) => s.employeeId === transfer.employeeId || s.name === transfer.staffName
    );

    const prevSal = transfer.previousSalary !== undefined ? transfer.previousSalary : (currentStaff?.estimatedMonthlySalary || 0);
    const newSal = transfer.newSalary !== undefined ? transfer.newSalary : (currentStaff?.estimatedMonthlySalary || prevSal);
    const diff = newSal - prevSal;
    const isChanged = diff !== 0;

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Departmental Transfer - ${transfer.staffName}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #000000; background: #ffffff; line-height: 1.6; padding: 20px; margin: 0; }
          .header { text-align: center; border-bottom: 2px solid #000000; padding-bottom: 12px; margin-bottom: 20px; }
          .logo { font-size: 18pt; font-weight: 900; color: #000000; text-transform: uppercase; letter-spacing: 1px; }
          .sub-logo { font-size: 10pt; color: #333333; font-weight: 700; text-transform: uppercase; margin-top: 4px; }
          .ref-box { display: flex; justify-content: space-between; font-size: 10pt; color: #000000; font-family: monospace; margin-bottom: 20px; border-bottom: 1px solid #000000; padding-bottom: 8px; }
          .section-title { font-size: 11pt; font-weight: bold; color: #000000; text-transform: uppercase; margin-top: 18px; margin-bottom: 8px; border-bottom: 1px solid #000000; padding-bottom: 4px; }
          .table { width: 100%; border-collapse: collapse; margin: 12px 0 18px 0; }
          .table th, .table td { border: 1px solid #000000; padding: 8px 12px; font-size: 10pt; color: #000000; }
          .table th { background-color: #f5f5f5; font-weight: bold; text-align: left; width: 35%; }
          .table td { background-color: #ffffff; }
          .salary-box { background: #ffffff; border: 1px solid #000000; padding: 12px; margin: 15px 0; }
          .reason-box { background: #ffffff; border-left: 3px solid #000000; padding: 10px 14px; margin: 12px 0; font-style: italic; font-size: 10pt; }
          .footer { margin-top: 40px; padding-top: 15px; border-top: 2px solid #000000; display: flex; justify-content: space-between; align-items: flex-end; }
          .signature-line { margin-top: 30px; border-top: 1px solid #000000; width: 220px; font-size: 10pt; font-weight: bold; text-align: center; padding-top: 4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">${companyName.toUpperCase()}</div>
          <div class="sub-logo">Official Departmental Reassignment Notice</div>
        </div>

        <div class="ref-box">
          <div><strong>REF:</strong> ${transfer.id}</div>
          <div><strong>DATE:</strong> ${new Date(transfer.createdAt || transfer.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>

        <p style="font-size: 10.5pt;">
          <strong>TO:</strong> ${transfer.staffName} (${transfer.employeeId})<br>
          <strong>SUBJECT:</strong> OFFICIAL NOTICE OF INTERNAL DEPARTMENTAL REASSIGNMENT
        </p>

        <p style="font-size: 10.5pt;">Dear <strong>${transfer.staffName}</strong>,</p>
        <p style="font-size: 10.5pt;">This document serves as formal notification that your departmental assignment within <strong>${companyName}</strong> has been transferred. Please review the official reassignment directives below:</p>

        <div class="section-title">Departmental Reassignment Overview</div>
        <table class="table">
          <tr><th>Staff Member:</th><td>${transfer.staffName} (ID: ${transfer.employeeId})</td></tr>
          <tr><th>Current Department:</th><td>${transfer.fromDepartment}</td></tr>
          <tr><th>New Assigned Department:</th><td><strong>${transfer.toDepartment}</strong></td></tr>
          <tr><th>New Assigned Role:</th><td><strong>${transfer.toRole || 'Staff Member'}</strong></td></tr>
          <tr><th>Effective Date:</th><td><strong>${transfer.effectiveDate}</strong></td></tr>
          <tr><th>Authorized HR Lead:</th><td>${transfer.authorizedBy || 'HR Administration'}</td></tr>
        </table>

        <div class="section-title">Summary of Salary & Base Compensation</div>
        <div class="salary-box">
          <table style="width: 100%; border: none;">
            <tr>
              <td style="border: none; width: 35%;"><strong>Compensation Status:</strong></td>
              <td style="border: none;"><strong>${isChanged ? 'REVISED / ADJUSTED' : 'UNCHANGED / PRESERVED'}</strong></td>
            </tr>
            <tr>
              <td style="border: none;"><strong>Base Salary Bridge:</strong></td>
              <td style="border: none; font-size: 11pt;">
                <strong>${currencySymbol}${prevSal.toLocaleString()}</strong> &nbsp;&nbsp;&mdash;&gt;&nbsp;&nbsp; <strong>${currencySymbol}${newSal.toLocaleString()}</strong>
              </td>
            </tr>
            <tr>
              <td style="border: none;"><strong>Monthly Adjustment:</strong></td>
              <td style="border: none; font-size: 9.5pt;">
                ${isChanged
                  ? (diff > 0 ? `+${currencySymbol}${diff.toLocaleString()}/month (Salary Increase)` : `-${currencySymbol}${Math.abs(diff).toLocaleString()}/month (Salary Reduction)`)
                  : 'No monthly base compensation change applied during this transfer.'}
              </td>
            </tr>
          </table>
        </div>

        <div class="section-title">Operational Justification</div>
        <div class="reason-box">
          "${transfer.reason || 'Workforce structural balance, operational resource reallocation, and departmental capacity optimization.'}"
        </div>

        <p style="font-size: 10pt; margin-top: 18px;">
          Please report directly to the Department Lead of <strong>${transfer.toDepartment}</strong> on the effective date.
        </p>

        <div class="footer">
          <div>
            <div class="signature-line">${transfer.authorizedBy || 'HR Administration'}</div>
            <div style="font-size: 9pt; text-align: center; margin-top: 2px;">Authorized HR Officer</div>
          </div>
          <div style="text-align: right; font-size: 10pt; font-weight: bold;">
            ✔ VERIFIED CORPORATE RECORD
          </div>
        </div>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank', 'width=850,height=950');
    if (!printWin) {
      window.print();
      return;
    }
    printWin.document.write(printHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white shadow-xl border border-blue-900/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-mono font-semibold uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            Skima Department Hierarchy & Structural Payroll
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            Departments, Staff Transfers & Payroll Insights
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Manage organizational departments, execute staff transfers with official notice letters, view staff rosters, and monitor departmental budget weight.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Transfer Department Button */}
          <button
            onClick={() => handleOpenTransferModal()}
            className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Transfer Staff</span>
          </button>

          {/* History Transfers Button */}
          <button
            onClick={() => {
              setTransferHistoryFilter('all');
              setIsRecentTransfersModalOpen(true);
            }}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold flex items-center gap-2 transition cursor-pointer relative"
          >
            <History className="w-4 h-4 text-blue-400" />
            <span>History</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-500 text-white font-bold">
              {transfersHistory.length}
            </span>
          </button>

          <button
            onClick={() => setIsUploadDeptModalOpen(true)}
            className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload CSV</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Department</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Payroll Structural Insights Section (Integrated from Payroll Insights tab) */}
      <div className="space-y-4">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <BadgeDollarSign className="w-4 h-4 text-emerald-500" />
              Total Monthly Base Payroll Weight
            </div>
            <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-2">
              {currencySymbol}{totalPayrollWeight.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Across all {staffList.length} staff members</p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Average Monthly Salary Per Staff
            </div>
            <div className="text-2xl font-extrabold font-mono text-blue-600 dark:text-blue-400 mt-2">
              {currencySymbol}{avgMonthlySalary.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Mean departmental wage rate</p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-500" />
              Active Pay Grade Tiers
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-2">
              {configuredPayGrades.length > 0 ? configuredPayGrades.length : new Set(staffList.map((s) => deriveStaffPayGrade(s, configuredPayGrades))).size} <span className="text-xs text-slate-400">Tiers</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Structured compensation grades</p>
          </div>
        </div>

        {/* Charts & Table Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Department Bar Chart */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Departmental Base Payroll Breakdown ({currencySymbol})
            </h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="department" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isLight ? '#ffffff' : '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`${currencySymbol}${Number(val).toLocaleString()}`, 'Monthly Budget']}
                  />
                  <Bar dataKey="totalSalary" radius={[8, 8, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Department Budget Allocation Summary */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-500" />
                Department Budget Allocation Summary
              </h3>

              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Department</th>
                      <th className="px-3 py-2">Headcount</th>
                      <th className="px-3 py-2">Total Base Payroll</th>
                      <th className="px-3 py-2 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {chartData.map((d, i) => {
                      const share = Math.round((Number(d.totalSalary) / (Number(totalPayrollWeight) || 1)) * 100);
                      return (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                            {d.department}
                          </td>
                          <td className="px-3 py-2.5 font-mono">{d.staffCount} staff</td>
                          <td className="px-3 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                            {currencySymbol}{d.totalSalary.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold">
                            {share}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex items-center gap-2.5 text-xs text-blue-800 dark:text-blue-300 mt-2">
              <ShieldAlert className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Budget metrics update live when staff transfers or salary revisions are applied.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Clean Toolbar & Search */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search department name, code, lead, or description..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono shrink-0">
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {filteredDepts.length} of {departments.length} Department Units
          </span>
          <span>|</span>
          <span>{staffList.filter((s) => s.status !== 'Exited').length} Active Staff</span>
        </div>
      </div>

      {/* Departments Grid with Staff Dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
        {filteredDepts.map((dept) => {
          const deptStaff = staffList.filter(
            (s) => s.department === dept.name && s.status !== 'Exited'
          );
          const totalPayroll = deptStaff.reduce(
            (acc, curr) => acc + (curr.estimatedMonthlySalary || 0),
            0
          );
          const isExpanded = expandedDeptId === dept.id;
          const selectedRoles = selectedDeptRoles[dept.id] || [];

          // Extract all unique roles present in this department
          const rolesPresentSet = new Set<string>();
          (dept.roles || []).forEach((r) => {
            if (r.title && r.title.trim()) rolesPresentSet.add(r.title.trim());
          });
          deptStaff.forEach((s) => {
            if (s.role && s.role.trim()) rolesPresentSet.add(s.role.trim());
          });
          const rolesPresent = Array.from(rolesPresentSet).sort();

          // Filter staff roster for dropdown (matches any of the selected roles)
          const displayedStaff = selectedRoles.length > 0
            ? deptStaff.filter((s) =>
                selectedRoles.some((r) => (s.role || '').toLowerCase().trim() === r.toLowerCase().trim())
              )
            : deptStaff;

          return (
            <div
              key={dept.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 hover:border-blue-500/40 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold text-sm flex items-center justify-center border border-blue-500/20">
                      {dept.code}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                        {dept.name}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                        <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                        Lead: <span className="font-semibold text-slate-700 dark:text-slate-300">{dept.headOfDepartment}</span>
                      </p>
                    </div>
                  </div>

                  {/* Department Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(dept)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
                      title="Edit Department Name / Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeptToDelete(dept)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                      title="Delete Department (Sets assigned staff to Unassigned)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {dept.description}
                </p>
              </div>

              {/* Roles Filter Section */}
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    Department Roles ({rolesPresent.length})
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {selectedRoles.length > 0 ? `${selectedRoles.length} role(s) selected` : 'Select up to 2 roles'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 role-filter-dropdown-container">
                  {/* All Staff button */}
                  <button
                    onClick={() => {
                      setExpandedDeptId(dept.id);
                      handleClearRoleFilter(dept.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      selectedRoles.length === 0 && isExpanded
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                    title="Click to view all staff in this department"
                  >
                    <span>All Staff</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-200/80 dark:bg-slate-700 text-[10px] font-mono">
                      {deptStaff.length}
                    </span>
                  </button>

                  {/* Filter Dropdown (Multiple selection of up to 2 roles per department) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenRoleFilterDeptId(openRoleFilterDeptId === dept.id ? null : dept.id);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                        selectedRoles.length > 0
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                      title="Filter by roles (select up to 2 roles)"
                    >
                      <Filter className="w-3.5 h-3.5 text-blue-500" />
                      <span>Filter</span>
                      {selectedRoles.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-mono font-bold">
                          {selectedRoles.length}/2
                        </span>
                      )}
                      <ChevronDown className="w-3 h-3 opacity-60" />
                    </button>

                    {/* Popover Dropdown */}
                    {openRoleFilterDeptId === dept.id && (
                      <div className="absolute top-full left-0 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2.5 z-40 space-y-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Filter className="w-3 h-3 text-blue-500" />
                            Select Roles (Max 2)
                          </span>
                          {selectedRoles.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleClearRoleFilter(dept.id)}
                              className="text-[10px] text-rose-500 hover:underline font-bold cursor-pointer"
                            >
                              Clear all
                            </button>
                          )}
                        </div>

                        {rolesPresent.length === 0 ? (
                          <div className="text-xs text-slate-400 italic p-3 text-center">
                            No roles defined in this department.
                          </div>
                        ) : (
                          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                            {rolesPresent.map((roleTitle) => {
                              const isChecked = selectedRoles.some(
                                (r) => r.toLowerCase().trim() === roleTitle.toLowerCase().trim()
                              );
                              const roleStaffCount = deptStaff.filter(
                                (s) => (s.role || '').toLowerCase().trim() === roleTitle.toLowerCase().trim()
                              ).length;
                              const isMaxReached = selectedRoles.length >= 2 && !isChecked;

                              return (
                                <button
                                  key={roleTitle}
                                  type="button"
                                  onClick={() => handleToggleRoleFilter(dept.id, roleTitle)}
                                  disabled={isMaxReached}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                                    isChecked
                                      ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-100 font-bold border border-blue-300 dark:border-blue-700'
                                      : isMaxReached
                                      ? 'opacity-40 cursor-not-allowed text-slate-400'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  }`}
                                  title={isMaxReached ? 'Maximum 2 roles already selected' : `Filter by ${roleTitle}`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                                    />
                                    <span className="truncate">{roleTitle}</span>
                                  </div>
                                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                                    {roleStaffCount}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                          <span>{selectedRoles.length} of 2 selected</span>
                          <button
                            type="button"
                            onClick={() => setOpenRoleFilterDeptId(null)}
                            className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active Selected Role Tags */}
                  {selectedRoles.map((roleTitle) => (
                    <span
                      key={roleTitle}
                      className="px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 text-xs font-semibold flex items-center gap-1.5 border border-blue-200 dark:border-blue-800"
                    >
                      <span className="truncate max-w-[130px]">{roleTitle}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleRoleFilter(dept.id, roleTitle)}
                        className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-100 cursor-pointer"
                        title={`Remove ${roleTitle} filter`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats & Expand Dropdown Button */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                      <Users className="w-3 h-3 text-blue-500" />
                      Assigned Staff
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                      {deptStaff.length} <span className="text-xs font-normal text-slate-400">members</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-emerald-500" />
                      Monthly Payroll
                    </div>
                    <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {currencySymbol}{totalPayroll.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Dropdown Toggle for Staff Roster */}
                <button
                  onClick={() => {
                    if (isExpanded) {
                      setExpandedDeptId(null);
                    } else {
                      setExpandedDeptId(dept.id);
                    }
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">
                      View Staff Roster {selectedRoles.length > 0 ? `(${selectedRoles.join(', ')})` : `(${deptStaff.length})`}
                    </span>
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                </button>

                {/* Expanded Staff Dropdown List */}
                {isExpanded && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5 max-h-72 overflow-y-auto">
                    {/* Filter Status Bar inside Dropdown */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {selectedRoles.length > 0 ? `Roles: ${selectedRoles.join(' & ')}` : 'All Department Staff'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-mono font-bold">
                          {displayedStaff.length} {displayedStaff.length === 1 ? 'member' : 'members'}
                        </span>
                      </div>

                      {selectedRoles.length > 0 && (
                        <button
                          onClick={() => handleClearRoleFilter(dept.id)}
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                          <span>Show All Staff</span>
                        </button>
                      )}
                    </div>

                    {displayedStaff.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-4">
                        {selectedRoles.length > 0
                          ? `No staff members currently hold the role(s) "${selectedRoles.join(', ')}" in ${dept.name}.`
                          : `No staff currently assigned to ${dept.name}.`}
                      </p>
                    ) : (
                      displayedStaff.map((staff, idx) => (
                        <div
                          key={`${staff.id}-${idx}`}
                          className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                              {staff.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{staff.name}</span>
                                <span className="font-mono text-[10px] text-slate-400">({staff.employeeId})</span>
                                {staff.status === 'On Leave' && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    On Leave
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-slate-600 dark:text-slate-300">{staff.role || 'Unspecified Role'}</span>
                                <span>•</span>
                                <span className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold text-[10px] border border-purple-200/60 dark:border-purple-800/60">
                                  Grade: {deriveStaffPayGrade(staff, configuredPayGrades)}
                                </span>
                                <span>•</span>
                                <span>{currencySymbol}{staff.estimatedMonthlySalary?.toLocaleString()}/mo</span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleOpenTransferModal(staff.id)}
                            className="px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition shrink-0"
                            title="Transfer staff member to another department"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Transfer</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredDepts.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <Building2 className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">No Departments Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No departments matched your filter or none have been defined yet. Click "Add Department" or upload a department list to create new units.
          </p>
        </div>
      )}

      {/* Modal 1: Add / Edit Department */}
      {isAddDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                {editingDept ? 'Edit Department Details' : 'Add New Department'}
              </h3>
              <button
                onClick={() => setIsAddDeptModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    let nextCode = deptForm.code;
                    if (!deptForm.code || deptForm.code.length <= 4) {
                      const rawCode = newName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
                      if (rawCode) {
                        const existingCodes = new Set(
                          departments
                            .filter((d) => !editingDept || (editingDept.id !== d.id && editingDept.name !== d.name))
                            .map((d) => (d.code || '').toUpperCase())
                        );
                        let candidate = rawCode;
                        let counter = 1;
                        while (existingCodes.has(candidate)) {
                          candidate = `${rawCode}${counter++}`;
                        }
                        nextCode = candidate;
                      }
                    }
                    setDeptForm({ ...deptForm, name: newName, code: nextCode });
                  }}
                  placeholder="e.g. Operations, Logistics, HR"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Department ID / Unique Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={deptForm.code}
                    onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. OPS, ENG, HR, DPT-01"
                    className={`w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-mono font-bold text-slate-900 dark:text-white outline-none uppercase transition ${
                      (() => {
                        const proposed = deptForm.code.trim().toUpperCase();
                        if (!proposed) return 'border-slate-200 dark:border-slate-700 focus:border-blue-500';
                        const isSame = (d: DepartmentInfo) =>
                          editingDept && (editingDept.id === d.id || editingDept.name.trim().toLowerCase() === d.name.trim().toLowerCase());
                        const isDup = departments.some(
                          (d) => !isSame(d) && ((d.code && d.code.trim().toUpperCase() === proposed) || (d.id && d.id.trim().toUpperCase() === proposed))
                        );
                        return isDup ? 'border-rose-500 bg-rose-500/10' : 'border-emerald-500/60 focus:border-emerald-500';
                      })()
                    }`}
                  />
                  {(() => {
                    const proposed = deptForm.code.trim().toUpperCase();
                    if (!proposed) {
                      return <p className="text-[10px] text-slate-400 mt-1">Unique identifier code for department</p>;
                    }
                    const isSame = (d: DepartmentInfo) =>
                      editingDept && (editingDept.id === d.id || editingDept.name.trim().toLowerCase() === d.name.trim().toLowerCase());
                    const conflicting = departments.find(
                      (d) => !isSame(d) && ((d.code && d.code.trim().toUpperCase() === proposed) || (d.id && d.id.trim().toUpperCase() === proposed))
                    );
                    if (conflicting) {
                      return (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                          ⚠️ Department ID "{proposed}" is already used by {conflicting.name}.
                        </p>
                      );
                    }
                    return <p className="text-[10px] text-emerald-500 font-semibold mt-1">✓ Department ID is available and unique</p>;
                  })()}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Head of Department
                  </label>
                  <SearchableStaffSelect
                    staffList={staffList}
                    selectedEmployeeId={
                      staffList.find(
                        (s) =>
                          s.name.toLowerCase() === deptForm.headOfDepartment.toLowerCase() ||
                          s.employeeId.toLowerCase() === deptForm.headOfDepartment.toLowerCase()
                      )?.employeeId || ''
                    }
                    onSelect={(empId) => {
                      const selected = staffList.find((s) => s.employeeId === empId || s.id === empId);
                      setDeptForm({
                        ...deptForm,
                        headOfDepartment: selected ? selected.name : empId,
                      });
                    }}
                    placeholder="Search and select Head of Department..."
                    filterExited={true}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Department Description / Notes
                </label>
                <textarea
                  rows={2}
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  placeholder="Overview of duties, scope, or operational parameters..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Roles & Job Descriptions Section */}
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                      Department Roles & Job Descriptions
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Define roles, enumerated job descriptions, and mark key descriptions for KPI tracking.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newRole: DepartmentRole = {
                        id: `role-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                        title: '',
                        items: [
                          {
                            id: `item-${Date.now()}-0`,
                            text: '',
                            isKey: true,
                            weight: 100,
                          },
                        ],
                      };
                      setDeptForm({ ...deptForm, roles: [...deptForm.roles, newRole] });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center gap-1 border border-blue-200 dark:border-blue-800 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Role</span>
                  </button>
                </div>

                {/* Duplicate Role Name Error Warning */}
                {(() => {
                  const titles = deptForm.roles.map((r) => (r.title || '').trim().toLowerCase()).filter(Boolean);
                  const hasDup = titles.some((t, idx) => titles.indexOf(t) !== idx);
                  if (hasDup) {
                    return (
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        <span>Role names must be unique within a department. Please fix duplicate role titles.</span>
                      </div>
                    );
                  }
                  return null;
                })()}

                {deptForm.roles.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-400 text-xs">
                    No roles defined for this department yet. Click <strong>"+ Add Role"</strong> to create department roles & job descriptions.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {deptForm.roles.map((r, rIdx) => {
                      const items = r.items || (r.jobDescription ? [{ id: `item-legacy-${rIdx}`, text: r.jobDescription, isKey: true }] : []);
                      const titleLower = (r.title || '').trim().toLowerCase();
                      const isDuplicateTitle = titleLower !== '' && deptForm.roles.filter((other) => (other.title || '').trim().toLowerCase() === titleLower).length > 1;
                      const isOpen = openRoleIndex === rIdx;

                      return (
                        <div
                          key={r.id || rIdx}
                          className={`rounded-xl border transition-all ${
                            isDuplicateTitle
                              ? 'border-rose-400 dark:border-rose-600 bg-rose-50/30 dark:bg-rose-950/20'
                              : isOpen
                              ? 'border-blue-400 dark:border-blue-700 bg-slate-50 dark:bg-slate-800/90 shadow-md'
                              : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          {/* Role Header Bar: Title, Reports To, Description Button, Duplicate, Delete, Accordion Toggle */}
                          <div className="p-3 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                            {/* Accordion Toggle Icon & Title Field */}
                            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                              <button
                                type="button"
                                onClick={() => setOpenRoleIndex(isOpen ? null : rIdx)}
                                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition cursor-pointer shrink-0"
                                title={isOpen ? 'Collapse Role Details' : 'Expand Role JDs & Keywords'}
                              >
                                {isOpen ? (
                                  <ChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>

                              <div className="flex-1">
                                <input
                                  type="text"
                                  value={r.title || ''}
                                  onChange={(e) => {
                                    const updated = [...deptForm.roles];
                                    updated[rIdx] = { ...updated[rIdx], title: e.target.value };
                                    setDeptForm({ ...deptForm, roles: updated });
                                  }}
                                  placeholder="Role Title (e.g. Operations Manager, Technician)"
                                  className={`w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border ${
                                    isDuplicateTitle ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                                  } text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500`}
                                />
                                {isDuplicateTitle && (
                                  <span className="text-[10px] text-rose-500 font-bold block mt-0.5">
                                    Duplicate role title in department
                                  </span>
                                )}
                                {(() => {
                                  const allDutyParams = Array.from(new Set((items || []).flatMap((it) => it.mappedParameters || [])));
                                  if (allDutyParams.length === 0) return null;
                                  return (
                                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                      <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1">
                                        <Sliders className="w-2.5 h-2.5" />
                                        Duties Radar:
                                      </span>
                                      {allDutyParams.map((p) => {
                                        const count = (items || []).filter((it) => (it.mappedParameters || []).includes(p)).length;
                                        return (
                                          <span
                                            key={p}
                                            className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold flex items-center gap-1"
                                            title={`${count} duty/duties mapped to ${p}`}
                                          >
                                            <span>{p}</span>
                                            <span className="text-[9px] px-1 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 font-mono">
                                              {count}
                                            </span>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Actions: View/Edit Description, Duplicate, Delete */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* View / Edit Role Details Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  const parsed = parseReportsTo(r.reportsTo);
                                  setActiveRoleSummaryModal({
                                    roleIndex: rIdx,
                                    roleTitle: r.title || `Role #${rIdx + 1}`,
                                    summary: r.summary || r.jobDescription || '',
                                    reportsToDept: parsed.dept,
                                    reportsToRole: parsed.role,
                                    customReportsToRole: parsed.isCustom ? parsed.role : '',
                                    isCustomRole: parsed.isCustom,
                                  });
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                                  (r.summary || r.jobDescription || r.reportsTo)
                                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 font-bold'
                                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-200'
                                }`}
                                title="View and edit role description and reporting hierarchy"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span>View Desc</span>
                              </button>

                              {/* Duplicate Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  const dupRole: DepartmentRole = {
                                    id: `role-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                                    title: `${r.title || 'Role'} (Copy)`,
                                    summary: r.summary || r.jobDescription || '',
                                    targets: r.targets || '',
                                    reportsTo: r.reportsTo || '',
                                    items: items.map((it, idx) => ({ ...it, id: `item-${Date.now()}-${idx}` })),
                                  };
                                  const updated = [...deptForm.roles];
                                  updated.splice(rIdx + 1, 0, dupRole);
                                  setDeptForm({ ...deptForm, roles: updated });
                                  setOpenRoleIndex(rIdx + 1);
                                }}
                                className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1 cursor-pointer transition border border-slate-200 dark:border-slate-600"
                                title="Duplicate Role"
                              >
                                <CopyIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span className="hidden sm:inline">Duplicate</span>
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setRoleToDelete({
                                    roleIndex: rIdx,
                                    roleTitle: r.title ? `"${r.title}"` : `Role #${rIdx + 1}`,
                                  });
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                                title="Remove Role"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Accordion Content: Revealed only when openRoleIndex === rIdx */}
                          {isOpen && (() => {
                            const roleWeightSum = Math.round(items.reduce((acc, it) => acc + (typeof it.weight === 'number' ? it.weight : (it.isKey ? 25 : 15)), 0) * 10) / 10;
                            const isOverweighted = roleWeightSum > 100.05;
                            const isExact100 = Math.abs(roleWeightSum - 100) < 0.05;

                            return (
                              <div className="p-3.5 pt-2 border-t border-slate-200 dark:border-slate-700/70 space-y-3">
                                {/* Enumerated Job Descriptions Header */}
                                <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                                      <div className="flex items-center gap-2">
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                          Job Duties & Key Deliverables ({items.length})
                                        </label>
                                        {items.length > 0 && (
                                          <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border transition ${
                                              isOverweighted
                                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse'
                                                : isExact100
                                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                            }`}
                                            title="Sum of duty weights. Must not exceed 100%."
                                          >
                                            Weight: {roleWeightSum}% / 100% {isExact100 ? '✓' : isOverweighted ? '⚠️ Exceeds 100%!' : ''}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        {items.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updated = [...deptForm.roles];
                                              const balanced = autoCalculateDutyWeights(items);
                                              updated[rIdx] = { ...updated[rIdx], items: balanced };
                                              setDeptForm({ ...deptForm, roles: updated });
                                              emitGlobalToast('Duty weights auto-calculated to 100% (Key duties receive higher equal weights, lower duties receive lower equal weights).', 'success');
                                            }}
                                            className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold text-[10px] flex items-center gap-1 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer transition"
                                            title="Auto-calculate equal average weights based on duty count and key status (sums to 100%)"
                                          >
                                            <Calculator className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                            <span>Auto-Calculate Weights</span>
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...deptForm.roles];
                                            const curItems = items.length > 0 ? [...items] : [];
                                            curItems.push({
                                              id: `item-${Date.now()}-${curItems.length}`,
                                              text: '',
                                              keyword: '',
                                              isKey: curItems.length === 0,
                                            });
                                            const balanced = autoCalculateDutyWeights(curItems);
                                            updated[rIdx] = { ...updated[rIdx], items: balanced };
                                            setDeptForm({ ...deptForm, roles: updated });
                                          }}
                                          className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 font-bold text-[10px] flex items-center gap-1 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 cursor-pointer"
                                        >
                                          <Plus className="w-3 h-3" />
                                          <span>Add Duty</span>
                                        </button>
                                      </div>
                                    </div>

                                    {isOverweighted && (
                                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center justify-between text-xs font-medium gap-2">
                                        <div className="flex items-center gap-2">
                                          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                                          <span>Total duty weight is <strong>{roleWeightSum}%</strong>. The summation must not be greater than 100%.</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...deptForm.roles];
                                            const balanced = autoCalculateDutyWeights(items);
                                            updated[rIdx] = { ...updated[rIdx], items: balanced };
                                            setDeptForm({ ...deptForm, roles: updated });
                                            emitGlobalToast('Duty weights re-balanced to exactly 100%.', 'success');
                                          }}
                                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shrink-0 cursor-pointer shadow-xs transition"
                                        >
                                          Auto-Balance to 100%
                                        </button>
                                      </div>
                                    )}

                              {items.length === 0 ? (
                                <div className="text-[11px] text-slate-400 italic p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                                  No duties added yet. Click "+ Add Duty" to specify role responsibilities and ATS keywords.
                                </div>
                              ) : (
                                <div className="space-y-2.5">
                                  {items.map((item, itemIdx) => (
                                    <div
                                      key={item.id || itemIdx}
                                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs"
                                    >
                                      <div className="flex items-start gap-2">
                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 pt-1 font-mono min-w-[20px]">
                                          {itemIdx + 1}.
                                        </span>

                                        <textarea
                                          rows={2}
                                          value={item.text}
                                          onChange={(e) => {
                                            const updated = [...deptForm.roles];
                                            const curItems = [...items];
                                            curItems[itemIdx] = { ...curItems[itemIdx], text: e.target.value };
                                            updated[rIdx] = { ...updated[rIdx], items: curItems };
                                            setDeptForm({ ...deptForm, roles: updated });
                                          }}
                                          placeholder={`Job Duty / Deliverable ${itemIdx + 1} (e.g. Conduct daily inventory reconciliations and audit warehouse stock levels)...`}
                                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 resize-y"
                                        />

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...deptForm.roles];
                                            const curItems = items.filter((_, idx) => idx !== itemIdx);
                                            const balanced = autoCalculateDutyWeights(curItems);
                                            updated[rIdx] = { ...updated[rIdx], items: balanced };
                                            setDeptForm({ ...deptForm, roles: updated });
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer mt-1"
                                          title="Delete Duty Item"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      {/* ATS Key Skill & Key KPI Row */}
                                      <div className="flex items-center justify-between gap-3 pl-6 flex-wrap">
                                        <div className="flex-1 min-w-[180px] flex items-center gap-1.5">
                                          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold shrink-0">
                                            ATS Key skill:
                                          </span>
                                          <input
                                            type="text"
                                            value={item.keyword || ''}
                                            onChange={(e) => {
                                              const updated = [...deptForm.roles];
                                              const curItems = [...items];
                                              curItems[itemIdx] = { ...curItems[itemIdx], keyword: e.target.value };
                                              updated[rIdx] = { ...updated[rIdx], items: curItems };
                                              setDeptForm({ ...deptForm, roles: updated });
                                            }}
                                            placeholder="e.g. Inventory, Auditing, SQL, React..."
                                            className="flex-1 px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-teal-600 dark:text-teal-400 font-medium outline-none focus:border-teal-500"
                                          />
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...deptForm.roles];
                                            const curItems = [...items];
                                            curItems[itemIdx] = { ...curItems[itemIdx], isKey: !curItems[itemIdx].isKey };
                                            const balanced = autoCalculateDutyWeights(curItems);
                                            updated[rIdx] = { ...updated[rIdx], items: balanced };
                                            setDeptForm({ ...deptForm, roles: updated });
                                          }}
                                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                                            item.isKey
                                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 shadow-sm'
                                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-600'
                                          }`}
                                          title="Toggle Key KPI (Higher autocalculated weight & 2.5x ATS applicant compatibility weight)"
                                        >
                                          <Star className={`w-3 h-3 ${item.isKey ? 'fill-amber-400 text-amber-500' : ''}`} />
                                          <span>{item.isKey ? 'Key KPI (Higher Weight)' : 'Mark Key KPI'}</span>
                                        </button>
                                      </div>

                                      {/* Target & Weight Row */}
                                      <div className="flex items-center justify-between gap-3 pl-6 flex-wrap pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                                        <div className="flex-1 min-w-[200px] flex items-center gap-1.5">
                                          <span className="text-[10px] font-mono uppercase text-amber-600 dark:text-amber-400 font-bold shrink-0 flex items-center gap-1">
                                            <Target className="w-3 h-3 text-amber-500" />
                                            Target / Metric:
                                          </span>
                                          <input
                                            type="text"
                                            value={item.target || ''}
                                            onChange={(e) => {
                                              const updated = [...deptForm.roles];
                                              const curItems = [...items];
                                              curItems[itemIdx] = { ...curItems[itemIdx], target: e.target.value };
                                              updated[rIdx] = { ...updated[rIdx], items: curItems };
                                              setDeptForm({ ...deptForm, roles: updated });
                                            }}
                                            placeholder="e.g. 98% uptime, ≤24hr SLA, 100% compliance..."
                                            className="flex-1 px-2 py-0.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300 font-medium outline-none focus:border-amber-500"
                                          />
                                        </div>

                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold shrink-0">
                                            Weight:
                                          </span>
                                          <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step="0.1"
                                            value={typeof item.weight === 'number' ? item.weight : (item.isKey ? 25 : 15)}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value);
                                              const updated = [...deptForm.roles];
                                              const curItems = [...items];
                                              curItems[itemIdx] = { ...curItems[itemIdx], weight: isNaN(val) ? 0 : val };
                                              updated[rIdx] = { ...updated[rIdx], items: curItems };
                                              setDeptForm({ ...deptForm, roles: updated });
                                            }}
                                            className={`w-16 px-1.5 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 border text-[11px] text-center font-bold outline-none ${
                                              roleWeightSum > 100.05
                                                ? 'border-rose-400 text-rose-600 dark:text-rose-400 focus:border-rose-500'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:border-amber-500'
                                            }`}
                                          />
                                          <span className="text-[10px] font-bold text-slate-400">%</span>
                                        </div>
                                      </div>

                                      {/* Duty Radar Parameter Mapping Row */}
                                      <div className="flex items-center justify-between gap-2 pl-6 flex-wrap pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <button
                                            type="button"
                                            onClick={() => setParamMappingTarget({ roleIndex: rIdx, dutyIndex: itemIdx })}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                                              item.mappedParameters && item.mappedParameters.length > 0
                                                ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 font-bold'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-purple-600 hover:border-purple-300'
                                            }`}
                                            title="Map duty to generic KPI radar parameters (max 2 per duty)"
                                          >
                                            <Sliders className="w-3 h-3 text-purple-500 shrink-0" />
                                            <span>Map to Param</span>
                                            <span className="w-4 h-4 rounded-full text-[9px] bg-purple-600 text-white font-mono flex items-center justify-center">
                                              {(item.mappedParameters || []).length}/2
                                            </span>
                                          </button>

                                          {item.mappedParameters && item.mappedParameters.length > 0 && (
                                            <div className="flex items-center gap-1 flex-wrap">
                                              {item.mappedParameters.map((p) => (
                                                <span
                                                  key={p}
                                                  className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-semibold flex items-center gap-1"
                                                >
                                                  <Sliders className="w-2.5 h-2.5 text-purple-500" />
                                                  <span>{p}</span>
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        <span className="text-[10px] text-slate-400 italic">
                                          {item.mappedParameters && item.mappedParameters.length === 2
                                            ? '2 of 2 radar params mapped'
                                            : item.mappedParameters && item.mappedParameters.length === 1
                                            ? '1 of 2 radar params mapped'
                                            : 'Max 2 params per duty'}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddDeptModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  {editingDept ? 'Update Department' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Details, Description & Reporting Hierarchy Modal ("View Desc") */}
      {activeRoleSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden p-6 space-y-5 my-8">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Role Details & Specifications
                  </h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                    {activeRoleSummaryModal.roleTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveRoleSummaryModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: Reports To (Dynamically retrieved from tenant departments and roles) */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-500" />
                  <span>Reports To (Organizational Hierarchy)</span>
                </label>
                {(activeRoleSummaryModal.reportsToRole || activeRoleSummaryModal.reportsToDept) && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoleSummaryModal({
                        ...activeRoleSummaryModal,
                        reportsToDept: '',
                        reportsToRole: '',
                        customReportsToRole: '',
                        isCustomRole: false,
                      });
                    }}
                    className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
                  >
                    Clear Reporting Line
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Specify which department and supervisor role this position reports to. Automatically retrieved from all departments created in the system and dynamically injected into official document templates via <code className="text-blue-600 dark:text-blue-400 font-mono font-bold">{'{REPORTS_TO}'}</code>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Step 1: Select Department */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    1. Reporting Department
                  </label>
                  <select
                    value={activeRoleSummaryModal.reportsToDept}
                    onChange={(e) => {
                      const newDept = e.target.value;
                      setActiveRoleSummaryModal({
                        ...activeRoleSummaryModal,
                        reportsToDept: newDept,
                        reportsToRole: '',
                        customReportsToRole: '',
                        isCustomRole: !newDept,
                      });
                    }}
                    className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">-- Direct Supervisor / Custom Role --</option>
                    {tenantDepartments.map((d) => (
                      <option key={d.id || d.name} value={d.name}>
                        {d.name} {d.roles.length > 0 ? `(${d.roles.length} roles)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 2: Select Role */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    2. Supervisor Role
                  </label>
                  {(!activeRoleSummaryModal.reportsToDept || activeRoleSummaryModal.isCustomRole) ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={activeRoleSummaryModal.customReportsToRole || activeRoleSummaryModal.reportsToRole}
                        onChange={(e) => {
                          setActiveRoleSummaryModal({
                            ...activeRoleSummaryModal,
                            customReportsToRole: e.target.value,
                            reportsToRole: e.target.value,
                            isCustomRole: true,
                          });
                        }}
                        placeholder="e.g. Managing Partner, Director, Supervisor"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium"
                      />
                      {activeRoleSummaryModal.reportsToDept && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRoleSummaryModal({
                              ...activeRoleSummaryModal,
                              isCustomRole: false,
                              customReportsToRole: '',
                              reportsToRole: '',
                            });
                          }}
                          className="text-[10px] text-blue-500 hover:underline cursor-pointer"
                        >
                          ← Choose from department roles
                        </button>
                      )}
                    </div>
                  ) : (
                    <select
                      value={activeRoleSummaryModal.reportsToRole}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__CUSTOM__') {
                          setActiveRoleSummaryModal({
                            ...activeRoleSummaryModal,
                            isCustomRole: true,
                            customReportsToRole: '',
                            reportsToRole: '',
                          });
                        } else {
                          setActiveRoleSummaryModal({
                            ...activeRoleSummaryModal,
                            reportsToRole: val,
                            isCustomRole: false,
                          });
                        }
                      }}
                      className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="">-- Select Supervisor Role --</option>
                      {availableRolesForSelectedDept.map((rTitle) => (
                        <option key={rTitle} value={rTitle}>
                          {rTitle}
                        </option>
                      ))}
                      <option value="__CUSTOM__">+ Enter custom supervisor title...</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Active Reporting Line Preview Badge */}
              {activeRoleSummaryModal.reportsToRole && (
                <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs flex items-center justify-between">
                  <span className="text-blue-900 dark:text-blue-200 font-medium">
                    Reporting Line: <strong className="font-bold text-blue-700 dark:text-blue-300">{activeRoleSummaryModal.reportsToRole}</strong>
                    {activeRoleSummaryModal.reportsToDept && (
                      <span className="text-slate-500 dark:text-slate-400"> • {activeRoleSummaryModal.reportsToDept}</span>
                    )}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                    Active
                  </span>
                </div>
              )}
            </div>

            {/* Section 2: Detailed Role Description & Job Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  <span>Role Description & Job Summary</span>
                </label>
                {activeRoleSummaryModal.summary && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoleSummaryModal({
                        ...activeRoleSummaryModal,
                        summary: '',
                      });
                    }}
                    className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
                  >
                    Clear Description
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Provide an executive overview of the role's primary mission, scope, and objectives. This text is injected into appointment and contract documents using the <code className="text-blue-600 dark:text-blue-400 font-mono font-bold">{'{JOB_SUMMARY}'}</code> tag.
              </p>
              <textarea
                rows={4}
                value={activeRoleSummaryModal.summary}
                onChange={(e) => {
                  setActiveRoleSummaryModal({
                    ...activeRoleSummaryModal,
                    summary: e.target.value,
                  });
                }}
                placeholder="e.g. The Operations Manager oversees daily operational lifecycle, managing inventory logistics across distribution channels, supervising floor technicians, and ensuring strict compliance with safety protocols and operational SLAs..."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 resize-y leading-relaxed"
              />
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveRoleSummaryModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const rIdx = activeRoleSummaryModal.roleIndex;
                  const updated = [...deptForm.roles];

                  const roleVal = activeRoleSummaryModal.isCustomRole
                    ? activeRoleSummaryModal.customReportsToRole.trim()
                    : activeRoleSummaryModal.reportsToRole.trim();

                  let formattedReportsTo = '';
                  if (roleVal) {
                    const deptVal = activeRoleSummaryModal.reportsToDept.trim();
                    if (deptVal && !roleVal.includes(deptVal)) {
                      formattedReportsTo = `${roleVal} (${deptVal})`;
                    } else {
                      formattedReportsTo = roleVal;
                    }
                  }

                  updated[rIdx] = {
                    ...updated[rIdx],
                    summary: activeRoleSummaryModal.summary.trim(),
                    jobDescription: activeRoleSummaryModal.summary.trim() || updated[rIdx].jobDescription,
                    targets: updated[rIdx].targets || '',
                    reportsTo: formattedReportsTo,
                  };
                  setDeptForm({ ...deptForm, roles: updated });
                  setActiveRoleSummaryModal(null);
                }}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 cursor-pointer"
              >
                Save Role Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Map Duty to Generic KPI Radar Parameters */}
      {paramMappingTarget !== null && deptForm.roles[paramMappingTarget.roleIndex] && deptForm.roles[paramMappingTarget.roleIndex].items?.[paramMappingTarget.dutyIndex] && (() => {
        const roleIdx = paramMappingTarget.roleIndex;
        const dutyIdx = paramMappingTarget.dutyIndex;
        const currentRole = deptForm.roles[roleIdx];
        const currentDuty = currentRole.items![dutyIdx];
        const currentDutyMapped = currentDuty.mappedParameters || [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Map Duty to KPI Radar Parameters
                    </h3>
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-mono font-semibold">
                      {currentRole.title || `Role #${roleIdx + 1}`} • Duty #{dutyIdx + 1}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setParamMappingTarget(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Duty Snippet */}
              <div className="px-6 pt-4">
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 italic">
                  <span className="font-bold font-mono text-purple-600 dark:text-purple-400 not-italic mr-1.5">
                    Duty #{dutyIdx + 1}:
                  </span>
                  {currentDuty.text ? currentDuty.text : '(Empty duty description)'}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      Duty Radar Composition (Max 2 Mappings)
                    </span>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-200/80 dark:bg-purple-900/80 text-purple-800 dark:text-purple-200">
                      {currentDutyMapped.length}/2 Selected
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 leading-relaxed">
                    1 duty can be mapped to a <strong>maximum of 2 parameters</strong>. A single parameter can be mapped to as many duties in the role as desired. The more duties mapped to a parameter, the more comprehensive and difficult it is for staff to level up that metric.
                  </p>
                </div>

                {/* Parameter Selection Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {GENERIC_KPI_PARAMETERS.map((param) => {
                    const isSelected = currentDutyMapped.includes(param.name);
                    const isLimitReached = !isSelected && currentDutyMapped.length >= 2;
                    const otherDutiesWithParam = (currentRole.items || []).filter(
                      (it, idx) => idx !== dutyIdx && (it.mappedParameters || []).includes(param.name)
                    ).length;
                    const totalRoleDutiesWithParam = otherDutiesWithParam + (isSelected ? 1 : 0);

                    return (
                      <button
                        key={param.id}
                        type="button"
                        disabled={isLimitReached}
                        onClick={() => {
                          const updatedRoles = [...deptForm.roles];
                          const curItems = [...(updatedRoles[roleIdx].items || [])];
                          let mapped = [...(curItems[dutyIdx].mappedParameters || [])];
                          if (isSelected) {
                            mapped = mapped.filter((p) => p !== param.name);
                          } else {
                            if (mapped.length < 2) {
                              mapped.push(param.name);
                            }
                          }
                          curItems[dutyIdx] = { ...curItems[dutyIdx], mappedParameters: mapped };
                          updatedRoles[roleIdx] = { ...updatedRoles[roleIdx], items: curItems };
                          setDeptForm({ ...deptForm, roles: updatedRoles });
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-400 dark:border-purple-600 shadow-sm'
                            : isLimitReached
                            ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                            : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`text-xs font-bold flex items-center gap-1.5 ${
                              isSelected
                                ? 'text-purple-700 dark:text-purple-300'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <CheckCircle2
                              className={`w-4 h-4 ${
                                isSelected
                                  ? 'text-purple-600 dark:text-purple-400 fill-purple-600/20'
                                  : 'text-slate-300 dark:text-slate-600'
                              }`}
                            />
                            {param.name}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-600 text-white">
                              Mapped
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                          {param.description}
                        </p>

                        {/* Duty Role Saturation Indicator */}
                        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">Role saturation:</span>
                          <span
                            className={`font-mono font-bold px-1.5 py-0.2 rounded ${
                              totalRoleDutiesWithParam >= 3
                                ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300'
                                : totalRoleDutiesWithParam >= 1
                                ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            {totalRoleDutiesWithParam} {totalRoleDutiesWithParam === 1 ? 'duty' : 'duties'} {totalRoleDutiesWithParam >= 2 ? '(Difficult leveling)' : ''}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {currentDutyMapped.length >= 2 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    • 2 of 2 parameters mapped to this duty. Deselect a parameter to choose a different one.
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <button
                  type="button"
                  onClick={() => {
                    const updatedRoles = [...deptForm.roles];
                    const curItems = [...(updatedRoles[roleIdx].items || [])];
                    curItems[dutyIdx] = { ...curItems[dutyIdx], mappedParameters: [] };
                    updatedRoles[roleIdx] = { ...updatedRoles[roleIdx], items: curItems };
                    setDeptForm({ ...deptForm, roles: updatedRoles });
                  }}
                  className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
                >
                  Clear Duty Mappings
                </button>
                <button
                  type="button"
                  onClick={() => setParamMappingTarget(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal 2: Transfer Department Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                Transfer Staff Member Department
              </h3>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div>
                <SearchableStaffSelect
                  staffList={staffList}
                  selectedEmployeeId={
                    staffList.find((s) => s.id === transferForm.staffId || s.employeeId === transferForm.staffId)?.employeeId || ''
                  }
                  onSelect={(empId) => {
                    const selected = staffList.find((s) => s.employeeId === empId || s.id === empId);
                    const currentDept = selected?.department || 'Unassigned';
                    const targets = departments.filter((d) => d.name !== currentDept);
                    const validToDept = targets.some((d) => d.name === transferForm.toDepartment)
                      ? transferForm.toDepartment
                      : (targets[0] ? targets[0].name : '');
                    const targetDeptObj = departments.find((d) => d.name === validToDept);
                    const suggestedRole = targetDeptObj?.roles?.[0]?.title || selected?.role || '';

                    setTransferForm({
                      ...transferForm,
                      staffId: selected ? selected.id : empId,
                      toDepartment: validToDept,
                      toRole: suggestedRole,
                      newSalary: selected ? (selected.estimatedMonthlySalary || 0) : 0,
                    });
                  }}
                  label="Select Staff Member *"
                  placeholder="Type staff name, ID, or department to search..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Current Department
                  </label>
                  <input
                    type="text"
                    disabled
                    value={
                      staffList.find((s) => s.id === transferForm.staffId || s.employeeId === transferForm.staffId)?.department || 'Unassigned'
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 outline-none"
                  />
                  <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Current Role:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {staffList.find((s) => s.id === transferForm.staffId || s.employeeId === transferForm.staffId)?.role || 'N/A'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    New Destination Dept *
                  </label>
                  <select
                    required
                    value={transferForm.toDepartment}
                    onChange={(e) => {
                      const newDept = e.target.value;
                      const targetDeptObj = departments.find((d) => d.name === newDept);
                      const suggestedRole = targetDeptObj?.roles?.[0]?.title || transferForm.toRole || '';
                      setTransferForm({ ...transferForm, toDepartment: newDept, toRole: suggestedRole });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  >
                    {departments
                      .filter(
                        (d) =>
                          d.name !==
                          (staffList.find((s) => s.id === transferForm.staffId || s.employeeId === transferForm.staffId)?.department || '')
                      )
                      .map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Role in Destination Department */}
              {(() => {
                const targetDeptObj = departments.find((d) => d.name === transferForm.toDepartment);
                const deptPredefinedRoles = (targetDeptObj?.roles || []).map((r) => r.title);
                const deptStaffRoles = Array.from(
                  new Set(
                    staffList
                      .filter((s) => s.department === transferForm.toDepartment)
                      .map((s) => s.role)
                      .filter(Boolean)
                  )
                );
                const targetRoles = Array.from(new Set([...deptPredefinedRoles, ...deptStaffRoles]));

                return (
                  <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-blue-950 dark:text-blue-200">
                        New Assigned Role in {transferForm.toDepartment || 'Destination Department'} *
                      </label>
                      {targetRoles.length > 0 && (
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                          {targetRoles.length} department {targetRoles.length === 1 ? 'role' : 'roles'} available
                        </span>
                      )}
                    </div>
                    
                    <div className="relative">
                      <input
                        type="text"
                        required
                        list="modal-target-dept-roles"
                        value={transferForm.toRole}
                        onChange={(e) => setTransferForm({ ...transferForm, toRole: e.target.value })}
                        placeholder={`Enter or choose role in ${transferForm.toDepartment || 'new department'}...`}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <datalist id="modal-target-dept-roles">
                        {targetRoles.map((r) => (
                          <option key={r} value={r} />
                        ))}
                      </datalist>
                    </div>

                    {targetRoles.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Quick select:</span>
                        {targetRoles.slice(0, 6).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setTransferForm({ ...transferForm, toRole: r })}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                              transferForm.toRole === r
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Salary Bridge Section during Transfer */}
              {(() => {
                const currentStaffSalary = staffList.find((s) => s.id === transferForm.staffId || s.employeeId === transferForm.staffId)?.estimatedMonthlySalary || 0;
                return (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1">
                        <BadgeDollarSign className="w-4 h-4 text-blue-500" />
                        Monthly Base Salary Bridge
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        Current: {currencySymbol}{currentStaffSalary.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                      <div className="flex-1 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                        <span className="text-[10px] text-slate-400 block font-sans font-semibold">Current Salary</span>
                        {currencySymbol}{currentStaffSalary.toLocaleString()}
                      </div>
                      <span className="text-blue-500 font-extrabold text-base">⟶</span>
                      <div className="flex-1">
                        <span className="text-[10px] text-slate-400 block font-sans font-semibold">New Salary ({currencySymbol})</span>
                        <input
                          type="number"
                          required
                          min={0}
                          value={transferForm.newSalary}
                          onChange={(e) => setTransferForm({ ...transferForm, newSalary: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-400 dark:border-blue-600 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="text-[10px] font-semibold">
                      {transferForm.newSalary === currentStaffSalary ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Salary Status: Unchanged / Preserved ({currencySymbol}{currentStaffSalary.toLocaleString()})
                        </span>
                      ) : (
                        <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Revised Salary: {currencySymbol}{currentStaffSalary.toLocaleString()} ⟶ {currencySymbol}{transferForm.newSalary.toLocaleString()} (
                          {transferForm.newSalary > currentStaffSalary
                            ? `+${currencySymbol}${(transferForm.newSalary - currentStaffSalary).toLocaleString()}/month Increase`
                            : `-${currencySymbol}${(currentStaffSalary - transferForm.newSalary).toLocaleString()}/month Reduction`}
                          )
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Effective Transfer Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={transferForm.effectiveDate}
                    onChange={(e) => setTransferForm({ ...transferForm, effectiveDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Authorized By
                  </label>
                  <input
                    type="text"
                    value={transferForm.authorizedBy}
                    onChange={(e) => setTransferForm({ ...transferForm, authorizedBy: e.target.value })}
                    placeholder="e.g. HR Manager / Operations Director"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Transfer / Administrative Notes
                </label>
                <textarea
                  rows={3}
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  placeholder="e.g. Workforce balancing, site operational request, internal promotion..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Execute Transfer & Generate Letter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Transfer History Modal */}
      {isRecentTransfersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Staff Transfer History
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                  {displayedTransfers.length} Record(s)
                </span>
              </div>
              <button
                onClick={() => setIsRecentTransfersModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Toggle: All vs Recent (Last 30 Days) */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setTransferHistoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  transferHistoryFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Transfers ({transfersHistory.length})
              </button>
              <button
                type="button"
                onClick={() => setTransferHistoryFilter('30days')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  transferHistoryFilter === '30days'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Recent (Last 30 Days)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold">
                  {transfersLast30Days.length}
                </span>
              </button>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Ref ID</th>
                    <th className="px-3 py-2">Staff Member</th>
                    <th className="px-3 py-2">From Dept</th>
                    <th className="px-3 py-2">To Dept</th>
                    <th className="px-3 py-2">Effective Date</th>
                    <th className="px-3 py-2 text-right">Transfer Letter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {displayedTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        {transferHistoryFilter === '30days'
                          ? 'No cross-department staff transfers recorded in the last 30 days.'
                          : 'No cross-department staff transfers recorded yet.'}
                      </td>
                    </tr>
                  ) : (
                    displayedTransfers.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {t.id}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                          {t.staffName}
                          <span className="block text-[10px] font-mono font-normal text-slate-400">
                            {t.employeeId}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                            {t.fromDepartment}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                            {t.toDepartment}
                          </span>
                          {t.toRole && (
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                              Role: <span className="text-slate-800 dark:text-slate-200 font-semibold">{t.toRole}</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono">{t.effectiveDate}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={() => setSelectedTransferForLetter(t)}
                            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition cursor-pointer inline-flex items-center gap-1 font-bold text-[10px]"
                            title="Generate & View Transfer Letter"
                          >
                            <FileText className="w-4 h-4 text-blue-500" />
                            <span>View Letter</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 font-mono">
                Click the file icon on any row to open the printable Transfer Letter notice.
              </p>
              <button
                onClick={() => setIsRecentTransfersModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 cursor-pointer"
              >
                Close List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Generated Transfer Letter Modal */}
      {selectedTransferForLetter && (() => {
        const currentStaffObj = staffList.find(
          (s) => s.employeeId === selectedTransferForLetter.employeeId || s.name === selectedTransferForLetter.staffName
        );

        const effectivePrevSal =
          selectedTransferForLetter.previousSalary !== undefined
            ? selectedTransferForLetter.previousSalary
            : (currentStaffObj?.estimatedMonthlySalary || 0);

        const effectiveNewSal =
          selectedTransferForLetter.newSalary !== undefined
            ? selectedTransferForLetter.newSalary
            : (currentStaffObj?.estimatedMonthlySalary || effectivePrevSal);

        const salaryDiff = effectiveNewSal - effectivePrevSal;
        const isSalaryChanged = salaryDiff !== 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Official Department Transfer Letter
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTransferForLetter(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Salary Editor Section Above Modal Letter */}
              <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                    <BadgeDollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Edit / Adjust Staff Salary for Transfer</span>
                  </div>
                  {salaryUpdateNotice && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                      ✓ {salaryUpdateNotice}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      min={0}
                      value={letterSalaryInput}
                      onChange={(e) => setLetterSalaryInput(Number(e.target.value))}
                      placeholder="Enter new monthly salary..."
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdateSalaryInLetterModal(letterSalaryInput)}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Save Salary</span>
                  </button>
                </div>
              </div>

              {/* Printable Letter Box - Strict Black & White */}
              <div className="p-6 rounded-xl bg-white border-2 border-slate-900 space-y-4 font-sans text-xs text-black leading-relaxed max-h-96 overflow-y-auto shadow-inner">
                <div className="text-center border-b-2 border-black pb-3 space-y-1">
                  <h4 className="font-black text-base text-black uppercase tracking-wider">
                    {companyName.toUpperCase()}
                  </h4>
                  <p className="text-[10px] text-slate-800 uppercase font-bold tracking-wide">
                    Official Departmental Reassignment Notice
                  </p>
                </div>

                <div className="flex justify-between text-[11px] text-slate-800 font-mono border-b border-slate-300 pb-2">
                  <span>Ref: <strong className="text-black font-bold">{selectedTransferForLetter.id}</strong></span>
                  <span>Date: {new Date(selectedTransferForLetter.createdAt || selectedTransferForLetter.effectiveDate).toLocaleDateString()}</span>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-black">
                    TO: {selectedTransferForLetter.staffName} ({selectedTransferForLetter.employeeId})
                  </div>
                  <div className="font-bold text-black uppercase">
                    SUBJECT: NOTICE OF INTERNAL DEPARTMENTAL TRANSFER
                  </div>
                </div>

                <p className="text-black">
                  Dear <strong>{selectedTransferForLetter.staffName}</strong>,
                  <br /><br />
                  This document serves as formal notification that your departmental assignment within <strong>{companyName}</strong> has been transferred.
                </p>

                <div className="p-3 rounded-lg bg-slate-50 border border-black space-y-1.5 text-black font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-700">Previous Department:</span>
                    <span className="font-bold">{selectedTransferForLetter.fromDepartment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-700">New Department:</span>
                    <span className="font-bold text-black underline">{selectedTransferForLetter.toDepartment}</span>
                  </div>
                  {selectedTransferForLetter.toRole && (
                    <div className="flex justify-between">
                      <span className="text-slate-700">New Assigned Role:</span>
                      <span className="font-bold text-black">{selectedTransferForLetter.toRole}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-700">Effective Date:</span>
                    <span className="font-bold">{selectedTransferForLetter.effectiveDate}</span>
                  </div>
                </div>

                {/* Summary of Salary Block */}
                <div className="p-3.5 rounded-lg bg-slate-50 border border-black space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold border-b border-black pb-1.5">
                    <span className="font-mono uppercase tracking-wider text-[11px] text-black">
                      SUMMARY OF SALARY & COMPENSATION
                    </span>
                    {isSalaryChanged ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-black text-black bg-white">
                        REVISED / ADJUSTED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-black text-black bg-white">
                        UNCHANGED / PRESERVED
                      </span>
                    )}
                  </div>

                  {!isSalaryChanged ? (
                    <div className="space-y-1 text-black font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-700">Monthly Base Salary:</span>
                        <span className="font-bold">{currencySymbol}{effectiveNewSal.toLocaleString()}</span>
                      </div>
                      <p className="text-[10px] text-slate-700 italic mt-1">
                        * Salary Status: Unchanged. No compensation modifications were applied during this departmental transition.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 text-black font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-700">Previous Monthly Salary:</span>
                        <span className="font-semibold">{currencySymbol}{effectivePrevSal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-700">New Revised Base Salary:</span>
                        <span className="font-bold text-black">{currencySymbol}{effectiveNewSal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-t border-black pt-1">
                        <span className="text-slate-700">Monthly Adjustment:</span>
                        <span className="font-bold text-black">
                          {salaryDiff > 0 ? `+${currencySymbol}${salaryDiff.toLocaleString()} (Increase)` : `-${currencySymbol}${Math.abs(salaryDiff).toLocaleString()} (Reduction)`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <strong className="block text-black mb-1">Operational Justification / Reason:</strong>
                  <p className="text-slate-800 italic">
                    "{selectedTransferForLetter.reason}"
                  </p>
                </div>

                <p className="text-[11px] text-slate-700">
                  Please report to your new Department Lead on the effective date.
                </p>

                <div className="pt-4 border-t-2 border-black flex justify-between items-end">
                  <div>
                    <div className="font-bold text-black">{selectedTransferForLetter.authorizedBy || 'HR Administration'}</div>
                    <div className="text-[10px] text-slate-700">Authorized HR Officer</div>
                  </div>
                  <div className="text-[10px] font-bold text-black flex items-center gap-1 border border-black px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                    VERIFIED RECORD
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 gap-2 flex-wrap">
                <button
                  onClick={() => handleCopyLetter(selectedTransferForLetter)}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedLetterNotice ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-blue-500" />}
                  <span>{copiedLetterNotice ? 'Copied!' : 'Copy Text'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadDoc(selectedTransferForLetter)}
                    className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Download Letter as Microsoft Word (.doc) document"
                  >
                    <Download className="w-4 h-4 text-blue-200" />
                    <span>Export DOC</span>
                  </button>

                  <button
                    onClick={() => handleDownloadPdf(selectedTransferForLetter)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    title="Print or Export as PDF document"
                  >
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <span>Print / Save PDF</span>
                  </button>

                  <button
                    onClick={() => setSelectedTransferForLetter(null)}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Upload Departments List Modal */}
      {isUploadDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-500" />
                Upload Department List
              </h3>
              <button
                onClick={() => setIsUploadDeptModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Batch create organizational departments by uploading a CSV/Excel file or pasting rows adhering to the preferred table format below:
            </p>

            {/* Preferred Table Schema Format View */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  Preferred Table Format Schema
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const sampleCsv = `Department Name,Code,Head of Department,Description,Role Title,Description 1,Description 2,Description 3\nLogistics & Inventory,LOG,David Mark,Warehouse management and site distribution,Operations Supervisor,Manage daily warehouse dispatches,Audit inventory records,Ensure safety protocols\nCustomer Support,SUP,Sarah Connor,24/7 client ticket resolution,Helpdesk Lead,Oversee ticketing queue,Train junior support staff,Maintain SLA response times`;
                      const blob = new Blob(['\ufeff' + sampleCsv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = 'Preferred_Department_Import_Template.csv';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    <Download className="w-3 h-3 text-blue-500" />
                    <span>Download Template (.CSV)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadCsvText(`Logistics & Inventory, LOG, David Mark, Warehouse management and site distribution, Operations Supervisor, Manage daily dispatches, Audit inventory, Ensure safety compliance\nCustomer Support, SUP, Sarah Connor, 24/7 client resolution, Helpdesk Lead, Oversee ticketing queue, Train support staff, Maintain SLA response times`);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    <Copy className="w-3 h-3 text-slate-500" />
                    <span>Load Sample Format</span>
                  </button>
                </div>
              </div>

              {/* Table Schema Preview */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto bg-slate-50 dark:bg-slate-950">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-blue-50/80 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-1.5 whitespace-nowrap">Department Name</th>
                      <th className="px-3 py-1.5 whitespace-nowrap">Code</th>
                      <th className="px-3 py-1.5 whitespace-nowrap">Head</th>
                      <th className="px-3 py-1.5 whitespace-nowrap">Description</th>
                      <th className="px-3 py-1.5 whitespace-nowrap">Role Title</th>
                      <th className="px-3 py-1.5 whitespace-nowrap">Description 1</th>
                      <th className="px-3 py-1.5 whitespace-nowrap">Description 2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                    <tr>
                      <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-slate-900 dark:text-white">Logistics & Inventory</td>
                      <td className="px-3 py-1.5 font-bold text-blue-500">LOG</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">David Mark</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">Warehouse management</td>
                      <td className="px-3 py-1.5 font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">Operations Supervisor</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">Manage daily dispatches</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">Audit inventory records</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-slate-900 dark:text-white">Customer Support</td>
                      <td className="px-3 py-1.5 font-bold text-blue-500">SUP</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">Sarah Connor</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">24/7 ticket resolution</td>
                      <td className="px-3 py-1.5 font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">Helpdesk Lead</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">Oversee ticket queue</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">Train support staff</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Paste CSV or Excel Rows
              </label>
              <textarea
                rows={5}
                value={uploadCsvText}
                onChange={(e) => setUploadCsvText(e.target.value)}
                placeholder={`Logistics & Inventory, LOG, David Mark, Warehouse logistics & distribution\nCustomer Support, SUP, Sarah Connor, Client ticket resolution\nSecurity & Safety, SEC, James Bond, Facility access and safety`}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <label className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-1.5 border border-slate-300 dark:border-slate-700">
                <Upload className="w-3.5 h-3.5 text-blue-500" />
                <span>Choose .CSV File</span>
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const content = evt.target?.result as string;
                        if (content) setUploadCsvText(content);
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadDeptModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleProcessUploadDepartments(uploadCsvText)}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  Import Departments
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Department Modal */}
      <ConfirmDeleteModal
        isOpen={!!deptToDelete}
        title="Delete Department Unit"
        itemName={deptToDelete ? `${deptToDelete.name} (${deptToDelete.code || 'N/A'})` : ''}
        message="Are you sure you want to delete this department?"
        subMessage="All staff currently assigned to this department will be automatically reassigned to 'Unassigned' status."
        confirmButtonText="Yes, Delete Department"
        onConfirm={() => {
          if (deptToDelete) {
            handleDeleteDept(deptToDelete);
            setDeptToDelete(null);
          }
        }}
        onClose={() => setDeptToDelete(null)}
        isLight={isLight}
      />

      {/* Confirm Delete Role Modal */}
      <ConfirmDeleteModal
        isOpen={!!roleToDelete}
        title="Delete Department Role"
        itemName={roleToDelete?.roleTitle}
        message="Are you sure you want to remove this role and its job descriptions from this department?"
        subMessage="All defined job duties and KPI key points under this role will be deleted."
        confirmButtonText="Yes, Delete Role"
        onConfirm={() => {
          if (roleToDelete !== null) {
            const updated = deptForm.roles.filter((_, idx) => idx !== roleToDelete.roleIndex);
            setDeptForm({ ...deptForm, roles: updated });
            setRoleToDelete(null);
          }
        }}
        onClose={() => setRoleToDelete(null)}
        isLight={isLight}
      />
    </div>
  );
};
