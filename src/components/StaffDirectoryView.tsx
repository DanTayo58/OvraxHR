import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  Upload,
  UserPlus,
  Search,
  Filter,
  Download,
  Building2,
  BadgeDollarSign,
  Briefcase,
  Clock,
  Trash2,
  Edit2,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  FileSpreadsheet,
  RefreshCw,
  UserX,
  UserCheck,
  UserMinus,
  X,
  FileText,
  History,
  HeartHandshake,
  ArrowRightLeft,
  Calendar,
  Printer,
  Paperclip,
  Eye,
  ArrowUpDown,
  ChevronDown,
  BarChart3,
  PieChart as PieChartIcon,
  Award,
  Star,
  FileCheck,
  Check,
  ShieldCheck,
  Camera,
  Image as ImageIcon,
  Lock,
  Zap,
  Calculator,
  Database,
  Sliders,
  FileQuestion,
  TrendingUp,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { StaffMember, ProjectFile, AppSettings, LeaveRequest, DepartmentInfo, JobDescriptionItem, InvolvementLevel, JdSection, JdSubsection, EnumerationFormat, User, BookedPenalty, ManualDeductionRule, PayrollConfig, DocumentItemType } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { SearchableStaffSelect } from './SearchableStaffSelect';
import { ConfirmationLetterModal } from './ConfirmationLetterModal';
import { StaffDocumentModal, DocumentTypeTab } from './StaffDocumentModal';
import { EditSuspensionModal } from './EditSuspensionModal';
import { SuspensionHistoryModal } from './SuspensionHistoryModal';
import { TrackApplicantsModal } from './TrackApplicantsModal';
import { StaffWelfareWorkspaceModal } from './StaffWelfareWorkspaceModal';
import { ManageQueryModal } from './ManageQueryModal';
import { syncStaffAndProjects } from '../utils/rosterSync';
import { generateStaffId, getDepartmentCode, formatStaffId, getStaffSuspensionDetails, logStaffSuspensionHistory, isStaffSuspendedOnDate, isStaffSuspensionEnded, calculateSuspensionDays, isNaEmployeeId, isEmployeeIdUnique, isStaffCurrentlyOnQuery, loadCompanyQueries } from '../utils/staffUtils';
import { getActiveOrganizationName, getStaffRoleDutiesInfo, replaceDocumentTags } from '../utils/documentTemplates';
import { loadCompanyData, saveCompanyData, STORAGE_KEYS } from '../utils/companyStorage';
import { getCompanyCurrencySymbol, loadCompanyPayrollConfig, saveCompanyPayrollConfig, derivePayGradeFromSalary, deriveStaffPayGrade, calculateSuspensionDeduction } from '../utils/payrollUtils';
import { getActiveLeaveForStaff, isLeaveEnded, isLeaveCurrentlyActive, reconcileStaffAndLeaves, getTodayDateString } from '../utils/leaveUtils';
import { getCleanDepartments } from '../utils/departmentUtils';
import { emitGlobalToast } from '../context/ToastContext';

export type SortField = 'department' | 'name' | 'employeeId' | 'role' | 'salary' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface SortRule {
  id: string;
  field: SortField;
  direction: SortDirection;
}

const FIELD_LABELS: Record<SortField, string> = {
  department: 'Department',
  name: 'Full Name',
  employeeId: 'Employee ID',
  role: 'Role',
  salary: 'Monthly Salary',
  status: 'Status',
};

// KPI Evaluation Frequency type
export type KpiFrequency = 'daily' | 'monthly' | 'quarterly' | 'yearly';

// Robust KPI rating parser: parses both traditional levels and specific custom score values
export const parseKpiRating = (
  val: any
): { level: 'Very Bad' | 'Bad' | 'OK' | 'Good' | 'Very good' | ''; score: number | null } => {
  if (val === undefined || val === null || val === '') {
    return { level: '', score: null };
  }
  if (typeof val === 'number') {
    const s = Math.max(0, Math.min(100, Math.round(val)));
    let lvl: 'Very Bad' | 'Bad' | 'OK' | 'Good' | 'Very good' = 'OK';
    if (s < 25) lvl = 'Very Bad';
    else if (s <= 44) lvl = 'Bad';
    else if (s <= 55) lvl = 'OK'; // OK is between 45 - 55%
    else if (s <= 79) lvl = 'Good';
    else lvl = 'Very good';
    return { level: lvl, score: s };
  }
  const str = String(val).trim();
  if (str.includes(':')) {
    const [rawLvl, rawScore] = str.split(':');
    const parsedScore = parseInt(rawScore, 10);
    const scoreVal = !isNaN(parsedScore) ? Math.max(0, Math.min(100, parsedScore)) : null;
    let lvl = rawLvl.trim();
    if (lvl.toLowerCase() === 'very good') lvl = 'Very good';
    return { level: lvl as any, score: scoreVal };
  }
  const standardMap: Record<string, { level: 'Very Bad' | 'Bad' | 'OK' | 'Good' | 'Very good'; score: number }> = {
    'Very Bad': { level: 'Very Bad', score: 20 },
    'Bad': { level: 'Bad', score: 35 },
    'OK': { level: 'OK', score: 50 },
    'Good': { level: 'Good', score: 70 },
    'Very good': { level: 'Very good', score: 90 },
    'Very Good': { level: 'Very good', score: 90 },
    'Strongly works': { level: 'Very good', score: 90 },
    'Works': { level: 'Good', score: 70 },
    'Ok': { level: 'OK', score: 50 },
    'Doesnt work': { level: 'Bad', score: 35 },
    'Strongly doesnt work': { level: 'Very Bad', score: 20 },
    "Strongly doesn't work": { level: 'Very Bad', score: 20 },
  };
  if (standardMap[str]) {
    return standardMap[str];
  }
  const num = parseInt(str, 10);
  if (!isNaN(num)) {
    return parseKpiRating(num);
  }
  return { level: '', score: null };
};

interface StaffDirectoryViewProps {
  staffList: StaffMember[];
  projects?: ProjectFile[];
  leaves?: LeaveRequest[];
  onUpdateStaffList: (updated: StaffMember[]) => void;
  onUpdateProjects?: (updated: ProjectFile[]) => void;
  onOpenUploadModal: (mode?: 'scheme' | 'active' | 'suspended' | 'exited') => void;
  onOpenPayrollWorkspace?: () => void;
  isLight?: boolean;
  settings?: AppSettings;
  onUpdateSettings?: (updated: AppSettings) => void;
  user?: User;
}

export const StaffDirectoryView: React.FC<StaffDirectoryViewProps> = ({
  staffList,
  projects = [],
  leaves = [],
  onUpdateStaffList,
  onUpdateProjects,
  onOpenUploadModal,
  onOpenPayrollWorkspace,
  isLight = false,
  settings,
  onUpdateSettings,
  user,
}) => {
  const companyName =
    (user?.company && user.company.trim()) ||
    (settings?.companyName && settings.companyName.trim()) ||
    getActiveOrganizationName(settings);
  const currencySymbol = getCompanyCurrencySymbol(companyName);
  const currentUserName = user?.name || user?.username || 'HR Admin';
  const payrollConfig = loadCompanyPayrollConfig(companyName);
  const defaultSuspensionConfig = payrollConfig?.suspensionDeductionConfig || {
    isEnabled: true,
    calculationType: 'daily_pay',
    rigidDailyAmount: 50,
    daysBasis: 31,
  };
  const isSuspensionDeductionGloballyEnabled = defaultSuspensionConfig.isEnabled !== false;
  const [suspendDeductionOverride, setSuspendDeductionOverride] = useState<boolean>(isSuspensionDeductionGloballyEnabled);
  const configuredPayGrades = payrollConfig.payGrades || [];
  const isAdmin = !user || user.role === 'Admin' || user.isAdmin === true;
  const [rosterTab, setRosterTab] = useState<'active' | 'suspended' | 'exited'>('active');
  const [isManageQueryOpen, setIsManageQueryOpen] = useState(false);
  const [manageQueryStaff, setManageQueryStaff] = useState<StaffMember | null>(null);
  const [selectedQueryForModal, setSelectedQueryForModal] = useState<string | undefined>(undefined);
  const [suspendSearchInput, setSuspendSearchInput] = useState('');
  const [suspendNotification, setSuspendNotification] = useState<string | null>(null);
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [selectedStaffToSuspend, setSelectedStaffToSuspend] = useState<StaffMember | null>(null);
  const [editingSuspensionStaff, setEditingSuspensionStaff] = useState<StaffMember | null>(null);
  const [pendingSuspendStaffId, setPendingSuspendStaffId] = useState<string | null>(null);
  const [suspendStartDate, setSuspendStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [suspendEndDate, setSuspendEndDate] = useState<string>(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  });
  const [suspendEndTime, setSuspendEndTime] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendPenaltyRuleId, setSuspendPenaltyRuleId] = useState<string>('none');
  const manualDeductionsCatalog = payrollConfig?.manualDeductionRules || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterKpis, setFilterKpis] = useState<string[]>([]);
  const [isFiltersDropdownOpen, setIsFiltersDropdownOpen] = useState(false);
  const filterContainerRef = useRef<HTMLDivElement>(null);
  const [sortRules, setSortRules] = useState<SortRule[]>([]); // Default unsorted / default order on launch
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sortContainerRef.current &&
        !sortContainerRef.current.contains(event.target as Node)
      ) {
        setIsSortDropdownOpen(false);
      }
      if (
        filterContainerRef.current &&
        !filterContainerRef.current.contains(event.target as Node)
      ) {
        setIsFiltersDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [isTrackApplicantsOpen, setIsTrackApplicantsOpen] = useState(false);
  const [isWelfareWorkspaceOpen, setIsWelfareWorkspaceOpen] = useState(false);
  const [isSuspensionHistoryOpen, setIsSuspensionHistoryOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffLogUser, setStaffLogUser] = useState<StaffMember | null>(null);
  const [staffLogProfileTab, setStaffLogProfileTab] = useState<'personnel' | 'guarantor' | 'nextOfKin'>('personnel');
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [confirmationStaff, setConfirmationStaff] = useState<StaffMember | null>(null);
  const [documentModalInitialTab, setDocumentModalInitialTab] = useState<DocumentTypeTab | null>('confirmation');
  const [isNewStaffPrompt, setIsNewStaffPrompt] = useState<boolean>(false);
  const [selectedKpiDate, setSelectedKpiDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [allowNormalDuties, setAllowNormalDuties] = useState<boolean>(false);
  const [kpiRefreshTrigger, setKpiRefreshTrigger] = useState(0);
  const [kpiFrequency, setKpiFrequency] = useState<KpiFrequency>(() => {
    try {
      return (loadCompanyData<KpiFrequency>(STORAGE_KEYS.KPI_FREQUENCY, companyName, 'daily')) || 'daily';
    } catch {
      return 'daily';
    }
  });

  // Disable background scrolling when Staff Log modal or KPI evaluation modal is open
  useEffect(() => {
    if (staffLogUser || isKpiModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [staffLogUser, isKpiModalOpen]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'leaves' | 'transfers' | 'suspensions' | 'records'>('all');
  const [selectedDocPreview, setSelectedDocPreview] = useState<{
    title?: string;
    employeeName: string;
    employeeId?: string;
    department?: string;
    leaveType?: string;
    startDate?: string;
    endDate?: string;
    daysCount?: number;
    attachmentName?: string;
    attachmentUrl?: string;
    reason?: string;
    category?: string;
    details?: { label: string; value: string }[];
  } | null>(null);

  const handlePrintDocument = (doc: {
    employeeName: string;
    employeeId?: string;
    department?: string;
    leaveType?: string;
    startDate?: string;
    endDate?: string;
    daysCount?: number;
    attachmentName?: string;
    attachmentUrl?: string;
    reason?: string;
    title?: string;
    category?: string;
    details?: { label: string; value: string }[];
  }) => {
    const printWindow = window.open('', '_blank', 'width=850,height=900');
    if (!printWindow) {
      window.print();
      return;
    }
    const docTitle = doc.title || (doc.leaveType ? `${doc.leaveType} Leave Record` : 'Official Staff Document Record');
    const orgName = companyName || 'Company Workforce Portal';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${docTitle} - ${doc.employeeName}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 36px; color: #1e293b; background: #fff; line-height: 1.5; }
            .header { border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { margin: 0; font-size: 20px; color: #0f766e; font-weight: 800; letter-spacing: -0.02em; }
            .header p { margin: 4px 0 0 0; font-size: 12px; color: #64748b; font-weight: 500; }
            .badge { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 5px 12px; border-radius: 6px; font-weight: bold; font-size: 11px; text-transform: uppercase; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 18px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
            .field { font-size: 12px; }
            .label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 3px; letter-spacing: 0.05em; }
            .val { font-weight: 600; color: #0f172a; font-size: 13px; }
            .doc-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; margin-top: 18px; }
            .doc-img { max-width: 100%; max-height: 480px; border-radius: 6px; object-fit: contain; }
            .notes-box { background: #f1f5f9; border-left: 4px solid #0d9488; padding: 14px; border-radius: 6px; font-size: 12px; color: #334155; margin-bottom: 20px; }
            .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #94a3b8; }
            .sig-line { width: 180px; border-top: 1px dashed #94a3b8; text-align: center; padding-top: 4px; font-size: 10px; color: #64748b; font-weight: 600; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${docTitle.toUpperCase()}</h1>
              <p>${orgName} • Official HR Audit & History Archive</p>
            </div>
            <span class="badge">${doc.category || 'VERIFIED RECORD'}</span>
          </div>
          <div class="grid">
            <div class="field"><div class="label">Employee Full Name</div><div class="val">${doc.employeeName}</div></div>
            <div class="field"><div class="label">Employee ID</div><div class="val">${doc.employeeId || 'N/A'}</div></div>
            <div class="field"><div class="label">Department</div><div class="val">${doc.department || 'N/A'}</div></div>
            ${doc.leaveType ? `<div class="field"><div class="label">Leave Type</div><div class="val">${doc.leaveType} Leave</div></div>` : ''}
            ${doc.startDate ? `<div class="field"><div class="label">Period / Effective Date</div><div class="val">${doc.startDate}${doc.endDate ? ` to ${doc.endDate}` : ''}${doc.daysCount ? ` (${doc.daysCount} Days)` : ''}</div></div>` : ''}
            ${(doc.details || []).map((d) => `<div class="field"><div class="label">${d.label}</div><div class="val">${d.value}</div></div>`).join('')}
            ${doc.attachmentName ? `<div class="field"><div class="label">Document Attachment Reference</div><div class="val">${doc.attachmentName}</div></div>` : ''}
          </div>
          ${doc.reason ? `
            <div class="notes-box">
              <div class="label" style="color: #0f766e; margin-bottom: 4px;">Record Description / Official Details:</div>
              <div style="font-weight: 500; line-height: 1.6;">${doc.reason}</div>
            </div>
          ` : ''}
          ${doc.attachmentUrl ? `
            <div class="doc-box">
              <div class="label" style="margin-bottom:10px;">Attached Proof / Supporting Visual Document</div>
              ${doc.attachmentUrl.startsWith('data:image') 
                ? `<img src="${doc.attachmentUrl}" class="doc-img" alt="Proof Document" />` 
                : `<div style="padding:30px;background:#f8fafc;border-radius:6px;font-weight:600;color:#334155;">📄 Attached Document: ${doc.attachmentName || 'Official File Document'}</div>`
              }
            </div>
          ` : ''}
          <div class="footer">
            <div>
              <div>Printed: ${new Date().toLocaleString()}</div>
              <div>System Scoped Auth Stamp • ${orgName}</div>
            </div>
            <div class="sig-line">
              Authorized HR Representative
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 400);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Print official Key Performance Indicator (KPI) Evaluation Sheet & Measured Results
  const handlePrintKpiEvaluation = (
    staff: StaffMember,
    date: string,
    evalItems: { id: string; text: string; isKey?: boolean; target?: string; weight?: number; keyword?: string }[],
    ratings: Record<string, any>,
    dailyScore: number | null,
    monthlyScore: number | null
  ) => {
    const printWindow = window.open('', '_blank', 'width=950,height=1000');
    const orgName = (companyName || getActiveOrganizationName(settings)).trim() || 'Workforce Portal';

    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const dutyCardsHtml = evalItems.length > 0 ? evalItems.map((item, idx) => {
      const itemStorageKey = `${staff.employeeId || staff.id}_${date}_${item.id}`;
      const rawRating = ratings[itemStorageKey] || '';
      const { level: parsedLevel, score: parsedScore } = parseKpiRating(rawRating);

      const renderOptionPill = (level: 'Very Bad' | 'Bad' | 'OK' | 'Good' | 'Very good', colorStyleKey: string) => {
        const isSelected = parsedLevel.toLowerCase() === level.toLowerCase();
        const displayVal = isSelected && parsedScore !== null ? parsedScore : '';
        const levelDisplayName = level === 'Very good' ? 'Very Good' : level;

        return `
          <div class="opt-pill ${colorStyleKey} ${isSelected ? 'opt-selected' : ''}">
            <span class="opt-check">${isSelected ? '✓' : '○'}</span>
            <span class="opt-name">${levelDisplayName}:</span>
            <span class="opt-line ${isSelected && displayVal !== '' ? 'opt-line-filled' : ''}">${displayVal !== '' ? `&nbsp;${displayVal}&nbsp;` : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</span><span class="opt-pct">%</span>
          </div>
        `;
      };

      return `
        <div class="duty-card">
          <div class="duty-header">
            <div class="duty-title-wrapper">
              <span class="duty-badge-num">#${idx + 1}</span>
              <div class="duty-text">${item.text}</div>
            </div>
            <div class="duty-score-wrap">
              ${parsedScore !== null
                ? `<span class="score-pill-awarded">Score: <strong>${parsedScore}%</strong></span>`
                : `<span class="score-pill-pending">Score: <strong>—</strong></span>`}
            </div>
          </div>

          <div class="duty-sub-row">
            <span class="duty-badge ${item.isKey ? 'duty-key' : 'duty-routine'}">
              ${item.isKey ? '★ Key KPI Deliverable' : 'Routine Operational Duty'}
            </span>
            ${item.keyword ? `<span class="duty-badge duty-skill">ATS: ${item.keyword}</span>` : ''}
            ${item.target ? `<span class="target-badge">🎯 Target: ${item.target}</span>` : ''}
          </div>

          <!-- Rating options horizontally underneath the duty with write-in underline -->
          <div class="rating-options-strip">
            ${renderOptionPill('Very Bad', 'opt-very-bad')}
            ${renderOptionPill('Bad', 'opt-bad')}
            ${renderOptionPill('OK', 'opt-ok')}
            ${renderOptionPill('Good', 'opt-good')}
            ${renderOptionPill('Very good', 'opt-very-good')}
          </div>
        </div>
      `;
    }).join('') : `
      <div class="no-duties-box">
        No job description duties defined in departments configuration for role "${staff.role || 'Unassigned'}".
      </div>
    `;

    const qualitativeVerdict =
      dailyScore !== null
        ? dailyScore >= 90
          ? 'Outstanding & Exceptional Delivery across key duties'
          : dailyScore >= 75
          ? 'Very Good & High Standard Performance'
          : dailyScore >= 60
          ? 'Competent & Satisfactory Performance'
          : dailyScore >= 40
          ? 'Marginal Delivery — Requires Improvement'
          : 'Unsatisfactory Delivery — Immediate Corrective Action Needed'
        : 'Appraisal Awaiting Rating Input';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>KPI Performance Appraisal Sheet - ${staff.name} (#${staff.employeeId || staff.id})</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 12mm 14mm 12mm; }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 4px;
              font-size: 12px;
              line-height: 1.45;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            /* Header */
            .header-bar {
              border-bottom: 2.5px solid #0f766e;
              padding-bottom: 8px;
              margin-bottom: 10px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .org-title { font-size: 17px; font-weight: 900; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px; }
            .doc-title { font-size: 13.5px; font-weight: 800; color: #1e293b; margin-top: 2px; }
            .header-badges { display: flex; align-items: center; gap: 6px; }
            .badge-date { background: #f0fdfa; color: #0f766e; border: 1.5px solid #99f6e4; font-weight: 700; font-size: 10.5px; padding: 3px 8px; border-radius: 6px; }
            .badge-scale { background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; font-weight: 700; font-size: 10.5px; padding: 3px 8px; border-radius: 6px; }
            
            /* Meta grid for portrait A4 */
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 8px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 8px 12px;
              margin-bottom: 10px;
            }
            .meta-label { color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.3px; margin-bottom: 2px; }
            .meta-val { color: #0f172a; font-weight: 800; font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            
            /* Appraisal Rubric Banner */
            .rubric-container {
              margin-bottom: 12px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 7px 10px;
            }
            .rubric-title { font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; margin-bottom: 5px; }
            .rubric-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
            .rubric-pill { padding: 4px 6px; border-radius: 6px; text-align: center; border-width: 1px; border-style: solid; }
            .rubric-pill-name { font-weight: 800; font-size: 10.5px; }
            .rubric-pill-score { font-size: 9px; font-family: monospace; font-weight: 700; margin-top: 1px; }
            
            .pill-very-bad-legend { background: #ffe4e6; border-color: #f43f5e; color: #9f1239; }
            .pill-bad-legend { background: #fef3c7; border-color: #f59e0b; color: #92400e; }
            .pill-ok-legend { background: #dbeafe; border-color: #3b82f6; color: #1e40af; }
            .pill-good-legend { background: #ccfbf1; border-color: #14b8a6; color: #115e59; }
            .pill-very-good-legend { background: #d1fae5; border-color: #10b981; color: #065f46; }

            /* Duties List Container */
            .duties-section-title {
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #0f766e;
              margin-bottom: 6px;
              display: flex;
              align-items: center;
              justify-content: space-between;
            }

            /* Duty Cards Layout (Replaces Table) */
            .duty-card {
              background: #ffffff;
              border: 1.5px solid #e2e8f0;
              border-radius: 8px;
              padding: 9px 11px;
              margin-bottom: 8px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .duty-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 10px;
              margin-bottom: 4px;
            }
            .duty-title-wrapper {
              display: flex;
              align-items: flex-start;
              gap: 7px;
              flex: 1;
            }
            .duty-badge-num {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              min-width: 22px;
              height: 20px;
              padding: 0 4px;
              background: #f0fdfa;
              color: #0f766e;
              border: 1.5px solid #99f6e4;
              border-radius: 5px;
              font-weight: 800;
              font-family: monospace;
              font-size: 10.5px;
              flex-shrink: 0;
              margin-top: 1px;
            }
            .duty-text {
              font-size: 12px;
              font-weight: 700;
              color: #0f172a;
              line-height: 1.35;
            }
            .duty-score-wrap {
              flex-shrink: 0;
              text-align: right;
            }
            .score-pill-awarded {
              display: inline-block;
              background: #f0fdfa;
              color: #0f766e;
              border: 1.5px solid #0d9488;
              padding: 2px 8px;
              border-radius: 6px;
              font-size: 11px;
              font-family: monospace;
            }
            .score-pill-pending {
              display: inline-block;
              background: #f8fafc;
              color: #94a3b8;
              border: 1px solid #e2e8f0;
              padding: 2px 8px;
              border-radius: 6px;
              font-size: 11px;
              font-family: monospace;
            }

            .duty-sub-row {
              display: flex;
              align-items: center;
              gap: 5px;
              flex-wrap: wrap;
              margin-left: 29px;
              margin-bottom: 7px;
            }
            .duty-badge {
              display: inline-block;
              padding: 1.5px 6px;
              border-radius: 4px;
              font-size: 8.5px;
              font-weight: 800;
              font-family: monospace;
            }
            .duty-key { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
            .duty-routine { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
            .duty-skill { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
            .target-badge {
              font-size: 9px;
              color: #854d0e;
              background: #fffbeb;
              padding: 1.5px 6px;
              border-radius: 4px;
              border: 1px dashed #fcd34d;
              font-weight: 600;
            }

            /* Rating Options Strip Underneath Duty */
            .rating-options-strip {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 4px;
              margin-left: 29px;
            }
            .opt-pill {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 2px;
              padding: 4px 3px;
              border-radius: 6px;
              font-size: 9px;
              font-weight: 600;
              border: 1px solid #cbd5e1;
              background: #f8fafc;
              color: #475569;
              text-align: center;
              white-space: nowrap;
            }
            .opt-check { font-size: 9.5px; font-weight: 800; margin-right: 1px; }
            .opt-name { font-weight: 700; }
            .opt-line {
              display: inline-block;
              min-width: 22px;
              border-bottom: 1.5px solid #475569;
              text-align: center;
              font-weight: 800;
              font-family: monospace;
              font-size: 9.5px;
              line-height: 1;
              padding: 0 1px;
            }
            .opt-line-filled {
              border-bottom: 1.5px solid currentColor;
            }
            .opt-pct { font-size: 8.5px; font-family: monospace; opacity: 0.9; margin-left: 1px; }

            /* Selected active options with exact colors matching modal buttons */
            .opt-very-bad.opt-selected {
              background: #e11d48 !important;
              border-color: #be123c !important;
              color: #ffffff !important;
              font-weight: 800;
              box-shadow: 0 1px 2px rgba(225, 29, 72, 0.25);
            }
            .opt-bad.opt-selected {
              background: #d97706 !important;
              border-color: #b45309 !important;
              color: #ffffff !important;
              font-weight: 800;
              box-shadow: 0 1px 2px rgba(217, 119, 6, 0.25);
            }
            .opt-ok.opt-selected {
              background: #2563eb !important;
              border-color: #1d4ed8 !important;
              color: #ffffff !important;
              font-weight: 800;
              box-shadow: 0 1px 2px rgba(37, 99, 235, 0.25);
            }
            .opt-good.opt-selected {
              background: #0d9488 !important;
              border-color: #0f766e !important;
              color: #ffffff !important;
              font-weight: 800;
              box-shadow: 0 1px 2px rgba(13, 148, 136, 0.25);
            }
            .opt-very-good.opt-selected {
              background: #059669 !important;
              border-color: #047857 !important;
              color: #ffffff !important;
              font-weight: 800;
              box-shadow: 0 1px 2px rgba(5, 150, 105, 0.25);
            }

            .no-duties-box {
              text-align: center;
              color: #64748b;
              padding: 20px;
              background: #f8fafc;
              border: 1px dashed #cbd5e1;
              border-radius: 8px;
              margin-bottom: 12px;
            }

            /* Result Card */
            .result-card {
              border: 2px solid #0f766e;
              border-radius: 8px;
              background: #f0fdfa;
              padding: 10px 16px;
              margin-top: 10px;
              margin-bottom: 14px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .result-score { font-size: 28px; font-weight: 900; color: #0f766e; font-family: monospace; line-height: 1; }
            .result-label { font-size: 10px; text-transform: uppercase; font-weight: 800; color: #0f766e; letter-spacing: 0.5px; }
            .result-desc { font-size: 12px; color: #1e293b; margin-top: 2px; font-weight: 700; }
            .monthly-score-tag { font-size: 10.5px; color: #0f766e; margin-top: 3px; font-weight: 600; }

            /* Signatures */
            .signatures {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-top: 16px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .sig-line { border-top: 1.5px solid #94a3b8; margin-top: 32px; padding-top: 4px; font-size: 10px; font-weight: 700; color: #334155; text-align: center; }
            .sig-sub { font-size: 9px; color: #64748b; font-weight: normal; text-align: center; margin-top: 2px; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <div class="org-title">${orgName}</div>
              <div class="doc-title">Key Performance Indicator (KPI) Evaluation Sheet</div>
            </div>
            <div class="header-badges">
              <span class="badge-date">Date: ${formattedDate}</span>
              <span class="badge-scale">100% Evaluation Scale</span>
            </div>
          </div>

          <div class="meta-grid">
            <div>
              <div class="meta-label">Staff Name</div>
              <div class="meta-val">${staff.name}</div>
            </div>
            <div>
              <div class="meta-label">Employee ID</div>
              <div class="meta-val">#${staff.employeeId || staff.id}</div>
            </div>
            <div>
              <div class="meta-label">Department</div>
              <div class="meta-val">${staff.department || 'N/A'}</div>
            </div>
            <div>
              <div class="meta-label">Assigned Role</div>
              <div class="meta-val">${staff.role || 'N/A'}</div>
            </div>
            <div>
              <div class="meta-label">Staff Status</div>
              <div class="meta-val" style="color: ${staff.status === 'Probation' ? '#7c3aed' : '#059669'};">
                ${staff.status || 'Active'}
              </div>
            </div>
          </div>

          <!-- Appraisal Rating Scale Legend with Specified Ranges -->
          <div class="rubric-container">
            <div class="rubric-title">Key Duties Performance Evaluation Rubric &amp; Scoring Ranges</div>
            <div class="rubric-grid">
              <div class="rubric-pill pill-very-bad-legend">
                <div class="rubric-pill-name">Very Bad</div>
                <div class="rubric-pill-score">0% – 24% • Critical Deficiency</div>
              </div>
              <div class="rubric-pill pill-bad-legend">
                <div class="rubric-pill-name">Bad</div>
                <div class="rubric-pill-score">25% – 44% • Needs Improvement</div>
              </div>
              <div class="rubric-pill pill-ok-legend">
                <div class="rubric-pill-name">OK</div>
                <div class="rubric-pill-score">45% – 55% • Baseline Target</div>
              </div>
              <div class="rubric-pill pill-good-legend">
                <div class="rubric-pill-name">Good</div>
                <div class="rubric-pill-score">56% – 79% • High Standard Delivery</div>
              </div>
              <div class="rubric-pill pill-very-good-legend">
                <div class="rubric-pill-name">Very Good</div>
                <div class="rubric-pill-score">80% – 100% • Outstanding Target</div>
              </div>
            </div>
          </div>

          <!-- Duties & Options Underneath (No Table, No Weights) -->
          <div class="duties-section-title">
            <span>Evaluated Role Duties & Delivered Performance Standards</span>
            <span>Total Duties: ${evalItems.length}</span>
          </div>

          ${dutyCardsHtml}

          <!-- Result of KPI measured at bottom -->
          <div class="result-card">
            <div>
              <div class="result-label">Overall Performance Measurement Result</div>
              <div class="result-desc">${qualitativeVerdict}</div>
              ${monthlyScore !== null && monthlyScore !== undefined ? `<div class="monthly-score-tag">Cumulative Monthly Average: <strong>${monthlyScore}%</strong></div>` : ''}
            </div>
            <div style="text-align: right;">
              <div class="result-score">${dailyScore !== null ? `${dailyScore}%` : '—'}</div>
              <div style="font-size: 9.5px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-top: 2px;">
                ${dailyScore !== null ? 'Day Appraisal Score' : 'Awaiting Ratings'}
              </div>
            </div>
          </div>

          <div class="signatures">
            <div>
              <div class="sig-line">Staff Member Signature</div>
              <div class="sig-sub">Acknowledged & Discussed • Date: ____________</div>
            </div>
            <div>
              <div class="sig-line">Lead / Immediate Supervisor Signature</div>
              <div class="sig-sub">Evaluated By • Date: ____________</div>
            </div>
            <div>
              <div class="sig-line">HR Director / Management Approval</div>
              <div class="sig-sub">Verified & Recorded • Date: ____________</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 350);
            }
          </script>
        </body>
      </html>
    `;

    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Fetch database roles for a department (or all departments)
  const getAvailableDbRoles = (deptName?: string) => {
    let roles: string[] = [];
    try {
      const parsed = getCleanDepartments(companyName);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((d) => {
          if (!deptName || d.name.toLowerCase().trim() === (deptName || '').toLowerCase().trim()) {
            if (Array.isArray(d.roles)) {
              d.roles.forEach((r) => {
                if (r && r.title && r.title.trim() && !roles.includes(r.title.trim())) {
                  roles.push(r.title.trim());
                }
              });
            }
          }
        });
      }
    } catch (err) {
      console.error('Error reading department roles', err);
    }
    return roles;
  };

  // Get structured role info & job description items for a staff member strictly from Department database records
  const getStaffRoleInfo = (staff: StaffMember) => {
    return getStaffRoleDutiesInfo(staff, companyName);
  };

  // Legacy string helper for backwards compatibility
  const getStaffJobDescription = (staff: StaffMember) => {
    const { items, jobDescription } = getStaffRoleInfo(staff);
    if (items && items.length > 0) return items.map((it) => it.text).join(' | ');
    return jobDescription || '';
  };

  // Export official personalized job description as .doc
  const handleExportJobDescriptionDoc = (staff: StaffMember) => {
    const { roleTitle, items, keyItems, normalItems, skills, keyDutiesCount, jobDescription } = getStaffRoleInfo(staff);
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const companyName = (settings?.jdCompanyName || settings?.companyName || getActiveOrganizationName(settings)).trim();
    const docTitle = settings?.jdDocumentTitle || 'OFFICIAL STAFF JOB DESCRIPTION & PERFORMANCE CONTRACT';
    const empSigLabel = settings?.jdEmployeeSigLabel || 'Employee Signature';
    const hrSigLabel = settings?.jdHrSigLabel || 'HR / Management Representative Signature';

    const replaceJdTags = (rawText: string = '') => {
      return replaceDocumentTags(rawText, staff, companyName, dateStr);
    };

    const getEnumerationPrefix = (index: number, format?: EnumerationFormat, isSub = false) => {
      if (!format || format === 'none') return '';
      if (format === 'dots') return '• ';
      if (format === 'numbers') return `${index + 1}. `;
      if (format === 'letters') {
        const char = String.fromCharCode(65 + (index % 26));
        return isSub ? `${char.toLowerCase()}. ` : `${char}. `;
      }
      if (format === 'roman') {
        const lookup: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
        let num = index + 1;
        let rom = '';
        for (const [val, str] of lookup) {
          while (num >= val) { rom += str; num -= val; }
        }
        return isSub ? `${rom.toLowerCase()}. ` : `${rom}. `;
      }
      return '';
    };

    const renderRoleHtml = (type: DocumentItemType, introParagraph?: string, isSub = false) => {
      const intro = introParagraph && introParagraph.trim()
        ? `<p style="font-size: ${isSub ? '10pt' : '10.5pt'}; color: #334155; line-height: 1.5; margin-bottom: 8px;">${replaceJdTags(introParagraph)}</p>`
        : '';

      if (type === 'skills') {
        const skillsList = (skills && skills.length > 0)
          ? skills
          : ['Operational Workflow Management', 'Quality Benchmark Compliance', 'Process Optimization', 'Safety Protocols'];
        const skillsHtml = skillsList
          .map((sk) => `<li style="margin-bottom: 6px; font-size: ${isSub ? '9.5pt' : '10pt'}; color: #1e293b;"><strong>${replaceJdTags(sk)}</strong></li>`)
          .join('');
        return `
          ${intro}
          <ul style="margin-left: 0; padding-left: 20px; list-style-type: square; margin-bottom: 12px;">
            ${skillsHtml}
          </ul>
        `;
      }

      let itemsToRender: { text: string; isKey?: boolean }[] = [];
      if (type === 'key_roles') {
        itemsToRender = (keyItems && keyItems.length > 0) ? keyItems : items.filter((i) => i.isKey);
      } else if (type === 'normal_roles') {
        itemsToRender = (normalItems && normalItems.length > 0) ? normalItems : items.filter((i) => !i.isKey);
      } else {
        itemsToRender = items;
      }

      if (itemsToRender.length === 0) {
        if (type === 'key_roles') {
          itemsToRender = [
            { text: 'Direct operational workflows, key milestones, and team deliverables', isKey: true },
            { text: 'Enforce stringent quality benchmarks, compliance protocols, and safety standards', isKey: true },
          ];
        } else if (type === 'normal_roles') {
          itemsToRender = [
            { text: 'Coordinate daily departmental handovers and routine tasks', isKey: false },
            { text: 'Maintain operating records and routine operational logs', isKey: false },
          ];
        } else {
          itemsToRender = [
            { text: 'Manage daily operational workflows and department deliverables', isKey: false },
            { text: 'Ensure strict compliance with punctuality, shift rosters, and safety procedures', isKey: false },
            { text: 'Maintain quality standards and execute monthly performance targets', isKey: false },
          ];
        }
      }

      const listContent = `
        <ul style="margin-left: 0; padding-left: 20px; list-style-type: disc; margin-bottom: 12px;">
          ${itemsToRender
            .map(
              (it) => `
            <li style="margin-bottom: 8px; font-size: ${isSub ? '10pt' : '10.5pt'}; line-height: 1.5; color: #1e293b;">
              <strong>${replaceJdTags(it.text)}</strong>
            </li>
          `
            )
            .join('')}
        </ul>
      `;

      return `${intro}${listContent}`;
    };

    const renderDutiesListHtml = (introParagraph?: string) => {
      return renderRoleHtml('all_roles', introParagraph);
    };

    const renderTableHtml = (headers?: string[], rows?: string[][]) => {
      if (!headers || headers.length === 0) return '';
      return `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              ${headers
                .map(
                  (h) => `<th style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 10pt; font-weight: bold; color: #334155;">${replaceJdTags(h)}</th>`
                )
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${
              rows && rows.length > 0
                ? rows
                    .map(
                      (row) => `
              <tr>
                ${row
                  .map(
                    (cell) => `<td style="border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 10pt; color: #0f172a;">${replaceJdTags(cell)}</td>`
                  )
                  .join('')}
              </tr>
            `
                    )
                    .join('')
                : `<tr><td colspan="${headers.length}" style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color: #94a3b8; font-style: italic;">No rows defined</td></tr>`
            }
          </tbody>
        </table>
      `;
    };

    const hasCustomSections = settings?.jdSections && settings.jdSections.length > 0;
    const activeSections: JdSection[] = hasCustomSections
      ? (settings.jdSections as JdSection[])
      : [
          {
            id: 'sec-meta-table',
            title: 'Employee & Role Profile Information',
            type: 'table',
            enumeration: 'none',
            tableHeaders: ['Information Field', 'Profile Record Detail', 'Department Designation', 'Current Status'],
            tableRows: [
              ['Staff Name', '{STAFF_NAME}', 'Department', '{DEPARTMENT}'],
              ['Employee ID', '#{EMPLOYEE_ID}', 'Role / Designation', '{ROLE_TITLE}'],
              ['Contract Status', '{EMPLOYMENT_STATUS}', 'Issue Date', '{DATE}'],
            ],
            subsections: [],
          },
          {
            id: 'sec-1',
            title: settings?.jdSection1Title || 'Core Role Overview & Scope',
            type: 'text',
            enumeration: 'roman',
            text: settings?.jdSection1Text || 'This official document details the primary responsibilities, standards of conduct, and key performance evaluation metrics (KPI) assigned to {STAFF_NAME} as a {ROLE_TITLE} in the {DEPARTMENT} department.',
          },
          {
            id: 'sec-2',
            title: settings?.jdSection2Title || 'Enumerated Responsibilities & Duties',
            type: 'duties_list',
            enumeration: 'roman',
            text: 'Here are your assigned job descriptions and primary duties:',
          },
          {
            id: 'sec-3',
            title: settings?.jdSection3Title || 'Acknowledgement & Authorization',
            type: 'text',
            enumeration: 'roman',
            text: settings?.jdSection3Text || 'By signing below, the employee hereby confirms receipt, review, and agreement to fulfill all duties and performance metrics specified in this job description document.',
          },
        ];

    const sectionsHtml = activeSections
      .map((sec, secIdx) => {
        const secPrefix = getEnumerationPrefix(secIdx, sec.enumeration, false);
        const fullSecTitle = `${secPrefix}${replaceJdTags(sec.title)}`;

        let mainContent = '';
        if (sec.type === 'text' && sec.text) {
          mainContent = `<p style="font-size: 10.5pt; color: #334155; line-height: 1.6; margin-bottom: 12px;">${replaceJdTags(sec.text)}</p>`;
        } else if (sec.type === 'duties_list' || sec.type === 'all_roles' || sec.type === 'key_roles' || sec.type === 'normal_roles' || sec.type === 'skills') {
          mainContent = renderRoleHtml(sec.type, sec.text || 'Core operational responsibilities:');
        } else if (sec.type === 'list') {
          const headingHtml = sec.heading ? `<p style="font-size: 10.5pt; font-weight: bold; color: #334155; margin-bottom: 6px;">${replaceJdTags(sec.heading)}</p>` : '';
          const itemsHtml = (sec.listItems && sec.listItems.length > 0 ? sec.listItems : ['Execute assigned responsibilities'])
            .map((item, itemIdx) => {
              const itemPrefix = getEnumerationPrefix(itemIdx, sec.enumeration || 'letters', true);
              return `<li style="margin-bottom: 6px; font-size: 10.5pt; color: #1e293b; list-style: none;"><strong>${itemPrefix || '•'}</strong> ${replaceJdTags(item)}</li>`;
            })
            .join('');
          mainContent = `${headingHtml}<ul style="margin-left: 0; padding-left: 10px; margin-bottom: 12px;">${itemsHtml}</ul>`;
        } else if (sec.type === 'table') {
          mainContent = renderTableHtml(sec.tableHeaders, sec.tableRows);
        }

        const subsectionsHtml =
          sec.subsections && sec.subsections.length > 0
            ? sec.subsections
                .map((sub, subIdx) => {
                  const subPrefix = getEnumerationPrefix(subIdx, sub.enumeration, true);
                  const fullSubTitle = `${subPrefix}${replaceJdTags(sub.title)}`;
                  let subContent = '';
                  if (sub.type === 'text' && sub.text) {
                    subContent = `<p style="font-size: 10pt; color: #475569; line-height: 1.5; margin-bottom: 10px; margin-left: 15px;">${replaceJdTags(sub.text)}</p>`;
                  } else if (sub.type === 'duties_list' || sub.type === 'all_roles' || sub.type === 'key_roles' || sub.type === 'normal_roles' || sub.type === 'skills') {
                    subContent = `<div style="margin-left: 15px;">${renderRoleHtml(sub.type, sub.text, true)}</div>`;
                  } else if (sub.type === 'list') {
                    const headingHtml = sub.heading ? `<p style="font-size: 10pt; font-weight: bold; color: #475569; margin-bottom: 6px; margin-left: 15px;">${replaceJdTags(sub.heading)}</p>` : '';
                    const itemsHtml = (sub.listItems && sub.listItems.length > 0 ? sub.listItems : ['Execute assigned responsibilities'])
                      .map((item, itemIdx) => {
                        const itemPrefix = getEnumerationPrefix(itemIdx, sub.enumeration || 'letters', true);
                        return `<li style="margin-bottom: 5px; font-size: 10pt; color: #1e293b; list-style: none;"><strong>${itemPrefix || '•'}</strong> ${replaceJdTags(item)}</li>`;
                      })
                      .join('');
                    subContent = `${headingHtml}<ul style="margin-left: 15px; padding-left: 10px; margin-bottom: 10px;">${itemsHtml}</ul>`;
                  } else if (sub.type === 'table') {
                    subContent = `<div style="margin-left: 15px;">${renderTableHtml(sub.tableHeaders, sub.tableRows)}</div>`;
                  }

                  return `
                    <div style="margin-top: 15px; margin-left: 10px;">
                      <div style="font-size: 11pt; font-weight: bold; color: #0f172a; margin-bottom: 6px;">${fullSubTitle}</div>
                      ${subContent}
                    </div>
                  `;
                })
                .join('')
            : '';

        return `
          <div style="margin-top: 25px;">
            <div class="section-title">${fullSecTitle}</div>
            ${mainContent}
            ${subsectionsHtml}
          </div>
        `;
      })
      .join('');

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Official Job Description - ${staff.name}</title>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; margin: 40px; color: #0f172a; line-height: 1.6; }
          .header { text-align: center; border-bottom: 2px dashed #0d9488; padding-bottom: 15px; margin-bottom: 25px; }
          .company { font-size: 14pt; font-weight: bold; color: #0d9488; letter-spacing: 1px; }
          .title { font-size: 18pt; font-weight: bold; color: #0f172a; margin-top: 6px; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          .meta-table td { padding: 9px 12px; border: 1px solid #cbd5e1; font-size: 10.5pt; }
          .meta-table td.label { font-weight: bold; background-color: #f1f5f9; color: #334155; width: 25%; }
          .section-title { font-size: 12pt; font-weight: bold; color: #0d9488; border-left: 4px solid #0d9488; padding-left: 10px; margin-top: 25px; margin-bottom: 12px; text-transform: uppercase; }
          .signatures { margin-top: 50px; width: 100%; border-collapse: collapse; }
          .signatures td { width: 50%; padding-top: 40px; font-size: 10pt; vertical-align: bottom; }
          .sig-line { border-top: 1px solid #475569; width: 85%; margin-top: 40px; padding-top: 5px; font-weight: bold; color: #334155; }
        </style>
      </head>
      <body>
        <div class="header">
          ${companyName ? `<div class="company">${companyName}</div>` : ''}
          <div class="title">${docTitle}</div>
          <div style="font-size: 9pt; color: #64748b; margin-top: 5px;">Document Issue Date: ${dateStr}</div>
        </div>

        ${sectionsHtml}

        <table class="signatures">
          <tr>
            <td>
              <div class="sig-line">${empSigLabel}</div>
              <div>Full Name: ${staff.name}</div>
              <div>Date: ____ / ____ / ________</div>
            </td>
            <td>
              <div class="sig-line">${hrSigLabel}</div>
              <div>Authorized HR Representative</div>
              <div>Date: ____ / ____ / ________</div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Job_Description_${staff.name.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Calculate KPI involvement data based on key job description options and selected frequency
  const getStaffKpiData = (staff: StaffMember, targetDateStr?: string, frequency: KpiFrequency = kpiFrequency) => {
    // Read recorded daily key description ratings from company storage
    let storedRatings: Record<string, any> = {};
    try {
      storedRatings = loadCompanyData<Record<string, any>>(STORAGE_KEYS.KPI_RATINGS, companyName, {});
    } catch (e) {
      console.error('Error reading KPI ratings', e);
    }

    const staffPrefix = `${staff.employeeId || staff.id}_`;

    // Retrieve active job description items strictly from Department records
    const { items } = getStaffRoleInfo(staff);
    const keyItems = items.filter((it) => it.isKey);
    const evalItems = keyItems.length > 0 ? keyItems : items;
    const totalKeyCount = evalItems.length;

    // Group ratings by date for this staff member
    // Storage Key Format: `${staffPrefix}${date}_${itemId}`
    const ratingsByDate: Record<string, Record<string, any>> = {};

    Object.entries(storedRatings).forEach(([key, levelOrScore]) => {
      if (key.startsWith(staffPrefix)) {
        const rest = key.slice(staffPrefix.length);
        const lastUnderscore = rest.lastIndexOf('_');
        if (lastUnderscore !== -1) {
          const dateStr = rest.slice(0, lastUnderscore);
          const itemId = rest.slice(lastUnderscore + 1);
          // Only evaluate if itemId currently exists in active department job descriptions
          if (evalItems.some((it) => it.id === itemId)) {
            if (!ratingsByDate[dateStr]) ratingsByDate[dateStr] = {};
            ratingsByDate[dateStr][itemId] = levelOrScore;
          }
        }
      }
    });

    // Calculate daily average for each measured date:
    // Day Average = (Sum of ratings for active key descriptions on that date) / (totalKeyCount)
    const dailyAveragesByDate: Record<string, number> = {};

    Object.entries(ratingsByDate).forEach(([dateStr, itemRatings]) => {
      if (totalKeyCount > 0) {
        let daySum = 0;
        let ratedCount = 0;
        Object.values(itemRatings).forEach((levelOrScore) => {
          const { score } = parseKpiRating(levelOrScore);
          if (score !== null) {
            daySum += score;
            ratedCount += 1;
          }
        });
        if (ratedCount > 0) {
          const dayAvg = Math.round(daySum / totalKeyCount);
          dailyAveragesByDate[dateStr] = Math.min(100, Math.max(0, dayAvg));
        }
      }
    });

    // Overall rated average across all measured dates
    const ratedDailyAvgs = Object.values(dailyAveragesByDate);
    const overallRatedAverage = ratedDailyAvgs.length > 0
      ? Math.round(ratedDailyAvgs.reduce((a, b) => a + b, 0) / ratedDailyAvgs.length)
      : 0;

    // Determine reference date
    let refDateStr = targetDateStr || new Date().toISOString().slice(0, 10);
    const ratedDates = Object.keys(dailyAveragesByDate).sort();
    if (!targetDateStr && ratedDates.length > 0) {
      refDateStr = ratedDates[ratedDates.length - 1];
    }

    const dateParts = refDateStr.split('-').map(Number);
    const targetYear = dateParts[0] || new Date().getFullYear();
    const targetMonth = (dateParts[1] || 1) - 1; // 0-11
    const targetDay = dateParts[2] || 1;
    const refDate = new Date(targetYear, targetMonth, targetDay);

    let chartData: { label: string; day?: string; score: number; tooltipTitle?: string; dateStr?: string }[] = [];
    let summaryScore = overallRatedAverage;
    let frequencyTitle = 'Daily Performance Analysis (7 Days)';
    let periodSummaryLabel = 'Daily Avg';
    let frequencyCaption = `Daily average of scores evaluates directly to the overall KPI of ${summaryScore}%.`;

    if (frequency === 'daily') {
      const dayOfWeek = refDate.getDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(refDate);
      monday.setDate(refDate.getDate() + diffToMon);

      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      chartData = dayNames.map((day, idx) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + idx);
        const dYear = d.getFullYear();
        const dMonth = String(d.getMonth() + 1).padStart(2, '0');
        const dDay = String(d.getDate()).padStart(2, '0');
        const dateStr = `${dYear}-${dMonth}-${dDay}`;
        const score = dailyAveragesByDate[dateStr] !== undefined ? dailyAveragesByDate[dateStr] : 0;
        return {
          label: day,
          day,
          dateStr,
          score,
          tooltipTitle: `${dateStr} (${day})`,
        };
      });

      const weekRatedScores = chartData.filter((d) => dailyAveragesByDate[d.dateStr!] !== undefined).map((d) => d.score);
      summaryScore = dailyAveragesByDate[refDateStr] !== undefined
        ? dailyAveragesByDate[refDateStr]
        : weekRatedScores.length > 0
        ? Math.round(weekRatedScores.reduce((a, b) => a + b, 0) / weekRatedScores.length)
        : overallRatedAverage;
      frequencyTitle = 'Daily Performance Analysis (7 Days)';
      periodSummaryLabel = 'Daily Avg';
      frequencyCaption = `Current daily score evaluates directly to the overall KPI (${summaryScore}%).`;
    } else if (frequency === 'monthly') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      chartData = monthNames.map((name, idx) => {
        const mPrefix = `${targetYear}-${String(idx + 1).padStart(2, '0')}`;
        const mScores: number[] = [];
        Object.entries(dailyAveragesByDate).forEach(([dStr, s]) => {
          if (dStr.startsWith(mPrefix)) {
            mScores.push(s);
          }
        });
        const mAvg = mScores.length > 0 ? Math.round(mScores.reduce((a, b) => a + b, 0) / mScores.length) : 0;
        return {
          label: name,
          day: name,
          score: mAvg,
          tooltipTitle: `${name} ${targetYear} (${mScores.length} days evaluated)`,
        };
      });

      const currentMonthPrefix = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
      const currentMonthScores = Object.entries(dailyAveragesByDate)
        .filter(([dStr]) => dStr.startsWith(currentMonthPrefix))
        .map(([, s]) => s);

      summaryScore = currentMonthScores.length > 0
        ? Math.round(currentMonthScores.reduce((a, b) => a + b, 0) / currentMonthScores.length)
        : overallRatedAverage;
      frequencyTitle = `Monthly Performance Trend (${targetYear})`;
      periodSummaryLabel = 'Monthly Avg';
      frequencyCaption = `Monthly score for ${monthNames[targetMonth]} ${targetYear} is ${summaryScore}%.`;
    } else if (frequency === 'quarterly') {
      const quarters = [
        { label: '1st Quarter', fullLabel: '1st Quarter (Jan - Mar)', months: [1, 2, 3] },
        { label: '2nd Quarter', fullLabel: '2nd Quarter (Apr - Jun)', months: [4, 5, 6] },
        { label: '3rd Quarter', fullLabel: '3rd Quarter (Jul - Sep)', months: [7, 8, 9] },
        { label: '4th Quarter', fullLabel: '4th Quarter (Oct - Dec)', months: [10, 11, 12] },
      ];

      chartData = quarters.map((q) => {
        const qScores: number[] = [];
        q.months.forEach((m) => {
          const prefix = `${targetYear}-${String(m).padStart(2, '0')}`;
          Object.entries(dailyAveragesByDate).forEach(([dStr, s]) => {
            if (dStr.startsWith(prefix)) {
              qScores.push(s);
            }
          });
        });
        const qAvg = qScores.length > 0 ? Math.round(qScores.reduce((a, b) => a + b, 0) / qScores.length) : 0;
        return {
          label: q.label,
          day: q.label,
          score: qAvg,
          tooltipTitle: `${q.fullLabel} ${targetYear} (${qScores.length} days evaluated)`,
        };
      });

      const currentQIdx = Math.floor(targetMonth / 3);
      const targetQScore = chartData[currentQIdx]?.score;
      summaryScore = targetQScore > 0 ? targetQScore : overallRatedAverage;
      frequencyTitle = `Quarter-Yearly Breakdown (${targetYear}, Every 3 Months)`;
      periodSummaryLabel = 'Quarterly Avg';
      frequencyCaption = `Quarterly score for ${quarters[currentQIdx].label} is ${summaryScore}%.`;
    } else if (frequency === 'yearly') {
      // 4 years leading up to current year 2026: 2023, 2024, 2025, 2026
      const currentYear = 2026;
      const years = [currentYear - 3, currentYear - 2, currentYear - 1, currentYear]; // [2023, 2024, 2025, 2026]
      chartData = years.map((y) => {
        const yScores: number[] = [];
        Object.entries(dailyAveragesByDate).forEach(([dStr, s]) => {
          if (dStr.startsWith(`${y}-`)) {
            yScores.push(s);
          }
        });
        const yAvg = yScores.length > 0 ? Math.round(yScores.reduce((a, b) => a + b, 0) / yScores.length) : 0;
        return {
          label: String(y),
          day: String(y),
          score: yAvg,
          tooltipTitle: `Year ${y} (${yScores.length} days evaluated)`,
        };
      });

      const currentYearScore = chartData.find((d) => d.label === String(currentYear))?.score;
      summaryScore = currentYearScore && currentYearScore > 0 ? currentYearScore : overallRatedAverage;
      frequencyTitle = `Annual Performance (2023 - ${currentYear})`;
      periodSummaryLabel = 'Annual Avg';
      frequencyCaption = `Annual average performance score for year ${currentYear} is ${summaryScore}%.`;
    }

    // Collated all-time average across all evaluated days (strictly 0 if no ratings recorded)
    const allEvaluatedDailyScores = Object.values(dailyAveragesByDate);
    const collatedAllTimeAverage = allEvaluatedDailyScores.length > 0
      ? Math.round(allEvaluatedDailyScores.reduce((a, b) => a + b, 0) / allEvaluatedDailyScores.length)
      : (typeof (staff as any).kpiScore === 'number' ? (staff as any).kpiScore : 0);

    // Multi-dimensional KPI Radar Parameters for this individual staff
    // 6 generic parameters: Regularity, Punctuality, Task Execution, Discipline, Operational Output, Initiative
    let staffQueries: any[] = [];
    try {
      staffQueries = loadCompanyQueries(companyName).filter(
        (q) => q.staffId === staff.id || q.staffId === staff.employeeId
      );
    } catch (e) {
      console.error(e);
    }
    const pendingQueriesCount = staffQueries.filter((q) => q.status === 'pending').length;
    const closedWarningCount = staffQueries.filter((q) => q.finalVerdict === 'Official Warning' || q.finalVerdict === 'Suspension').length;

    // 1. Regularity & Punctuality strictly derived from actual attendance records across worksheets
    // Load effective projects if projects prop is empty or out of sync
    const effectiveProjects: ProjectFile[] = (projects && projects.length > 0)
      ? projects
      : loadCompanyData<ProjectFile[]>(STORAGE_KEYS.PROJECTS, companyName, []);

    const cleanStr = (s?: string) => (s || '').trim().toLowerCase();
    const cleanId = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const staffIdClean = cleanId(staff.id);
    const staffEmpIdClean = cleanId(staff.employeeId);
    const staffNameClean = cleanStr(staff.name).replace(/\s+/g, ' ');

    const staffRecords: any[] = [];
    (effectiveProjects || []).forEach((proj) => {
      (proj.records || []).forEach((rec) => {
        const recEmpClean = cleanId(rec.employeeId);
        const recIdClean = cleanId(rec.id);
        const recNameClean = cleanStr(rec.employeeName).replace(/\s+/g, ' ');

        const idMatches =
          (staffEmpIdClean && recEmpClean && (staffEmpIdClean === recEmpClean || staffEmpIdClean.endsWith(recEmpClean) || recEmpClean.endsWith(staffEmpIdClean))) ||
          (staffIdClean && recEmpClean && staffIdClean === recEmpClean) ||
          (staffIdClean && recIdClean && recIdClean.includes(staffIdClean)) ||
          (staffEmpIdClean && recIdClean && recIdClean.includes(staffEmpIdClean));

        const nameMatches =
          Boolean(staffNameClean &&
          recNameClean &&
          (staffNameClean === recNameClean ||
            (staffNameClean.length > 3 && recNameClean.length > 3 && (staffNameClean.includes(recNameClean) || recNameClean.includes(staffNameClean)))));

        if (idMatches || nameMatches) {
          staffRecords.push(rec);
        }
      });
    });

    let regularityScore = 0;
    let punctualityScore = 0;
    if (staffRecords.length > 0) {
      const isRestOrLeave = (r: any) => {
        const st = cleanStr(r.status);
        return (
          st.includes('leave') ||
          st.includes('pre-employment') ||
          st.includes('holiday') ||
          st.includes('weekend') ||
          st.includes('day off') ||
          st.includes('excused') ||
          st === 'rest'
        );
      };

      const hasAttendanceClock = (r: any) => {
        const cIn = (r.clockIn || '').trim();
        return cIn !== '' && cIn !== '-' && cIn !== '--:--' && cIn !== '00:00';
      };

      const isPresentStatus = (r: any) => {
        const st = cleanStr(r.status);
        return st === 'present' || st === 'on duty' || st === 'in';
      };

      const isLateStatus = (r: any) => {
        const st = cleanStr(r.status);
        return st === 'late';
      };

      const isHalfDayStatus = (r: any) => {
        const st = cleanStr(r.status);
        return st === 'half day' || st === 'halfday';
      };

      const isAbsentStatus = (r: any) => {
        const st = cleanStr(r.status);
        return st === 'absent';
      };

      const scheduledDays = staffRecords.filter(
        (r) => !isRestOrLeave(r) && (isPresentStatus(r) || isLateStatus(r) || isHalfDayStatus(r) || isAbsentStatus(r) || hasAttendanceClock(r))
      );

      const attendedDays = staffRecords.filter(
        (r) => !isRestOrLeave(r) && (isPresentStatus(r) || isLateStatus(r) || isHalfDayStatus(r) || hasAttendanceClock(r))
      );

      const onTimeDays = staffRecords.filter(
        (r) => !isRestOrLeave(r) && (isPresentStatus(r) || (hasAttendanceClock(r) && !isLateStatus(r))) && !isLateStatus(r)
      );

      if (scheduledDays.length > 0) {
        regularityScore = Math.round((attendedDays.length / scheduledDays.length) * 100);
      } else if (attendedDays.length > 0) {
        regularityScore = 100;
      }

      if (attendedDays.length > 0) {
        punctualityScore = Math.round((onTimeDays.length / attendedDays.length) * 100);
      }
    }

    // 2. Discipline score: 100 baseline for active personnel, penalized by formal queries and warnings
    const hasWorkforcePresence = staffRecords.length > 0 || allEvaluatedDailyScores.length > 0 || staff.status === 'Active';
    const disciplineScore = hasWorkforcePresence
      ? Math.max(0, 100 - (pendingQueriesCount * 25 + closedWarningCount * 15))
      : 0;

    // 3. Task Execution, Output, and Initiative derived strictly from actual recorded duty ratings
    const paramBuckets: Record<string, number[]> = {
      'Task Execution': [],
      Output: [],
      Initiative: [],
    };

    Object.entries(ratingsByDate).forEach(([, itemRatings]) => {
      Object.entries(itemRatings).forEach(([itemId, levelOrScore]) => {
        const { score } = parseKpiRating(levelOrScore);
        if (score !== null) {
          const matchedDuty = evalItems.find((it) => it.id === itemId);
          const mapped = matchedDuty?.mappedParameters || [];
          if (mapped.length > 0) {
            mapped.forEach((param) => {
              const pNorm = param.toLowerCase().trim();
              if (pNorm.includes('task') || pNorm.includes('execution')) {
                paramBuckets['Task Execution'].push(score);
              } else if (pNorm.includes('output') || pNorm.includes('operation')) {
                paramBuckets.Output.push(score);
              } else if (pNorm.includes('initiative') || pNorm.includes('cooperation')) {
                paramBuckets.Initiative.push(score);
              }
            });
          } else {
            // Unmapped duties contribute to Task Execution
            paramBuckets['Task Execution'].push(score);
          }
        }
      });
    });

    const taskExecutionScore = paramBuckets['Task Execution'].length > 0
      ? Math.round(paramBuckets['Task Execution'].reduce((a, b) => a + b, 0) / paramBuckets['Task Execution'].length)
      : (overallRatedAverage > 0 ? overallRatedAverage : 0);

    const outputScore = paramBuckets.Output.length > 0
      ? Math.round(paramBuckets.Output.reduce((a, b) => a + b, 0) / paramBuckets.Output.length)
      : (overallRatedAverage > 0 ? overallRatedAverage : 0);

    const initiativeScore = paramBuckets.Initiative.length > 0
      ? Math.round(paramBuckets.Initiative.reduce((a, b) => a + b, 0) / paramBuckets.Initiative.length)
      : (overallRatedAverage > 0 ? overallRatedAverage : 0);

    const radarData = [
      { parameter: 'Regularity', score: regularityScore, fullMark: 100 },
      { parameter: 'Punctuality', score: punctualityScore, fullMark: 100 },
      { parameter: 'Task Execution', score: taskExecutionScore, fullMark: 100 },
      { parameter: 'Discipline', score: disciplineScore, fullMark: 100 },
      { parameter: 'Output', score: outputScore, fullMark: 100 },
      { parameter: 'Initiative', score: initiativeScore, fullMark: 100 },
    ];

    const radarAverage = Math.round(radarData.reduce((acc, curr) => acc + curr.score, 0) / radarData.length);

    // Promotion Recommendation Assessment
    let promotionRecommendation = '';
    let promotionBadge = '';
    let promotionColor = '';
    if (collatedAllTimeAverage === 0 && staffRecords.length === 0) {
      promotionRecommendation = 'No KPI evaluation records or duty assessments logged yet. Complete duty ratings in the Performance tab to evaluate promotion eligibility.';
      promotionBadge = 'Pending Assessment';
      promotionColor = 'bg-slate-500/20 text-slate-400 border-slate-500/40';
    } else if (collatedAllTimeAverage >= 85) {
      promotionRecommendation = 'Outstanding all-time record. Highly recommended for grade promotion and senior title advancement.';
      promotionBadge = 'Tier 1 - Highly Recommended';
      promotionColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    } else if (collatedAllTimeAverage >= 70) {
      promotionRecommendation = 'Consistent performer exceeding baseline standards. Eligible for annual promotion review and appraisal.';
      promotionBadge = 'Tier 2 - Eligible for Review';
      promotionColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    } else if (collatedAllTimeAverage >= 55) {
      promotionRecommendation = 'Baseline competence demonstrated. Recommend consolidating current grade duties before advancement.';
      promotionBadge = 'Tier 3 - Developing in Grade';
      promotionColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    } else if (collatedAllTimeAverage > 0) {
      promotionRecommendation = 'Performance below promotion baseline. Requires KPI remedial plan and closer supervisory monitoring.';
      promotionBadge = 'Tier 4 - Review Deferred';
      promotionColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    } else {
      promotionRecommendation = 'Attendance records active, but duty KPI evaluations have not yet been logged in Performance tab.';
      promotionBadge = 'KPI Evaluation Pending';
      promotionColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
    }

    const promotionStatus = {
      recommendation: promotionRecommendation,
      badgeText: promotionBadge,
      badgeColor: promotionColor,
      allTimeScore: collatedAllTimeAverage,
    };

    return {
      dailyData: chartData,
      chartData,
      frequency,
      frequencyTitle,
      periodSummaryLabel,
      frequencyCaption,
      summaryScore,
      averageMonthlyScore: summaryScore,
      dailyAveragesByDate,
      totalRatedDays: ratedDailyAvgs.length,
      collatedAllTimeAverage,
      promotionStatus,
      radarData,
      radarAverage,
      pieData: [
        { name: 'Achieved KPI', value: summaryScore, fill: '#0d9488' },
        { name: 'Variance', value: Math.max(0, 100 - summaryScore), fill: '#334155' },
      ],
    };
  };
  const [isExitedUploadOpen, setIsExitedUploadOpen] = useState(false);
  const [exitedCsvInput, setExitedCsvInput] = useState('');

  // Departure Types for exited employees
  const DEPARTURE_TYPES = [
    'Voluntary Resignation',
    'Contract Termination',
    'Contract Expiration / End of Term',
    'Retirement',
    'Mutual Separation Agreement',
    'Redundancy / Layoff',
    'Disciplinary Dismissal',
    'Job Abandonment / Abscondment',
    'Medical Invalidation / Health Discharge',
    'Probation Non-Confirmation',
    'Other Departure Reason',
  ];

  // Mark Exit modal state
  const [exitModalStaff, setExitModalStaff] = useState<StaffMember | null>(null);
  const [exitDate, setExitDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [exitDepartureType, setExitDepartureType] = useState<string>('Voluntary Resignation');
  const [exitReason, setExitReason] = useState<string>('');
  const [exitDocuments, setExitDocuments] = useState<
    { name: string; size?: number; type?: string; data: string; uploadDate: string }[]
  >([]);
  const [isUploadingExitDoc, setIsUploadingExitDoc] = useState(false);
  const exitDocInputRef = useRef<HTMLInputElement>(null);

  const openMarkExitedModal = (staff: StaffMember) => {
    setExitModalStaff(staff);
    setExitDate(new Date().toISOString().split('T')[0]);
    setExitDepartureType(staff.exitDepartureType || 'Voluntary Resignation');
    setExitReason(staff.exitReason || '');
    setExitDocuments(staff.exitDocuments ? [...staff.exitDocuments] : []);
  };

  const handleExitDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingExitDoc(true);

    const fileList = Array.from(files) as File[];
    let processed = 0;
    const newDocs: { name: string; size?: number; type?: string; data: string; uploadDate: string }[] = [];

    fileList.forEach((file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        emitGlobalToast(`File "${file.name}" exceeds the 10MB limit.`, 'warning');
        processed++;
        if (processed === fileList.length) setIsUploadingExitDoc(false);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        newDocs.push({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          data: base64,
          uploadDate: new Date().toISOString().split('T')[0],
        });
        processed++;
        if (processed === fileList.length) {
          setExitDocuments((prev) => [...prev, ...newDocs]);
          setIsUploadingExitDoc(false);
        }
      };
      reader.onerror = () => {
        processed++;
        if (processed === fileList.length) setIsUploadingExitDoc(false);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveExitDoc = (index: number) => {
    setExitDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  // Form State for Add / Edit
  const [formData, setFormData] = useState<Partial<StaffMember>>({
    name: '',
    employeeId: '',
    department: 'Engineering',
    role: '',
    email: '',
    phone: '',
    payGrade: 'Grade L3',
    estimatedMonthlySalary: 3500,
    shiftSchedule: 'Morning',
    status: 'Active',
    employeeCategory: 'Full-time',
  });

  // Sync last attendance upload with staff list smartly
  const handleSyncLastAttendanceUpload = (skipConfirm = false) => {
    if (!projects || projects.length === 0) {
      if (!skipConfirm) {
        emitGlobalToast('No uploaded attendance worksheets found. Please upload an attendance file first!', 'info');
      }
      return;
    }

    const { updatedStaffList, updatedProjects } = syncStaffAndProjects(staffList, projects);

    onUpdateStaffList(updatedStaffList);
    if (onUpdateProjects) {
      onUpdateProjects(updatedProjects);
    }

    if (!skipConfirm) {
      emitGlobalToast('Sync Complete! Master staff directory and attendance worksheets are now fully synchronized.', 'success');
    }
  };

  // Auto-Sync Toggle Handler
  const handleToggleAutoSync = () => {
    if (!settings || !onUpdateSettings) return;
    const nextState = !settings.autoSyncStaffFromAttendance;

    onUpdateSettings({
      ...settings,
      autoSyncStaffFromAttendance: nextState,
    });

    if (nextState) {
      handleSyncLastAttendanceUpload(true);
    }
  };

  // Process Exited Staff CSV / Text Upload
  const handleProcessExitedUpload = (pastedText: string) => {
    const lines = pastedText.split('\n').map((l) => l.trim()).filter((l) => l !== '');
    if (lines.length === 0) return;

    const newExited: StaffMember[] = [];
    const startIdx =
      lines[0].toLowerCase().includes('name') ||
      lines[0].toLowerCase().includes('id') ||
      lines[0].toLowerCase().includes('employee')
        ? 1
        : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(/,|\t/).map((p) => p.trim());
      if (parts.length >= 1 && parts[0]) {
        const name = parts[0];
        const empId = parts[1] || `EXT-${Date.now().toString().slice(-4)}-${i}`;
        const dept = parts[2] || 'Operations';
        const exitD = parts[3] || new Date().toISOString().split('T')[0];
        const reason = parts[4] || 'Resignation / Contract Terminated';

        newExited.push({
          id: `exited-upload-${Date.now()}-${i}`,
          employeeId: formatStaffId(empId),
          name,
          department: dept,
          role: 'Exited Personnel',
          email: `${empId.toLowerCase().replace(/[^a-z0-9]/g, '')}@company.com`,
          payGrade: 'Grade L1',
          estimatedMonthlySalary: 0,
          shiftSchedule: 'Off',
          status: 'Exited',
          exitDate: exitD,
          exitReason: reason,
        });
      }
    }

    if (newExited.length > 0) {
      onUpdateStaffList([...staffList, ...newExited]);
      emitGlobalToast(`Successfully imported ${newExited.length} exited staff records!`, 'success');
      setExitedCsvInput('');
      setIsExitedUploadOpen(false);
    } else {
      emitGlobalToast('Could not parse any valid exited staff records from the input provided.', 'error');
    }
  };

  const handleConfirmMarkExited = () => {
    if (!exitModalStaff) return;
    const finalDate = exitDate || new Date().toISOString().split('T')[0];
    const finalDepartureType = exitDepartureType || 'Voluntary Resignation';
    const finalReason = exitReason.trim() || finalDepartureType;

    onUpdateStaffList(
      staffList.map((s) =>
        s.id === exitModalStaff.id
          ? {
              ...s,
              status: 'Exited',
              exitDate: finalDate,
              exitDepartureType: finalDepartureType,
              exitReason: finalReason,
              exitDocuments: exitDocuments.length > 0 ? exitDocuments : s.exitDocuments,
            }
          : s
      )
    );
    setExitModalStaff(null);
  };

  const handleReinstateStaff = (staff: StaffMember) => {
    onUpdateStaffList(
      staffList.map((s) =>
        s.id === staff.id
          ? { ...s, status: 'Active', exitDate: undefined, exitReason: undefined }
          : s
      )
    );
  };

  // Reconcile staff suspension dates and leaves automatically on mount/date change
  useEffect(() => {
    if (!staffList || staffList.length === 0 || !onUpdateStaffList) return;
    const { updatedStaff, hasStaffChanged } = reconcileStaffAndLeaves(staffList, leaves);
    if (hasStaffChanged) {
      onUpdateStaffList(updatedStaff);
    }
  }, [leaves]);

  const handleSuspendStaff = (
    staff: StaffMember,
    startDateOrEndTime?: string,
    reasonOrEndDate?: string,
    reason?: string,
    penaltyRuleIdOrObj?: string | ManualDeductionRule | null,
    overrideDeductionActive?: boolean
  ) => {
    let sDate = '';
    let eDate = '';
    let rsn = '';

    if (reason !== undefined) {
      // Called with (staff, startDate, endDate, reason)
      sDate = startDateOrEndTime || new Date().toISOString().split('T')[0];
      eDate = reasonOrEndDate || '';
      rsn = reason || '';
    } else {
      // Called with (staff, endTimeOrRange, reason)
      const inputStr = startDateOrEndTime || '';
      rsn = reasonOrEndDate || '';
      if (inputStr.includes(' to ')) {
        const parts = inputStr.split(' to ');
        sDate = parts[0]?.trim() || new Date().toISOString().split('T')[0];
        eDate = parts[1]?.trim() || '';
      } else {
        sDate = new Date().toISOString().split('T')[0];
        eDate = inputStr.split('T')[0] || inputStr;
      }
    }

    const todayStr = getTodayDateString();
    const formattedEndTime = sDate && eDate ? `${sDate} to ${eDate}` : eDate || sDate || undefined;
    
    // Status is 'Suspended' if today falls within suspension timeframe
    const isSuspendedToday = isStaffSuspendedOnDate({
      status: 'Suspended',
      suspensionStartDate: sDate,
      suspensionEndDate: eDate,
    } as any, todayStr);

    const calculatedStatus = isSuspendedToday ? 'Suspended' : 'Active';
    const suspensionDays = calculateSuspensionDays(sDate, eDate);

    // Determine whether to apply the automatic suspension deduction
    const shouldApplyAutoDeduction =
      overrideDeductionActive !== undefined ? overrideDeductionActive : suspendDeductionOverride;

    const autoBreakdown = calculateSuspensionDeduction(
      staff.estimatedMonthlySalary || 0,
      suspensionDays,
      {
        isEnabled: shouldApplyAutoDeduction,
        calculationType: defaultSuspensionConfig.calculationType,
        rigidDailyAmount: defaultSuspensionConfig.rigidDailyAmount,
        daysBasis: 31,
      },
      currencySymbol
    );

    // 1. Determine penalty rule from payroll manual deductions catalog if selected
    let ruleToApply: ManualDeductionRule | null = null;
    if (penaltyRuleIdOrObj) {
      if (typeof penaltyRuleIdOrObj === 'object') {
        ruleToApply = penaltyRuleIdOrObj;
      } else if (penaltyRuleIdOrObj !== 'none') {
        ruleToApply = (payrollConfig.manualDeductionRules || []).find((r) => r.id === penaltyRuleIdOrObj) || null;
      }
    } else if (suspendPenaltyRuleId && suspendPenaltyRuleId !== 'none') {
      ruleToApply = (payrollConfig.manualDeductionRules || []).find((r) => r.id === suspendPenaltyRuleId) || null;
    }

    const newBookedPenalties: BookedPenalty[] = [];
    let totalDeductionLogged = 0;
    let primaryDeductionPolicy = 'Pardoned (No Automatic Deduction / Fine)';

    // 2. Book Automatic Suspension Deduction if active
    if (shouldApplyAutoDeduction) {
      const autoAmount = autoBreakdown.totalAmount;
      totalDeductionLogged += autoAmount;
      primaryDeductionPolicy =
        defaultSuspensionConfig.calculationType === 'daily_pay'
          ? `Daily Pay (Base/31: ${currencySymbol}${autoBreakdown.dailyRate.toLocaleString()}/day × ${suspensionDays}d) = ${currencySymbol}${autoAmount.toLocaleString()}`
          : `Rigid Rate (${currencySymbol}${defaultSuspensionConfig.rigidDailyAmount.toLocaleString()}/day × ${suspensionDays}d) = ${currencySymbol}${autoAmount.toLocaleString()}`;

      const autoPenalty: BookedPenalty = {
        id: `pen-auto-susp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        staffId: staff.id,
        employeeId: staff.employeeId || '',
        staffName: staff.name,
        department: staff.department || 'General',
        ruleName: `Suspension Deduction (${defaultSuspensionConfig.calculationType === 'daily_pay' ? 'Daily Pay Salary/31' : 'Rigid Daily Rate'})`,
        reason: `Default suspension deduction for ${suspensionDays} day(s) (${sDate} to ${eDate || 'Indefinite'})${rsn ? ` - ${rsn}` : ''}`,
        type: 'fixed',
        value: autoAmount,
        calculatedAmount: autoAmount,
        status: 'Active',
        incidentDate: sDate || todayStr,
        bookedAt: new Date().toISOString(),
      };
      newBookedPenalties.push(autoPenalty);
    }

    // 3. Book Extra Disciplinary Fine from catalog if selected
    if (ruleToApply) {
      const baseSalary = staff.estimatedMonthlySalary || 0;
      const calculatedAmount =
        ruleToApply.type === 'percentage'
          ? (baseSalary * ruleToApply.defaultValue) / 100
          : ruleToApply.defaultValue;

      totalDeductionLogged += calculatedAmount;

      const finePenalty: BookedPenalty = {
        id: `pen-susp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        staffId: staff.id,
        employeeId: staff.employeeId || '',
        staffName: staff.name,
        department: staff.department || 'General',
        ruleId: ruleToApply.id,
        ruleName: ruleToApply.name,
        reason: `Disciplinary Suspension Penalty: ${ruleToApply.name}${rsn ? ` (${rsn})` : ''}`,
        type: ruleToApply.type,
        value: ruleToApply.defaultValue,
        calculatedAmount,
        status: 'Active',
        incidentDate: sDate || todayStr,
        bookedAt: new Date().toISOString(),
      };
      newBookedPenalties.push(finePenalty);

      if (shouldApplyAutoDeduction) {
        primaryDeductionPolicy += ` + Fine: ${ruleToApply.name} (${currencySymbol}${calculatedAmount.toLocaleString()})`;
      } else {
        primaryDeductionPolicy = `Catalog Fine: ${ruleToApply.name} (${currencySymbol}${calculatedAmount.toLocaleString()})`;
      }
    }

    // Save booked penalties into payroll configuration
    if (newBookedPenalties.length > 0) {
      try {
        const existingPenalties = payrollConfig.bookedPenalties || [];
        const updatedConfig: PayrollConfig = {
          ...payrollConfig,
          bookedPenalties: [...newBookedPenalties, ...existingPenalties],
        };
        saveCompanyPayrollConfig(updatedConfig, companyName);
      } catch (err) {
        console.error('Failed to book suspension penalty in payroll:', err);
      }
    }

    // 4. Log structured suspension history
    logStaffSuspensionHistory(
      staff,
      {
        type: staff.status === 'Suspended' ? 'updated' : 'created',
        startDate: sDate,
        endDate: eDate,
        reason: rsn,
        deductionPolicy: primaryDeductionPolicy,
        deductionAmount: totalDeductionLogged,
        dailyRate: shouldApplyAutoDeduction ? autoBreakdown.dailyRate : 0,
        calculationType: shouldApplyAutoDeduction ? defaultSuspensionConfig.calculationType : ruleToApply ? 'catalog' : 'none',
        durationDays: suspensionDays,
        penaltyRuleName: ruleToApply ? ruleToApply.name : shouldApplyAutoDeduction ? 'Automatic Daily Suspension Deduction' : 'None',
        authorizedBy: currentUserName,
      },
      companyName
    );

    onUpdateStaffList(
      staffList.map((s) =>
        s.id === staff.id
          ? {
              ...s,
              status: calculatedStatus,
              suspensionStartDate: sDate || undefined,
              suspensionEndDate: eDate || undefined,
              suspensionEndTime: formattedEndTime,
              suspensionReason: rsn || undefined,
              suspensionDeductedDays: 0,
              suspensionTotalDays: suspensionDays,
            }
          : s
      )
    );
    const deductionSuffix = totalDeductionLogged > 0 ? ` with ${currencySymbol}${totalDeductionLogged.toLocaleString()} total deduction` : '';
    const suspendMsg = `"${staff.name}" suspension registered (${sDate} to ${eDate || 'Indefinite'})${deductionSuffix}.`;
    setSuspendNotification(suspendMsg);
    emitGlobalToast(suspendMsg, 'info');
    setTimeout(() => setSuspendNotification(null), 4000);
    setSuspendSearchInput('');
    setSuspendEndTime('');
    setSuspendReason('');
    setSuspendPenaltyRuleId('none');
    setPendingSuspendStaffId(null);
  };

  const handleOpenEditSuspension = (staff: StaffMember) => {
    setEditingSuspensionStaff(staff);
  };

  const handleSaveSuspension = (
    staffId: string,
    startDate: string,
    endDate: string,
    reason: string,
    appliedPenaltyRule?: any
  ) => {
    const todayStr = getTodayDateString();
    const formattedEndTime = startDate && endDate
      ? `${startDate} to ${endDate}`
      : endDate || startDate || undefined;

    const target = staffList.find((s) => s.id === staffId);

    // Status is 'Suspended' if today is within active range; if timeframe has ended or is upcoming, status is Active
    const isSuspendedToday = isStaffSuspendedOnDate({
      status: 'Suspended',
      suspensionStartDate: startDate,
      suspensionEndDate: endDate,
    } as any, todayStr);

    const targetStatus = isSuspendedToday ? 'Suspended' : 'Active';

    onUpdateStaffList(
      staffList.map((s) =>
        s.id === staffId
          ? {
              ...s,
              status: targetStatus,
              suspensionStartDate: startDate || undefined,
              suspensionEndDate: endDate || undefined,
              suspensionEndTime: formattedEndTime,
              suspensionReason: reason || undefined,
            }
          : s
      )
    );

    // If staff log modal is open for this staff member, update it too
    if (staffLogUser && staffLogUser.id === staffId) {
      setStaffLogUser({
        ...staffLogUser,
        status: targetStatus,
        suspensionStartDate: startDate || undefined,
        suspensionEndDate: endDate || undefined,
        suspensionEndTime: formattedEndTime,
        suspensionReason: reason || undefined,
      });
    }

    const penaltyNotice = appliedPenaltyRule ? ` with penalty fine (${appliedPenaltyRule.name})` : '';
    const msg = `Suspension logged for "${target?.name || 'staff member'}" (${startDate || todayStr} to ${endDate || 'Indefinite'})${penaltyNotice}.`;
    setSuspendNotification(msg);
    emitGlobalToast(msg, 'info');
    setTimeout(() => setSuspendNotification(null), 4000);
    setEditingSuspensionStaff(null);
  };

  const handleUnsuspendStaff = (staff: StaffMember) => {
    logStaffSuspensionHistory(
      staff,
      {
        type: 'restored',
        authorizedBy: currentUserName || 'HR Management',
      },
      companyName
    );

    onUpdateStaffList(
      staffList.map((s) =>
        s.id === staff.id
          ? {
              ...s,
              status: 'Active',
              suspensionStartDate: undefined,
              suspensionEndDate: undefined,
              suspensionEndTime: undefined,
              suspensionReason: undefined,
            }
          : s
      )
    );
    if (staffLogUser && staffLogUser.id === staff.id) {
      setStaffLogUser({
        ...staffLogUser,
        status: 'Active',
        suspensionStartDate: undefined,
        suspensionEndDate: undefined,
        suspensionEndTime: undefined,
        suspensionReason: undefined,
      });
    }
    const restoreMsg = `"${staff.name}" has been unsuspended and restored to Active status.`;
    setSuspendNotification(restoreMsg);
    emitGlobalToast(restoreMsg, 'success');
    setTimeout(() => setSuspendNotification(null), 4000);
  };

  const handleDeleteStaff = (id: string) => {
    const target = staffList.find((s) => s.id === id || s.employeeId === id);
    onUpdateStaffList(staffList.filter((s) => s.id !== id && s.employeeId !== id));
    emitGlobalToast(`Staff member "${target?.name || 'Employee'}" removed from directory`, 'warning');
  };

  const handleUpdateStartDate = (staffId: string, newDate: string) => {
    const targetStaff = staffList.find((s) => s.id === staffId || s.employeeId === staffId);
    const oldDate = targetStaff?.joinDate || 'Not specified';
    const updated = staffList.map((s) => (s.id === staffId ? { ...s, joinDate: newDate } : s));
    onUpdateStaffList(updated);
    emitGlobalToast(`Start date updated to ${newDate} for ${targetStaff?.name || 'staff member'}`, 'success');
    if (staffLogUser && staffLogUser.id === staffId) {
      setStaffLogUser({ ...staffLogUser, joinDate: newDate });
    }

    // Persist audit record in STAFF_HISTORY under Onboarding & Audit
    try {
      const storedLogs = loadCompanyData<Record<string, any[]>>(STORAGE_KEYS.STAFF_HISTORY, companyName, {});
      const staffKey = targetStaff?.employeeId || staffId;
      const currentList = storedLogs[staffKey] || [];
      const auditEntry = {
        id: `audit-date-${Date.now()}`,
        category: 'Onboarding & Audit',
        title: `Start Date Adjusted to ${newDate}`,
        date: new Date().toISOString().split('T')[0],
        notes: `Staff start/join date was updated from ${oldDate} to ${newDate} by ${user?.name || 'HR Admin'}.`,
        authorizedBy: user?.name || 'HR Admin',
      };
      const newLogs = {
        ...storedLogs,
        [staffKey]: [auditEntry, ...currentList],
      };
      saveCompanyData(STORAGE_KEYS.STAFF_HISTORY, newLogs, companyName);
      setKpiRefreshTrigger((prev) => prev + 1);
    } catch (e) {
      console.error('Failed to log start date change audit trail:', e);
    }
  };

  // Extract unique departments from staffList and stored database departments
  const dbDepartmentsData = React.useMemo(() => {
    return getCleanDepartments(companyName);
  }, [companyName]);

  const dbDepartments = React.useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => {
      if (s.department && s.department.trim()) {
        set.add(s.department.trim());
      }
    });
    if (Array.isArray(dbDepartmentsData)) {
      dbDepartmentsData.forEach((d: any) => {
        if (d?.name && typeof d.name === 'string' && d.name.trim()) {
          set.add(d.name.trim());
        }
      });
    }
    return Array.from(set).sort();
  }, [staffList, dbDepartmentsData]);

  // Combined department options for filtering
  const departments = ['All', ...dbDepartments];

  // Filtering based on rosterTab
  const baseStaffList = staffList.filter((s) => {
    if (rosterTab === 'active') return s.status !== 'Suspended' && s.status !== 'Exited';
    if (rosterTab === 'suspended') return s.status === 'Suspended';
    if (rosterTab === 'exited') return s.status === 'Exited';
    return true;
  });

  // Non-suspended active staff list for the Suspend Staff search tool
  const activeNonSuspendedStaff = staffList.filter((s) => {
    if (s.status === 'Exited' || s.status === 'Suspended') return false;
    if (!suspendSearchInput.trim()) return false;
    const term = suspendSearchInput.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(term) ||
      s.employeeId.toLowerCase().includes(term) ||
      s.department.toLowerCase().includes(term) ||
      s.role.toLowerCase().includes(term)
    );
  });

  // Filtering
  const filteredStaff = baseStaffList.filter((s) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      s.name.toLowerCase().includes(term) ||
      s.employeeId.toLowerCase().includes(term) ||
      s.department.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      s.role.toLowerCase().includes(term);
    const matchesDept = selectedDept === 'All' || (s.department || '').trim() === selectedDept.trim();
    
    // Status filter (up to 2 selected)
    const matchesStatus = filterStatuses.length === 0 || filterStatuses.includes(s.status);

    // KPI Performance filter (up to 2 selected)
    let matchesKpi = true;
    if (filterKpis.length > 0) {
      const score = s.kpiScore !== undefined ? s.kpiScore : (getStaffKpiData(s, undefined, kpiFrequency)?.summaryScore || 0);
      matchesKpi = filterKpis.some((kpiCat) => {
        if (kpiCat === 'high') return score >= 80;
        if (kpiCat === 'good') return score >= 60 && score < 80;
        if (kpiCat === 'average') return score >= 40 && score < 60;
        if (kpiCat === 'critical') return score < 40;
        return true;
      });
    }

    return matchesSearch && matchesDept && matchesStatus && matchesKpi;
  });

  // Multi-level sorting logic for Directory View and CSV Exports
  const sortedStaffList = [...filteredStaff].sort((a, b) => {
    if (sortRules.length === 0) return 0;

    for (const rule of sortRules) {
      const dirMult = rule.direction === 'asc' ? 1 : -1;
      let res = 0;

      if (rule.field === 'department') {
        res = (a.department || '').trim().localeCompare((b.department || '').trim(), undefined, { sensitivity: 'base' });
      } else if (rule.field === 'name') {
        res = (a.name || '').trim().localeCompare((b.name || '').trim(), undefined, { sensitivity: 'base' });
      } else if (rule.field === 'employeeId') {
        res = (a.employeeId || '').trim().localeCompare((b.employeeId || '').trim(), undefined, { numeric: true, sensitivity: 'base' });
      } else if (rule.field === 'role') {
        res = (a.role || '').trim().localeCompare((b.role || '').trim(), undefined, { sensitivity: 'base' });
      } else if (rule.field === 'salary') {
        res = (a.estimatedMonthlySalary || 0) - (b.estimatedMonthlySalary || 0);
      } else if (rule.field === 'status') {
        res = (a.status || '').trim().localeCompare((b.status || '').trim(), undefined, { sensitivity: 'base' });
      }

      if (res !== 0) {
        return res * dirMult;
      }
    }
    return 0;
  });

  const handleAddSortRule = () => {
    if (sortRules.length >= 2) return;
    const availableFields: SortField[] = ['name', 'employeeId', 'department', 'role', 'salary', 'status'];
    const unused = availableFields.find((f) => !sortRules.some((r) => r.field === f)) || 'name';
    setSortRules((prev) => [
      ...prev,
      { id: `sort-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, field: unused, direction: 'asc' },
    ]);
  };

  const handleUpdateSortRule = (index: number, updates: Partial<SortRule>) => {
    setSortRules((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], ...updates };
      }
      return updated;
    });
  };

  const handleRemoveSortRule = (index: number) => {
    setSortRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSwapSortRules = () => {
    if (sortRules.length === 2) {
      setSortRules([sortRules[1], sortRules[0]]);
    }
  };

  const handleClearSortRules = () => {
    setSortRules([]);
  };

  // Metrics
  const totalStaff = staffList.length;
  const activeStaffCount = staffList.filter((s) => s.status === 'Active').length;
  const onQueryStaffCount = staffList.filter((s) => s.status === 'On Query' || isStaffCurrentlyOnQuery(s.id, companyName)).length;
  const probationStaffCount = staffList.filter((s) => s.status === 'Probation').length;
  const suspendedStaffCount = staffList.filter((s) => s.status === 'Suspended').length;
  const exitedStaffCount = staffList.filter((s) => s.status === 'Exited').length;
  const onLeaveStaff = staffList.filter((s) => s.status === 'On Leave').length;
  const totalMonthlyPayrollWeight = staffList
    .filter((s) => s.status !== 'Exited')
    .reduce((sum, s) => sum + (s.estimatedMonthlySalary || 0), 0);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      emitGlobalToast('Please select an image file under 5MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new (window as any).Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
          setFormData((prev) => ({ ...prev, photo: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, photo: '' }));
  };

  const handleOpenAddModal = () => {
    setEditingStaff(null);
    const defaultDept = dbDepartments[0] || 'Engineering';
    setFormData({
      employeeId: 'N/A',
      name: '',
      department: defaultDept,
      role: 'Specialist',
      email: '',
      phone: '',
      dob: '',
      homeAddress: '',
      guarantorName: '',
      guarantorPhone: '',
      guarantorRelationship: '',
      guarantorAddress: '',
      nextOfKinName: '',
      nextOfKinPhone: '',
      nextOfKinRelationship: '',
      nextOfKinAddress: '',
      payFrequency: payrollConfig.defaultPayFrequency || 'Monthly',
      payGrade: derivePayGradeFromSalary(3500, configuredPayGrades),
      estimatedMonthlySalary: 3500,
      shiftSchedule: 'Morning',
      status: 'Active',
      employeeCategory: 'Full-time',
      bankName: '',
      accountNumber: '',
      joinDate: new Date().toISOString().split('T')[0],
      photo: '',
    });
    setIsAddStaffModalOpen(true);
  };

  const handleOpenEditModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setFormData({
      ...staff,
      employeeId: staff.employeeId ? staff.employeeId : 'N/A',
      employeeCategory: staff.employeeCategory || 'Full-time',
      photo: staff.photo || staff.avatar || '',
      payFrequency: staff.payFrequency || payrollConfig.defaultPayFrequency || 'Monthly',
      payGrade: deriveStaffPayGrade(staff, configuredPayGrades),
      dob: staff.dob || '',
      homeAddress: staff.homeAddress || '',
      guarantorName: staff.guarantorName || '',
      guarantorPhone: staff.guarantorPhone || '',
      guarantorRelationship: staff.guarantorRelationship || '',
      guarantorAddress: staff.guarantorAddress || '',
      nextOfKinName: staff.nextOfKinName || '',
      nextOfKinPhone: staff.nextOfKinPhone || '',
      nextOfKinRelationship: staff.nextOfKinRelationship || '',
      nextOfKinAddress: staff.nextOfKinAddress || '',
      bankName: staff.bankName || '',
      accountNumber: staff.accountNumber || '',
      joinDate: staff.joinDate || new Date().toISOString().split('T')[0],
    });
    setIsAddStaffModalOpen(true);
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      emitGlobalToast('Please enter employee name.', 'warning');
      return;
    }

    const rawEmpId = (formData.employeeId || '').trim();
    const formattedEmpId = isNaEmployeeId(rawEmpId) ? 'N/A' : rawEmpId;

    // Validate ID uniqueness (except for N/A)
    const uniquenessCheck = isEmployeeIdUnique(formattedEmpId, staffList, editingStaff?.id);
    if (!uniquenessCheck.isUnique) {
      const conflict = uniquenessCheck.conflictingStaff;
      emitGlobalToast(
        `Employee ID "${formattedEmpId}" already belongs to ${conflict?.name || 'another staff member'}. Two staff cannot share the same ID (except for N/A).`,
        'error'
      );
      return;
    }

    if (editingStaff) {
      const updatedMember: StaffMember = {
        ...editingStaff,
        ...(formData as StaffMember),
        employeeId: formattedEmpId,
        employeeCategory: formData.employeeCategory || editingStaff.employeeCategory || 'Full-time',
        dob: formData.dob || editingStaff.dob,
        homeAddress: formData.homeAddress || editingStaff.homeAddress,
        guarantorName: formData.guarantorName || editingStaff.guarantorName,
        guarantorPhone: formData.guarantorPhone || editingStaff.guarantorPhone,
        guarantorRelationship: formData.guarantorRelationship || editingStaff.guarantorRelationship,
        guarantorAddress: formData.guarantorAddress || editingStaff.guarantorAddress,
        nextOfKinName: formData.nextOfKinName || editingStaff.nextOfKinName,
        nextOfKinPhone: formData.nextOfKinPhone || editingStaff.nextOfKinPhone,
        nextOfKinRelationship: formData.nextOfKinRelationship || editingStaff.nextOfKinRelationship,
        nextOfKinAddress: formData.nextOfKinAddress || editingStaff.nextOfKinAddress,
        joinDate: isAdmin ? (formData.joinDate || editingStaff.joinDate) : editingStaff.joinDate,
        photo: formData.photo !== undefined ? formData.photo : editingStaff.photo,
      };

      onUpdateStaffList(
        staffList.map((s) => (s.id === editingStaff.id ? updatedMember : s))
      );
      emitGlobalToast(`Staff profile for "${updatedMember.name}" updated successfully`, 'success');

      if (staffLogUser && (staffLogUser.id === editingStaff.id || staffLogUser.employeeId === editingStaff.employeeId)) {
        setStaffLogUser(updatedMember);
      }

      // If joinDate changed by admin, persist audit record
      if (isAdmin && formData.joinDate && formData.joinDate !== editingStaff.joinDate) {
        try {
          const storedLogs = loadCompanyData<Record<string, any[]>>(STORAGE_KEYS.STAFF_HISTORY, companyName, {});
          const staffKey = formattedEmpId || editingStaff.employeeId || editingStaff.id;
          const currentList = storedLogs[staffKey] || [];
          const auditEntry = {
            id: `audit-date-${Date.now()}`,
            category: 'Onboarding & Audit',
            title: `Start Date Adjusted to ${formData.joinDate}`,
            date: new Date().toISOString().split('T')[0],
            notes: `Staff start/join date was updated from ${editingStaff.joinDate || 'Not specified'} to ${formData.joinDate} by ${user?.name || 'HR Admin'}.`,
            authorizedBy: user?.name || 'HR Admin',
          };
          saveCompanyData(STORAGE_KEYS.STAFF_HISTORY, {
            ...storedLogs,
            [staffKey]: [auditEntry, ...currentList],
          }, companyName);
        } catch (err) {
          console.error('Failed to log start date change', err);
        }
      }
    } else {
      const newMember: StaffMember = {
        id: `staff-${Date.now()}`,
        employeeId: formattedEmpId,
        name: formData.name || 'Unnamed Employee',
        department: formData.department || 'General',
        role: formData.role || 'Staff Member',
        email: formData.email || '',
        phone: formData.phone || '',
        dob: formData.dob || undefined,
        homeAddress: formData.homeAddress || undefined,
        guarantorName: formData.guarantorName || undefined,
        guarantorPhone: formData.guarantorPhone || undefined,
        guarantorRelationship: formData.guarantorRelationship || undefined,
        guarantorAddress: formData.guarantorAddress || undefined,
        nextOfKinName: formData.nextOfKinName || undefined,
        nextOfKinPhone: formData.nextOfKinPhone || undefined,
        nextOfKinRelationship: formData.nextOfKinRelationship || undefined,
        nextOfKinAddress: formData.nextOfKinAddress || undefined,
        payFrequency: formData.payFrequency || payrollConfig.defaultPayFrequency || 'Monthly',
        payGrade: formData.payGrade || derivePayGradeFromSalary(Number(formData.estimatedMonthlySalary) || 3000, configuredPayGrades),
        estimatedMonthlySalary: Number(formData.estimatedMonthlySalary) || 3000,
        shiftSchedule: (formData.shiftSchedule as any) || 'Morning',
        status: (formData.status as any) || 'Active',
        employeeCategory: formData.employeeCategory || 'Full-time',
        bankName: formData.bankName || '',
        accountNumber: formData.accountNumber || '',
        joinDate: formData.joinDate || new Date().toISOString().split('T')[0],
        photo: formData.photo || undefined,
      };
      onUpdateStaffList([newMember, ...staffList]);
      emitGlobalToast(`New employee "${newMember.name}" (${newMember.employeeId}) added to directory`, 'success');
      // Transition to staff document modal with multi-tab options (JD, Confirmation Letter, Appointment Letter)
      setIsNewStaffPrompt(true);
      setDocumentModalInitialTab(null);
      setConfirmationStaff(newMember);
    }
    setIsAddStaffModalOpen(false);
  };

  const handleExportCSV = () => {
    // Determine the staff list to export based strictly on the current roster tab
    let listToExport: StaffMember[] = [];
    let tabLabel = 'active';

    if (rosterTab === 'active') {
      listToExport = staffList.filter((s) => s.status !== 'Suspended' && s.status !== 'Exited');
      tabLabel = 'active';
    } else if (rosterTab === 'suspended') {
      listToExport = staffList.filter((s) => s.status === 'Suspended');
      tabLabel = 'suspended';
    } else if (rosterTab === 'exited') {
      listToExport = staffList.filter((s) => s.status === 'Exited');
      tabLabel = 'exited';
    } else {
      listToExport = [...staffList];
      tabLabel = 'complete';
    }

    if (listToExport.length === 0) {
      // Fallback check from storage if memory state is empty
      try {
        const stored = loadCompanyData<StaffMember[]>(STORAGE_KEYS.STAFF, companyName, []);
        if (Array.isArray(stored) && stored.length > 0) {
          if (rosterTab === 'active') {
            listToExport = stored.filter((s) => s.status !== 'Suspended' && s.status !== 'Exited');
          } else if (rosterTab === 'suspended') {
            listToExport = stored.filter((s) => s.status === 'Suspended');
          } else if (rosterTab === 'exited') {
            listToExport = stored.filter((s) => s.status === 'Exited');
          }
        }
      } catch (e) {
        console.error('Failed to retrieve fallback staff for export:', e);
      }
    }

    if (listToExport.length === 0) {
      emitGlobalToast(`No ${tabLabel} staff records found to export.`, 'info');
      return;
    }

    const headers = [
      'Employee ID',
      'Full Name',
      'Department',
      'Role / Designation',
      'Email Address',
      'Phone Number',
      'Pay Grade',
      'Estimated Monthly Salary ($)',
      'Shift Schedule',
      'Bank Name',
      'Account Number',
      'Employment Status',
      'Join Date',
      'Exit Date',
      'Exit Reason',
      'Suspension End Time',
      'Suspension Reason / Reference',
    ];

    // Sort by name for clean, readable output
    const sortedExportList = [...listToExport].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = sortedExportList.map((s) => [
      escapeCsv(s.employeeId || s.id || ''),
      escapeCsv(s.name || 'Unnamed Employee'), // Name kept clean without (suspended) suffix to ensure symmetric re-import
      escapeCsv(s.department || 'N/A'),
      escapeCsv(s.role || 'Staff Member'),
      escapeCsv(s.email || ''),
      escapeCsv(s.phone || ''),
      escapeCsv(deriveStaffPayGrade(s, configuredPayGrades)),
      s.estimatedMonthlySalary !== undefined ? s.estimatedMonthlySalary : 0,
      escapeCsv(s.shiftSchedule || 'Morning'),
      escapeCsv(s.bankName || ''),
      escapeCsv(s.accountNumber || ''),
      escapeCsv(s.status || (rosterTab === 'suspended' ? 'Suspended' : rosterTab === 'exited' ? 'Exited' : 'Active')),
      escapeCsv(s.joinDate || ''),
      escapeCsv(s.exitDate || ''),
      escapeCsv(s.exitReason || ''),
      escapeCsv(s.suspensionEndTime || ''),
      escapeCsv(s.suspensionReason || ''),
    ]);

    const csvContent =
      headers.join(',') +
      '\n' +
      rows.map((r) => r.join(',')).join('\n');

    // Add UTF-8 BOM so Excel opens special characters and formatting cleanly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `skima_${tabLabel}_staff_directory_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    emitGlobalToast(`Exported ${listToExport.length} ${tabLabel} staff records to CSV`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-mono font-semibold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            Skima HR Aid Core Roster
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Full Departmental Staff Directory
          </h2>
          <p className="text-xs text-slate-400 max-w-xl">
            Upload, organize, and manage your entire company staff roster. Staff records feed directly into Skima Shift Planning, Leave Management, and Payroll Structural Insights.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10">
          {rosterTab === 'active' ? (
            <>
              <button
                onClick={() => onOpenUploadModal('active')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Active Staff List</span>
              </button>
              <button
                id="track-applicants-btn"
                onClick={() => setIsTrackApplicantsOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>Track Applicants</span>
              </button>
              {onOpenPayrollWorkspace && (
                <button
                  id="payroll-workspace-btn"
                  onClick={onOpenPayrollWorkspace}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                >
                  <BadgeDollarSign className="w-4 h-4" />
                  <span>Payroll Workspace</span>
                </button>
              )}
            </>
          ) : rosterTab === 'suspended' ? (
            <>
              <button
                onClick={() => onOpenUploadModal('suspended')}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-amber-600/30 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Suspended Staff List</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSuspensionHistoryOpen(true)}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs"
                title="View Suspended Staff History & Disciplinary Audit Trail"
              >
                <History className="w-4 h-4 text-amber-500" />
                <span>History</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onOpenUploadModal('exited')}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Exited Staff List</span>
              </button>
              <button
                onClick={() => {
                  setFormData({
                    name: '',
                    employeeId: '',
                    department: 'Operations',
                    role: 'Former Employee',
                    email: '',
                    phone: '',
                    payGrade: 'N/A',
                    estimatedMonthlySalary: 0,
                    shiftSchedule: 'Off',
                    status: 'Exited',
                    exitDate: new Date().toISOString().split('T')[0],
                    exitReason: 'Departure / Contract Ended',
                  });
                  setEditingStaff(null);
                  setIsAddStaffModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <UserX className="w-4 h-4 text-rose-400" />
                <span>Add Exited Employee</span>
              </button>
            </>
          )}

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            title={`Export ${rosterTab === 'active' ? 'Active' : rosterTab === 'suspended' ? 'Suspended' : 'Exited'} Staff as CSV`}
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>

          {/* KPI Frequency Selector - Beside Staff Welfare */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
            <BarChart3 className="w-3.5 h-3.5 text-teal-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">KPI:</span>
            <select
              value={kpiFrequency}
              onChange={(e) => {
                const val = e.target.value as KpiFrequency;
                setKpiFrequency(val);
                try {
                  saveCompanyData(STORAGE_KEYS.KPI_FREQUENCY, val, companyName);
                } catch (err) {
                  console.error(err);
                }
              }}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              title="KPI Evaluation Frequency: Daily, Monthly, Quarter-Yearly (every 3 months), or Yearly"
            >
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarter-Yearly (Every 3 Mos)</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsWelfareWorkspaceOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500/10 to-pink-500/10 hover:from-rose-500/20 hover:to-pink-500/20 text-rose-500 border border-rose-500/30 text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs"
            title="Open Staff Welfare Workspace (Birthdays, Employee of the Month, Staff Loans & Salary Advances)"
          >
            <HeartHandshake className="w-4 h-4 text-rose-500" />
            <span>Staff Welfare</span>
          </button>
        </div>
      </div>

      {/* Roster View Sub-Tabs: Active Directory vs Suspended Staff vs Exited Staff List */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setRosterTab('active')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            rosterTab === 'active'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Active Staff Directory</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/20 text-white">
            {staffList.filter((s) => s.status !== 'Exited').length}
          </span>
        </button>

        <button
          onClick={() => setRosterTab('suspended')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            rosterTab === 'suspended'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <UserMinus className="w-4 h-4" />
          <span>Suspended Staff</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              suspendedStaffCount > 0
                ? 'bg-amber-500/30 text-amber-200 font-bold'
                : 'bg-slate-700/40 text-slate-400'
            }`}
          >
            {suspendedStaffCount}
          </span>
        </button>

        <button
          onClick={() => setRosterTab('exited')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            rosterTab === 'exited'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <UserX className="w-4 h-4" />
          <span>Exited Staff List</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              exitedStaffCount > 0
                ? 'bg-rose-500/20 text-rose-300 font-bold'
                : 'bg-slate-700/40 text-slate-400'
            }`}
          >
            {exitedStaffCount}
          </span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {filteredStaff.length !== totalStaff ? (
                <span>
                  {filteredStaff.length}{' '}
                  <span className="text-xs text-slate-400 font-normal">/ {totalStaff}</span>
                </span>
              ) : (
                totalStaff
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {filteredStaff.length !== totalStaff ? 'Filtered Staff Count' : 'Total Roster Staff'}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono flex items-baseline gap-2 flex-wrap">
              <span>{activeStaffCount}</span>
              {probationStaffCount > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-sans">
                  +{probationStaffCount} on Probation
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Regular Active Staff
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {onLeaveStaff}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Staff on Leave / Off
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <BadgeDollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">
              {currencySymbol}{totalMonthlyPayrollWeight.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Est. Monthly Salary Weight
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toast for Suspend Action */}
      {suspendNotification && (
        <div className="p-3.5 rounded-xl bg-amber-600 text-white font-semibold text-xs flex items-center justify-between shadow-lg border border-amber-500 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <UserMinus className="w-4 h-4 shrink-0" />
            <span>{suspendNotification}</span>
          </div>
          <button onClick={() => setSuspendNotification(null)} className="hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Interactive Search & Suspend Panel for Suspended Tab */}
      {rosterTab === 'suspended' && (
        <div className="p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
                <UserMinus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                  Suspend a Staff Member
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Type staff name or ID below, then click "Suspend Staff" to add them to the suspended roster and display the (suspended) tag.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-amber-800 dark:text-amber-300 font-bold bg-amber-100 dark:bg-amber-900/60 px-3 py-1 rounded-xl border border-amber-300 dark:border-amber-800 self-start sm:self-auto">
              {suspendedStaffCount} Currently Suspended
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-600 dark:text-amber-400" />
            <input
              type="text"
              placeholder="Search active staff to suspend (type name, ID, or department)..."
              value={suspendSearchInput}
              onChange={(e) => setSuspendSearchInput(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {suspendSearchInput && (
              <button
                onClick={() => setSuspendSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {suspendSearchInput.trim() !== '' && (
            <div className="max-h-96 overflow-y-auto bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-1 shadow-lg">
              {activeNonSuspendedStaff.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500">
                  No active (non-suspended) staff member found matching "{suspendSearchInput}"
                </div>
              ) : (
                activeNonSuspendedStaff.map((staff) => {
                  const isPending = pendingSuspendStaffId === staff.id;
                  const todayStr = new Date().toISOString().split('T')[0];

                  return (
                    <div
                      key={staff.id}
                      className="p-2.5 rounded-xl hover:bg-amber-50/40 dark:hover:bg-slate-800/80 text-xs transition space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold font-mono text-[11px] flex items-center justify-center shrink-0">
                            {staff.name.charAt(0)}
                          </div>
                          <div className="truncate">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{staff.name}</span>
                              <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                                ({staff.employeeId})
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {staff.department} • {staff.role}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (isPending) {
                              setPendingSuspendStaffId(null);
                            } else {
                              setPendingSuspendStaffId(staff.id);
                              setSuspendStartDate(todayStr);
                              const defaultEnd = new Date();
                              defaultEnd.setDate(defaultEnd.getDate() + 7);
                              setSuspendEndDate(defaultEnd.toISOString().split('T')[0]);
                              setSuspendReason('');
                              setSuspendPenaltyRuleId('none');
                              setSuspendDeductionOverride(isSuspensionDeductionGloballyEnabled);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-white font-bold text-[11px] flex items-center gap-1.5 shrink-0 shadow-sm transition cursor-pointer ${
                            isPending
                              ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                              : 'bg-amber-600 hover:bg-amber-500'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{isPending ? 'Close Calendar' : 'Set Suspension'}</span>
                        </button>
                      </div>

                      {/* Dropdown Calendar / Date Range Period Selector */}
                      {isPending && (() => {
                        const quickSuspensionDays = calculateSuspensionDays(suspendStartDate || todayStr, suspendEndDate);
                        const quickAutoBreakdown = calculateSuspensionDeduction(
                          staff.estimatedMonthlySalary || 0,
                          quickSuspensionDays,
                          {
                            isEnabled: suspendDeductionOverride,
                            calculationType: defaultSuspensionConfig.calculationType,
                            rigidDailyAmount: defaultSuspensionConfig.rigidDailyAmount,
                          },
                          currencySymbol,
                          suspendStartDate || todayStr
                        );
                        const quickSelectedRule = (manualDeductionsCatalog || []).find((r) => r.id === suspendPenaltyRuleId) || null;
                        const quickFineAmount = quickSelectedRule
                          ? quickSelectedRule.type === 'percentage'
                            ? ((staff.estimatedMonthlySalary || 0) * quickSelectedRule.defaultValue) / 100
                            : quickSelectedRule.defaultValue
                          : 0;
                        const quickTotalDeduction = (suspendDeductionOverride ? quickAutoBreakdown.totalAmount : 0) + quickFineAmount;

                        return (
                          <div className="mt-2 p-3.5 rounded-xl bg-amber-50 dark:bg-slate-950 border border-amber-300 dark:border-amber-700/80 shadow-md space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-amber-200 dark:border-amber-900/60">
                              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                Specify Suspension Period for {staff.name}
                              </span>
                              <span className="text-[10px] font-mono bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded font-bold">
                                From Today ({todayStr})
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                                  Effective Start Date (From)
                                </label>
                                <div className="relative">
                                  <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input
                                    type="date"
                                    value={suspendStartDate || todayStr}
                                    onChange={(e) => setSuspendStartDate(e.target.value)}
                                    className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300 mb-1">
                                  Suspension End Date (To) *
                                </label>
                                <div className="relative">
                                  <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-600 dark:text-amber-400" />
                                  <input
                                    type="date"
                                    value={suspendEndDate}
                                    min={suspendStartDate || todayStr}
                                    onChange={(e) => setSuspendEndDate(e.target.value)}
                                    className="w-full pl-8 pr-2 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-amber-400 dark:border-amber-600 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Deduction Summary & Per-Suspension Policy Override */}
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                    <Calculator className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-[11px] text-slate-900 dark:text-white">
                                        Suspension Deduction Summary
                                      </span>
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-800">
                                        Default Deductions Rule
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                                      Global Policy: {isSuspensionDeductionGloballyEnabled ? (defaultSuspensionConfig.calculationType === 'daily_pay' ? `Daily Pay Rate (Salary / ${quickAutoBreakdown.daysBasis}d in ${quickAutoBreakdown.monthName})` : `Rigid Rate (${currencySymbol}${defaultSuspensionConfig.rigidDailyAmount}/day)`) : 'Globally Disabled'}
                                    </span>
                                  </div>
                                </div>

                                {/* Per-incident override toggle button */}
                                <button
                                  type="button"
                                  onClick={() => setSuspendDeductionOverride(!suspendDeductionOverride)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto ${
                                    suspendDeductionOverride
                                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs shadow-emerald-600/30'
                                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                  }`}
                                  title={
                                    isSuspensionDeductionGloballyEnabled
                                      ? suspendDeductionOverride
                                        ? 'Click to pardon / disable deduction for this specific suspension'
                                        : 'Click to re-enable deduction for this suspension'
                                      : suspendDeductionOverride
                                      ? 'Deduction enabled for this specific suspension'
                                      : 'Click to enforce deduction for this suspension'
                                  }
                                >
                                  {suspendDeductionOverride ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>DEDUCTION ACTIVE</span>
                                    </>
                                  ) : (
                                    <>
                                      <X className="w-3 h-3" />
                                      <span>PARDONED (NO DEDUCTION)</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Live Calculation Line Items & Total */}
                              <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-amber-500/25 space-y-1.5">
                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                  <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                                      Standard Daily Rate
                                    </span>
                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                      {currencySymbol}{quickAutoBreakdown.dailyRate.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                      <span className="text-[9px] font-normal text-slate-500 ml-1">
                                        ({defaultSuspensionConfig.calculationType === 'daily_pay' ? `Salary/${quickAutoBreakdown.daysBasis}d` : 'Rigid Rate'})
                                      </span>
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                                      Duration Applied
                                    </span>
                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                      {quickSuspensionDays} calendar day{quickSuspensionDays > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </div>

                                <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-800 text-[11px] space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">
                                      Automatic Suspension Rate:
                                    </span>
                                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                      {suspendDeductionOverride ? (
                                        `-${currencySymbol}${quickAutoBreakdown.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                                      ) : (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">$0.00 (Pardoned)</span>
                                      )}
                                    </span>
                                  </div>

                                  {quickSelectedRule && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-600 dark:text-slate-400">
                                        Disciplinary Fine ({quickSelectedRule.name}):
                                      </span>
                                      <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                                        -{currencySymbol}{quickFineAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="pt-1.5 border-t border-amber-500/30 flex items-center justify-between">
                                  <span className="font-bold text-[11px] text-slate-900 dark:text-white">
                                    Total Suspension Deduction:
                                  </span>
                                  <span className="text-sm font-mono font-black text-rose-600 dark:text-rose-400">
                                    {quickTotalDeduction > 0 ? `-${currencySymbol}${quickTotalDeduction.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : `${currencySymbol}0.00`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Reason & Penalty Deduction (Side-by-Side) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                  Reason / Reference Memo (Optional)
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g., Pending disciplinary inquiry, policy breach..."
                                  value={suspendReason}
                                  onChange={(e) => setSuspendReason(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                                  <span className="flex items-center gap-1">
                                    <Zap className="w-3 h-3 text-amber-500" />
                                    Impose Extra Fine (Catalog)
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono">Manual Deductions</span>
                                </label>
                                <select
                                  value={suspendPenaltyRuleId}
                                  onChange={(e) => setSuspendPenaltyRuleId(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                                >
                                  <option value="none">None (No Extra Fine)</option>
                                  {manualDeductionsCatalog.map((rule) => (
                                    <option key={rule.id} value={rule.id}>
                                      {rule.name} — {rule.type === 'percentage' ? `${rule.defaultValue}% Base` : `${currencySymbol}${rule.defaultValue.toLocaleString()}`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 gap-2">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                                Suspension from <strong className="text-slate-700 dark:text-slate-300">{suspendStartDate || todayStr}</strong> to <strong className="text-amber-700 dark:text-amber-300">{suspendEndDate || 'Indefinite'}</strong>
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPendingSuspendStaffId(null)}
                                  className="px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 text-[11px] font-semibold cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const formattedEndTime = `${suspendStartDate || todayStr} to ${suspendEndDate}`;
                                    handleSuspendStaff(
                                      staff,
                                      formattedEndTime,
                                      suspendReason || 'Administrative Suspension',
                                      undefined,
                                      suspendPenaltyRuleId,
                                      suspendDeductionOverride
                                    );
                                    setPendingSuspendStaffId(null);
                                  }}
                                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-md shadow-amber-600/30 transition cursor-pointer"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                  <span>Confirm Suspension</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Employee ID, Name, Role, or Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Dept:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Combined Status & KPI Filters Dropdown (Max 2 selections per category) */}
          <div className="relative" ref={filterContainerRef}>
            <button
              type="button"
              onClick={() => setIsFiltersDropdownOpen(!isFiltersDropdownOpen)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                filterStatuses.length > 0 || filterKpis.length > 0
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
              }`}
              title="Combined Status & KPI Filters (Max 2 selections per category)"
            >
              <Filter className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Filters</span>
              {(filterStatuses.length > 0 || filterKpis.length > 0) && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-mono font-bold shrink-0">
                  {filterStatuses.length + filterKpis.length}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isFiltersDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFiltersDropdownOpen && (
              <div className="absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-blue-500" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Multi-Filters</h4>
                  </div>
                  {(filterStatuses.length > 0 || filterKpis.length > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterStatuses([]);
                        setFilterKpis([]);
                      }}
                      className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Category 1: Status (Max 2) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Staff Status</span>
                    <span className="text-[10px] font-mono text-slate-400 font-semibold">
                      {filterStatuses.length}/2 selected
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Active', val: 'Active' },
                      { label: 'Probation', val: 'Probation' },
                      { label: 'On Leave', val: 'On Leave' },
                      { label: 'Off Duty', val: 'Off Duty' },
                      { label: 'Suspended', val: 'Suspended' },
                      ...(rosterTab === 'exited' ? [{ label: 'Exited', val: 'Exited' }] : []),
                    ].map((item) => {
                      const isChecked = filterStatuses.includes(item.val);
                      const isDisabled = !isChecked && filterStatuses.length >= 2;
                      return (
                        <button
                          type="button"
                          key={item.val}
                          disabled={isDisabled}
                          onClick={() => {
                            if (isChecked) {
                              setFilterStatuses(filterStatuses.filter((s) => s !== item.val));
                            } else if (filterStatuses.length < 2) {
                              setFilterStatuses([...filterStatuses, item.val]);
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-between transition cursor-pointer text-left ${
                            isChecked
                              ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                              : isDisabled
                              ? 'opacity-40 bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          <span>{item.label}</span>
                          {isChecked && <Check className="w-3 h-3 text-blue-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Category 2: KPI Performance (Max 2) */}
                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">KPI Performance</span>
                    <span className="text-[10px] font-mono text-slate-400 font-semibold">
                      {filterKpis.length}/2 selected
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'High (≥80%)', val: 'high' },
                      { label: 'Good (60-79%)', val: 'good' },
                      { label: 'Average (40-59%)', val: 'average' },
                      { label: 'Critical (<40%)', val: 'critical' },
                    ].map((item) => {
                      const isChecked = filterKpis.includes(item.val);
                      const isDisabled = !isChecked && filterKpis.length >= 2;
                      return (
                        <button
                          type="button"
                          key={item.val}
                          disabled={isDisabled}
                          onClick={() => {
                            if (isChecked) {
                              setFilterKpis(filterKpis.filter((k) => k !== item.val));
                            } else if (filterKpis.length < 2) {
                              setFilterKpis([...filterKpis, item.val]);
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-between transition cursor-pointer text-left ${
                            isChecked
                              ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                              : isDisabled
                              ? 'opacity-40 bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          {isChecked && <Check className="w-3 h-3 text-blue-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 italic">Max 2 selections per category</span>
                  <button
                    type="button"
                    onClick={() => setIsFiltersDropdownOpen(false)}
                    className="px-3 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-bold cursor-pointer hover:opacity-90"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sort Controls */}
          <div className="relative border-l border-slate-200 dark:border-slate-800 pl-3" ref={sortContainerRef}>
            <button
              type="button"
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                sortRules.length > 0
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
              }`}
              title="Sort Roster List and CSV Exports"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Sort</span>
              {sortRules.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-mono shrink-0">
                  {sortRules.length}
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isSortDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 animate-in fade-in zoom-in-95 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Staff Directory Sorting Rules</span>
                  </span>
                  {sortRules.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSortRules}
                      className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {sortRules.length === 0 ? (
                  <div className="text-center py-3 text-xs text-slate-400">
                    No active sorting rules. Defaulting to system order.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {sortRules.map((rule, idx) => (
                      <div
                        key={rule.id || idx}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                          <span>{idx === 0 ? '1. Primary Sort' : '2. Secondary Sort'}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSortRule(idx)}
                            className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 cursor-pointer text-xs"
                            title="Remove rule"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={rule.field}
                            onChange={(e) =>
                              handleUpdateSortRule(idx, {
                                field: e.target.value as SortField,
                              })
                            }
                            className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-semibold outline-none"
                          >
                            <option value="name">Staff Name</option>
                            <option value="employeeId">Employee ID</option>
                            <option value="department">Department</option>
                            <option value="role">Designation / Role</option>
                            <option value="salary">Est. Monthly Salary</option>
                            <option value="status">Status</option>
                          </select>

                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateSortRule(idx, {
                                direction: rule.direction === 'asc' ? 'desc' : 'asc',
                              })
                            }
                            className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>{rule.direction === 'asc' ? 'Ascending ↑' : 'Descending ↓'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Helpful tip if Primary is a unique field like Name or Employee ID and Secondary is selected */}
                {sortRules.length === 2 && (sortRules[0].field === 'name' || sortRules[0].field === 'employeeId') && (
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[10px] text-amber-800 dark:text-amber-300 leading-tight">
                    💡 <strong>Tip:</strong> Primary sort ({FIELD_LABELS[sortRules[0].field]}) evaluates first. Since names are unique, set <strong>{FIELD_LABELS[sortRules[1].field]}</strong> as Primary (click <strong>"Swap 1st & 2nd"</strong>) to group by {FIELD_LABELS[sortRules[1].field]} first.
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-2">
                  {sortRules.length < 2 && (
                    <button
                      type="button"
                      onClick={handleAddSortRule}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 font-bold text-xs flex items-center gap-1 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{sortRules.length === 0 ? 'Add Sort Rule' : 'Add 2nd Rule'}</span>
                    </button>
                  )}
                  {sortRules.length === 2 && (
                    <button
                      type="button"
                      onClick={handleSwapSortRules}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Swap 1st & 2nd</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsSortDropdownOpen(false)}
                    className="ml-auto px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                <th className="px-2.5 py-2.5 whitespace-nowrap">
                  Employee ID
                </th>
                <th className="px-2.5 py-2.5 min-w-[130px] max-w-[220px] whitespace-normal">
                  Staff Name
                </th>
                <th className="px-2.5 py-2.5 whitespace-normal max-w-[150px]">
                  Department
                </th>
                <th className="px-2.5 py-2.5 min-w-[120px] max-w-[200px] whitespace-normal">
                  Designation / Role
                </th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">Pay Grade</th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">
                  Est. Salary
                </th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">Shift Schedule</th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">Bank Details</th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">
                  Status
                </th>
                <th className="px-2.5 py-2.5 whitespace-nowrap text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {sortedStaffList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-3">
                      <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        No staff members found
                      </p>
                      <p className="text-xs text-slate-500">
                        Upload a CSV/Excel staff list or add a new employee to populate your Skima HR directory.
                      </p>
                      <button
                        onClick={() => onOpenUploadModal('scheme')}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white shadow"
                      >
                        Upload Scheme
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedStaffList.map((staff, idx) => (
                  <tr
                    key={`${staff.id}-${idx}`}
                    className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="px-2.5 py-2 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {staff.employeeId}
                    </td>
                    <td className="px-2.5 py-2 max-w-[220px] whitespace-normal">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap break-words leading-tight">
                        <span className="break-words">{staff.name}</span>
                        {staff.status === 'Suspended' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shrink-0">
                            (suspended)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 break-all leading-tight mt-0.5">{staff.email}</div>
                    </td>
                    <td className="px-2.5 py-2 font-medium whitespace-normal max-w-[150px]">
                      <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] break-words">
                        {staff.department}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 font-medium text-slate-800 dark:text-slate-200 max-w-[200px] whitespace-normal break-words leading-snug">
                      <div>{staff.role}</div>
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        {staff.employeeCategory || 'Full-time'}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 font-mono">
                      <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 leading-snug">
                        {deriveStaffPayGrade(staff, configuredPayGrades)}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {currencySymbol}{staff.estimatedMonthlySalary?.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {staff.shiftSchedule}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {staff.bankName || staff.accountNumber ? (
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs">{staff.bankName || 'Bank'}</div>
                          <div className="text-[11px] text-slate-500 font-mono tracking-wide">{staff.accountNumber || '-'}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Not Provided</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          staff.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : staff.status === 'On Query'
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-400 dark:border-amber-600'
                            : staff.status === 'Probation'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                            : staff.status === 'On Leave'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : staff.status === 'Suspended'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                            : staff.status === 'Exited'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {staff.status}
                      </span>
                      {staff.status === 'On Query' && (
                        <div
                          className="text-[9px] font-mono text-amber-600 dark:text-amber-400 mt-0.5 max-w-[120px] truncate font-semibold flex items-center gap-1"
                          title="Active disciplinary query awaiting resolution"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block shrink-0" />
                          <span>On Query</span>
                        </div>
                      )}
                      {staff.status === 'Probation' && (
                        <div
                          className="text-[9px] font-mono text-purple-600 dark:text-purple-400 mt-0.5 max-w-[120px] truncate font-semibold"
                          title="Probationary period active"
                        >
                          Probationary
                        </div>
                      )}
                      {staff.status === 'Suspended' && (() => {
                        const susp = getStaffSuspensionDetails(staff);
                        if (susp.displayRange) {
                          return (
                            <div
                              className="text-[9px] font-mono text-amber-600 dark:text-amber-400 mt-0.5 max-w-[120px] truncate"
                              title={`Suspension: ${susp.displayRange}${susp.reason ? ` - ${susp.reason}` : ''}`}
                            >
                              {susp.endDate ? `Until ${susp.endDate}` : susp.startDate ? `From ${susp.startDate}` : 'Suspended'}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {staff.status === 'On Leave' && (() => {
                        const activeLeave = getActiveLeaveForStaff(staff, leaves);
                        if (activeLeave) {
                          return (
                            <div
                              className="text-[9px] font-mono text-amber-600 dark:text-amber-400 mt-0.5 max-w-[120px] truncate"
                              title={`${activeLeave.leaveType} Leave (${activeLeave.startDate} to ${activeLeave.endDate})`}
                            >
                              Until {activeLeave.endDate}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {staff.status === 'Exited' && (
                        <div className="space-y-0.5 mt-0.5">
                          {staff.exitDepartureType && (
                            <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                              {staff.exitDepartureType}
                            </div>
                          )}
                          {staff.exitDate && (
                            <div className="text-[9px] font-mono text-slate-500 dark:text-slate-400">
                              Exited: {staff.exitDate}
                            </div>
                          )}
                          {staff.exitDocuments && staff.exitDocuments.length > 0 && (
                            <div className="flex items-center gap-1 text-[9px] text-blue-600 dark:text-blue-400 font-semibold">
                              <Paperclip className="w-2.5 h-2.5" />
                              <span>{staff.exitDocuments.length} doc{staff.exitDocuments.length > 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap text-right">
                      <div className="grid grid-cols-2 gap-1 w-fit ml-auto">
                        {staff.status === 'Exited' ? (
                          <>
                            <button
                              onClick={() => {
                                setStaffLogUser(staff);
                                setStaffLogProfileTab('personnel');
                              }}
                              className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition cursor-pointer"
                              title="Staff Log (Leaves & Position History)"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openMarkExitedModal(staff)}
                              className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition cursor-pointer"
                              title="Edit Departure Reason & Documents"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReinstateStaff(staff)}
                              className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition"
                              title="Reinstate to Active Roster"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setStaffToDelete(staff)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Delete Exited Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : staff.status === 'Suspended' ? (
                          <>
                            <button
                              onClick={() => handleOpenEditSuspension(staff)}
                              className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition"
                              title="Edit Suspension Start & End Dates"
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleUnsuspendStaff(staff)}
                              className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition"
                              title="Unsuspend and restore to Active status"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openMarkExitedModal(staff)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Mark as Exited Employee"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setStaffLogUser(staff);
                                setStaffLogProfileTab('personnel');
                              }}
                              className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition cursor-pointer"
                              title="Staff Log (Leaves & Position History)"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenEditSuspension(staff)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              title="Suspend Staff Member"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openMarkExitedModal(staff)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Mark as Exited Employee"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setStaffLogUser(staff);
                                setStaffLogProfileTab('personnel');
                              }}
                              className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition cursor-pointer"
                              title="Staff Log (Leaves & Position History)"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(staff)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              title="Edit Employee"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Staff Modal */}
      {isAddStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <span>{editingStaff ? 'Edit Staff Member' : 'Add Direct Employee to Staff Directory'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddStaffModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* Staff Profile Photo Management (Add / Change / Remove) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center gap-4">
                {/* Photo Preview Thumbnail on Left */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border-2 border-dashed border-indigo-300 dark:border-indigo-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative group">
                  {formData.photo ? (
                    <img
                      src={formData.photo}
                      alt="Staff Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-slate-400 dark:text-slate-500">
                      <Users className="w-6 h-6 mx-auto opacity-60" />
                      <span className="text-[9px] block font-mono">No Image</span>
                    </div>
                  )}
                </div>

                {/* Information and Controls on Right of Image */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-indigo-500" />
                      <span>Staff Profile Photo</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">PNG, JPG or WEBP (Max 5MB)</span>
                  </div>

                  {/* Actions: Upload / Change / Remove */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <label className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-sm shadow-indigo-600/20">
                      <Camera className="w-3.5 h-3.5" />
                      <span>{formData.photo ? 'Change Photo' : 'Upload Staff Image'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>

                    {formData.photo && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 font-semibold text-xs border border-rose-200 dark:border-rose-800/80 flex items-center gap-1.5 transition cursor-pointer"
                        title="Remove uploaded image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Primary Identifiers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold">
                      Employee ID
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const autoId = generateStaffId(formData.department || 'GEN', staffList);
                        setFormData((prev) => ({ ...prev, employeeId: autoId }));
                      }}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Auto-generate ID based on department code (DEPT_ID-XXXX)"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span>Auto Generate</span>
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={formData.employeeId}
                      onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                      placeholder="e.g. 001, EMP-101, or N/A"
                      className={`w-full pl-3 pr-20 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                        !isEmployeeIdUnique(formData.employeeId || '', staffList, editingStaff?.id).isUnique
                          ? 'border-red-500 focus:ring-2 focus:ring-red-400'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500'
                      } text-slate-900 dark:text-white font-mono font-bold outline-none`}
                    />
                    <div className="absolute right-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, employeeId: '' }))}
                        title="Clear Employee ID (defaults to N/A)"
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <X className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                        <span>Clear</span>
                      </button>
                    </div>
                  </div>
                  {!isEmployeeIdUnique(formData.employeeId || '', staffList, editingStaff?.id).isUnique ? (
                    <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        ID "{formData.employeeId}" is already assigned to {isEmployeeIdUnique(formData.employeeId || '', staffList, editingStaff?.id).conflictingStaff?.name}. Two staff cannot share the same ID (except for N/A).
                      </span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-0.5 font-sans flex items-center justify-between">
                      <span>Empty ID defaults to <strong className="text-slate-600 dark:text-slate-300 font-mono">N/A</strong>. IDs must be unique (except for N/A).</span>
                      {formData.employeeId && formData.employeeId.toUpperCase() !== 'N/A' && (
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, employeeId: 'N/A' }))}
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-semibold ml-1"
                        >
                          Set to N/A
                        </button>
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Alexander Pierce"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              {/* Department & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Department {editingStaff && <span className="text-[10px] font-normal text-amber-500 dark:text-amber-400">(Deactivated in Edit)</span>}
                  </label>
                  {editingStaff ? (
                    <>
                      <input
                        type="text"
                        disabled
                        value={formData.department}
                        className="w-full px-3 py-2 rounded-xl border bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-75"
                      />
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                        Department changes are managed via Department Transfers.
                      </p>
                    </>
                  ) : (
                    <div className="space-y-2">
                      {dbDepartments.length > 0 && (
                        <select
                          value={dbDepartments.includes(formData.department) ? formData.department : '__custom__'}
                          onChange={(e) => {
                            if (e.target.value !== '__custom__') {
                              const newDept = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                department: newDept,
                                role: prev.role || 'N/A',
                              }));
                            }
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                        >
                          <option value="" disabled>-- Select Department from Database --</option>
                          {dbDepartments.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                          <option value="__custom__">+ Enter Custom / New Department...</option>
                        </select>
                      )}
                      {(!dbDepartments.includes(formData.department) || dbDepartments.length === 0) && (
                        <input
                          type="text"
                          required
                          placeholder="Type department name..."
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Role / Designation *
                  </label>
                  {(() => {
                    const deptRoles = getAvailableDbRoles(formData.department);
                    const roleOptions: string[] = [];

                    deptRoles.forEach((r) => {
                      if (r && r.trim() && r.trim() !== 'N/A' && !roleOptions.includes(r.trim())) {
                        roleOptions.push(r.trim());
                      }
                    });

                    if (!roleOptions.includes('N/A')) {
                      roleOptions.push('N/A');
                    }

                    if (formData.role && formData.role.trim() && !roleOptions.includes(formData.role.trim())) {
                      roleOptions.unshift(formData.role.trim());
                    }

                    return (
                      <select
                        value={formData.role || 'N/A'}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                      >
                        {roleOptions.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              </div>

              {/* Start Date (Admin Only) & Date of Birth */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold">
                      Official Start Date *
                    </label>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                      isAdmin
                        ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800'
                        : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800'
                    }`}>
                      {isAdmin ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-teal-500" />
                          <span>Admin Edit</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3 text-amber-500" />
                          <span>Admin Only</span>
                        </>
                      )}
                    </span>
                  </div>
                  {isAdmin ? (
                    <input
                      type="date"
                      required
                      value={formData.joinDate || ''}
                      onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  ) : (
                    <div className="relative">
                      <input
                        type="date"
                        disabled
                        value={formData.joinDate || ''}
                        className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed opacity-75"
                        title="Start Date can only be modified by an Administrator"
                      />
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                        <Lock className="w-3 h-3 shrink-0" />
                        <span>Official start date modifications are restricted to Admin accounts.</span>
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Date of Birth (DOB)
                  </label>
                  <input
                    type="date"
                    value={formData.dob || ''}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Contact Information & Residential Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. employee@company.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. +1 555-0199"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Home Address Entry */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Home Residential Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 14 Palm Avenue, Victoria Island, Lagos"
                  value={formData.homeAddress || ''}
                  onChange={(e) => setFormData({ ...formData, homeAddress: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Guarantor Details Section */}
              <div className="p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 space-y-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 font-mono">
                    Guarantor / Sponsor Profile
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1">
                      Guarantor Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Chief Robert Adeleke"
                      value={formData.guarantorName || ''}
                      onChange={(e) => setFormData({ ...formData, guarantorName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1">
                      Guarantor Phone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +234 803 123 4567"
                      value={formData.guarantorPhone || ''}
                      onChange={(e) => setFormData({ ...formData, guarantorPhone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1">
                      Relationship
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Father, Legal Sponsor"
                      value={formData.guarantorRelationship || ''}
                      onChange={(e) => setFormData({ ...formData, guarantorRelationship: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Guarantor Residential Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 22 Broad Street, Lagos Island, Lagos"
                    value={formData.guarantorAddress || ''}
                    onChange={(e) => setFormData({ ...formData, guarantorAddress: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              </div>

              {/* Next of Kin Details Section */}
              <div className="p-4 rounded-2xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-900/40 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 font-mono">
                    Next of Kin Profile
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1">
                      Next of Kin Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mrs. Funke Adeleke"
                      value={formData.nextOfKinName || ''}
                      onChange={(e) => setFormData({ ...formData, nextOfKinName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1">
                      Next of Kin Phone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +234 802 987 6543"
                      value={formData.nextOfKinPhone || ''}
                      onChange={(e) => setFormData({ ...formData, nextOfKinPhone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1">
                      Relationship
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Spouse, Sibling, Child"
                      value={formData.nextOfKinRelationship || ''}
                      onChange={(e) => setFormData({ ...formData, nextOfKinRelationship: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Next of Kin Residential Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 14 Victoria Island Expressway, Lagos"
                    value={formData.nextOfKinAddress || ''}
                    onChange={(e) => setFormData({ ...formData, nextOfKinAddress: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              </div>

              {/* Compensation, Pay Frequency & Pay Grade */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Pay Frequency
                  </label>
                  <select
                    value={formData.payFrequency || payrollConfig.defaultPayFrequency || 'Monthly'}
                    onChange={(e) => setFormData({ ...formData, payFrequency: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold outline-none"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Bi-Weekly">Bi-Weekly</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold">
                      Pay Grade
                    </label>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">
                      Dynamic Tier
                    </span>
                  </div>
                  <select
                    value={formData.payGrade || derivePayGradeFromSalary(Number(formData.estimatedMonthlySalary) || 0, configuredPayGrades)}
                    onChange={(e) => {
                      const selectedGrade = e.target.value;
                      const matchedTier = configuredPayGrades.find((pg) => pg.name === selectedGrade);
                      const currentSalary = Number(formData.estimatedMonthlySalary) || 0;
                      let updatedSalary = currentSalary;
                      if (matchedTier && (currentSalary < matchedTier.minSalary || currentSalary > matchedTier.maxSalary)) {
                        updatedSalary = matchedTier.minSalary;
                      }
                      setFormData({
                        ...formData,
                        payGrade: selectedGrade,
                        estimatedMonthlySalary: updatedSalary,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold outline-none"
                  >
                    {configuredPayGrades.map((grade) => (
                      <option key={grade.id} value={grade.name}>
                        {grade.name} ({currencySymbol}{grade.minSalary.toLocaleString()} - {currencySymbol}{grade.maxSalary.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Est. Base Salary ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    value={formData.estimatedMonthlySalary}
                    onChange={(e) => {
                      const newSalary = parseFloat(e.target.value) || 0;
                      const autoGrade = derivePayGradeFromSalary(newSalary, configuredPayGrades);
                      setFormData({
                        ...formData,
                        estimatedMonthlySalary: newSalary,
                        payGrade: autoGrade,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Bank Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chase Bank, First Bank"
                    value={formData.bankName || ''}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1029384756"
                    value={formData.accountNumber || ''}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Shift, Status & Employee Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Shift Schedule {editingStaff && <span className="text-[10px] font-normal text-amber-500 dark:text-amber-400">(Deactivated in Edit)</span>}
                  </label>
                  {(() => {
                    const baseShifts = settings?.shifts && settings.shifts.length > 0
                      ? settings.shifts
                      : [
                          { id: '1', name: 'Morning Shift', startTime: '08:00', endTime: '17:00' },
                          { id: '2', name: 'Afternoon Shift', startTime: '14:00', endTime: '22:00' },
                          { id: '3', name: 'Night Shift', startTime: '22:00', endTime: '06:00' },
                        ];
                    const allShifts = [
                      ...baseShifts,
                      { id: 'na', name: 'N/A', startTime: 'N/A', endTime: 'N/A' },
                    ];
                    const currVal = formData.shiftSchedule || 'N/A';
                    const isKnown = allShifts.some((s) => s.name === currVal);
                    const optionsList = isKnown
                      ? allShifts
                      : [...allShifts, { id: 'custom', name: currVal, startTime: 'Custom', endTime: 'Custom' }];

                    return (
                      <>
                        <select
                          disabled={!!editingStaff}
                          value={currVal}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              shiftSchedule: e.target.value as any,
                            })
                          }
                          className={`w-full px-3 py-2 rounded-xl font-semibold text-xs border ${
                            editingStaff
                              ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-75'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                          }`}
                        >
                          {optionsList.map((s) => (
                            <option key={s.id || s.name} value={s.name}>
                              {s.name} {s.startTime !== 'N/A' && s.startTime !== 'Custom' ? `(${s.startTime} - ${s.endTime})` : ''}
                            </option>
                          ))}
                        </select>
                        {editingStaff && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                            Shift schedule is managed via Shifts & Rosters.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Status {editingStaff && (editingStaff.status === 'Suspended' || editingStaff.status === 'Exited') && <span className="text-[10px] font-normal text-amber-500 dark:text-amber-400">(Managed via Rosters)</span>}
                  </label>
                  <select
                    disabled={!!editingStaff && (editingStaff.status === 'Suspended' || editingStaff.status === 'Exited')}
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as any })
                    }
                    className={`w-full px-3 py-2 rounded-xl border ${
                      editingStaff && (editingStaff.status === 'Suspended' || editingStaff.status === 'Exited')
                        ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-75 font-semibold'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                    }`}
                  >
                    <option value="Active">Active (Regular Staff)</option>
                    <option value="Probation">Probation (Under Evaluation)</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Off Duty">Off Duty</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Exited">Exited (Archived Staff)</option>
                  </select>
                  {editingStaff && (editingStaff.status === 'Suspended' || editingStaff.status === 'Exited') && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      Status changes are managed via directory exit & roster actions.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Employee Category *
                  </label>
                  <select
                    value={formData.employeeCategory || 'Full-time'}
                    onChange={(e) =>
                      setFormData({ ...formData, employeeCategory: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs outline-none"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Trainee">Trainee</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Used for conditional payroll & corporate deductions.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddStaffModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  {editingStaff ? 'Save Changes' : 'Complete Registration & Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Exited Staff Modal */}
      {exitModalStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserX className="w-5 h-5 text-rose-500" />
                <span>Mark Staff as Exited</span>
              </h3>
              <button
                type="button"
                onClick={() => setExitModalStaff(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>{exitModalStaff.name}</span>
                <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400">{exitModalStaff.employeeId}</span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span>Department: <strong className="text-slate-700 dark:text-slate-300">{exitModalStaff.department}</strong></span>
                <span>•</span>
                <span>Role: <strong className="text-slate-700 dark:text-slate-300">{exitModalStaff.role}</strong></span>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Kind of Departure *
                </label>
                <select
                  value={exitDepartureType}
                  onChange={(e) => setExitDepartureType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                >
                  {DEPARTURE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Exit / Departure Date *
                </label>
                <input
                  type="date"
                  value={exitDate}
                  onChange={(e) => setExitDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Departure Notes / Details (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Handover completed, equipment returned, reason details..."
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white resize-none"
                />
              </div>

              {/* Attach Necessary Departure Documents */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-rose-500" />
                    <span>Attach Necessary Departure Documents</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    PDF, DOC, Images (Max 10MB)
                  </span>
                </div>

                <input
                  type="file"
                  ref={exitDocInputRef}
                  multiple
                  onChange={handleExitDocumentUpload}
                  className="hidden"
                />

                <div
                  onClick={() => exitDocInputRef.current?.click()}
                  className="p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500/50 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/50 dark:hover:bg-slate-800/70 transition cursor-pointer flex flex-col items-center justify-center text-center gap-1.5"
                >
                  <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Click to browse & attach documents
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Resignation letter, termination notice, clearance form, etc.
                  </span>
                </div>

                {isUploadingExitDoc && (
                  <div className="text-[11px] text-rose-500 flex items-center gap-1.5 font-medium animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Attaching document(s)...</span>
                  </div>
                )}

                {/* List of Attached Documents */}
                {exitDocuments.length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {exitDocuments.map((doc, idx) => (
                      <div
                        key={`${doc.name}-${idx}`}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                          <span className="truncate text-slate-900 dark:text-white font-medium">
                            {doc.name}
                          </span>
                          {doc.size ? (
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              ({(doc.size / 1024).toFixed(0)} KB)
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {doc.data && (
                            <a
                              href={doc.data}
                              download={doc.name}
                              className="p-1 rounded text-slate-400 hover:text-blue-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                              title="Download Attachment"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveExitDoc(idx)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                            title="Remove attachment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setExitModalStaff(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMarkExited}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 transition cursor-pointer"
              >
                Confirm Exited Employee
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Upload Exited Staff List Modal */}
      {isExitedUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserX className="w-5 h-5 text-rose-500" />
                Upload Exited Staff Roster
              </h3>
              <button
                onClick={() => setIsExitedUploadOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Import former or departed staff records directly into your Exited Staff Archive. Paste CSV/Excel lines in the format:
            </p>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300">
              Full Name, Employee ID, Department, Exit Date, Reason
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Paste CSV or Excel Rows
              </label>
              <textarea
                rows={6}
                value={exitedCsvInput}
                onChange={(e) => setExitedCsvInput(e.target.value)}
                placeholder={`John Doe, SKM-011, Engineering, 2026-05-15, Contract Ended\nJane Smith, SKM-012, Operations, 2026-06-30, Resignation`}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <label className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-1.5 border border-slate-300 dark:border-slate-700">
                <Upload className="w-3.5 h-3.5 text-rose-500" />
                <span>Choose .CSV / .XLS File</span>
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
                        if (content) setExitedCsvInput(content);
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsExitedUploadOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleProcessExitedUpload(exitedCsvInput)}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 cursor-pointer"
                >
                  Import Exited Staff
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Staff Member Modal */}
      {isSuspendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserMinus className="w-5 h-5 text-amber-500" />
                Suspend Staff Member
              </h3>
              <button
                onClick={() => {
                  setIsSuspendModalOpen(false);
                  setSelectedStaffToSuspend(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Select an active staff member to place them on suspension. They will be tagged with <span className="font-bold text-amber-600 dark:text-amber-400">(suspended)</span> across all reports, roster views, and CSV exports.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Search Active Staff Member
              </label>
              <SearchableStaffSelect
                staffList={staffList.filter((s) => s.status !== 'Exited' && s.status !== 'Suspended')}
                selectedStaffId={selectedStaffToSuspend?.id || ''}
                onSelectStaff={(staff) => setSelectedStaffToSuspend(staff)}
                placeholder="Search staff by name, ID, department..."
              />
            </div>

            {selectedStaffToSuspend && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-100">
                      {selectedStaffToSuspend.name}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      ID: {selectedStaffToSuspend.employeeId}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-800 dark:text-amber-300">
                    Department: <span className="font-semibold">{selectedStaffToSuspend.department}</span> • Role: <span className="font-semibold">{selectedStaffToSuspend.role}</span>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Suspension End Date & Time (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={suspendEndTime}
                      onChange={(e) => setSuspendEndTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono outline-none focus:border-amber-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Logged in staff suspension history and roster status tracking.
                    </p>
                  </div>

                  {/* Reason & Penalty Deduction (Side-by-Side) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Suspension Reason / Reference (Optional)
                      </label>
                      <input
                        type="text"
                        value={suspendReason}
                        onChange={(e) => setSuspendReason(e.target.value)}
                        placeholder="e.g. Disciplinary inquiry, policy breach..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-500" />
                          Impose Fine (Manual Deductions)
                        </span>
                        <span className="text-[9px] text-slate-400 font-normal">Payroll Catalog</span>
                      </label>
                      <select
                        value={suspendPenaltyRuleId}
                        onChange={(e) => setSuspendPenaltyRuleId(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="none">None (Financial Pardon / No Fine)</option>
                        {manualDeductionsCatalog.map((rule) => (
                          <option key={rule.id} value={rule.id}>
                            {rule.name} — {rule.type === 'percentage' ? `${rule.defaultValue}% Base` : `${currencySymbol}${rule.defaultValue.toLocaleString()}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsSuspendModalOpen(false);
                  setSelectedStaffToSuspend(null);
                  setSuspendEndTime('');
                  setSuspendReason('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedStaffToSuspend}
                onClick={() => {
                  if (selectedStaffToSuspend) {
                    handleSuspendStaff(selectedStaffToSuspend, suspendEndTime, suspendReason);
                    setIsSuspendModalOpen(false);
                    setSelectedStaffToSuspend(null);
                  }
                }}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white shadow-md shadow-amber-600/30 cursor-pointer flex items-center gap-1.5"
              >
                <UserMinus className="w-4 h-4" />
                <span>Confirm Suspension</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Log Modal (Leaves & Transfers/History) */}
      {staffLogUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl max-h-[92vh] rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-2xl overflow-y-auto p-6 md:p-8 space-y-5">
            {/* Header: Staff Image & Name on Left, Close (X) on Right */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center text-lg font-black font-mono shrink-0 overflow-hidden shadow-md">
                  {staffLogUser.photo || staffLogUser.avatar ? (
                    <img
                      src={staffLogUser.photo || staffLogUser.avatar}
                      alt={staffLogUser.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{staffLogUser.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white leading-tight">{staffLogUser.name}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Employee ID: <span className="text-blue-400 font-bold">#{staffLogUser.employeeId}</span> • {staffLogUser.department} ({staffLogUser.role})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStaffLogUser(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Close Staff Log"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Short Section Under Name: Action Buttons on Left, Status Indicator on Right */}
            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewStaffPrompt(false);
                    setDocumentModalInitialTab(null);
                    setConfirmationStaff(staffLogUser);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition shadow-sm shadow-blue-600/20"
                  title="Print Employment Documents (Confirmation Letter, Official Job Description, Appointment Letter)"
                >
                  <Printer className="w-4 h-4 text-blue-100" />
                  <span>Print Employment Documents</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setManageQueryStaff(staffLogUser);
                    setSelectedQueryForModal(undefined);
                    setIsManageQueryOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition shadow-sm shadow-amber-600/20"
                  title="Log and manage disciplinary query for staff"
                >
                  <FileQuestion className="w-4 h-4 text-amber-100" />
                  <span>Manage Query</span>
                  {(() => {
                    const hasPending = isStaffCurrentlyOnQuery(staffLogUser.id, companyName);
                    if (hasPending) {
                      return (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-400 text-amber-200 text-[9px] font-mono animate-pulse">
                          Active Query
                        </span>
                      );
                    }
                    return null;
                  })()}
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="text-slate-400 font-mono text-[11px] uppercase tracking-wider font-semibold">
                  Status:
                </span>
                <span
                  className={`px-3 py-0.5 rounded-full text-xs font-mono font-bold border ${
                    staffLogUser.status === 'Active'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : staffLogUser.status === 'On Query'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : staffLogUser.status === 'Probation'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : staffLogUser.status === 'Suspended'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : staffLogUser.status === 'On Leave'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {staffLogUser.status || 'Active'}
                </span>
                {staffLogUser.status === 'Probation' && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...staffLogUser, status: 'Active' as const };
                      const updatedList = staffList.map((s) => (s.id === staffLogUser.id ? updated : s));
                      onUpdateStaffList(updatedList);
                      setStaffLogUser(updated);
                      emitGlobalToast(`${staffLogUser.name} has been confirmed as regular Active Staff!`, 'success');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    title="Confirm probation period completed and confirm to Regular Active Staff"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-200" />
                    <span>Confirm to Regular Active</span>
                  </button>
                )}
                {staffLogUser.status === 'Active' && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...staffLogUser, status: 'Probation' as const };
                      const updatedList = staffList.map((s) => (s.id === staffLogUser.id ? updated : s));
                      onUpdateStaffList(updatedList);
                      setStaffLogUser(updated);
                      emitGlobalToast(`${staffLogUser.name} placed on Probation evaluation.`, 'info');
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-700/80 hover:bg-purple-900/50 text-slate-300 hover:text-purple-200 border border-slate-600 hover:border-purple-500 text-[10px] font-medium transition cursor-pointer"
                    title="Place staff on probationary evaluation"
                  >
                    <span>Place on Probation</span>
                  </button>
                )}
              </div>
            </div>

            {/* Employee Bio & Dossier Tabs Card */}
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-xs space-y-3">
              {/* Dossier Tabs Header */}
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5 flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-blue-400 font-bold uppercase tracking-wider text-[11px] font-mono">
                  <UserCheck className="w-4 h-4" />
                  <span>Employee Record Profile</span>
                </div>

                <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700/80 gap-1">
                  <button
                    type="button"
                    onClick={() => setStaffLogProfileTab('personnel')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      staffLogProfileTab === 'personnel'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Personnel Info</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffLogProfileTab('guarantor')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      staffLogProfileTab === 'guarantor'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Guarantor Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffLogProfileTab('nextOfKin')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      staffLogProfileTab === 'nextOfKin'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Next of Kin Profile</span>
                  </button>
                </div>
              </div>

              {/* Tab Content Pane */}
              {staffLogProfileTab === 'personnel' && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
                    <div>
                      <span className="block text-[10px] uppercase font-mono text-slate-400">Official Start Date</span>
                      <span className="font-mono font-bold text-white">{staffLogUser.joinDate || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-mono text-slate-400">Date of Birth</span>
                      <span className="font-mono font-bold text-white">{staffLogUser.dob || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-mono text-slate-400">Email Address</span>
                      <span className="truncate block text-slate-200 font-mono">{staffLogUser.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-mono text-slate-400">Phone Number</span>
                      <span className="font-mono text-slate-200">{staffLogUser.phone || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-700/60">
                    <div className="sm:col-span-2">
                      <span className="block text-[10px] uppercase font-mono text-slate-400">Home Residential Address</span>
                      <span className="font-medium text-slate-200">{staffLogUser.homeAddress || 'No residential address on file'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-mono text-slate-400">Base Pay Grade</span>
                      <span className="font-mono font-bold text-indigo-300">
                        {deriveStaffPayGrade(staffLogUser, configuredPayGrades)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {staffLogProfileTab === 'guarantor' && (
                <div className="pt-1">
                  {staffLogUser.guarantorName ? (
                    <div className="space-y-2.5 text-slate-300">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <span className="block text-[10px] uppercase font-mono text-slate-400">Guarantor Name</span>
                          <span className="font-bold text-white">{staffLogUser.guarantorName}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-mono text-slate-400">Relationship</span>
                          <span className="font-medium text-teal-300">{staffLogUser.guarantorRelationship || 'Sponsor'}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-mono text-slate-400">Phone Number</span>
                          <span className="font-mono text-slate-200">{staffLogUser.guarantorPhone || 'N/A'}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-700/60">
                        <span className="block text-[10px] uppercase font-mono text-slate-400">Guarantor Residential Address</span>
                        <span className="font-medium text-slate-200">{staffLogUser.guarantorAddress || 'N/A'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs italic">
                      No guarantor or sponsor details registered for this employee yet.
                    </div>
                  )}
                </div>
              )}

              {staffLogProfileTab === 'nextOfKin' && (
                <div className="pt-1">
                  {staffLogUser.nextOfKinName ? (
                    <div className="space-y-2.5 text-slate-300">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <span className="block text-[10px] uppercase font-mono text-slate-400">Next of Kin Name</span>
                          <span className="font-bold text-white">{staffLogUser.nextOfKinName}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-mono text-slate-400">Relationship</span>
                          <span className="font-medium text-teal-300">{staffLogUser.nextOfKinRelationship || 'Next of Kin'}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-mono text-slate-400">Phone Number</span>
                          <span className="font-mono text-slate-200">{staffLogUser.nextOfKinPhone || 'N/A'}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-700/60">
                        <span className="block text-[10px] uppercase font-mono text-slate-400">Next of Kin Residential Address</span>
                        <span className="font-medium text-slate-200">{staffLogUser.nextOfKinAddress || 'N/A'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs italic">
                      No next of kin details registered for this employee yet.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 0. Suspension Status & End Time History (Logged exclusively in Staff Log) */}
            {staffLogUser.status === 'Suspended' && (
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <UserMinus className="w-4 h-4 text-amber-400" />
                    <span>Staff Member Currently On Suspension</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditSuspension(staffLogUser)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-900 flex items-center gap-1.5 shadow cursor-pointer transition-colors"
                      title="Edit Suspension Start Date and End Date"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Edit Suspension Dates</span>
                    </button>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Suspended Status
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-amber-200/90 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-mono uppercase">Suspension Active Period:</span>
                    <span className="font-semibold text-white font-mono">
                      {getStaffSuspensionDetails(staffLogUser).displayRange}
                    </span>
                  </div>
                  {staffLogUser.suspensionReason && (
                    <div>
                      <span className="text-slate-400 block text-[10px] font-mono uppercase">Reason / Ref:</span>
                      <span className="font-semibold text-white">{staffLogUser.suspensionReason}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 1. Job Description & KPI Performance Analysis Charts & Daily Involvement Logger */}
            {(() => {
              const kpi = getStaffKpiData(staffLogUser, selectedKpiDate, kpiFrequency);
              const { roleTitle, items } = getStaffRoleInfo(staffLogUser);
              const keyItems = items.filter((it) => it.isKey);
              const evalItems = keyItems.length > 0 ? keyItems : items;

              // Read stored involvement for selected date
              let storedRatings: Record<string, any> = {};
              try {
                storedRatings = loadCompanyData<Record<string, any>>(STORAGE_KEYS.KPI_RATINGS, companyName, {});
              } catch (e) {
                console.error(e);
              }

              const scoresForDate: number[] = [];
              evalItems.forEach((item) => {
                const key = `${staffLogUser.employeeId || staffLogUser.id}_${selectedKpiDate}_${item.id}`;
                const rawRating = storedRatings[key];
                const { score } = parseKpiRating(rawRating);
                if (score !== null) {
                  scoresForDate.push(score);
                }
              });

              const dailyScore = evalItems.length > 0 && scoresForDate.length > 0
                ? Math.round(scoresForDate.reduce((a, b) => a + b, 0) / evalItems.length)
                : null;

              return (
                <div className="space-y-4 pt-2 border-t border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                      <span>Job Description & KPI Performance Analysis</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* KPI Frequency Selector */}
                      <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-700">
                        <Clock className="w-3.5 h-3.5 text-teal-400" />
                        <span className="text-[10px] uppercase font-bold text-slate-400">Frequency:</span>
                        <select
                          value={kpiFrequency}
                          onChange={(e) => {
                            const val = e.target.value as KpiFrequency;
                            setKpiFrequency(val);
                            try {
                              saveCompanyData(STORAGE_KEYS.KPI_FREQUENCY, val, companyName);
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="bg-transparent text-teal-300 font-bold text-xs focus:outline-none cursor-pointer"
                        >
                          <option value="daily" className="bg-slate-900 text-white">Daily</option>
                          <option value="monthly" className="bg-slate-900 text-white">Monthly</option>
                          <option value="quarterly" className="bg-slate-900 text-white">Quarter-Yearly (Every 3 Mo)</option>
                          <option value="yearly" className="bg-slate-900 text-white">Yearly</option>
                        </select>
                      </div>

                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        100% Scale Evaluation
                      </span>
                    </div>
                  </div>

                  {/* Input KPI Action Banner */}
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-teal-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-teal-400" />
                          Key Duties & KPI Appraisal
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                          {evalItems.length} Key {evalItems.length === 1 ? 'Duty' : 'Duties'} Configured
                        </span>
                        {dailyScore !== null ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            dailyScore >= 80
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : dailyScore >= 45
                              ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}>
                            {selectedKpiDate}: {dailyScore}% Evaluated
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-700">
                            {selectedKpiDate}: Not Evaluated
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Input ratings for duties configured as key duties in the role specifications. Appraise performance, view results, and print official evaluation sheets.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsKpiModalOpen(true)}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold shadow-lg shadow-teal-700/30 flex items-center gap-2 transition cursor-pointer"
                      >
                        <Sliders className="w-4 h-4 text-emerald-200" />
                        <span>Input KPI</span>
                      </button>
                    </div>
                  </div>

                  {/* KPI Charts Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Radar Chart: Visual KPI Dimension Statistics */}
                    <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3 flex flex-col justify-between">
                      <div className="w-full flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-teal-400" />
                          <span>KPI Radar Dimensions</span>
                        </span>
                        <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800">
                          {kpi.radarAverage}% Radar Index
                        </span>
                      </div>

                      <div className="relative w-full h-44 flex items-center justify-center my-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={kpi.radarData}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis
                              dataKey="parameter"
                              stroke="#94a3b8"
                              tick={{ fill: '#e2e8f0', fontSize: 10, fontWeight: 'bold' }}
                            />
                            <PolarRadiusAxis
                              angle={30}
                              domain={[0, 100]}
                              stroke="#475569"
                              tick={{ fill: '#94a3b8', fontSize: 8 }}
                            />
                            <Radar
                              name={staffLogUser.name}
                              dataKey="score"
                              stroke="#0d9488"
                              fill="#0d9488"
                              fillOpacity={0.35}
                              strokeWidth={2}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                borderColor: '#334155',
                                borderRadius: '8px',
                                fontSize: '11px',
                                color: '#fff',
                              }}
                              formatter={(val: any) => [`${val}%`, 'Score']}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="w-full p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/60 text-[11px] text-slate-300 space-y-1">
                        <div className="flex items-center justify-center gap-1.5 font-bold text-teal-300">
                          <Award className="w-3.5 h-3.5 text-teal-400" />
                          <span>
                            {kpi.radarAverage >= 80
                              ? 'Exceptional Multidimensional Performance'
                              : kpi.radarAverage >= 60
                              ? 'Strong Overall Competence Balance'
                              : 'Developing Cross-Functional Baseline'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 text-center">
                          6 core KPI parameters: Regularity, Punctuality, Task Execution, Discipline, Output & Initiative.
                        </p>
                      </div>
                    </div>

                    {/* Bar Chart: Frequency Performance Analysis */}
                    <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4 text-blue-400" />
                          {kpi.frequencyTitle}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          0% - 100% Scale
                        </span>
                      </div>

                      <div className="h-44 w-full pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={kpi.chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                              formatter={(value: any, name: any, item: any) => [`${value}% Score`, item?.payload?.tooltipTitle || 'KPI Score']}
                            />
                            <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                              {kpi.chartData.map((entry, index) => (
                                <Cell
                                  key={`bar-${index}`}
                                  fill={
                                    entry.score >= 80
                                      ? '#0d9488'
                                      : entry.score >= 56
                                      ? '#2563eb'
                                      : entry.score >= 45
                                      ? '#0284c7'
                                      : entry.score >= 25
                                      ? '#f59e0b'
                                      : entry.score > 0
                                      ? '#e11d48'
                                      : '#334155'
                                  }
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-700/60 text-[10px] text-slate-400 text-center font-mono">
                        {kpi.frequencyCaption}
                      </div>
                    </div>
                  </div>

                  {/* Collated All-Time Average & Promotion Assessment */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800/80 to-slate-900 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-indigo-400" />
                          Collated All-Time KPI Average
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                          {kpi.collatedAllTimeAverage}% All-Time Score
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${kpi.promotionStatus.badgeColor}`}>
                          {kpi.promotionStatus.badgeText}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {kpi.promotionStatus.recommendation}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Promotion Readiness</div>
                        <div className="text-xs font-semibold text-emerald-400 font-mono">
                          {kpi.collatedAllTimeAverage >= 70 ? 'Advance Eligible' : 'In Review'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 2. Staff History Log & Audit Records (Consolidated at bottom) */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-bold font-mono text-teal-400 uppercase tracking-wider">
                    Staff History Log & Audit Records
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Verified HR Audit Trail
                </div>
              </div>

              {/* History Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
                {[
                  { id: 'all', label: 'All Events' },
                  { id: 'queries', label: 'Queries' },
                  { id: 'leaves', label: 'Leaves' },
                  { id: 'transfers', label: 'Transfers & Roles' },
                  { id: 'suspensions', label: 'Suspensions' },
                  { id: 'records', label: 'Onboarding & Audit' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setHistoryFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 cursor-pointer ${
                      historyFilter === tab.id
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                        : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Unified History Entries Stream */}
              {(() => {
                const userLeaves = leaves.filter(
                  (l) =>
                    l.employeeId.toLowerCase() === staffLogUser.employeeId.toLowerCase() ||
                    l.employeeName.toLowerCase() === staffLogUser.name.toLowerCase()
                );

                // Department Transfers
                let userTransfers: any[] = [];
                try {
                  const allTransfers = loadCompanyData<any[]>(STORAGE_KEYS.TRANSFERS, companyName, []);
                  if (Array.isArray(allTransfers)) {
                    userTransfers = allTransfers.filter(
                      (t) =>
                        t.staffId === staffLogUser.id ||
                        (t.staffName && t.staffName.toLowerCase() === staffLogUser.name.toLowerCase()) ||
                        (t.employeeId && t.employeeId.toLowerCase() === staffLogUser.employeeId.toLowerCase())
                    );
                  }
                } catch (e) {
                  console.error(e);
                }

                // Custom HR History Logs
                let userCustomLogs: any[] = [];
                try {
                  const storedLogs = loadCompanyData<Record<string, any[]>>(STORAGE_KEYS.STAFF_HISTORY, companyName, {});
                  const staffKey = staffLogUser.employeeId || staffLogUser.id;
                  userCustomLogs = storedLogs[staffKey] || [];
                } catch (e) {
                  console.error(e);
                }

                // Build unified timeline
                interface TimelineItem {
                  id: string;
                  type: 'leave' | 'transfer' | 'suspension' | 'custom' | 'onboarding' | 'departure' | 'query';
                  badge: string;
                  badgeClass: string;
                  title: string;
                  date: string;
                  description?: string;
                  attachmentName?: string;
                  attachmentUrl?: string;
                  details?: { label: string; value: string }[];
                  exitDocs?: { name: string; size?: number; type?: string; data: string; uploadDate: string }[];
                  printAction: () => void;
                }

                const items: TimelineItem[] = [];

                // 0. Disciplinary Queries
                if (historyFilter === 'all' || historyFilter === 'queries') {
                  const allCompanyQueries = loadCompanyQueries(companyName);
                  const staffQueries = allCompanyQueries.filter(
                    (q) =>
                      q.staffId === staffLogUser.id ||
                      (staffLogUser.employeeId && q.staffId === staffLogUser.employeeId) ||
                      (q.staffName && q.staffName.toLowerCase() === staffLogUser.name.toLowerCase())
                  );

                  staffQueries.forEach((q) => {
                    const isPending = q.status === 'pending';
                    items.push({
                      id: `query-${q.id}`,
                      type: 'query',
                      badge: isPending ? 'Pending Query' : `Closed Query (${(q.verdict || 'RESOLVED').toUpperCase()})`,
                      badgeClass: isPending
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : q.verdict === 'warning'
                        ? 'bg-amber-600/20 text-amber-400 border-amber-600/30'
                        : q.verdict === 'fine'
                        ? 'bg-rose-600/20 text-rose-300 border-rose-600/30'
                        : q.verdict === 'suspension'
                        ? 'bg-purple-600/20 text-purple-300 border-purple-600/30'
                        : q.verdict === 'exit'
                        ? 'bg-red-700/20 text-red-300 border-red-700/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                      title: `Query: "${q.title}" - ${isPending ? 'Awaiting Response' : 'Closed / Resolved'}`,
                      date: `Issued: ${new Date(q.issuedAt).toLocaleDateString()} • Deadline: ${new Date(q.deadlineAt).toLocaleString()}`,
                      description: isPending
                        ? `Awaiting employee response within ${q.deadlineHours}h window.`
                        : `Closed with verdict: ${(q.verdict || 'Resolved').toUpperCase()}${q.verdictDetails?.notes ? ` - ${q.verdictDetails.notes}` : ''}`,
                      attachmentName: q.queryDocument?.name || q.responseDocument?.name,
                      attachmentUrl: q.queryDocument?.data || q.responseDocument?.data,
                      details: [
                        { label: 'Status', value: isPending ? 'Pending (On Query)' : 'Closed' },
                        { label: 'Window', value: `${q.deadlineHours} Hours` },
                        { label: 'Query Letter', value: q.queryDocument ? q.queryDocument.name : 'Not attached' },
                        { label: 'Response Letter', value: q.responseDocument ? q.responseDocument.name : 'Not attached' },
                        ...(q.verdict ? [{ label: 'Action Verdict', value: q.verdict.toUpperCase() }] : []),
                      ],
                      printAction: () => {
                        setManageQueryStaff(staffLogUser);
                        setSelectedQueryForModal(q.id);
                        setIsManageQueryOpen(true);
                      },
                    });
                  });
                }

                // 1. Leaves
                if (historyFilter === 'all' || historyFilter === 'leaves') {
                  userLeaves.forEach((l) => {
                    const ended = isLeaveEnded(l);
                    const isOngoing = isLeaveCurrentlyActive(l);
                    items.push({
                      id: `leave-${l.id}`,
                      type: 'leave',
                      badge: `${l.leaveType} Leave`,
                      badgeClass: ended
                        ? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                        : isOngoing
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                      title: `${l.leaveType} Leave (${l.daysCount} Days) - ${
                        ended ? 'Completed' : isOngoing ? 'Active / Ongoing' : 'Upcoming Scheduled'
                      }`,
                      date: `${l.startDate} to ${l.endDate}`,
                      description: l.reason ? `Reason: ${l.reason}` : undefined,
                      attachmentName: l.attachmentName,
                      attachmentUrl: l.attachmentUrl,
                      details: [
                        { label: 'Approval Status', value: l.status || 'Approved' },
                        {
                          label: 'Lifecycle',
                          value: ended ? 'Completed (Ended)' : isOngoing ? 'Ongoing (Active)' : 'Upcoming Scheduled',
                        },
                        { label: 'Leave Duration', value: `${l.daysCount} Days` },
                      ],
                      printAction: () =>
                        setSelectedDocPreview({
                          title: `${l.leaveType} Leave Record - ${staffLogUser.name}`,
                          category: 'LEAVE RECORD',
                          employeeName: staffLogUser.name,
                          employeeId: staffLogUser.employeeId,
                          department: staffLogUser.department,
                          leaveType: l.leaveType,
                          startDate: l.startDate,
                          endDate: l.endDate,
                          daysCount: l.daysCount,
                          attachmentName: l.attachmentName || 'Leave Proof Document',
                          attachmentUrl: l.attachmentUrl,
                          reason: l.reason,
                        }),
                    });
                  });
                }

                // 2. Transfers
                if (historyFilter === 'all' || historyFilter === 'transfers') {
                  userTransfers.forEach((t) => {
                    items.push({
                      id: `trf-${t.id}`,
                      type: 'transfer',
                      badge: 'Department Transfer',
                      badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                      title: `Transferred to ${t.toDepartment}`,
                      date: t.transferDate || 'N/A',
                      description: `Reassigned from ${t.fromDepartment} (${t.fromRole || 'Staff'}) to ${t.toDepartment} (${t.toRole || 'Staff'}). Authorized by: ${t.authorizedBy || 'HR'}.`,
                      details: [
                        { label: 'Previous Department', value: t.fromDepartment },
                        { label: 'New Department', value: t.toDepartment },
                        { label: 'Effective Date', value: t.transferDate || 'Immediate' },
                      ],
                      printAction: () =>
                        setSelectedDocPreview({
                          title: `Official Transfer Record - ${staffLogUser.name}`,
                          category: 'TRANSFER RECORD',
                          employeeName: staffLogUser.name,
                          employeeId: staffLogUser.employeeId,
                          department: t.toDepartment,
                          startDate: t.transferDate,
                          reason: `Staff reassignment from ${t.fromDepartment} to ${t.toDepartment}. Authorized by ${t.authorizedBy || 'HR Management'}.`,
                          details: [
                            { label: 'From Department', value: t.fromDepartment },
                            { label: 'To Department', value: t.toDepartment },
                            { label: 'New Role', value: t.toRole || staffLogUser.role },
                            { label: 'Transfer Ref ID', value: t.id },
                          ],
                        }),
                    });
                  });
                }

                // 3. Suspensions (Active and Historical Logs)
                if (historyFilter === 'all' || historyFilter === 'suspensions') {
                  // Active state indicator
                  if (staffLogUser.status === 'Suspended') {
                    items.push({
                      id: `susp-active-${staffLogUser.id}`,
                      type: 'suspension',
                      badge: 'Active Suspension',
                      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                      title: 'Workforce Disciplinary Suspension (Active)',
                      date: staffLogUser.suspensionEndTime ? `Until: ${staffLogUser.suspensionEndTime}` : 'Active Suspension',
                      description: staffLogUser.suspensionReason || 'Disciplinary review process currently active.',
                      details: [
                        { label: 'Status', value: 'Currently Suspended' },
                        { label: 'Timeframe', value: staffLogUser.suspensionEndTime || 'Pending Review' },
                        { label: 'Reason', value: staffLogUser.suspensionReason || 'Disciplinary investigation' },
                      ],
                      printAction: () =>
                        setSelectedDocPreview({
                          title: `Disciplinary Suspension Notice - ${staffLogUser.name}`,
                          category: 'SUSPENSION NOTICE',
                          employeeName: staffLogUser.name,
                          employeeId: staffLogUser.employeeId,
                          department: staffLogUser.department,
                          startDate: staffLogUser.suspensionStartDate || new Date().toISOString().split('T')[0],
                          reason: staffLogUser.suspensionReason || 'Disciplinary suspension order registered on employee log.',
                          details: [
                            { label: 'Suspension Period', value: staffLogUser.suspensionEndTime || 'Indefinite / Pending Hearing' },
                            { label: 'Disciplinary Status', value: 'Active Suspension' },
                          ],
                        }),
                    });
                  }

                  // Suspensions from history log entries
                  userCustomLogs
                    .filter((cl) => cl.category === 'Disciplinary Suspension' || cl.title?.toLowerCase().includes('suspension'))
                    .forEach((cl) => {
                      items.push({
                        id: `susp-log-${cl.id}`,
                        type: 'suspension',
                        badge: 'Suspension Log',
                        badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                        title: cl.title,
                        date: cl.startDate && cl.endDate ? `${cl.startDate} to ${cl.endDate}` : cl.date || 'Suspension Record',
                        description: cl.notes,
                        details: [
                          { label: 'Event', value: cl.title },
                          { label: 'Date Logged', value: cl.date },
                          { label: 'Effective Range', value: cl.startDate ? `${cl.startDate} to ${cl.endDate || 'Indefinite'}` : cl.date },
                          { label: 'Financial Penalty', value: cl.penaltyApplied || 'None (Pardoned)' },
                          { label: 'Authorized By', value: cl.authorizedBy || 'HR Management' },
                        ],
                        printAction: () =>
                          setSelectedDocPreview({
                            title: `Disciplinary Suspension Record - ${staffLogUser.name}`,
                            category: 'SUSPENSION LOG',
                            employeeName: staffLogUser.name,
                            employeeId: staffLogUser.employeeId,
                            department: staffLogUser.department,
                            startDate: cl.startDate || cl.date,
                            reason: cl.notes || cl.reason || 'Disciplinary suspension record.',
                            details: [
                              { label: 'Action Title', value: cl.title },
                              { label: 'Timeframe', value: cl.startDate ? `${cl.startDate} to ${cl.endDate || 'Indefinite'}` : cl.date },
                              { label: 'Penalty Status', value: cl.penaltyApplied || 'Pardoned (No fine)' },
                              { label: 'Authorized By', value: cl.authorizedBy || 'HR Management' },
                            ],
                          }),
                      });
                    });
                }

                // 4. Custom HR Logs
                if (historyFilter === 'all' || historyFilter === 'records') {
                  userCustomLogs
                    .filter((cl) => cl.category !== 'Disciplinary Suspension' && !cl.title?.toLowerCase().includes('suspension'))
                    .forEach((cl) => {
                    const isDisciplinary = cl.category.includes('Query') || cl.category.includes('Warning') || cl.category.includes('Policy');
                    const isCommendation = cl.category.includes('Commendation') || cl.category.includes('Award');
                    items.push({
                      id: cl.id,
                      type: 'custom',
                      badge: cl.category,
                      badgeClass: isDisciplinary
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : isCommendation
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
                      title: cl.title,
                      date: cl.date,
                      description: cl.notes,
                      attachmentName: cl.attachmentName,
                      attachmentUrl: cl.attachmentUrl,
                      details: [
                        { label: 'Category', value: cl.category },
                        { label: 'Authorized By', value: cl.authorizedBy || 'HR Admin' },
                      ],
                      printAction: () =>
                        setSelectedDocPreview({
                          title: `${cl.category} Record - ${staffLogUser.name}`,
                          category: cl.category.toUpperCase(),
                          employeeName: staffLogUser.name,
                          employeeId: staffLogUser.employeeId,
                          department: staffLogUser.department,
                          startDate: cl.date,
                          attachmentName: cl.attachmentName,
                          attachmentUrl: cl.attachmentUrl,
                          reason: cl.notes,
                          details: [
                            { label: 'Event Category', value: cl.category },
                            { label: 'Event Title', value: cl.title },
                            { label: 'Authorized By', value: cl.authorizedBy || 'HR Management' },
                          ],
                        }),
                    });
                  });
                }

                // 5. Departure / Exited Record
                if ((historyFilter === 'all' || historyFilter === 'records') && (staffLogUser.status === 'Exited' || staffLogUser.exitDate)) {
                  items.push({
                    id: `departure-${staffLogUser.id}`,
                    type: 'departure',
                    badge: staffLogUser.exitDepartureType || 'Exited Employee',
                    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                    title: `Workforce Departure - ${staffLogUser.exitDepartureType || 'Separation'}`,
                    date: staffLogUser.exitDate ? `Exit Date: ${staffLogUser.exitDate}` : 'Exited Status',
                    description: staffLogUser.exitReason || 'Official workforce separation recorded.',
                    details: [
                      { label: 'Departure Type', value: staffLogUser.exitDepartureType || 'General Exit' },
                      { label: 'Exit Date', value: staffLogUser.exitDate || 'N/A' },
                      { label: 'Departure Notes', value: staffLogUser.exitReason || 'None recorded' },
                      {
                        label: 'Attached Documents',
                        value: staffLogUser.exitDocuments?.length
                          ? `${staffLogUser.exitDocuments.length} file(s) attached`
                          : 'None',
                      },
                    ],
                    exitDocs: staffLogUser.exitDocuments,
                    printAction: () =>
                      setSelectedDocPreview({
                        title: `Employee Separation Record - ${staffLogUser.name}`,
                        category: 'DEPARTURE / EXIT RECORD',
                        employeeName: staffLogUser.name,
                        employeeId: staffLogUser.employeeId,
                        department: staffLogUser.department,
                        startDate: staffLogUser.exitDate || new Date().toISOString().split('T')[0],
                        reason: staffLogUser.exitReason || staffLogUser.exitDepartureType || 'Workforce departure record.',
                        details: [
                          { label: 'Departure Type', value: staffLogUser.exitDepartureType || 'General Exit' },
                          { label: 'Exit Date', value: staffLogUser.exitDate || 'N/A' },
                          { label: 'Departure Notes', value: staffLogUser.exitReason || 'None recorded' },
                          {
                            label: 'Documentation Status',
                            value: staffLogUser.exitDocuments?.length
                              ? `${staffLogUser.exitDocuments.length} document(s) filed`
                              : 'No external attachments',
                          },
                        ],
                      }),
                  });
                }

                // 6. Onboarding / Registration
                if (historyFilter === 'all' || historyFilter === 'records') {
                  items.push({
                    id: `onboard-${staffLogUser.id}`,
                    type: 'onboarding',
                    badge: 'Employee Registration',
                    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                    title: 'Onboarded & Registered in System',
                    date: staffLogUser.joinDate || 'Official Join Date',
                    description: `Registered in ${staffLogUser.department} as ${staffLogUser.role}. Base Pay Grade: ${staffLogUser.payGrade || 'Standard'}. Start date: ${staffLogUser.joinDate || 'Not specified'}. ${staffLogUser.homeAddress ? `Address: ${staffLogUser.homeAddress}.` : ''} ${staffLogUser.guarantorName ? `Guarantor: ${staffLogUser.guarantorName} (${staffLogUser.guarantorRelationship || 'Sponsor'}).` : ''}`,
                    details: [
                      { label: 'Start / Join Date', value: staffLogUser.joinDate || 'N/A' },
                      { label: 'Date of Birth', value: staffLogUser.dob || 'N/A' },
                      { label: 'Registered Role', value: staffLogUser.role },
                      { label: 'Assigned Department', value: staffLogUser.department },
                      { label: 'Home Address', value: staffLogUser.homeAddress || 'N/A' },
                      { label: 'Guarantor Name', value: staffLogUser.guarantorName || 'N/A' },
                      { label: 'Guarantor Phone', value: staffLogUser.guarantorPhone || 'N/A' },
                      { label: 'Shift', value: staffLogUser.shiftSchedule || 'Morning' },
                    ],
                    printAction: () =>
                      setSelectedDocPreview({
                        title: `Official Employee Onboarding Record - ${staffLogUser.name}`,
                        category: 'ONBOARDING AUDIT RECORD',
                        employeeName: staffLogUser.name,
                        employeeId: staffLogUser.employeeId,
                        department: staffLogUser.department,
                        startDate: staffLogUser.joinDate || 'Registration Date',
                        reason: `Official employment entry and workforce registration record for ${staffLogUser.name} in department ${staffLogUser.department}. Start date: ${staffLogUser.joinDate || 'Not specified'}.`,
                        details: [
                          { label: 'Start Date', value: staffLogUser.joinDate || 'N/A' },
                          { label: 'Date of Birth', value: staffLogUser.dob || 'N/A' },
                          { label: 'Assigned Role', value: staffLogUser.role },
                          { label: 'Department', value: staffLogUser.department },
                          { label: 'Home Address', value: staffLogUser.homeAddress || 'N/A' },
                          { label: 'Guarantor Details', value: staffLogUser.guarantorName ? `${staffLogUser.guarantorName} (${staffLogUser.guarantorRelationship || 'Sponsor'}) - ${staffLogUser.guarantorPhone || ''}` : 'N/A' },
                          { label: 'Shift Roster', value: staffLogUser.shiftSchedule || 'Morning' },
                          { label: 'Status', value: staffLogUser.status },
                        ],
                      }),
                  });
                }

                if (items.length === 0) {
                  return (
                    <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 text-slate-400 text-xs font-mono text-center">
                      No records found under the "{historyFilter}" filter for {staffLogUser.name}.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 font-bold text-white flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${item.badgeClass}`}>
                              {item.badge}
                            </span>
                            <span>{item.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Date / Period: <span className="text-slate-300 font-semibold">{item.date}</span>
                          </div>
                          {item.description && (
                            <div className="text-[11px] text-slate-300 italic leading-relaxed">
                              "{item.description}"
                            </div>
                          )}
                          {item.attachmentName && (
                            <div className="text-[11px] text-blue-400 font-semibold flex items-center gap-1 mt-1">
                              <Paperclip className="w-3.5 h-3.5 text-blue-400" />
                              <span>Attached File: {item.attachmentName}</span>
                            </div>
                          )}
                          {item.exitDocs && item.exitDocs.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Paperclip className="w-3 h-3 text-rose-400" />
                                <span>Attached Departure Files ({item.exitDocs.length}):</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {item.exitDocs.map((doc: any, docIdx: number) => (
                                  <a
                                    key={`${doc.name}-${docIdx}`}
                                    href={doc.data}
                                    download={doc.name}
                                    className="px-2 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-700/80 text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                                    title={`Download ${doc.name}`}
                                  >
                                    <FileText className="w-3 h-3 text-rose-400 shrink-0" />
                                    <span className="truncate max-w-[150px]">{doc.name}</span>
                                    <Download className="w-3 h-3 text-slate-400 shrink-0 ml-0.5" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={item.printAction}
                          className={`px-3.5 py-1.5 rounded-xl text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition shadow-md ${
                            item.type === 'query'
                              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                              : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                          }`}
                        >
                          {item.type === 'query' ? (
                            <>
                              <FileQuestion className="w-3.5 h-3.5 text-amber-100" />
                              <span>Manage / View Query</span>
                            </>
                          ) : (
                            <>
                              <Printer className="w-3.5 h-3.5 text-blue-100" />
                              <span>View & Print Document</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-800">
              <button
                onClick={() => setStaffLogUser(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Key Duties & KPI Performance Appraisal Modal */}
      {isKpiModalOpen && staffLogUser && (() => {
        const { items } = getStaffRoleInfo(staffLogUser);
        const keyItems = items.filter((it) => Boolean(it.isKey));
        const evalItems = allowNormalDuties ? items : keyItems;

        let storedRatings: Record<string, InvolvementLevel> = {};
        try {
          storedRatings = loadCompanyData<Record<string, InvolvementLevel>>(
            STORAGE_KEYS.KPI_RATINGS,
            companyName,
            {}
          );
        } catch (e) {
          console.error(e);
        }

        const handleSetInvolvement = (itemId: string, level: InvolvementLevel) => {
          const todayStr = new Date().toISOString().slice(0, 10);
          if (selectedKpiDate > todayStr) {
            emitGlobalToast('Rating submission for future dates is not allowed.', 'warning');
            return;
          }
          const storageKey = `${staffLogUser.employeeId || staffLogUser.id}_${selectedKpiDate}_${itemId}`;
          const updated = { ...storedRatings, [storageKey]: level };
          try {
            saveCompanyData(STORAGE_KEYS.KPI_RATINGS, updated, companyName);
          } catch (e) {
            console.error(e);
          }
          setKpiRefreshTrigger((prev) => prev + 1);
        };

        const involvementOptions: { label: InvolvementLevel; color: string; activeBg: string }[] = [
          { label: 'Very good', color: 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-950/60', activeBg: 'bg-emerald-600 text-white font-bold' },
          { label: 'Good', color: 'text-teal-300 border-teal-500/30 hover:bg-teal-950/60', activeBg: 'bg-teal-600 text-white font-bold' },
          { label: 'OK', color: 'text-blue-300 border-blue-500/30 hover:bg-blue-950/60', activeBg: 'bg-blue-600 text-white font-bold' },
          { label: 'Bad', color: 'text-amber-300 border-amber-500/30 hover:bg-amber-950/60', activeBg: 'bg-amber-600 text-white font-bold' },
          { label: 'Very Bad', color: 'text-rose-300 border-rose-500/30 hover:bg-rose-950/60', activeBg: 'bg-rose-600 text-white font-bold' },
        ];

        const INVOLVEMENT_MAP: Record<string, number> = {
          'Very good': 100,
          'Good': 80,
          'OK': 60,
          'Bad': 40,
          'Very Bad': 20,
          'Strongly works': 100,
          'Works': 80,
          'Ok': 60,
          'Doesnt work': 40,
          'Strongly doesnt work': 20,
          "Strongly doesn't work": 20,
        };

        const selectedDayScores: number[] = [];
        evalItems.forEach((item) => {
          const itemKey = `${staffLogUser.employeeId || staffLogUser.id}_${selectedKpiDate}_${item.id}`;
          const rating = storedRatings[itemKey];
          if (rating && INVOLVEMENT_MAP[rating] !== undefined) {
            selectedDayScores.push(INVOLVEMENT_MAP[rating]);
          }
        });

        const dailyScore = evalItems.length > 0 && selectedDayScores.length > 0
          ? Math.round(selectedDayScores.reduce((a, b) => a + b, 0) / evalItems.length)
          : null;

        const kpi = getStaffKpiData(staffLogUser, selectedKpiDate);
        const monthlyScore = kpi.averageMonthlyScore;

        const handleTriggerPrint = () => {
          handlePrintKpiEvaluation(
            staffLogUser,
            selectedKpiDate,
            evalItems,
            storedRatings,
            dailyScore,
            monthlyScore
          );
        };

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-5">
            <div className="bg-slate-900 border border-slate-700/80 text-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
              {/* Header with Staff Info (Name, ID, Dept, Role) */}
              <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-900/90">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="p-1.5 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                      <Sliders className="w-4 h-4" />
                    </span>
                    <h3 className="text-base font-bold text-white tracking-wide">
                      Key Duties & KPI Performance Appraisal
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      100% Evaluation Scale
                    </span>
                  </div>

                  {/* Staff Info Grid (Staff Name, ID, Department, Role) */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs text-slate-300 pt-1">
                    <span className="flex items-center gap-1.5 font-bold text-white bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                      <span className="text-[10px] uppercase text-slate-400 font-normal">Staff:</span>
                      {staffLogUser.name}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-teal-300 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                      <span className="text-[10px] uppercase text-slate-400 font-normal">ID:</span>
                      {staffLogUser.employeeId || staffLogUser.id}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-200 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] uppercase text-slate-400 font-normal">Dept:</span>
                      {staffLogUser.department}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-200 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] uppercase text-slate-400 font-normal">Role:</span>
                      {staffLogUser.role}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAllowNormalDuties((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition cursor-pointer ${
                      allowNormalDuties
                        ? 'bg-teal-600/30 text-teal-300 border-teal-500/50 shadow-sm shadow-teal-500/10'
                        : 'bg-slate-800/90 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                    title={allowNormalDuties ? 'Currently allowing all duties (Key & Normal). Click to restrict to Key Duties only.' : 'Click to include normal/routine duties in appraisal.'}
                  >
                    <div className={`w-7 h-4 rounded-full p-0.5 transition-colors ${allowNormalDuties ? 'bg-teal-500' : 'bg-slate-700'}`}>
                      <div className={`w-3 h-3 rounded-full bg-white transition-transform ${allowNormalDuties ? 'translate-x-3' : 'translate-x-0'}`} />
                    </div>
                    <span className="whitespace-nowrap">Allow normal duties</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsKpiModalOpen(false)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Evaluation Controls Bar */}
              <div className="px-4 sm:px-5 py-3 bg-slate-800/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-400" />
                  <label className="text-slate-300 font-semibold">Evaluation Date:</label>
                  <input
                    type="date"
                    value={selectedKpiDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => {
                      const val = e.target.value;
                      const todayStr = new Date().toISOString().slice(0, 10);
                      setSelectedKpiDate(val > todayStr ? todayStr : val);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400">
                    {allowNormalDuties ? 'All Role Duties:' : 'Configured Key Duties:'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    {evalItems.length} {allowNormalDuties ? (evalItems.length === 1 ? 'Duty' : 'Duties') : (evalItems.length === 1 ? 'Key Duty' : 'Key Duties')}
                  </span>
                </div>
              </div>

              {/* Scrollable Key Duties List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                {items.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-800/80 space-y-2 text-amber-200">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span>No Department Job Descriptions Configured</span>
                    </div>
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      No active job descriptions were found for role <strong>"{staffLogUser.role}"</strong> in department <strong>"{staffLogUser.department}"</strong>.
                      Please open the <strong>Departments</strong> tab, edit role <strong>"{staffLogUser.role}"</strong> in <strong>{staffLogUser.department}</strong>, and define key duties to enable KPI ratings.
                    </p>
                  </div>
                ) : evalItems.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-slate-800/70 border border-slate-700 space-y-2 text-slate-300">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-400">
                      <AlertCircle className="w-4 h-4 text-teal-400" />
                      <span>No Duties Marked as "Key Duties"</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      None of the {items.length} duties for role <strong>"{staffLogUser.role}"</strong> are currently marked as Key Duties in the Roles tab. By default, only duties marked as key are displayed.
                    </p>
                    <div className="pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAllowNormalDuties(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition cursor-pointer"
                      >
                        Enable "Allow normal duties" to evaluate all {items.length} duties
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {evalItems.map((item, idx) => {
                      const itemStorageKey = `${staffLogUser.employeeId || staffLogUser.id}_${selectedKpiDate}_${item.id}`;
                      const currentRating = storedRatings[itemStorageKey] || '';

                      // Calculate historical average rating across all recorded dates for this staff member
                      const staffPrefix = `${staffLogUser.employeeId || staffLogUser.id}_`;
                      let itemSum = 0;
                      let itemDaysCount = 0;

                      Object.entries(storedRatings).forEach(([key, lvl]) => {
                        if (key.startsWith(staffPrefix) && key.endsWith(`_${item.id}`)) {
                          if (INVOLVEMENT_MAP[lvl] !== undefined) {
                            itemSum += INVOLVEMENT_MAP[lvl];
                            itemDaysCount += 1;
                          }
                        }
                      });

                      const itemAverage = itemDaysCount > 0 ? Math.round(itemSum / itemDaysCount) : null;

                      return (
                        <div key={item.id || idx} className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/70 space-y-2.5 hover:border-slate-600 transition">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold text-slate-200">
                            <span className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>
                              <span className="leading-snug">{item.text}</span>
                            </span>

                            <div className="flex items-center gap-2 shrink-0">
                              {itemAverage !== null ? (
                                <span
                                  className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1.5 ${
                                    itemAverage >= 80
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                      : itemAverage >= 60
                                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                      : itemAverage >= 40
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  }`}
                                  title={`Average rating across ${itemDaysCount} measured day(s) for this key duty`}
                                >
                                  <span>Hist. Avg: {itemAverage}%</span>
                                  {itemAverage < 40 && (
                                    <span className="text-[9px] font-sans font-extrabold text-rose-300 bg-rose-950/80 px-1.5 py-0.2 rounded border border-rose-700/60">
                                      Warning
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                                  Hist. Avg: Not Measured
                                </span>
                              )}

                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                                  item.isKey
                                    ? 'text-amber-400 bg-amber-950/60 border-amber-800'
                                    : 'text-slate-400 bg-slate-900 border-slate-700'
                                }`}
                              >
                                {item.isKey ? 'Key Duty' : 'Normal Duty'}
                              </span>
                            </div>
                          </div>

                          {/* 5-Level Rating Buttons */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
                            {involvementOptions.map((opt) => {
                              const isSelected = currentRating === opt.label;
                              return (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() => handleSetInvolvement(item.id, opt.label)}
                                  className={`px-2 py-2 rounded-xl text-[11px] font-semibold border transition cursor-pointer text-center ${
                                    isSelected
                                      ? opt.activeBg
                                      : `${opt.color} bg-slate-900/60`
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom: Appraisal Results & Final Actions */}
              <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Daily Result */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Day Appraisal Result ({selectedKpiDate})
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-mono font-bold text-white">
                        {dailyScore !== null ? `${dailyScore}%` : 'Pending Input'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        dailyScore === null
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : dailyScore >= 90
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : dailyScore >= 75
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                          : dailyScore >= 60
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}>
                        {dailyScore === null
                          ? 'Not Rated'
                          : dailyScore >= 90
                          ? 'Outstanding'
                          : dailyScore >= 75
                          ? 'Proficient'
                          : dailyScore >= 60
                          ? 'Satisfactory'
                          : 'Needs Improvement'}
                      </span>
                    </div>
                  </div>

                  {/* Monthly Overall Average */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Overall Monthly Average
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-mono font-bold text-teal-300">
                        {monthlyScore !== null && monthlyScore !== undefined ? `${monthlyScore}%` : 'Not Measured'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        Historical KPI
                      </span>
                    </div>
                  </div>

                  {/* Evaluation Summary */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Appraisal Status
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">
                        {dailyScore !== null
                          ? `${selectedDayScores.length} of ${evalItems.length} Duties Appraised`
                          : 'Awaiting Daily Ratings'}
                      </span>
                      {dailyScore !== null && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={handleTriggerPrint}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-teal-600/30 transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print KPI Evaluation Sheet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsKpiModalOpen(false)}
                    className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Document Preview Modal */}
      {selectedDocPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-blue-400" />
                <span>{selectedDocPreview.title || 'Staff Leave Proof Document'}</span>
              </h3>
              <button
                onClick={() => setSelectedDocPreview(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Employee:</span>
                  <span className="font-bold text-white">{selectedDocPreview.employeeName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Employee ID:</span>
                  <span className="font-mono text-teal-400 font-bold">{selectedDocPreview.employeeId || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Department:</span>
                  <span className="text-slate-200">{selectedDocPreview.department || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Leave Type:</span>
                  <span className="text-teal-300 font-semibold">{selectedDocPreview.leaveType || 'Leave'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">Document File Name:</span>
                <span className="font-mono text-blue-400 font-semibold">
                  {selectedDocPreview.attachmentName}
                </span>
              </div>

              {selectedDocPreview.reason && (
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Reason / Notes:</span>
                  <p className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 italic">
                    "{selectedDocPreview.reason}"
                  </p>
                </div>
              )}

              {selectedDocPreview.attachmentUrl ? (
                <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center space-y-3">
                  {selectedDocPreview.attachmentUrl.startsWith('data:image') ? (
                    <img
                      src={selectedDocPreview.attachmentUrl}
                      alt="Proof Attachment"
                      className="max-h-56 rounded-xl object-contain border border-slate-700"
                    />
                  ) : (
                    <div className="text-center py-4">
                      <FileText className="w-10 h-10 text-blue-400 mx-auto" />
                      <span className="text-xs font-semibold text-slate-200 block mt-2">
                        {selectedDocPreview.attachmentName}
                      </span>
                    </div>
                  )}
                  <a
                    href={selectedDocPreview.attachmentUrl}
                    download={selectedDocPreview.attachmentName}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition shadow-md shadow-blue-600/30"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Document File
                  </a>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-800 text-center space-y-1">
                  <FileText className="w-8 h-8 text-blue-400 mx-auto opacity-70" />
                  <p className="font-semibold text-slate-200">File Reference Registered</p>
                  <p className="text-[11px] text-slate-400">
                    This leave record was logged with proof file: "{selectedDocPreview.attachmentName}".
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-800">
              <button
                type="button"
                onClick={() => handlePrintDocument(selectedDocPreview)}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-teal-600/30 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document & Record</span>
              </button>
              <button
                onClick={() => setSelectedDocPreview(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Staff Modal */}
      <ConfirmDeleteModal
        isOpen={!!staffToDelete}
        title="Delete Staff Member Record"
        itemName={staffToDelete ? `${staffToDelete.name} (${staffToDelete.employeeId || 'ID N/A'})` : ''}
        message="Are you sure you want to permanently delete this staff member from the system?"
        subMessage="This will erase all personal details, employment logs, and historical performance records associated with this employee."
        confirmButtonText="Yes, Delete Staff Member"
        onConfirm={() => {
          if (staffToDelete) {
            handleDeleteStaff(staffToDelete.id);
            setStaffToDelete(null);
          }
        }}
        onClose={() => setStaffToDelete(null)}
        isLight={isLight}
      />

      {/* Staff Official Document Modal (JD, Confirmation Letter, Appointment Letter) */}
      {confirmationStaff && (
        <StaffDocumentModal
          isOpen={true}
          staff={confirmationStaff}
          settings={settings}
          isNewStaffPrompt={isNewStaffPrompt}
          initialTab={documentModalInitialTab}
          onClose={() => {
            setConfirmationStaff(null);
            setIsNewStaffPrompt(false);
          }}
          onFinish={() => {
            setConfirmationStaff(null);
            setIsNewStaffPrompt(false);
          }}
        />
      )}

      {/* Edit Suspension Dates & Details Modal */}
      <EditSuspensionModal
        isOpen={!!editingSuspensionStaff}
        staff={editingSuspensionStaff}
        onClose={() => setEditingSuspensionStaff(null)}
        onSave={handleSaveSuspension}
        onUnsuspend={handleUnsuspendStaff}
        isLight={isLight}
        companyName={companyName}
        currentUserName={currentUserName}
      />

      {/* Suspension History & Audit Log Modal */}
      <SuspensionHistoryModal
        isOpen={isSuspensionHistoryOpen}
        onClose={() => setIsSuspensionHistoryOpen(false)}
        staffList={staffList}
        companyName={companyName}
        currentUser={user}
        canManage={isAdmin || user?.role === 'Manager' || user?.role === 'HR' || user?.role === 'Officer' || true}
        onRecordsUpdated={(updatedStaff) => {
          if (updatedStaff && onUpdateStaffList) {
            onUpdateStaffList(updatedStaff);
          } else if (onUpdateStaffList) {
            const updated = loadCompanyData<StaffMember[]>(STORAGE_KEYS.STAFF, companyName, staffList);
            onUpdateStaffList(updated);
          }
        }}
        onSelectStaff={(staff) => {
          setIsSuspensionHistoryOpen(false);
          setStaffLogUser(staff);
          setStaffLogProfileTab('personnel');
        }}
      />

      {/* Track Applicants & ATS Onboarding Modal */}
      <TrackApplicantsModal
        isOpen={isTrackApplicantsOpen}
        onClose={() => setIsTrackApplicantsOpen(false)}
        staffList={staffList}
        onUpdateStaffList={onUpdateStaffList}
        departments={departments}
        dbDepartments={dbDepartmentsData}
        companyName={companyName}
        isLight={isLight}
        settings={settings}
        onDirectAddEmployee={handleOpenAddModal}
        onOpenConfirmationLetter={(staff) => {
          setConfirmationStaff(staff);
          setDocumentModalInitialTab('confirmation');
          setIsNewStaffPrompt(true);
        }}
        onOpenJobDescription={(staff) => {
          setConfirmationStaff(staff);
          setDocumentModalInitialTab('jd');
          setIsNewStaffPrompt(true);
        }}
      />

      {/* Staff Welfare Workspace Modal */}
      <StaffWelfareWorkspaceModal
        isOpen={isWelfareWorkspaceOpen}
        onClose={() => setIsWelfareWorkspaceOpen(false)}
        staffList={staffList}
        companyName={companyName}
        isLight={isLight}
        dbDepartments={dbDepartmentsData}
      />

      {/* Disciplinary Query Management Modal */}
      {manageQueryStaff && (
        <ManageQueryModal
          isOpen={isManageQueryOpen}
          onClose={() => {
            setIsManageQueryOpen(false);
            setManageQueryStaff(null);
            setSelectedQueryForModal(undefined);
          }}
          staff={manageQueryStaff}
          companyName={companyName}
          currentUser={user}
          settings={settings}
          isLight={isLight}
          initialQueryId={selectedQueryForModal}
          onStaffUpdated={(updatedStaff) => {
            if (onUpdateStaffList) {
              const updatedList = staffList.map((s) => (s.id === updatedStaff.id ? updatedStaff : s));
              onUpdateStaffList(updatedList);
            }
            setManageQueryStaff(updatedStaff);
            if (staffLogUser && staffLogUser.id === updatedStaff.id) {
              setStaffLogUser(updatedStaff);
            }
          }}
        />
      )}
    </div>
  );
};
