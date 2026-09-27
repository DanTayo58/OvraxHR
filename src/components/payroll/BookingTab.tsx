import React, { useState, useMemo } from 'react';
import {
  Calendar,
  RotateCcw,
  Zap,
  CheckCircle2,
  DollarSign,
  FileText,
  Search,
  ChevronRight,
  Sparkles,
  Printer,
  X,
  Building,
  TrendingUp,
  Coins,
  TrendingDown,
  FileSpreadsheet,
} from 'lucide-react';
import { PayGradeTier, PayrollConfig, StaffMember } from '../../types';
import {
  calculateStaffPayroll,
  getActiveFrequenciesOnDate,
  getNextRollDateForFrequency,
  isPayFrequencyDueOnDate,
  StaffPayrollCalculation,
} from '../../utils/payrollUtils';
import { emitGlobalToast } from '../../context/ToastContext';
import { saveCompanyData, STORAGE_KEYS } from '../../utils/companyStorage';
import { ExportPayrollModal } from './ExportPayrollModal';

interface BookingTabProps {
  staffList: StaffMember[];
  config: PayrollConfig;
  currencySymbol: string;
  isLight?: boolean;
  companyName?: string;
  onExecuteRoll: (targetFrequency?: string, activeCalculations?: StaffPayrollCalculation[]) => void;
  onUpdateStaffList?: (updated: StaffMember[]) => void;
  onSaveConfig: (updated: PayrollConfig, msg?: string) => void;
}

function formatToDdMmYyyy(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export const BookingTab: React.FC<BookingTabProps> = ({
  staffList,
  config,
  currencySymbol,
  isLight = false,
  companyName,
  onExecuteRoll,
  onUpdateStaffList,
  onSaveConfig,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [evaluationDate, setEvaluationDate] = useState<string>(todayStr);
  const [frequencyFilter, setFrequencyFilter] = useState<'due_today' | 'all' | 'Weekly' | 'Bi-Weekly' | 'Monthly'>('due_today');
  
  // Secondary Toolbar Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('All');
  const [sortField, setSortField] = useState<'name' | 'baseSalary' | 'totalBonuses' | 'totalDeductions' | 'netSalary'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modal States
  const [isBulkSetModalOpen, setIsBulkSetModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedPayslipStaff, setSelectedPayslipStaff] = useState<StaffPayrollCalculation | null>(null);

  // Active staff only
  const activeEmployees = useMemo(() => {
    return staffList.filter((s) => s.status !== 'Exited');
  }, [staffList]);

  // Unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => {
      if (s.department) set.add(s.department.trim());
    });
    return Array.from(set).sort();
  }, [staffList]);

  // Which frequencies are due on the evaluation date?
  const activeFrequenciesDue = useMemo(() => {
    return getActiveFrequenciesOnDate(evaluationDate, config.rollRules);
  }, [evaluationDate, config.rollRules]);

  const isSimultaneousRun = activeFrequenciesDue.length > 1;

  // Upcoming dates for info banner
  const nextWeekly = useMemo(() => getNextRollDateForFrequency('Weekly', evaluationDate, config.rollRules), [evaluationDate, config.rollRules]);
  const nextBiWeekly = useMemo(() => getNextRollDateForFrequency('Bi-Weekly', evaluationDate, config.rollRules), [evaluationDate, config.rollRules]);
  const nextMonthly = useMemo(() => getNextRollDateForFrequency('Monthly', evaluationDate, config.rollRules), [evaluationDate, config.rollRules]);

  // Expected next run formatted date for active frequency tab view
  const nextExpectedRunFormatted = useMemo(() => {
    let targetDate = '';
    if (frequencyFilter === 'Weekly') {
      targetDate = nextWeekly;
    } else if (frequencyFilter === 'Bi-Weekly') {
      targetDate = nextBiWeekly;
    } else if (frequencyFilter === 'Monthly') {
      targetDate = nextMonthly;
    } else if (frequencyFilter === 'due_today') {
      if (activeFrequenciesDue.length === 1) {
        const freq = activeFrequenciesDue[0];
        if (freq === 'Weekly') targetDate = nextWeekly;
        else if (freq === 'Bi-Weekly') targetDate = nextBiWeekly;
        else if (freq === 'Monthly') targetDate = nextMonthly;
      } else {
        const sorted = [nextWeekly, nextBiWeekly, nextMonthly].filter(Boolean).sort();
        targetDate = sorted[0] || '';
      }
    } else {
      const sorted = [nextWeekly, nextBiWeekly, nextMonthly].filter(Boolean).sort();
      targetDate = sorted[0] || '';
    }
    return formatToDdMmYyyy(targetDate);
  }, [frequencyFilter, nextWeekly, nextBiWeekly, nextMonthly, activeFrequenciesDue]);

  // Compute calculations for all active employees evaluated against evaluationDate
  const allCalculations = useMemo(() => {
    return activeEmployees.map((staff) => {
      return calculateStaffPayroll(staff, config, evaluationDate, companyName);
    });
  }, [activeEmployees, config, evaluationDate, companyName]);

  // Filter & sort calculations
  const filteredCalculations = useMemo(() => {
    let list = allCalculations.filter((calc) => {
      // 1. Frequency Filter
      const staffFreq = calc.payFrequency || config.defaultPayFrequency || 'Monthly';
      if (frequencyFilter === 'due_today') {
        const isDue = isPayFrequencyDueOnDate(staffFreq, evaluationDate, config.rollRules);
        if (!isDue) return false;
      } else if (frequencyFilter !== 'all') {
        if (staffFreq !== frequencyFilter) return false;
      }

      // 2. Department Filter
      if (selectedDeptFilter !== 'All' && calc.department !== selectedDeptFilter) {
        return false;
      }

      // 3. Pay Grade Filter
      if (selectedGradeFilter !== 'All' && calc.payGrade !== selectedGradeFilter) {
        return false;
      }

      // 4. Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const match =
          calc.name.toLowerCase().includes(q) ||
          calc.employeeId.toLowerCase().includes(q) ||
          calc.role.toLowerCase().includes(q) ||
          calc.department.toLowerCase().includes(q) ||
          calc.payGrade.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });

    // Apply Sorting
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'baseSalary':
          cmp = a.baseSalary - b.baseSalary;
          break;
        case 'totalBonuses':
          cmp = a.totalBonuses - b.totalBonuses;
          break;
        case 'totalDeductions':
          cmp = a.totalDeductions - b.totalDeductions;
          break;
        case 'netSalary':
          cmp = a.netSalary - b.netSalary;
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [
    allCalculations,
    frequencyFilter,
    evaluationDate,
    config.rollRules,
    config.defaultPayFrequency,
    selectedDeptFilter,
    selectedGradeFilter,
    searchTerm,
    sortField,
    sortDirection,
  ]);

  // Summary Metrics for the current view
  const summary = useMemo(() => {
    let gross = 0;
    let corporate = 0;
    let penalties = 0;
    let suspensions = 0;
    let attendance = 0;
    let totalDeductions = 0;
    let totalBonuses = 0;
    let net = 0;

    filteredCalculations.forEach((calc) => {
      gross += calc.baseSalary;
      corporate += calc.corporateDeductions;
      penalties += calc.penaltiesTotal;
      suspensions += calc.suspensionDeduction || 0;
      attendance += (calc.absenteeDeduction || 0) + (calc.latenessDeduction || 0);
      totalDeductions += calc.totalDeductions;
      totalBonuses += calc.totalBonuses || 0;
      net += calc.netSalary;
    });

    return {
      staffCount: filteredCalculations.length,
      gross,
      corporate,
      penalties,
      suspensions,
      attendance,
      totalDeductions,
      totalBonuses,
      net,
    };
  }, [filteredCalculations]);

  // Count of staff due today
  const dueTodayCount = useMemo(() => {
    return allCalculations.filter((c) => {
      const freq = c.payFrequency || config.defaultPayFrequency || 'Monthly';
      return isPayFrequencyDueOnDate(freq, evaluationDate, config.rollRules);
    }).length;
  }, [allCalculations, evaluationDate, config.rollRules, config.defaultPayFrequency]);

  // Bulk Action Handlers
  const handleBulkSetFrequency = (frequency: string) => {
    if (!onUpdateStaffList) return;
    const targetIds = new Set(filteredCalculations.map((c) => c.staffId));
    const updated = staffList.map((s) =>
      targetIds.has(s.id) ? { ...s, payFrequency: frequency as any } : s
    );
    onUpdateStaffList(updated);
    saveCompanyData(STORAGE_KEYS.STAFF, updated, companyName);
    setIsBulkSetModalOpen(false);
    emitGlobalToast(`Updated pay frequency to ${frequency} for ${targetIds.size} staff`, 'success');
  };

  const handleBulkSetPayGrade = (grade: PayGradeTier) => {
    if (!onUpdateStaffList) return;
    const targetIds = new Set(filteredCalculations.map((c) => c.staffId));
    const updated = staffList.map((s) => {
      if (!targetIds.has(s.id)) return s;
      let salary = s.estimatedMonthlySalary || 0;
      if (salary < grade.minSalary) salary = grade.minSalary;
      if (salary > grade.maxSalary) salary = grade.maxSalary;
      return {
        ...s,
        payGrade: grade.name,
        estimatedMonthlySalary: salary,
        payFrequency: (s.payFrequency || grade.defaultFrequency || 'Monthly') as any,
      };
    });
    onUpdateStaffList(updated);
    saveCompanyData(STORAGE_KEYS.STAFF, updated, companyName);
    setIsBulkSetModalOpen(false);
    emitGlobalToast(`Assigned salary grade "${grade.name}" to ${targetIds.size} staff`, 'success');
  };

  return (
    <div className="space-y-4">
      {/* 1. Cycle Context & Date Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Active Payroll Registry</span>
              </span>

              {isSimultaneousRun ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Simultaneous Run: {activeFrequenciesDue.join(' + ')}</span>
                </span>
              ) : activeFrequenciesDue.length === 1 ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Active Cycle: {activeFrequenciesDue[0]}</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  No Standard Frequency Due On This Day
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review current cycle allowances, automatic statutory & disciplinary deductions, and execute pay roll.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <label htmlFor="eval-date-input" className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Payroll Date:
              </label>
              <input
                id="eval-date-input"
                type="date"
                value={evaluationDate}
                onChange={(e) => setEvaluationDate(e.target.value || todayStr)}
                className="text-xs font-mono font-semibold bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              />
              {evaluationDate !== todayStr && (
                <button
                  type="button"
                  onClick={() => setEvaluationDate(todayStr)}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Today
                </button>
              )}
            </div>

            {/* Execute Roll Button (Opens Modal with Deductions & Allowances Tabs + Downloads/Charts) */}
            <button
              type="button"
              onClick={() => onExecuteRoll(frequencyFilter === 'due_today' ? undefined : frequencyFilter, filteredCalculations)}
              className="px-4 py-2 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 flex items-center gap-2 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Execute Payroll</span>
            </button>
          </div>
        </div>

        {/* Schedule Reference Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px]">
          <div className="flex items-center gap-4 flex-wrap text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Scheduled Kickoffs:</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              Weekly: <strong>{formatToDdMmYyyy(nextWeekly)}</strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
              Bi-Weekly: <strong>{formatToDdMmYyyy(nextBiWeekly)}</strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Monthly: <strong>{formatToDdMmYyyy(nextMonthly)}</strong>
            </span>
          </div>

          <div className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">
            Formula: x = (Base Salary / Days of Month). Counted Days × x. Count resets to 0 upon execution.
          </div>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (Gross, Allowances, Deductions, Net Disbursal) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Employees in Active Run</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {summary.staffCount}
            </span>
            <span className="text-[11px] text-slate-400">
              {frequencyFilter === 'due_today' ? 'due on date' : 'filtered'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Gross Base Salary</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {currencySymbol}{summary.gross.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">Allowances Sum</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              +{currencySymbol}{summary.totalBonuses.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-rose-500 dark:text-rose-400 block">Deductions Sum</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              -{currencySymbol}{summary.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 block">Net Disbursal Pay</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {currencySymbol}{summary.net.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Frequency Selector Toolbar (Search bar removed from this row as requested) */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full">
          <button
            type="button"
            onClick={() => setFrequencyFilter('due_today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              frequencyFilter === 'due_today'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>Active Due on Date</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/20">
              {dueTodayCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFrequencyFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              frequencyFilter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Staff ({allCalculations.length})
          </button>

          <button
            type="button"
            onClick={() => setFrequencyFilter('Weekly')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              frequencyFilter === 'Weekly'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>Weekly</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${frequencyFilter === 'Weekly' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
              {formatToDdMmYyyy(nextWeekly)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFrequencyFilter('Bi-Weekly')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              frequencyFilter === 'Bi-Weekly'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>Bi-Weekly</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${frequencyFilter === 'Bi-Weekly' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
              {formatToDdMmYyyy(nextBiWeekly)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFrequencyFilter('Monthly')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              frequencyFilter === 'Monthly'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>Monthly</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${frequencyFilter === 'Monthly' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
              {formatToDdMmYyyy(nextMonthly)}
            </span>
          </button>
        </div>
      </div>

      {/* 3b. Search Bar on top of filters section */}
      <div className="relative w-full">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search employee name, ID, role, or department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-9 py-2.5 rounded-2xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3c. Single-Line Filters & Actions Bar */}
      <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-2 shrink-0">
          {/* Department Filter */}
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="All">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Salary Grade Filter */}
          <select
            value={selectedGradeFilter}
            onChange={(e) => setSelectedGradeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="All">All Pay Grades</option>
            {config.payGrades.map((grade) => (
              <option key={grade.id} value={grade.name}>
                {grade.name}
              </option>
            ))}
          </select>

          {/* Sort Dropdown */}
          <select
            value={`${sortField}-${sortDirection}`}
            onChange={(e) => {
              const [f, d] = e.target.value.split('-');
              setSortField(f as any);
              setSortDirection(d as any);
            }}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="name-asc">Sort: Name (A-Z)</option>
            <option value="name-desc">Sort: Name (Z-A)</option>
            <option value="baseSalary-desc">Sort: Salary (High to Low)</option>
            <option value="baseSalary-asc">Sort: Salary (Low to High)</option>
            <option value="totalBonuses-desc">Sort: Allowances (Highest)</option>
            <option value="totalDeductions-desc">Sort: Deductions (Highest)</option>
            <option value="netSalary-desc">Sort: Net Pay (Highest)</option>
          </select>

          {/* Reset Filters */}
          {(selectedDeptFilter !== 'All' || selectedGradeFilter !== 'All' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setSelectedDeptFilter('All');
                setSelectedGradeFilter('All');
                setSearchTerm('');
              }}
              className="px-2 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        {/* Action Controls: Bulk Set All To */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsBulkSetModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition"
            title="Bulk set frequency or pay grade for filtered employees"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200" />
            <span>Set All To...</span>
          </button>

          <span className="text-[11px] text-slate-500 font-mono pl-1">
            {filteredCalculations.length} staff
          </span>
        </div>
      </div>

      {/* 4. Primary Booking Table (With Allowances Sum & Deductions Sum) */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Pay Frequency</th>
                <th className="py-3 px-4 text-right">Base Salary</th>
                <th className="py-3 px-4 text-right">Allowances Sum</th>
                <th className="py-3 px-4 text-right">Deductions Sum</th>
                <th className="py-3 px-4 text-right">Net Pay</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCalculations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-500" />
                    <p className="font-semibold text-sm">No employees found for this schedule selection</p>
                    <p className="text-xs mt-1">
                      {frequencyFilter === 'due_today'
                        ? 'Try switching to "All Staff" or selecting another evaluation date.'
                        : 'No records match the active search or filter criteria.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCalculations.map((calc) => {
                  const staffFreq = calc.payFrequency || config.defaultPayFrequency || 'Monthly';
                  const isDueOnEvalDate = isPayFrequencyDueOnDate(staffFreq, evaluationDate, config.rollRules);
                  const susp = calc.suspensionDetails;
                  const hasSuspensionDeduction = susp && susp.hasActiveSuspension && susp.deductionAmount > 0;

                  return (
                    <tr
                      key={calc.staffId}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Name & Role */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                            {calc.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">{calc.name}</span>
                              <span className="text-[10px] font-mono text-slate-400">{calc.employeeId}</span>
                              {hasSuspensionDeduction && (
                                <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  Suspended ({susp.countedDays}d)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              <span>{calc.role}</span>
                              <span>•</span>
                              <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px]">
                                {calc.department || 'General'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Pay Frequency */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {staffFreq}
                          </span>
                          {isDueOnEvalDate ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              Due Today
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                              Upcoming
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Base Salary */}
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                        {currencySymbol}{calc.baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Allowances Sum */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {calc.totalBonuses > 0
                            ? `+${currencySymbol}${calc.totalBonuses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : `${currencySymbol}0.00`}
                        </span>
                      </td>

                      {/* Active Deductions */}
                      <td className="py-3.5 px-4 text-right">
                        <div>
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                            {calc.totalDeductions > 0 ? `-${currencySymbol}${calc.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `${currencySymbol}0.00`}
                          </span>

                          {/* Deduction Chips */}
                          <div className="flex items-center justify-end gap-1 mt-1 flex-wrap">
                            {calc.corporateDeductions > 0 && (
                              <span className="px-1.5 py-0.2 rounded-md text-[9px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                Corp: {currencySymbol}{calc.corporateDeductions.toFixed(0)}
                              </span>
                            )}
                            {calc.penaltiesTotal > 0 && (
                              <span className="px-1.5 py-0.2 rounded-md text-[9px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                Fines: {currencySymbol}{calc.penaltiesTotal.toFixed(0)}
                              </span>
                            )}
                            {susp && susp.hasActiveSuspension && susp.deductionAmount > 0 && (
                              <span
                                className="px-1.5 py-0.2 rounded-md text-[9px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 cursor-help"
                                title={`Counted ${susp.countedDays}d before payroll × ${currencySymbol}${susp.dailyRateX}/d`}
                              >
                                Susp: {currencySymbol}{susp.deductionAmount.toFixed(0)} ({susp.countedDays}d)
                              </span>
                            )}
                            {((calc.absenteeDeduction || 0) + (calc.latenessDeduction || 0)) > 0 && (
                              <span
                                className="px-1.5 py-0.2 rounded-md text-[9px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-help"
                                title={`Attendance: ${calc.attendanceDetails?.absentDays || 0} absent, ${calc.attendanceDetails?.lateDays || 0} late`}
                              >
                                Att: {currencySymbol}{((calc.absenteeDeduction || 0) + (calc.latenessDeduction || 0)).toFixed(0)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Net Pay */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          {currencySymbol}{calc.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Actions (View Payslip replaces old Deductions button) */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedPayslipStaff(calc)}
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs flex items-center gap-1.5 mx-auto cursor-pointer transition shadow-2xs"
                          title="View official employee payslip statement"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Payslip</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Displaying <strong>{filteredCalculations.length}</strong> staff members for this payroll view. Next run expected on: <strong className="text-slate-800 dark:text-slate-200 font-mono">{nextExpectedRunFormatted}</strong>.
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-500">
              Total Run Net: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{currencySymbol}{summary.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* MODAL 1: Employee Monthly Payslip Statement */}
      {selectedPayslipStaff && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
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
                    Tax Ref: {config.taxIdentificationNumber || 'TAX-CORP-0982'}
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
                    {evaluationDate || todayStr}
                  </div>
                  <div className="mt-1">Frequency:</div>
                  <div className="font-bold text-indigo-500">{selectedPayslipStaff.payFrequency || 'Monthly'}</div>
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
                      {currencySymbol}{selectedPayslipStaff.baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                        +{currencySymbol}{b.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 font-semibold text-slate-900 dark:text-white">
                    <span>Total Gross Earnings</span>
                    <span className="font-mono">
                      {currencySymbol}{(selectedPayslipStaff.baseSalary + selectedPayslipStaff.totalBonuses).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="space-y-2">
                <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 font-mono uppercase tracking-wider text-[10px]">
                  2. Statutory & Corporate Deductions
                </h5>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {selectedPayslipStaff.deductionBreakdown.length === 0 ? (
                    <div className="p-2.5 bg-white dark:bg-slate-900 text-slate-400 italic">
                      No active deductions applied for this cycle
                    </div>
                  ) : (
                    selectedPayslipStaff.deductionBreakdown.map((d, i) => (
                      <div
                        key={i}
                        className="flex justify-between p-2.5 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400"
                      >
                        <span>
                          {d.name} ({d.type})
                        </span>
                        <span className="font-mono font-bold">
                          -{currencySymbol}{d.amount.toFixed(2)}
                        </span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 font-semibold text-rose-600 dark:text-rose-400">
                    <span>Total Cycle Deductions</span>
                    <span className="font-mono font-bold">
                      -{currencySymbol}{selectedPayslipStaff.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
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
                  {currencySymbol}{selectedPayslipStaff.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {/* MODAL 2: Bulk Update "Set All To..." Modal */}
      {isBulkSetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Bulk Assignment & Configuration
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkSetModalOpen(false)}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Option A: Bulk Set Pay Frequency */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span>Option A: Set Pay Frequency For All Filtered</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Update payment cycle for all <strong>{filteredCalculations.length} currently filtered staff members</strong>.
                </p>
                <div className="flex gap-2 pt-1 flex-wrap">
                  {(['Weekly', 'Bi-Weekly', 'Monthly'] as const).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => handleBulkSetFrequency(freq)}
                      className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer transition shadow-2xs"
                    >
                      Set to {freq}
                    </button>
                  ))}
                </div>
              </div>

              {/* Option B: Bulk Set Pay Grade */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-purple-500" />
                  <span>Option B: Set Salary Grade Tier For All Filtered</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Assign all <strong>{filteredCalculations.length} filtered staff</strong> to a designated grade tier.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
                  {config.payGrades.map((grade) => (
                    <button
                      key={grade.id}
                      type="button"
                      onClick={() => handleBulkSetPayGrade(grade)}
                      className="p-2.5 text-left rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer transition shadow-2xs group"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600">
                        {grade.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {currencySymbol}{grade.minSalary.toLocaleString()} - {currencySymbol}{grade.maxSalary.toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsBulkSetModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Export Payroll Tabulation */}
      {isExportModalOpen && (
        <ExportPayrollModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          staffList={staffList}
          config={config}
          currencySymbol={currencySymbol}
          companyName={companyName}
          defaultEvaluationDate={evaluationDate}
          defaultFrequency={frequencyFilter === 'due_today' ? 'all' : frequencyFilter}
          defaultDepartment={selectedDeptFilter}
          defaultGrade={selectedGradeFilter}
        />
      )}
    </div>
  );
};
