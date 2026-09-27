import React, { useState, useMemo } from 'react';
import {
  X,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  DollarSign,
  Layers,
  Coins,
  Download,
  BarChart3,
  Search,
  ChevronRight,
  Printer,
  Sparkles,
  TrendingDown,
  TrendingUp,
  PieChart,
  UserCheck,
  Calendar,
  FileSpreadsheet,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { PayrollConfig, StaffMember } from '../../types';
import { StaffPayrollCalculation } from '../../utils/payrollUtils';
import { emitGlobalToast } from '../../context/ToastContext';
import { ExportPayrollModal } from './ExportPayrollModal';

interface ExecuteRollModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList?: StaffMember[];
  config?: PayrollConfig;
  currencySymbol?: string;
  calculations?: StaffPayrollCalculation[];
  activePenaltiesCount?: number;
  totalActivePenaltiesAmount?: number;
  totalGrossSalary?: number;
  totalNetDisbursal?: number;
  totalSuspensionsAmount?: number;
  suspensionsCount?: number;
  targetFrequency?: string;
  staffCount?: number;
  companyName?: string;
  onConfirmRoll: () => void;
  onViewStaffPayslip?: (calc: StaffPayrollCalculation) => void;
  onProceedToBankTransfers?: () => void;
  onMarkAsCompleted?: () => void;
  onGoToDebitAccountConfig?: () => void;
}

export const ExecuteRollModal: React.FC<ExecuteRollModalProps> = ({
  isOpen,
  onClose,
  staffList = [],
  config,
  currencySymbol: customCurrencySymbol,
  calculations = [],
  activePenaltiesCount,
  totalActivePenaltiesAmount,
  totalGrossSalary,
  totalNetDisbursal,
  totalSuspensionsAmount = 0,
  suspensionsCount = 0,
  targetFrequency,
  staffCount,
  companyName,
  onConfirmRoll,
  onViewStaffPayslip,
  onProceedToBankTransfers,
  onMarkAsCompleted,
  onGoToDebitAccountConfig,
}) => {
  const [hasExecuted, setHasExecuted] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [showMissingBankPrompt, setShowMissingBankPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<'deductions' | 'bonuses'>('deductions');
  const [deductionCategoryFilter, setDeductionCategoryFilter] = useState<'all' | 'corporate' | 'penalty' | 'suspension' | 'attendance'>('all');
  const [bonusCategoryFilter, setBonusCategoryFilter] = useState<'all' | 'default' | 'performance' | 'custom'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCharts, setShowCharts] = useState(false);

  const currencySymbol = customCurrencySymbol || config?.currencySymbol || '$';

  // Target staff calculations (if filtered by frequency)
  const targetCalculations = useMemo(() => {
    if (!targetFrequency || targetFrequency === 'all' || targetFrequency === 'due_today') {
      return calculations;
    }
    return calculations.filter(
      (c) => (c.payFrequency || config?.defaultPayFrequency || 'Monthly') === targetFrequency
    );
  }, [calculations, targetFrequency, config?.defaultPayFrequency]);

  // Aggregate high-level totals
  const metrics = useMemo(() => {
    let gross = 0;
    let allowances = 0;
    let deductions = 0;
    let net = 0;

    let corpDeductions = 0;
    let penaltyDeductions = 0;
    let suspDeductions = 0;
    let attDeductions = 0;

    targetCalculations.forEach((c) => {
      gross += c.baseSalary || 0;
      allowances += c.totalBonuses || 0;
      deductions += c.totalDeductions || 0;
      net += c.netSalary || 0;

      corpDeductions += c.corporateDeductions || 0;
      penaltyDeductions += c.penaltiesTotal || 0;
      suspDeductions += c.suspensionDeduction || 0;
      attDeductions += (c.absenteeDeduction || 0) + (c.latenessDeduction || 0);
    });

    // Fallbacks if calculations array is empty
    if (targetCalculations.length === 0) {
      gross = totalGrossSalary ?? 0;
      deductions = (totalActivePenaltiesAmount ?? 0) + (totalSuspensionsAmount ?? 0);
      net = totalNetDisbursal ?? 0;
      penaltyDeductions = totalActivePenaltiesAmount ?? 0;
      suspDeductions = totalSuspensionsAmount ?? 0;
    }

    return {
      gross,
      allowances,
      deductions,
      net,
      corpDeductions,
      penaltyDeductions,
      suspDeductions,
      attDeductions,
      staffCount: targetCalculations.length > 0 ? targetCalculations.length : (staffCount ?? 0),
    };
  }, [targetCalculations, totalGrossSalary, totalNetDisbursal, totalActivePenaltiesAmount, totalSuspensionsAmount, staffCount]);

  // Deductions view filtering
  const filteredDeductions = useMemo(() => {
    return targetCalculations.filter((c) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.employeeId.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (deductionCategoryFilter === 'all') return c.totalDeductions > 0;
      if (deductionCategoryFilter === 'corporate') return (c.corporateDeductions || 0) > 0;
      if (deductionCategoryFilter === 'penalty') return (c.penaltiesTotal || 0) > 0;
      if (deductionCategoryFilter === 'suspension') return (c.suspensionDeduction || 0) > 0;
      if (deductionCategoryFilter === 'attendance') {
        return (c.absenteeDeduction || 0) > 0 || (c.latenessDeduction || 0) > 0;
      }
      return true;
    });
  }, [targetCalculations, searchTerm, deductionCategoryFilter]);

  // Allowances view filtering
  const filteredAllowances = useMemo(() => {
    return targetCalculations.filter((c) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.employeeId.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (bonusCategoryFilter === 'all') return c.totalBonuses > 0;
      if (bonusCategoryFilter === 'performance') {
        return c.bonusBreakdown.some((b) => b.name.toLowerCase().includes('kpi') || b.name.toLowerCase().includes('performance') || b.name.toLowerCase().includes('merit'));
      }
      if (bonusCategoryFilter === 'default') {
        return c.bonusBreakdown.some((b) => b.name.toLowerCase().includes('housing') || b.name.toLowerCase().includes('transport') || b.name.toLowerCase().includes('birthday') || b.name.toLowerCase().includes('medical'));
      }
      return c.totalBonuses > 0;
    });
  }, [targetCalculations, searchTerm, bonusCategoryFilter]);

  // Export CSV of Deductions
  const handleExportDeductionsCSV = () => {
    const headers = [
      'Employee ID',
      'Employee Name',
      'Department',
      'Role',
      'Pay Frequency',
      'Base Salary',
      'Corporate Deductions',
      'Active Penalties',
      'Suspension Proration',
      'Attendance Absenteeism',
      'Attendance Lateness',
      'Total Deductions',
      'Net Pay',
    ];

    const rows = targetCalculations.map((c) => [
      `"${c.employeeId}"`,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.department.replace(/"/g, '""')}"`,
      `"${c.role.replace(/"/g, '""')}"`,
      `"${c.payFrequency || 'Monthly'}"`,
      c.baseSalary.toFixed(2),
      c.corporateDeductions.toFixed(2),
      c.penaltiesTotal.toFixed(2),
      (c.suspensionDeduction || 0).toFixed(2),
      (c.absenteeDeduction || 0).toFixed(2),
      (c.latenessDeduction || 0).toFixed(2),
      c.totalDeductions.toFixed(2),
      c.netSalary.toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Payroll_Deductions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    emitGlobalToast('Deductions breakdown exported to CSV', 'success');
  };

  // Export CSV of Allowances
  const handleExportAllowancesCSV = () => {
    const headers = [
      'Employee ID',
      'Employee Name',
      'Department',
      'Role',
      'Pay Frequency',
      'Base Salary',
      'Active Allowances / Bonuses List',
      'Total Allowances',
      'Net Pay',
    ];

    const rows = targetCalculations.map((c) => {
      const breakdownText = c.bonusBreakdown.map((b) => `${b.name} (+${currencySymbol}${b.amount.toFixed(0)})`).join('; ');
      return [
        `"${c.employeeId}"`,
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.department.replace(/"/g, '""')}"`,
        `"${c.role.replace(/"/g, '""')}"`,
        `"${c.payFrequency || 'Monthly'}"`,
        c.baseSalary.toFixed(2),
        `"${breakdownText.replace(/"/g, '""')}"`,
        c.totalBonuses.toFixed(2),
        c.netSalary.toFixed(2),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Payroll_Allowances_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    emitGlobalToast('Allowances & bonuses exported to CSV', 'success');
  };

  // Download Payslips (Consolidated Batch Statement CSV)
  const handleDownloadAllPayslips = () => {
    const headers = [
      'Statement Date',
      'Company Name',
      'Tax Identification Number',
      'Employee ID',
      'Employee Name',
      'Department',
      'Role',
      'Pay Frequency',
      'Gross Base Salary',
      'Itemized Allowances',
      'Total Allowances',
      'Itemized Deductions',
      'Total Deductions',
      'Net Disbursal Salary',
    ];

    const todayStr = new Date().toISOString().split('T')[0];
    const rows = targetCalculations.map((c) => {
      const allowStr = c.bonusBreakdown.map((b) => `${b.name} (${currencySymbol}${b.amount.toFixed(2)})`).join(' | ');
      const dedStr = c.deductionBreakdown.map((d) => `${d.name} (${currencySymbol}${d.amount.toFixed(2)})`).join(' | ');

      return [
        `"${todayStr}"`,
        `"${(companyName || 'Corporate Workforce Organization').replace(/"/g, '""')}"`,
        `"${config?.taxIdentificationNumber || 'N/A'}"`,
        `"${c.employeeId}"`,
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.department.replace(/"/g, '""')}"`,
        `"${c.role.replace(/"/g, '""')}"`,
        `"${c.payFrequency || 'Monthly'}"`,
        c.baseSalary.toFixed(2),
        `"${allowStr.replace(/"/g, '""')}"`,
        c.totalBonuses.toFixed(2),
        `"${dedStr.replace(/"/g, '""')}"`,
        c.totalDeductions.toFixed(2),
        c.netSalary.toFixed(2),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Batch_Payslips_${companyName || 'Corporate'}_${todayStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    emitGlobalToast(`Consolidated payslip statements downloaded for ${targetCalculations.length} staff`, 'success');
  };

  // Department analytics for charts
  const departmentBreakdown = useMemo(() => {
    const map = new Map<string, { gross: number; deductions: number; allowances: number; net: number; count: number }>();
    targetCalculations.forEach((c) => {
      const dept = c.department || 'General';
      const curr = map.get(dept) || { gross: 0, deductions: 0, allowances: 0, net: 0, count: 0 };
      curr.gross += c.baseSalary;
      curr.deductions += c.totalDeductions;
      curr.allowances += c.totalBonuses;
      curr.net += c.netSalary;
      curr.count += 1;
      map.set(dept, curr);
    });
    return Array.from(map.entries()).map(([department, data]) => ({
      department,
      ...data,
    })).sort((a, b) => b.net - a.net);
  }, [targetCalculations]);

  const handleConfirmAndExecute = () => {
    onConfirmRoll();
    setHasExecuted(true);
    emitGlobalToast(
      'Payroll confirmed and executed! Penalties settled and suspension counters reset.',
      'success'
    );
  };

  const handleProceedToTransfers = () => {
    const hasDebitBankConfigured = Boolean(
      config?.debitAccount?.isConfigured &&
      config?.debitAccount?.bankName?.trim() &&
      config?.debitAccount?.accountNumber?.trim()
    );

    if (!hasDebitBankConfigured) {
      setShowMissingBankPrompt(true);
    } else {
      onClose();
      if (onProceedToBankTransfers) onProceedToBankTransfers();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${
              hasExecuted 
                ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40' 
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            }`}>
              {hasExecuted ? <CheckCircle2 className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {hasExecuted ? 'Execute Payroll & Disburse Cycle' : 'Check and Confirm Payroll & Cycle'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                  {targetFrequency && targetFrequency !== 'all' ? `${targetFrequency} Cycle` : 'All Active Cycles'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {metrics.staffCount} Staff Members
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {hasExecuted
                  ? 'All cycle penalties settled. Disburse via bank transfers, export for manual 3rd party execution, or mark run as complete.'
                  : 'Review cycle deductions, active allowances, download consolidated payslips, and check all figures before proceeding.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer self-start sm:self-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {hasExecuted ? (
          /* POST-EXECUTION VIEW */
          <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 max-w-4xl mx-auto w-full">
            {/* Success Hero Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  Payroll Execution & Settlement
                </h3>
                <p className="text-xs text-slate-300 max-w-lg mx-auto mt-1 leading-relaxed">
                  All active disciplinary penalties have been marked as <strong>Settled</strong>, suspension counters reset to <strong>0</strong>, and cycle totals compiled for <strong>{metrics.staffCount} staff members</strong>.
                </p>
              </div>

              {/* Execution Summary Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 max-w-2xl mx-auto text-left">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Staff Count</span>
                  <span className="text-base font-bold font-mono text-white mt-0.5 block">{metrics.staffCount}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold block">Allowances Sum</span>
                  <span className="text-base font-bold font-mono text-emerald-300 mt-0.5 block">+{currencySymbol}{metrics.allowances.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-[10px] font-mono uppercase text-rose-400 font-bold block">Deductions Sum</span>
                  <span className="text-base font-bold font-mono text-rose-300 mt-0.5 block">-{currencySymbol}{metrics.deductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-500/20 border border-indigo-500/30">
                  <span className="text-[10px] font-mono uppercase text-indigo-300 font-bold block">Total Net Pay</span>
                  <span className="text-base font-bold font-mono text-white mt-0.5 block">{currencySymbol}{metrics.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Next Steps Action Cards */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Recommended Actions:
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Export Payroll Button Card (Manual 3rd Party Application) */}
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-800/90 border-2 border-emerald-500/40 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 transition-all cursor-pointer group text-left flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                      <span>Execute Manually (Export & Use 3rd Party App)</span>
                      <ChevronRight className="w-4 h-4 text-emerald-500 group-hover:translate-x-1 transition" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Download the complete payroll tabulation spreadsheet (.xlsx / .csv) containing each staff's gross, net pay, itemized allowances, and descriptive manual deductions for external banking or accounting software.
                    </p>
                    <span className="inline-flex items-center gap-1 mt-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <span>Open Export Modal (.xlsx / .csv)</span>
                      <span>→</span>
                    </span>
                  </div>
                </button>

                {/* 2. Execute via Bank Transfers Card */}
                <button
                  type="button"
                  onClick={handleProceedToTransfers}
                  className="p-5 rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer group text-left flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/20 text-white border border-white/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-sm sm:text-base text-white">
                      <span>Execute via Bank Transfers</span>
                      <ArrowRight className="w-4 h-4 text-indigo-200 group-hover:translate-x-1 transition" />
                    </div>
                    <p className="text-xs text-indigo-100 mt-1 leading-relaxed">
                      Disburse payroll directly through bank transfer rails. Verifies corporate debit account configuration before batch transaction execution.
                    </p>
                    <span className="inline-flex items-center gap-1 mt-2.5 text-xs font-bold text-indigo-200 group-hover:text-white">
                      <span>Open Bank Transfers Workspace</span>
                      <span>→</span>
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* PRE-EXECUTION VIEW */
          <>
            {/* Executive Summary Metrics Banner */}
            <div className="p-5 bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Gross Base Salary</span>
                  <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                    {currencySymbol}{metrics.gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{metrics.staffCount} staff evaluated</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">All Allowances / Bonuses</span>
                  <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    +{currencySymbol}{metrics.allowances.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Recurring stipends & merit</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block">All Total Deductions</span>
                  <div className="text-lg sm:text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                    -{currencySymbol}{metrics.deductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Corp, fines, susp & att</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 block">Net Disbursal Pay</span>
                  <div className="text-lg sm:text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                    {currencySymbol}{metrics.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Actual net payout</span>
                </div>
              </div>
            </div>

            {/* Modal Tabs Navigation & Search Bar */}
            <div className="px-5 pt-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('deductions')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    activeTab === 'deductions'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  <span>All Deductions</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                    {filteredDeductions.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('bonuses')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    activeTab === 'bonuses'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  <span>All Allowances / Bonuses</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                    {filteredAllowances.length}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2 pb-2 sm:pb-0">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff, ID, department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {activeTab === 'deductions' ? (
              <button
                type="button"
                onClick={handleExportDeductionsCSV}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExportAllowancesCSV}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive Analysis Charts Drawer/Panel */}
        {showCharts && (
          <div className="p-4 bg-slate-900 text-white border-b border-slate-800 shrink-0 space-y-3 animate-in slide-in-from-top duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Cycle Analysis & Visual Breakdown
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowCharts(false)}
                className="text-[11px] text-slate-400 hover:text-white font-medium underline"
              >
                Hide Charts
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Chart 1: Proportional Distribution Bar */}
              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/70 space-y-2">
                <div className="text-[11px] font-bold text-slate-300">Financial Ratio Distribution</div>
                <div className="h-4 w-full bg-slate-700 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${Math.min(100, (metrics.net / (metrics.gross || 1)) * 100)}%` }}
                    title={`Net Pay: ${((metrics.net / (metrics.gross || 1)) * 100).toFixed(1)}%`}
                  />
                  <div
                    className="bg-rose-500 h-full transition-all"
                    style={{ width: `${Math.min(100, (metrics.deductions / (metrics.gross || 1)) * 100)}%` }}
                    title={`Deductions: ${((metrics.deductions / (metrics.gross || 1)) * 100).toFixed(1)}%`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Net Pay: {currencySymbol}{metrics.net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    Deductions: {currencySymbol}{metrics.deductions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* Chart 2: Deductions Breakdown by Category */}
              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/70 space-y-2">
                <div className="text-[11px] font-bold text-slate-300">Deduction Categories</div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Corporate & Statutory</span>
                    <span className="font-mono font-bold text-blue-400">{currencySymbol}{metrics.corpDeductions.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active Fines / Penalties</span>
                    <span className="font-mono font-bold text-amber-400">{currencySymbol}{metrics.penaltyDeductions.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Suspension Prorated</span>
                    <span className="font-mono font-bold text-indigo-400">{currencySymbol}{metrics.suspDeductions.toFixed(0)}</span>
                  </div>
                  {metrics.attDeductions > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Attendance (Absent/Late)</span>
                      <span className="font-mono font-bold text-emerald-400">{currencySymbol}{metrics.attDeductions.toFixed(0)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chart 3: Department Spend Share */}
              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/70 space-y-2">
                <div className="text-[11px] font-bold text-slate-300">Top Department Load</div>
                <div className="space-y-1 text-[10px] max-h-24 overflow-y-auto pr-1">
                  {departmentBreakdown.slice(0, 4).map((d) => (
                    <div key={d.department} className="flex items-center justify-between">
                      <span className="text-slate-300 truncate max-w-[120px]">{d.department} ({d.count})</span>
                      <span className="font-mono font-bold text-emerald-400">{currencySymbol}{d.net.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'deductions' ? (
            <div className="space-y-4">
              {/* Category Filter Pills for Deductions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setDeductionCategoryFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    deductionCategoryFilter === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  All Categories ({targetCalculations.filter((c) => c.totalDeductions > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setDeductionCategoryFilter('corporate')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    deductionCategoryFilter === 'corporate'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Corporate ({targetCalculations.filter((c) => (c.corporateDeductions || 0) > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setDeductionCategoryFilter('penalty')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    deductionCategoryFilter === 'penalty'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Incurred Fines ({targetCalculations.filter((c) => (c.penaltiesTotal || 0) > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setDeductionCategoryFilter('suspension')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    deductionCategoryFilter === 'suspension'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Suspensions ({targetCalculations.filter((c) => (c.suspensionDeduction || 0) > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setDeductionCategoryFilter('attendance')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    deductionCategoryFilter === 'attendance'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Attendance ({targetCalculations.filter((c) => (c.absenteeDeduction || 0) > 0 || (c.latenessDeduction || 0) > 0).length})
                </button>
              </div>

              {/* Deductions Staff Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4">Pay Frequency</th>
                        <th className="py-3 px-4 text-right">Base Salary</th>
                        <th className="py-3 px-4">Itemized Deductions Breakdown</th>
                        <th className="py-3 px-4 text-right">Total Deductions</th>
                        <th className="py-3 px-4 text-right">Net Salary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredDeductions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-400">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-1.5 opacity-40 text-emerald-500" />
                            <p className="font-semibold text-xs">No active deductions recorded for this filter</p>
                          </td>
                        </tr>
                      ) : (
                        filteredDeductions.map((calc) => (
                          <tr key={calc.staffId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 dark:text-white">{calc.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {calc.employeeId} • {calc.department}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">
                              {calc.payFrequency || 'Monthly'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold">
                              {currencySymbol}{calc.baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {calc.deductionBreakdown.map((d, i) => (
                                  <span
                                    key={i}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                                      d.name.includes('Penalty')
                                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                        : d.name.includes('Suspension')
                                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                        : d.name.includes('Absent') || d.name.includes('Late')
                                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                        : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                    }`}
                                  >
                                    {d.name}: -{currencySymbol}{d.amount.toFixed(0)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                              -{currencySymbol}{calc.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {currencySymbol}{calc.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Category Filter Pills for Allowances */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setBonusCategoryFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    bonusCategoryFilter === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  All Allowances ({targetCalculations.filter((c) => c.totalBonuses > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setBonusCategoryFilter('default')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    bonusCategoryFilter === 'default'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Corporate Defaults (Housing, Transport, Medical)
                </button>
                <button
                  type="button"
                  onClick={() => setBonusCategoryFilter('performance')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    bonusCategoryFilter === 'performance'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Performance & KPI Incentives
                </button>
              </div>

              {/* Allowances Staff Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4">Pay Frequency</th>
                        <th className="py-3 px-4 text-right">Base Salary</th>
                        <th className="py-3 px-4">Itemized Allowances Breakdown</th>
                        <th className="py-3 px-4 text-right">Total Allowances</th>
                        <th className="py-3 px-4 text-right">Net Salary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredAllowances.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-400">
                            <Coins className="w-8 h-8 mx-auto mb-1.5 opacity-40 text-amber-500" />
                            <p className="font-semibold text-xs">No allowances or bonuses recorded for this filter</p>
                          </td>
                        </tr>
                      ) : (
                        filteredAllowances.map((calc) => (
                          <tr key={calc.staffId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 dark:text-white">{calc.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {calc.employeeId} • {calc.department}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">
                              {calc.payFrequency || 'Monthly'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold">
                              {currencySymbol}{calc.baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {calc.bonusBreakdown.map((b, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                  >
                                    {b.name}: +{currencySymbol}{b.amount.toFixed(0)} ({b.type})
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              +{currencySymbol}{calc.totalBonuses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {currencySymbol}{calc.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Settle Rules Notice */}
          <div className="mt-4 p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div>
              <strong className="block font-bold">Automatic Settlement & Suspension Reset Logic:</strong>
              Confirming execution registers this pay run, automatically marks all active disciplinary penalties as <strong>Settled</strong>, and resets all employee suspension counted days before payroll back to <strong>0</strong> for the next cycle.
            </div>
          </div>
        </div>
      </>
    )}

        {/* Modal Bottom Action Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
          {hasExecuted ? (
            <div className="flex items-center justify-between w-full gap-3 flex-wrap">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold text-xs transition cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (onMarkAsCompleted) onMarkAsCompleted();
                    onClose();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Mark as Complete</span>
                </button>

                <button
                  type="button"
                  onClick={handleProceedToTransfers}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-2 cursor-pointer transition"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Execute via Bank Transfers</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadAllPayslips}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition shadow-2xs"
                >
                  <Download className="w-4 h-4 text-indigo-500" />
                  <span>Download Payslips</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCharts(!showCharts)}
                  className={`px-3.5 py-2 rounded-xl border font-bold text-xs flex items-center gap-2 cursor-pointer transition shadow-2xs ${
                    showCharts
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-purple-500" />
                  <span>{showCharts ? 'Hide Analysis Charts' : 'Generate Analysis Charts'}</span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndExecute}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center gap-2 cursor-pointer transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm and Proceed</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Missing Debit Bank Information Dialog */}
      {showMissingBankPrompt && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Debit Bank Information Required
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Corporate funding account not set up
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-amber-50/70 dark:bg-amber-950/30 p-3.5 rounded-2xl border border-amber-200 dark:border-amber-800/60">
              Your company has not configured debit bank account information for automated disbursements. Would you like to set up the debit bank information now?
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowMissingBankPrompt(false);
                  onClose();
                  if (onProceedToBankTransfers) onProceedToBankTransfers();
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold text-xs cursor-pointer order-2 sm:order-1 text-center"
              >
                Proceed Without Bank Info
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMissingBankPrompt(false);
                  onClose();
                  if (onGoToDebitAccountConfig) onGoToDebitAccountConfig();
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition order-1 sm:order-2"
              >
                <Building2 className="w-4 h-4" />
                <span>Yes, Set Up Bank Information</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Payroll Tabulation Modal */}
      {isExportModalOpen && (
        <ExportPayrollModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          staffList={staffList}
          config={config}
          currencySymbol={currencySymbol}
          companyName={companyName}
          defaultFrequency={targetFrequency && targetFrequency !== 'all' ? targetFrequency : 'all'}
        />
      )}
    </div>
  );
};
