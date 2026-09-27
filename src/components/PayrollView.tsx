import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Settings,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Download,
  Printer,
  Shield,
  FileText,
  Percent,
  Coins,
  Building,
  Building2,
  RefreshCw,
  Search,
  X,
  Lock,
  Calendar,
  Clock,
  ArrowLeft,
  Sliders,
  Zap,
  RotateCcw,
  ArrowUpDown,
  Filter,
  Layers,
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  AppSettings,
  BookedPenalty,
  ManualDeductionRule,
  PayFrequencyType,
  PayGradeTier,
  PayrollBonus,
  PayrollConfig,
  PayrollDeduction,
  PayrollRollRules,
  PayrollRunRecord,
  ProjectFile,
  StaffMember,
  User,
} from '../types';
import {
  calculateStaffPayroll,
  calculateStaffActiveSuspensionDeduction,
  DEFAULT_PAYROLL_CONFIG,
  DEFAULT_ROLL_RULES,
  deriveStaffPayGrade,
  GLOBAL_CURRENCY_OPTIONS,
  loadCompanyPayrollConfig,
  saveCompanyPayrollConfig,
  settlePenaltiesList,
  StaffPayrollCalculation,
} from '../utils/payrollUtils';
import { STORAGE_KEYS, saveCompanyData, loadCompanyData } from '../utils/companyStorage';
import { CorporateDeductionsSection } from './payroll/CorporateDeductionsSection';
import { CorporateDeductionModal } from './payroll/CorporateDeductionModal';
import { DefaultDeductionsSection } from './payroll/DefaultDeductionsSection';
import { DefaultAllowancesSection } from './payroll/DefaultAllowancesSection';
import { StaffWelfareWorkspaceModal } from './StaffWelfareWorkspaceModal';
import { ManualDeductionsAndPenaltiesSection } from './payroll/ManualDeductionsAndPenaltiesSection';
import { PenalizeStaffModal } from './payroll/PenalizeStaffModal';
import { ManualDeductionRuleModal } from './payroll/ManualDeductionRuleModal';
import { ExecuteRollModal } from './payroll/ExecuteRollModal';
import { BiWeeklyDatePicker } from './payroll/BiWeeklyDatePicker';
import { BookingTab } from './payroll/BookingTab';
import { ExportPayrollModal } from './payroll/ExportPayrollModal';
import { DebitAccountSection } from './payroll/DebitAccountSection';
import { BankTransfersModal } from './payroll/BankTransfersModal';
import { emitGlobalToast } from '../context/ToastContext';

export type PayrollSortField =
  | 'name'
  | 'employeeId'
  | 'department'
  | 'role'
  | 'payGrade'
  | 'payFrequency'
  | 'baseSalary'
  | 'totalDeductions'
  | 'totalBonuses'
  | 'netSalary';

export interface PayrollSortRule {
  id: string;
  field: PayrollSortField;
  direction: 'asc' | 'desc';
}

interface PayrollViewProps {
  staffList: StaffMember[];
  isLight?: boolean;
  settings?: AppSettings;
  user?: User | null;
  onBack?: () => void;
  onUpdateStaffList?: (updated: StaffMember[]) => void;
  onUpdateSettings?: (newSettings: AppSettings) => void;
}

export const PayrollView: React.FC<PayrollViewProps> = ({
  staffList,
  isLight = false,
  settings,
  user,
  onBack,
  onUpdateStaffList,
}) => {
  const companyName = settings?.companyName || '';
  const [config, setConfig] = useState<PayrollConfig>(() =>
    loadCompanyPayrollConfig(companyName)
  );

  const [activeSubTab, setActiveSubTab] = useState<
    'booking' | 'deductions' | 'bonuses' | 'currency_bank' | 'general_settings' | 'config'
  >('booking');

  const [rollCalculations, setRollCalculations] = useState<StaffPayrollCalculation[]>([]);

  // Safe In-App Delete Confirmation Modal State (replaces blocking confirm())
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [selectedPayslipStaff, setSelectedPayslipStaff] = useState<StaffPayrollCalculation | null>(
    null
  );
  const [isExportPayrollModalOpen, setIsExportPayrollModalOpen] = useState(false);

  // Modal states for creating/editing pay grades, deductions, bonuses
  const [editingGrade, setEditingGrade] = useState<PayGradeTier | null>(null);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [gradeForm, setGradeForm] = useState<Omit<PayGradeTier, 'id'>>({
    name: '',
    minSalary: 1000,
    maxSalary: 5000,
    defaultFrequency: 'Monthly',
    description: '',
    allowedBonusIds: undefined,
    allowedDeductionIds: undefined,
  });

  const [isWelfareModalOpen, setIsWelfareModalOpen] = useState(false);

  const [editingDeduction, setEditingDeduction] = useState<PayrollDeduction | null>(null);
  const [isDeductionModalOpen, setIsDeductionModalOpen] = useState(false);
  const [deductionForm, setDeductionForm] = useState<Omit<PayrollDeduction, 'id'>>({
    name: '',
    type: 'percentage',
    value: 5,
    applicableTo: 'All',
    applicableDepartments: ['All'],
    isEnabled: true,
    description: '',
  });

  const [editingBonus, setEditingBonus] = useState<PayrollBonus | null>(null);
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [bonusForm, setBonusForm] = useState<Omit<PayrollBonus, 'id'>>({
    name: '',
    type: 'fixed',
    value: 50,
    applicableTo: 'All',
    isEnabled: true,
    description: '',
    isDefault: false,
    category: 'custom',
    disbursementType: 'payroll',
  });

  // Manual Deductions & Penalty Booking Modal States
  const [editingManualRule, setEditingManualRule] = useState<ManualDeductionRule | null>(null);
  const [isManualRuleModalOpen, setIsManualRuleModalOpen] = useState(false);

  const [isPenalizeModalOpen, setIsPenalizeModalOpen] = useState(false);
  const [penalizeInitialStaff, setPenalizeInitialStaff] = useState<StaffMember | undefined>(undefined);
  const [penalizeInitialRule, setPenalizeInitialRule] = useState<ManualDeductionRule | undefined>(undefined);

  const [isExecuteRollModalOpen, setIsExecuteRollModalOpen] = useState(false);
  const [rollTargetFrequency, setRollTargetFrequency] = useState<string | undefined>(undefined);
  const [isBankTransfersModalOpen, setIsBankTransfersModalOpen] = useState(false);
  const [highlightDebitAccount, setHighlightDebitAccount] = useState(false);

  const [currencySearch, setCurrencySearch] = useState('');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Smooth scroll and highlight navigation to Debit Account Setup
  const handleNavigateToDebitAccountConfig = () => {
    setActiveSubTab('currency_bank');
    setHighlightDebitAccount(true);
    setTimeout(() => {
      const el = document.getElementById('debit-account-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
    setTimeout(() => {
      setHighlightDebitAccount(false);
    }, 3500);
  };

  // Reload config if companyName changes
  useEffect(() => {
    const loaded = loadCompanyPayrollConfig(companyName);
    setConfig(loaded);
  }, [companyName]);

  const handleSaveConfig = (newConfig: PayrollConfig, msg = 'Payroll settings saved') => {
    setConfig(newConfig);
    saveCompanyPayrollConfig(newConfig, companyName);
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
    emitGlobalToast(msg, 'success');
  };

  const handleMarkRunAsCompleted = () => {
    const todayStr = new Date().toISOString();
    const newRunRecord: PayrollRunRecord = {
      id: `RUN-${Date.now().toString(36).toUpperCase()}`,
      executedAt: config.lastRolledAt || todayStr,
      completedAt: todayStr,
      status: 'Completed',
      cycleDate: todayStr.split('T')[0],
      frequency: rollTargetFrequency || 'All',
      staffCount: activeStaff.length,
      totalGross: metrics.grossTotal,
      totalAllowances: metrics.bonusesTotal,
      totalDeductions: metrics.deductionsTotal,
      totalNet: metrics.netTotal,
    };
    const updatedRecentRuns = [newRunRecord, ...(config.recentRuns || [])].slice(0, 20);
    handleSaveConfig(
      {
        ...config,
        recentRuns: updatedRecentRuns,
      },
      'Payroll run cycle marked as Completed and archived successfully!'
    );
  };

  const isTechnicalUser = user?.role === 'Technical';
  const isAssistantUser = user?.role === 'Assistant';
  const canEditPayroll = user?.role === 'Admin' || user?.role === 'Manager';

  // Active Staff Calculations
  const activeStaff = useMemo(() => {
    return staffList.filter((s) => s.status !== 'Exited');
  }, [staffList]);

  const projects = useMemo(() => {
    return loadCompanyData<ProjectFile[]>(STORAGE_KEYS.PROJECTS, companyName, []);
  }, [companyName]);

  const payrollCalculations = useMemo(() => {
    return activeStaff.map((staff) => calculateStaffPayroll(staff, config, null, companyName, projects));
  }, [activeStaff, config, companyName, projects]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let grossTotal = 0;
    let deductionsTotal = 0;
    let bonusesTotal = 0;
    let netTotal = 0;

    payrollCalculations.forEach((c) => {
      grossTotal += c.baseSalary;
      deductionsTotal += c.totalDeductions;
      bonusesTotal += c.totalBonuses;
      netTotal += c.netSalary;
    });

    return {
      grossTotal,
      deductionsTotal,
      bonusesTotal,
      netTotal,
      staffCount: activeStaff.length,
    };
  }, [payrollCalculations, activeStaff]);

  // Filter Options Lists
  const departments = useMemo(() => {
    const depts = new Set<string>();
    activeStaff.forEach((s) => {
      if (s.department) depts.add(s.department.trim());
    });
    return ['All', ...Array.from(depts).sort()];
  }, [activeStaff]);

  // Handlers for Pay Grades
  const handleOpenNewGrade = () => {
    setEditingGrade(null);
    setGradeForm({
      name: '',
      minSalary: 1500,
      maxSalary: 4500,
      defaultFrequency: 'Monthly',
      description: '',
      allowedBonusIds: config.bonuses.map((b) => b.id),
      allowedDeductionIds: config.deductions.map((d) => d.id),
    });
    setIsGradeModalOpen(true);
  };

  const handleEditGrade = (grade: PayGradeTier) => {
    setEditingGrade(grade);
    setGradeForm({
      name: grade.name,
      minSalary: grade.minSalary,
      maxSalary: grade.maxSalary,
      defaultFrequency: grade.defaultFrequency || 'Monthly',
      description: grade.description || '',
      allowedBonusIds: grade.allowedBonusIds ?? config.bonuses.map((b) => b.id),
      allowedDeductionIds: grade.allowedDeductionIds ?? config.deductions.map((d) => d.id),
    });
    setIsGradeModalOpen(true);
  };

  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeForm.name.trim()) return;

    let updatedGrades: PayGradeTier[];
    if (editingGrade) {
      updatedGrades = config.payGrades.map((g) =>
        g.id === editingGrade.id ? { ...g, ...gradeForm } : g
      );
    } else {
      const newGrade: PayGradeTier = {
        id: `pg-${Date.now()}`,
        ...gradeForm,
      };
      updatedGrades = [...config.payGrades, newGrade];
    }

    handleSaveConfig({ ...config, payGrades: updatedGrades }, 'Pay Grade tier & mappings updated');
    setIsGradeModalOpen(false);
  };

  const handleDeleteGrade = (id: string) => {
    if (config.payGrades.length <= 1) {
      setSaveToast('At least one Pay Grade must remain configured.');
      setTimeout(() => setSaveToast(null), 3000);
      return;
    }
    const grade = config.payGrades.find((g) => g.id === id);
    setDeleteModalState({
      isOpen: true,
      title: 'Delete Pay Grade Tier',
      message: `Are you sure you want to delete "${grade?.name || 'this pay grade'}"? Staff assigned to this grade will retain their base compensation.`,
      onConfirm: () => {
        const updated = config.payGrades.filter((g) => g.id !== id);
        handleSaveConfig({ ...config, payGrades: updated }, 'Pay Grade deleted');
        setDeleteModalState(null);
      },
    });
  };

  // Handlers for Deductions
  const handleOpenNewDeduction = () => {
    setEditingDeduction(null);
    setDeductionForm({
      name: '',
      type: 'percentage',
      value: 5,
      applicableTo: 'All',
      applicableDepartments: ['All'],
      isEnabled: true,
      description: '',
    });
    setIsDeductionModalOpen(true);
  };

  const handleEditDeduction = (ded: PayrollDeduction) => {
    setEditingDeduction(ded);
    const initialDepts = ded.applicableDepartments && ded.applicableDepartments.length > 0
      ? ded.applicableDepartments
      : (ded.applicableTo && ded.applicableTo !== 'All' ? [ded.applicableTo] : ['All']);

    setDeductionForm({
      name: ded.name,
      type: ded.type,
      value: ded.value,
      applicableTo: ded.applicableTo || 'All',
      applicableDepartments: initialDepts,
      isEnabled: ded.isEnabled,
      description: ded.description || '',
    });
    setIsDeductionModalOpen(true);
  };

  const handleSaveCorporateDeduction = (dedData: Omit<PayrollDeduction, 'id'>) => {
    let updatedDeductions: PayrollDeduction[];
    if (editingDeduction) {
      updatedDeductions = config.deductions.map((d) =>
        d.id === editingDeduction.id ? { ...d, ...dedData } : d
      );
    } else {
      const newDed: PayrollDeduction = {
        id: `ded-${Date.now()}`,
        ...dedData,
      };
      updatedDeductions = [...config.deductions, newDed];
    }

    handleSaveConfig({ ...config, deductions: updatedDeductions }, 'Corporate deduction updated');
    setIsDeductionModalOpen(false);
  };

  const handleToggleDeduction = (id: string) => {
    const updated = config.deductions.map((d) =>
      d.id === id ? { ...d, isEnabled: !d.isEnabled } : d
    );
    handleSaveConfig({ ...config, deductions: updated }, 'Deduction status updated');
  };

  const handleDeleteDeduction = (id: string) => {
    const ded = config.deductions.find((d) => d.id !== id);
    setDeleteModalState({
      isOpen: true,
      title: 'Delete Deduction Rule',
      message: `Are you sure you want to delete "${ded?.name || 'this deduction rule'}"? It will no longer apply to staff calculations.`,
      onConfirm: () => {
        const updated = config.deductions.filter((d) => d.id !== id);
        handleSaveConfig({ ...config, deductions: updated }, 'Deduction rule deleted');
        setDeleteModalState(null);
      },
    });
  };

  // Handlers for Bonuses / Allowances
  const handleOpenNewBonus = () => {
    setEditingBonus(null);
    setBonusForm({
      name: '',
      type: 'fixed',
      value: 50,
      applicableTo: 'All',
      isEnabled: true,
      description: '',
      isDefault: false,
      category: 'custom',
      disbursementType: 'payroll',
    });
    setIsBonusModalOpen(true);
  };

  const handleEditBonus = (bonus: PayrollBonus) => {
    setEditingBonus(bonus);
    setBonusForm({
      name: bonus.name,
      type: bonus.type,
      value: bonus.value,
      applicableTo: bonus.applicableTo,
      isEnabled: bonus.isEnabled,
      description: bonus.description || '',
      isDefault: bonus.isDefault || false,
      category: bonus.category || 'custom',
      disbursementType: bonus.disbursementType || 'payroll',
    });
    setIsBonusModalOpen(true);
  };

  const handleSaveBonus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonusForm.name.trim()) return;

    let updatedBonuses: PayrollBonus[];
    if (editingBonus) {
      updatedBonuses = config.bonuses.map((b) =>
        b.id === editingBonus.id ? { ...b, ...bonusForm } : b
      );
    } else {
      const newBon: PayrollBonus = {
        id: `bon-${Date.now()}`,
        ...bonusForm,
      };
      updatedBonuses = [...config.bonuses, newBon];
    }

    handleSaveConfig({ ...config, bonuses: updatedBonuses }, 'Allowance configuration updated');
    setIsBonusModalOpen(false);
  };

  const handleToggleBonus = (id: string) => {
    const updated = config.bonuses.map((b) =>
      b.id === id ? { ...b, isEnabled: !b.isEnabled } : b
    );
    handleSaveConfig({ ...config, bonuses: updated }, 'Bonus status updated');
  };

  const handleDeleteBonus = (id: string) => {
    const bon = config.bonuses.find((b) => b.id !== id);
    setDeleteModalState({
      isOpen: true,
      title: 'Delete Bonus Incentive',
      message: `Are you sure you want to delete "${bon?.name || 'this bonus rule'}"?`,
      onConfirm: () => {
        const updated = config.bonuses.filter((b) => b.id !== id);
        handleSaveConfig({ ...config, bonuses: updated }, 'Bonus rule deleted');
        setDeleteModalState(null);
      },
    });
  };

  // Handlers for Manual Deduction Rule Templates
  const handleOpenNewManualRule = () => {
    setEditingManualRule(null);
    setIsManualRuleModalOpen(true);
  };

  const handleEditManualRule = (rule: ManualDeductionRule) => {
    setEditingManualRule(rule);
    setIsManualRuleModalOpen(true);
  };

  const handleDeleteManualRule = (id: string) => {
    const rule = (config.manualDeductionRules || []).find((r) => r.id !== id);
    setDeleteModalState({
      isOpen: true,
      title: 'Delete Penalty Template',
      message: `Are you sure you want to delete this penalty template? Past incurred instances will remain intact.`,
      onConfirm: () => {
        const updated = (config.manualDeductionRules || []).filter((r) => r.id !== id);
        handleSaveConfig({ ...config, manualDeductionRules: updated }, 'Deduction rule template deleted');
        setDeleteModalState(null);
      },
    });
  };

  const handleSaveManualRule = (ruleData: Omit<ManualDeductionRule, 'id'>) => {
    let updatedRules: ManualDeductionRule[];
    const currentRules = config.manualDeductionRules || [];
    if (editingManualRule) {
      updatedRules = currentRules.map((r) =>
        r.id === editingManualRule.id ? { ...r, ...ruleData } : r
      );
    } else {
      const newRule: ManualDeductionRule = {
        id: `mdr-${Date.now()}`,
        ...ruleData,
      };
      updatedRules = [...currentRules, newRule];
    }
    handleSaveConfig({ ...config, manualDeductionRules: updatedRules }, 'Manual deduction template saved');
    setIsManualRuleModalOpen(false);
  };

  // Handlers for Incurred Penalties
  const handleOpenPenalizeModal = (presetStaff?: StaffMember, presetRule?: ManualDeductionRule) => {
    setPenalizeInitialStaff(presetStaff);
    setPenalizeInitialRule(presetRule);
    setIsPenalizeModalOpen(true);
  };

  const handleConfirmPenalty = (penaltyData: Omit<BookedPenalty, 'id'>) => {
    const existingIndex = (config.bookedPenalties || []).findIndex(
      (p) =>
        p.status === 'Active' &&
        (p.staffId === penaltyData.staffId || (p.employeeId && p.employeeId === penaltyData.employeeId)) &&
        ((p.penaltyRuleId && p.penaltyRuleId === penaltyData.penaltyRuleId) ||
          (p.ruleId && p.ruleId === penaltyData.ruleId) ||
          (p.ruleName && penaltyData.ruleName && p.ruleName.trim().toLowerCase() === penaltyData.ruleName.trim().toLowerCase()))
    );

    if (existingIndex >= 0) {
      const existing = (config.bookedPenalties || [])[existingIndex];
      const existingMultiplier = existing.multiplier || 1;
      const addMultiplier = penaltyData.multiplier || 1;
      const combinedMultiplier = existingMultiplier + addMultiplier;
      const baseUnit = existing.baseValue ?? penaltyData.baseValue ?? (existing.type === 'percentage' ? existing.value : existing.value / existingMultiplier);
      const combinedTotal = baseUnit * combinedMultiplier;

      const updated = [...(config.bookedPenalties || [])];
      updated[existingIndex] = {
        ...existing,
        multiplier: combinedMultiplier,
        baseValue: baseUnit,
        value: combinedTotal,
        amount: combinedTotal,
        calculatedAmount: combinedTotal,
        reason: existing.reason.includes(penaltyData.reason)
          ? existing.reason
          : `${existing.reason}; ${penaltyData.reason}`,
        incurredDate: penaltyData.incurredDate || existing.incurredDate,
      };

      handleSaveConfig(
        { ...config, bookedPenalties: updated },
        `Added ${addMultiplier}x to ${penaltyData.staffName}'s penalty (now ${combinedMultiplier} times fined)`
      );
    } else {
      const newPenalty: BookedPenalty = {
        id: `pen-${Date.now()}`,
        ...penaltyData,
      };
      const updated = [newPenalty, ...(config.bookedPenalties || [])];
      handleSaveConfig({ ...config, bookedPenalties: updated }, `Penalty booked for ${penaltyData.staffName}`);
    }
  };

  const handleSettlePenalty = (penaltyId: string) => {
    const updated = (config.bookedPenalties || []).map((p) =>
      p.id === penaltyId ? { ...p, status: 'Settled' as const } : p
    );
    handleSaveConfig({ ...config, bookedPenalties: updated }, 'Penalty marked as Settled');
  };

  const handleRevokePenalty = (penaltyId: string) => {
    const penalty = (config.bookedPenalties || []).find((p) => p.id === penaltyId);
    setDeleteModalState({
      isOpen: true,
      title: 'Revoke and Delete Penalty',
      message: `Are you sure you want to revoke this penalty of ${config.currencySymbol}${penalty?.amount} for ${penalty?.staffName}?`,
      onConfirm: () => {
        const updated = (config.bookedPenalties || []).filter((p) => p.id !== penaltyId);
        handleSaveConfig({ ...config, bookedPenalties: updated }, 'Penalty removed');
        setDeleteModalState(null);
      },
    });
  };

  const handleExecuteRollAndSettle = (
    targetFrequency?: string,
    activeCalculations?: StaffPayrollCalculation[]
  ) => {
    setRollTargetFrequency(targetFrequency);
    if (activeCalculations && activeCalculations.length > 0) {
      setRollCalculations(activeCalculations);
    } else {
      setRollCalculations(payrollCalculations);
    }
    setIsExecuteRollModalOpen(true);
  };

  const handleConfirmRollSettle = () => {
    const settledPenalties = settlePenaltiesList(config.bookedPenalties || []);

    // Reset counted days before payroll for suspension deduction:
    // Formula: counted days before payroll * x = deduction on payroll.
    // After payroll is executed, counted days resets to 0.
    const todayStr = new Date().toISOString().split('T')[0];
    let staffUpdated = false;
    const updatedStaffList = staffList.map((st) => {
      if (rollTargetFrequency && rollTargetFrequency !== 'all' && rollTargetFrequency !== 'due_today') {
        const freq = st.payFrequency || config.defaultPayFrequency || 'Monthly';
        if (freq !== rollTargetFrequency) return st;
      }

      const suspCalc = calculateStaffActiveSuspensionDeduction(st, config, todayStr, companyName);
      if (suspCalc.hasActiveSuspension && suspCalc.countedDays > 0) {
        staffUpdated = true;
        const newDeductedDays = (st.suspensionDeductedDays || 0) + suspCalc.countedDays;
        return {
          ...st,
          suspensionDeductedDays: newDeductedDays,
          suspensionLastSettledDate: todayStr,
        };
      }
      return st;
    });

    if (staffUpdated) {
      if (onUpdateStaffList) {
        onUpdateStaffList(updatedStaffList);
      }
      saveCompanyData(STORAGE_KEYS.STAFF, updatedStaffList, companyName);
    }

    handleSaveConfig(
      {
        ...config,
        bookedPenalties: settledPenalties,
        lastRolledAt: new Date().toISOString(),
      },
      'Payroll roll executed. All cycle deductions processed, penalties settled, and suspension counters reset to 0!'
    );
  };

  // Currency Selector Filter
  const filteredCurrencies = useMemo(() => {
    if (!currencySearch.trim()) return GLOBAL_CURRENCY_OPTIONS;
    const q = currencySearch.toLowerCase();
    return GLOBAL_CURRENCY_OPTIONS.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
    );
  }, [currencySearch]);

  const handleSelectCurrency = (curr: typeof GLOBAL_CURRENCY_OPTIONS[0]) => {
    const updated: PayrollConfig = {
      ...config,
      currencyCode: curr.code,
      currencySymbol: curr.symbol,
      currencyName: curr.name,
    };
    handleSaveConfig(updated, `Active currency set to ${curr.label}`);
  };

  // Export Payroll to CSV (Consolidated Tabulation)
  const handleExportCSV = () => {
    const headers = [
      'Employee ID',
      'Employee Name',
      'Department',
      'Role',
      'Pay Frequency',
      `Base Salary (${config.currencySymbol})`,
      'Allowances List',
      `Allowances Sum (${config.currencySymbol})`,
      'Deductions List',
      `Deductions Sum (${config.currencySymbol})`,
      `Net Pay (${config.currencySymbol})`,
    ];

    const rows = payrollCalculations.map((c) => {
      const allowancesList =
        c.bonusBreakdown && c.bonusBreakdown.length > 0
          ? c.bonusBreakdown.map((b) => `${b.name} (${config.currencySymbol}${b.amount.toFixed(2)})`).join(', ')
          : 'None';
      const deductionsList =
        c.deductionBreakdown && c.deductionBreakdown.length > 0
          ? c.deductionBreakdown.map((d) => `${d.name} (${config.currencySymbol}${d.amount.toFixed(2)})`).join(', ')
          : 'None';

      return [
        `"${c.employeeId}"`,
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.department.replace(/"/g, '""')}"`,
        `"${c.role.replace(/"/g, '""')}"`,
        `"${c.payFrequency}"`,
        c.baseSalary.toFixed(2),
        `"${allowancesList.replace(/"/g, '""')}"`,
        c.totalBonuses.toFixed(2),
        `"${deductionsList.replace(/"/g, '""')}"`,
        c.totalDeductions.toFixed(2),
        c.netSalary.toFixed(2),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Payroll_Tabulation_${companyName || 'Corporate'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    const msg = `Exported payroll tabulation to CSV (${payrollCalculations.length} staff records)`;
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3500);
    emitGlobalToast(msg, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 text-white shadow-xl">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1 mb-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 transition cursor-pointer"
            >
              <span>← Back to Staff Directory</span>
            </button>
          )}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <DollarSign className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">
              Payroll & Compensation Architecture
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              Active: {config.currencyCode} {config.currencySymbol}
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Manage corporate pay grades, statutory deductions, bonuses, pay frequencies, and automated payslip generation.
          </p>
        </div>
      </div>

      {/* Role Restriction Banner for Technical Accounts */}
      {isTechnicalUser && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-3">
          <Lock className="w-5 h-5 shrink-0 text-amber-400" />
          <div className="text-xs">
            <strong className="block font-bold">Technical Role Permission Mode</strong>
            Technical accounts manage infrastructure, database, and system configurations. Monetary salary values are masked for privacy.
          </div>
        </div>
      )}

      {/* Key Metric Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Gross */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Gross Monthly Base
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">
              {isTechnicalUser
                ? '••••••'
                : `${config.currencySymbol}${metrics.grossTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {metrics.staffCount} Active Staff
            </div>
          </div>
        </div>

        {/* Deductions Total */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Total Deductions
            </div>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono">
              {isTechnicalUser
                ? '••••••'
                : `-${config.currencySymbol}${metrics.deductionsTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {config.deductions.filter((d) => d.isEnabled).length} Rules Active
            </div>
          </div>
        </div>

        {/* Bonuses Total */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Total Bonuses
            </div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono">
              {isTechnicalUser
                ? '••••••'
                : `+${config.currencySymbol}${metrics.bonusesTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {config.bonuses.filter((b) => b.isEnabled).length} Incentives Active
            </div>
          </div>
        </div>

        {/* Net Disbursal */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Estimated Net Disbursal
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {isTechnicalUser
                ? '••••••'
                : `${config.currencySymbol}${metrics.netTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Monthly Forecast
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('booking')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'booking'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Payroll (Active Run)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('deductions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'deductions'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Deductions ({config.deductions.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('bonuses')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'bonuses'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Allowances ({config.bonuses.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('currency_bank')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'currency_bank' || activeSubTab === 'config'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Currency & Bank Information</span>
          {config.debitAccount?.isConfigured ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          ) : (
            <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('general_settings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'general_settings'
              ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-md shadow-slate-800/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>General Settings</span>
        </button>
      </div>

      {/* SUB-TAB: BOOKING & ACTIVE DEDUCTIONS */}
      {activeSubTab === 'booking' && (
        <BookingTab
          staffList={activeStaff}
          config={config}
          currencySymbol={config.currencySymbol || '$'}
          isLight={isLight}
          companyName={companyName}
          onExecuteRoll={handleExecuteRollAndSettle}
          onUpdateStaffList={onUpdateStaffList}
          onSaveConfig={handleSaveConfig}
        />
      )}

      {/* SUB-TAB 2: DEDUCTIONS & PENALTIES */}
      {activeSubTab === 'deductions' && (
        <div className="space-y-6">
          {/* Default Deductions & Event-Based Automation Rules Section */}
          <DefaultDeductionsSection
            config={config}
            canEdit={canEditPayroll}
            onUpdateConfig={handleSaveConfig}
            projects={projects}
            companyName={companyName}
          />

          {/* Corporate / Statutory Deductions Section */}
          <CorporateDeductionsSection
            config={config}
            canEdit={canEditPayroll}
            onOpenNew={handleOpenNewDeduction}
            onEdit={handleEditDeduction}
            onDelete={handleDeleteDeduction}
            onToggle={handleToggleDeduction}
          />

          {/* Manual Deductions Catalog & Incurred Penalties Section */}
          <ManualDeductionsAndPenaltiesSection
            config={config}
            staffList={activeStaff}
            canEdit={canEditPayroll}
            onOpenNewRule={handleOpenNewManualRule}
            onEditRule={handleEditManualRule}
            onDeleteRule={handleDeleteManualRule}
            onOpenPenalizeModal={handleOpenPenalizeModal}
            onSettlePenalty={handleSettlePenalty}
            onRevokePenalty={handleRevokePenalty}
            onExecuteRollAndSettle={handleExecuteRollAndSettle}
          />
        </div>
      )}

      {/* SUB-TAB 3: ALLOWANCES & BONUSES CONFIGURATION */}
      {activeSubTab === 'bonuses' && (
        <div className="space-y-6">
          {/* Section 1: Default Allowances & Standard Packages */}
          <DefaultAllowancesSection
            config={config}
            canEdit={canEditPayroll}
            onUpdateConfig={handleSaveConfig}
            onToggleAllowance={handleToggleBonus}
            onEditAllowance={handleEditBonus}
            onOpenWelfareLedger={() => setIsWelfareModalOpen(true)}
          />

          {/* Section 2: Custom Allowances & Merit Incentives */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span>Custom & Merit Allowances</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Configure role bonuses, performance incentives, overtime stipends, and department allowances.
                </p>
              </div>
              {canEditPayroll && (
                <button
                  type="button"
                  onClick={handleOpenNewBonus}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-600/30 transition cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Allowance</span>
                </button>
              )}
            </div>

            {config.bonuses.filter((b) => !b.isDefault).length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-500">
                  No custom allowances defined yet.
                </p>
                <p className="text-[11px] text-slate-400">
                  Default allowances (Housing, Transport, Birthday, etc.) are managed in the section above. Click "Add Custom Allowance" to create specialized performance, overtime, or role stipends.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.bonuses
                  .filter((bon) => !bon.isDefault)
                  .map((bon) => (
                    <div
                      key={bon.id}
                      className={`p-4 rounded-2xl border transition ${
                        bon.isEnabled
                          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              bon.isEnabled ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-slate-400'
                            }`}
                          />
                          <div>
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white">{bon.name}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                {bon.category || 'Custom'}
                              </span>
                              <span className="text-[10px] text-slate-400">•</span>
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                {bon.disbursementType === 'welfare_log'
                                  ? 'Manual Welfare Ledger'
                                  : 'Recurring Payroll'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {canEditPayroll && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleBonus(bon.id)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono transition cursor-pointer ${
                                  bon.isEnabled
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                }`}
                              >
                                {bon.isEnabled ? 'Active' : 'Disabled'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditBonus(bon)}
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                                title="Edit Allowance"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBonus(bon.id)}
                                className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-400 hover:text-rose-600 cursor-pointer"
                                title="Delete Allowance"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {bon.type === 'percentage' ? `+${bon.value}%` : `+${config.currencySymbol}${bon.value}`}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({bon.type === 'percentage' ? 'Percentage of Gross Salary' : 'Fixed Stipend Amount'})
                        </span>
                      </div>

                      {bon.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                          {bon.description}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
                        <span>Applies to:</span>
                        <span className="font-bold text-slate-600 dark:text-slate-300">
                          {bon.applicableTo || 'All Staff Members'}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: CURRENCY & BANK INFORMATION */}
      {(activeSubTab === 'currency_bank' || activeSubTab === 'config') && (
        <div className="space-y-6">
          {/* Corporate Debit Account Configuration Section (Optional - can be left unset) */}
          <DebitAccountSection
            config={config}
            canEdit={canEditPayroll}
            onSaveConfig={handleSaveConfig}
            isHighlighted={highlightDebitAccount}
          />

          {/* 1. Active Currency Standard Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-500" />
                  <span>Global Currency Standard</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Select your organization's operational currency. All salary inputs, pay grades, and metrics dynamically adapt.
                </p>
              </div>

              <div className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs flex items-center gap-2 shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>
                  Current: {config.currencyCode} ({config.currencySymbol}) - {config.currencyName}
                </span>
              </div>
            </div>

            {/* Currency Search & Grid */}
            <div className="space-y-3 pt-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search countries, currency codes (e.g. USD, NGN, GBP, YEN, EUR, KES)..."
                  value={currencySearch}
                  onChange={(e) => setCurrencySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-1">
                {filteredCurrencies.map((curr) => {
                  const isSelected = config.currencyCode === curr.code;
                  return (
                    <button
                      key={curr.code}
                      type="button"
                      onClick={() => handleSelectCurrency(curr)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30'
                          : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="truncate">
                        <span className="font-mono font-bold block">{curr.code} {curr.symbol}</span>
                        <span className={`text-[10px] truncate block ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {curr.name}
                        </span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick link banner to General Settings */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <strong className="block text-slate-900 dark:text-white">Looking for Frequency Rules or Pay Grades?</strong>
              Configure cycle frequencies, pay grade salary tiers, and disciplinary deduction policies in General Settings.
            </div>
            <button
              type="button"
              onClick={() => setActiveSubTab('general_settings')}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 cursor-pointer transition whitespace-nowrap self-start sm:self-auto"
            >
              Go to General Settings →
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: GENERAL SETTINGS (Frequency, Pay Grades, Penalties, Tax ID) */}
      {activeSubTab === 'general_settings' && (
        <div className="space-y-6">
          {/* Quick link banner to Currency & Bank Information */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300">
                <strong className="block text-slate-900 dark:text-white">Corporate Debit Bank Account & Operating Currency</strong>
                Debit account setup is optional for batch disbursements. Active currency: {config.currencyCode} ({config.currencySymbol}).
              </div>
            </div>
            <button
              type="button"
              onClick={handleNavigateToDebitAccountConfig}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 cursor-pointer transition whitespace-nowrap self-start sm:self-auto"
            >
              Manage Currency & Bank Info →
            </button>
          </div>

          {/* 1. Frequency Configuration & Roll Automation Schedule */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span>Payroll Frequency & Automation Roll Schedule</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure the specific trigger days for each payroll cycle frequency. Individual staff members are assigned their pay frequency manually in their profiles.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Monthly Configuration */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Monthly Roll Schedule
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                      Monthly Cycle
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Trigger Occurrence Rule
                    </label>
                    <select
                      value={config.rollRules?.monthly?.ruleType || 'specific_day'}
                      onChange={(e) => {
                        const ruleType = e.target.value as 'specific_day' | 'beginning_of_month' | 'end_of_month';
                        const currentRollRules = config.rollRules || DEFAULT_ROLL_RULES;
                        const newConfig: PayrollConfig = {
                          ...config,
                          rollRules: {
                            ...currentRollRules,
                            monthly: {
                              ...currentRollRules.monthly,
                              ruleType,
                              dayOfMonth: ruleType === 'specific_day' ? (currentRollRules.monthly.dayOfMonth || 25) : undefined,
                            },
                          },
                        };
                        handleSaveConfig(newConfig, 'Monthly payroll schedule updated');
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-semibold outline-none"
                    >
                      <option value="specific_day">Specific Day of Every Month</option>
                      <option value="beginning_of_month">Beginning of Month (1st Day)</option>
                      <option value="end_of_month">Ending of Month (Last Calendar Day)</option>
                    </select>
                  </div>

                  {(config.rollRules?.monthly?.ruleType === 'specific_day' || !config.rollRules?.monthly?.ruleType) && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                        Selected Day of Month (1 - 31)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={config.rollRules?.monthly?.dayOfMonth || 25}
                          onChange={(e) => {
                            const dayVal = Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1));
                            const currentRollRules = config.rollRules || DEFAULT_ROLL_RULES;
                            const newConfig: PayrollConfig = {
                              ...config,
                              rollRules: {
                                ...currentRollRules,
                                monthly: {
                                  ruleType: 'specific_day',
                                  dayOfMonth: dayVal,
                                },
                              },
                            };
                            handleSaveConfig(newConfig, `Monthly roll set to day ${dayVal}`);
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                        />
                        <span className="text-xs font-mono text-slate-500 shrink-0">th of month</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                  {config.rollRules?.monthly?.ruleType === 'beginning_of_month' && (
                    <span>🗓️ Monthly payroll rolls automatically on the <strong>1st day</strong> of every month.</span>
                  )}
                  {config.rollRules?.monthly?.ruleType === 'end_of_month' && (
                    <span>🗓️ Monthly payroll rolls automatically on the <strong>last day</strong> of every month.</span>
                  )}
                  {(config.rollRules?.monthly?.ruleType === 'specific_day' || !config.rollRules?.monthly?.ruleType) && (
                    <span>🗓️ Monthly payroll rolls automatically on the <strong>{config.rollRules?.monthly?.dayOfMonth || 25}th</strong> of every month.</span>
                  )}
                </div>
              </div>

              {/* Bi-Weekly Configuration */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      Bi-Weekly Roll Schedule
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                      Fortnightly (2 Wks)
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                        Trigger Day of Week
                      </label>
                      <select
                        value={config.rollRules?.biWeekly?.dayOfWeek || 'Friday'}
                        onChange={(e) => {
                          const dayOfWeek = e.target.value as any;
                          const currentRollRules = config.rollRules || DEFAULT_ROLL_RULES;
                          const newConfig: PayrollConfig = {
                            ...config,
                            rollRules: {
                              ...currentRollRules,
                              biWeekly: {
                                ...(currentRollRules.biWeekly || DEFAULT_ROLL_RULES.biWeekly),
                                dayOfWeek,
                                interval: 'every_2nd_week',
                              },
                            },
                          };
                          handleSaveConfig(newConfig, `Bi-weekly payroll set to every 2nd ${dayOfWeek}`);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-semibold outline-none"
                      >
                        <option value="Monday">Every 2nd Monday</option>
                        <option value="Tuesday">Every 2nd Tuesday</option>
                        <option value="Wednesday">Every 2nd Wednesday</option>
                        <option value="Thursday">Every 2nd Thursday</option>
                        <option value="Friday">Every 2nd Friday</option>
                        <option value="Saturday">Every 2nd Saturday</option>
                        <option value="Sunday">Every 2nd Sunday</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                        Calendar Day Selection
                      </label>
                      <BiWeeklyDatePicker
                        selectedDayOfWeek={config.rollRules?.biWeekly?.dayOfWeek || 'Friday'}
                        value={config.rollRules?.biWeekly?.startDate || ''}
                        onChange={(startDate) => {
                          const currentRollRules = config.rollRules || DEFAULT_ROLL_RULES;
                          const newConfig: PayrollConfig = {
                            ...config,
                            rollRules: {
                              ...currentRollRules,
                              biWeekly: {
                                ...(currentRollRules.biWeekly || DEFAULT_ROLL_RULES.biWeekly),
                                startDate,
                                interval: 'every_2nd_week',
                              },
                            },
                          };
                          handleSaveConfig(newConfig, `Bi-weekly anchor start date set to ${startDate}`);
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                  <span>
                    🗓️ Bi-Weekly payroll starts on <strong>{config.rollRules?.biWeekly?.startDate || 'selected date'}</strong> and rolls every 2 weeks on <strong>{config.rollRules?.biWeekly?.dayOfWeek || 'Friday'}</strong>.
                  </span>
                </div>
              </div>

              {/* Weekly Configuration */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Weekly Roll Schedule
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      Weekly Cycle
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Trigger Day of Week
                    </label>
                    <select
                      value={config.rollRules?.weekly?.dayOfWeek || 'Friday'}
                      onChange={(e) => {
                        const dayOfWeek = e.target.value as any;
                        const currentRollRules = config.rollRules || DEFAULT_ROLL_RULES;
                        const newConfig: PayrollConfig = {
                          ...config,
                          rollRules: {
                            ...currentRollRules,
                            weekly: {
                              dayOfWeek,
                            },
                          },
                        };
                        handleSaveConfig(newConfig, `Weekly payroll set to every ${dayOfWeek}`);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-semibold outline-none"
                    >
                      <option value="Monday">Every Monday</option>
                      <option value="Tuesday">Every Tuesday</option>
                      <option value="Wednesday">Every Wednesday</option>
                      <option value="Thursday">Every Thursday</option>
                      <option value="Friday">Every Friday</option>
                      <option value="Saturday">Every Saturday</option>
                      <option value="Sunday">Every Sunday</option>
                    </select>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                  <span>🗓️ Weekly payroll rolls automatically <strong>every {config.rollRules?.weekly?.dayOfWeek || 'Friday'}</strong>.</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Corporate Pay Grades & Estimate Salary Ranges Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building className="w-4 h-4 text-purple-500" />
                  <span>Corporate Pay Grades & Estimate Salary Ranges</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Staff profiles and Applicant enrollment modals reference these pay grades.
                </p>
              </div>

              {canEditPayroll && (
                <button
                  type="button"
                  onClick={handleOpenNewGrade}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Pay Grade</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {config.payGrades.map((grade) => (
                <div
                  key={grade.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">{grade.name}</h4>
                    </div>
                    {canEditPayroll && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditGrade(grade)}
                          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                          title="Edit Pay Grade"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGrade(grade.id)}
                          className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-400 hover:text-rose-600 cursor-pointer"
                          title="Delete Pay Grade"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                    <div>
                      <div className="text-[10px] uppercase font-mono text-slate-400 mb-0.5">
                        Estimate Salary Range:
                      </div>
                      <div className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400">
                        {config.currencySymbol}{grade.minSalary.toLocaleString()} - {config.currencySymbol}{grade.maxSalary.toLocaleString()}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                        🎁 {grade.allowedBonusIds ? `${grade.allowedBonusIds.length}/${config.bonuses.length}` : `All (${config.bonuses.length})`} Allowances
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60">
                        📉 {grade.allowedDeductionIds ? `${grade.allowedDeductionIds.length}/${config.deductions.length}` : `All (${config.deductions.length})`} Deductions
                      </span>
                    </div>
                  </div>

                  {grade.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {grade.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    <span>
                      Assigned to{' '}
                      <strong className="text-slate-700 dark:text-slate-300">
                        {activeStaff.filter((s) => deriveStaffPayGrade(s, config.payGrades) === grade.name).length}
                      </strong>{' '}
                      staff
                    </span>
                    {canEditPayroll && (
                      <button
                        type="button"
                        onClick={() => handleEditGrade(grade)}
                        className="text-purple-600 dark:text-purple-400 hover:underline font-semibold cursor-pointer"
                      >
                        Edit Mappings →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Corporate Tax ID Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-500" />
              <span>Corporate Tax Identification (TIN) & Employer References</span>
            </h3>

            <div className="max-w-md">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Corporate Tax Identification / Reference (TIN)
              </label>
              <input
                type="text"
                value={config.taxIdentificationNumber || ''}
                onChange={(e) =>
                  setConfig({ ...config, taxIdentificationNumber: e.target.value })
                }
                onBlur={() =>
                  handleSaveConfig(config, 'Corporate Tax ID saved')
                }
                placeholder="e.g. TAX-984029-NY"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Displayed on official payslips and corporate tax reporting documents.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: PAYSLIP PREVIEW & PRINT */}
      {selectedPayslipStaff && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Employee Monthly Payslip Statement
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayslipStaff(null)}
                className="p-1 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1 min-h-0">
              {/* Company & Employee Identity Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {companyName || 'Corporate Workforce Organization'}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Tax Ref: {config.taxIdentificationNumber || 'N/A'}
                  </p>
                  <div className="mt-2 text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedPayslipStaff.name}
                    </span>{' '}
                    <span className="font-mono text-indigo-500">
                      ({selectedPayslipStaff.employeeId})
                    </span>
                    <div className="text-[10px] text-slate-400">
                      {selectedPayslipStaff.role} • {selectedPayslipStaff.department}
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono text-[10px] text-slate-400">
                  <div>Statement Date:</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {new Date().toISOString().split('T')[0]}
                  </div>
                  <div className="mt-1">Frequency:</div>
                  <div className="font-bold text-indigo-500">{selectedPayslipStaff.payFrequency}</div>
                </div>
              </div>

              {/* Earnings & Allowances */}
              <div className="space-y-2">
                <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 font-mono uppercase tracking-wider text-[10px]">
                  1. Gross Earnings & Incentives
                </h5>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="flex justify-between p-2.5 bg-white dark:bg-slate-900">
                    <span>Base {selectedPayslipStaff.payFrequency || 'Monthly'} Compensation</span>
                    <span className="font-mono font-bold">
                      {isTechnicalUser
                        ? '••••'
                        : `${config.currencySymbol}${selectedPayslipStaff.baseSalary.toLocaleString()}`}
                    </span>
                  </div>
                  {selectedPayslipStaff.bonusBreakdown.map((b, i) => (
                    <div
                      key={i}
                      className="flex justify-between p-2.5 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400"
                    >
                      <span>
                        {b.name} ({b.type})
                      </span>
                      <span className="font-mono font-bold">
                        {isTechnicalUser ? '••••' : `+${config.currencySymbol}${b.amount.toFixed(2)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deductions */}
              <div className="space-y-2">
                <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 font-mono uppercase tracking-wider text-[10px]">
                  2. Statutory & Corporate Deductions
                </h5>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {selectedPayslipStaff.deductionBreakdown.map((d, i) => (
                    <div
                      key={i}
                      className="flex justify-between p-2.5 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400"
                    >
                      <span>
                        {d.name} ({d.type})
                      </span>
                      <span className="font-mono font-bold">
                        {isTechnicalUser ? '••••' : `-${config.currencySymbol}${d.amount.toFixed(2)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Net Disbursal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
              <div>
                <div className="text-[10px] font-mono uppercase text-emerald-800 dark:text-emerald-300 font-bold">
                  Net {selectedPayslipStaff.payFrequency || 'Monthly'} Disbursal:
                </div>
                <div className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300">
                  {isTechnicalUser
                    ? '••••••'
                    : `${config.currencySymbol}${selectedPayslipStaff.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/30 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Payslip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD/EDIT PAY GRADE & SALARY MAPPINGS */}
      {isGradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto my-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-purple-500" />
                <span>{editingGrade ? 'Edit Pay Grade Tier & Mappings' : 'Create New Pay Grade Tier'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsGradeModalOpen(false)}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGrade} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Grade Name / Identifier *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grade L1 (Junior Specialist)"
                  value={gradeForm.name}
                  onChange={(e) => setGradeForm({ ...gradeForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Minimum Salary ({config.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={gradeForm.minSalary}
                    onChange={(e) =>
                      setGradeForm({ ...gradeForm, minSalary: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Maximum Salary ({config.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={gradeForm.maxSalary}
                    onChange={(e) =>
                      setGradeForm({ ...gradeForm, maxSalary: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Default Pay Frequency
                </label>
                <select
                  value={gradeForm.defaultFrequency}
                  onChange={(e) =>
                    setGradeForm({
                      ...gradeForm,
                      defaultFrequency: e.target.value as PayFrequencyType,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                >
                  <option value="Weekly">Weekly</option>
                  <option value="Bi-Weekly">Bi-Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Description / Eligibility Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Target roles, experience benchmarks, or departments..."
                  value={gradeForm.description}
                  onChange={(e) => setGradeForm({ ...gradeForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* SALARY GRADE MAPPING SECTION */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-4">
                {/* Allowances Mapping */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-slate-800 dark:text-slate-200 font-bold text-xs">
                        Mapped Allowances & Bonuses
                      </label>
                      <p className="text-[10px] text-slate-500">
                        Default is all allowances mapped; uncheck to disallow specific bonuses on this grade.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setGradeForm({
                            ...gradeForm,
                            allowedBonusIds: config.bonuses.map((b) => b.id),
                          })
                        }
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 cursor-pointer"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setGradeForm({
                            ...gradeForm,
                            allowedBonusIds: [],
                          })
                        }
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                    {config.bonuses.map((b) => {
                      const isChecked = gradeForm.allowedBonusIds
                        ? gradeForm.allowedBonusIds.includes(b.id)
                        : true;
                      return (
                        <label
                          key={b.id}
                          className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                            isChecked
                              ? 'bg-white dark:bg-slate-800 border-amber-300 dark:border-amber-700/60 shadow-xs'
                              : 'bg-transparent border-transparent opacity-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const current =
                                gradeForm.allowedBonusIds ?? config.bonuses.map((x) => x.id);
                              const next = e.target.checked
                                ? [...current, b.id]
                                : current.filter((id) => id !== b.id);
                              setGradeForm({ ...gradeForm, allowedBonusIds: next });
                            }}
                            className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white truncate">
                              {b.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span>
                                {b.type === 'percentage'
                                  ? `+${b.value}%`
                                  : `+${config.currencySymbol}${b.value}`}
                              </span>
                              {b.isDefault && (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">
                                  Default
                                </span>
                              )}
                              {b.disbursementType === 'welfare_log' && (
                                <span className="text-rose-500 font-semibold">
                                  Welfare Log
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Deductions Mapping */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-slate-800 dark:text-slate-200 font-bold text-xs">
                        Mapped Corporate & Statutory Deductions
                      </label>
                      <p className="text-[10px] text-slate-500">
                        Default is all deductions mapped; uncheck to disallow specific deductions on this grade.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setGradeForm({
                            ...gradeForm,
                            allowedDeductionIds: config.deductions.map((d) => d.id),
                          })
                        }
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 cursor-pointer"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setGradeForm({
                            ...gradeForm,
                            allowedDeductionIds: [],
                          })
                        }
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                    {config.deductions.map((d) => {
                      const isChecked = gradeForm.allowedDeductionIds
                        ? gradeForm.allowedDeductionIds.includes(d.id)
                        : true;
                      return (
                        <label
                          key={d.id}
                          className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                            isChecked
                              ? 'bg-white dark:bg-slate-800 border-rose-300 dark:border-rose-700/60 shadow-xs'
                              : 'bg-transparent border-transparent opacity-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const current =
                                gradeForm.allowedDeductionIds ??
                                config.deductions.map((x) => x.id);
                              const next = e.target.checked
                                ? [...current, d.id]
                                : current.filter((id) => id !== d.id);
                              setGradeForm({ ...gradeForm, allowedDeductionIds: next });
                            }}
                            className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white truncate">
                              {d.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                              {d.type === 'percentage'
                                ? `-${d.value}%`
                                : `-${config.currencySymbol}${d.value}`}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGradeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md transition"
                >
                  {editingGrade ? 'Save Changes' : 'Create Tier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD/EDIT CORPORATE DEDUCTION */}
      <CorporateDeductionModal
        isOpen={isDeductionModalOpen}
        onClose={() => setIsDeductionModalOpen(false)}
        config={config}
        currencySymbol={config.currencySymbol}
        departments={departments}
        staffList={activeStaff}
        existingShifts={settings?.shifts}
        companyName={companyName}
        editingDeduction={editingDeduction}
        onSave={handleSaveCorporateDeduction}
      />

      {/* MODAL 4: ADD/EDIT ALLOWANCE OR BONUS */}
      {isBonusModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto my-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-500" />
                <span>{editingBonus ? 'Edit Allowance / Incentive' : 'Add Allowance / Incentive'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsBonusModalOpen(false)}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBonus} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Allowance / Bonus Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Housing Subsidy, Fuel & Commute, Project Merit"
                  value={bonusForm.name}
                  onChange={(e) => setBonusForm({ ...bonusForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Allowance Category
                  </label>
                  <select
                    value={bonusForm.category || 'custom'}
                    onChange={(e) =>
                      setBonusForm({
                        ...bonusForm,
                        category: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="custom">Custom Merit / Bonus</option>
                    <option value="housing">Housing Allowance</option>
                    <option value="transport">Transport / Commute</option>
                    <option value="birthday">Birthday Celebration</option>
                    <option value="medical">Medical Emergency Aid</option>
                    <option value="bereavement">Bereavement Grant</option>
                    <option value="childbirth">Childbirth / Maternity Gift</option>
                    <option value="performance">Performance Incentive</option>
                    <option value="attendance">Attendance Stipend</option>
                    <option value="overtime">Shift Overtime</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Disbursement Channel
                  </label>
                  <select
                    value={bonusForm.disbursementType || 'payroll'}
                    onChange={(e) =>
                      setBonusForm({
                        ...bonusForm,
                        disbursementType: e.target.value as 'payroll' | 'welfare_log',
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="payroll">Recurring Payroll (Adds to monthly salary run)</option>
                    <option value="welfare_log">Welfare Ledger (Logged manually to welfare books)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Calculation Type
                  </label>
                  <select
                    value={bonusForm.type}
                    onChange={(e) =>
                      setBonusForm({
                        ...bonusForm,
                        type: e.target.value as 'percentage' | 'fixed',
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="fixed">Fixed Stipend ({config.currencySymbol})</option>
                    <option value="percentage">Percentage of Base Pay (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Value ({bonusForm.type === 'percentage' ? '%' : config.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    min={0}
                    value={bonusForm.value}
                    onChange={(e) =>
                      setBonusForm({
                        ...bonusForm,
                        value: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Applicable Staff / Department
                </label>
                <select
                  value={bonusForm.applicableTo}
                  onChange={(e) => setBonusForm({ ...bonusForm, applicableTo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                >
                  <option value="All">All Staff Members</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      Department: {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Description / Eligibility Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Criteria for awarding this allowance or grant..."
                  value={bonusForm.description}
                  onChange={(e) => setBonusForm({ ...bonusForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBonusModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md transition"
                >
                  {editingBonus ? 'Save Changes' : 'Add Allowance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Book / Incur Penalty for Staff */}
      <PenalizeStaffModal
        isOpen={isPenalizeModalOpen}
        onClose={() => setIsPenalizeModalOpen(false)}
        onConfirm={handleConfirmPenalty}
        staffList={activeStaff}
        config={config}
        initialStaff={penalizeInitialStaff}
        initialRule={penalizeInitialRule}
        currentUserName={user?.name || user?.username || 'Admin'}
      />

      {/* MODAL: Configure Manual Deduction Template Rule */}
      <ManualDeductionRuleModal
        isOpen={isManualRuleModalOpen}
        onClose={() => setIsManualRuleModalOpen(false)}
        onSave={handleSaveManualRule}
        editingRule={editingManualRule}
        config={config}
        currencySymbol={config.currencySymbol || '$'}
      />

      {/* MODAL: Execute Roll and Settle Penalties */}
      {isExecuteRollModalOpen && (
        <ExecuteRollModal
          isOpen={isExecuteRollModalOpen}
          onClose={() => setIsExecuteRollModalOpen(false)}
          onConfirmRoll={handleConfirmRollSettle}
          config={config}
          currencySymbol={config.currencySymbol || "$"}
          companyName={companyName}
          calculations={rollCalculations.length > 0 ? rollCalculations : payrollCalculations}
          staffCount={activeStaff.length}
          activePenaltiesCount={(config.bookedPenalties || []).filter((p) => p.status === "Active").length}
          totalActivePenaltiesAmount={(rollCalculations.length > 0 ? rollCalculations : payrollCalculations).reduce((sum, c) => sum + (c.penaltiesTotal || 0), 0)}
          totalSuspensionsAmount={(rollCalculations.length > 0 ? rollCalculations : payrollCalculations).reduce((sum, c) => sum + (c.suspensionDeduction || 0), 0)}
          suspensionsCount={(rollCalculations.length > 0 ? rollCalculations : payrollCalculations).filter((c) => (c.suspensionDeduction || 0) > 0).length}
          targetFrequency={rollTargetFrequency}
          totalGrossSalary={(rollCalculations.length > 0 ? rollCalculations : payrollCalculations).reduce((sum, c) => sum + c.baseSalary, 0)}
          totalNetDisbursal={(rollCalculations.length > 0 ? rollCalculations : payrollCalculations).reduce((sum, c) => sum + c.netSalary, 0)}
          onViewStaffPayslip={(calc) => setSelectedPayslipStaff(calc)}
          staffList={activeStaff}
          onProceedToBankTransfers={() => {
            setIsExecuteRollModalOpen(false);
            setIsBankTransfersModalOpen(true);
          }}
          onMarkAsCompleted={handleMarkRunAsCompleted}
          onGoToDebitAccountConfig={handleNavigateToDebitAccountConfig}
        />
      )}

      {/* MODAL: Safe In-App Delete Confirmation */}
      {deleteModalState?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto my-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {deleteModalState.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              {deleteModalState.message}
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteModalState(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteModalState.onConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/30 cursor-pointer transition"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Payroll Tabulation Modal */}
      {isExportPayrollModalOpen && (
        <ExportPayrollModal
          isOpen={isExportPayrollModalOpen}
          onClose={() => setIsExportPayrollModalOpen(false)}
          staffList={staffList}
          config={config}
          currencySymbol={config.currencySymbol || '$'}
          companyName={companyName}
        />
      )}

      {/* Bank Transfers & Disbursements Modal */}
      {isBankTransfersModalOpen && (
        <BankTransfersModal
          isOpen={isBankTransfersModalOpen}
          onClose={() => setIsBankTransfersModalOpen(false)}
          staffList={activeStaff}
          config={config}
          calculations={rollCalculations.length > 0 ? rollCalculations : payrollCalculations}
          currencySymbol={config.currencySymbol || '$'}
          companyName={companyName}
          onOpenExportModal={() => setIsExportPayrollModalOpen(true)}
          onMarkAsCompleted={handleMarkRunAsCompleted}
          onGoToDebitAccountConfig={handleNavigateToDebitAccountConfig}
          onUpdateStaffMember={(updated) => {
            const updatedList = staffList.map((s) => (s.id === updated.id ? updated : s));
            if (onUpdateStaffList) onUpdateStaffList(updatedList);
            saveCompanyData(STORAGE_KEYS.STAFF, updatedList, companyName);
          }}
        />
      )}
    </div>
  );
};
