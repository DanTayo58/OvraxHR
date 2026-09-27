import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  FileSpreadsheet,
  X,
  Printer,
  Copy,
  Check,
  Filter,
  DollarSign,
  Building2,
  Users,
  Search,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { StaffMember, PayrollConfig } from '../../types';
import { calculateStaffPayroll, isPayFrequencyDueOnDate, StaffPayrollCalculation } from '../../utils/payrollUtils';
import { emitGlobalToast } from '../../context/ToastContext';

function formatToDdMmYyyy(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

interface ExportPayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  config: PayrollConfig;
  currencySymbol?: string;
  companyName?: string;
  defaultEvaluationDate?: string;
  defaultFrequency?: string;
  defaultDepartment?: string;
  defaultGrade?: string;
}

export const ExportPayrollModal: React.FC<ExportPayrollModalProps> = ({
  isOpen,
  onClose,
  staffList,
  config,
  currencySymbol = '$',
  companyName = 'Corporate Organization',
  defaultEvaluationDate,
  defaultFrequency = 'all',
  defaultDepartment = 'All',
  defaultGrade = 'All',
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // Filter States inside Modal
  const [evaluationDate, setEvaluationDate] = useState<string>(defaultEvaluationDate || todayStr);
  const [frequencyFilter, setFrequencyFilter] = useState<string>(defaultFrequency);
  const [departmentFilter, setDepartmentFilter] = useState<string>(defaultDepartment);
  const [gradeFilter, setGradeFilter] = useState<string>(defaultGrade);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'netDesc' | 'netAsc' | 'grossDesc' | 'dept'>('name');
  const [copied, setCopied] = useState<boolean>(false);

  // Active non-exited staff
  const activeStaff = useMemo(() => {
    return staffList.filter((s) => s.status !== 'Exited');
  }, [staffList]);

  // Unique departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    activeStaff.forEach((s) => {
      if (s.department) set.add(s.department.trim());
    });
    return Array.from(set).sort();
  }, [activeStaff]);

  // Compute live payroll calculations for active staff against the evaluation date
  const allCalculations = useMemo(() => {
    return activeStaff.map((staff) => {
      return calculateStaffPayroll(staff, config, evaluationDate, companyName);
    });
  }, [activeStaff, config, evaluationDate, companyName]);

  // Filtered & sorted calculations
  const filteredCalculations = useMemo(() => {
    let list = allCalculations.filter((calc) => {
      // 1. Frequency filter
      const staffFreq = calc.payFrequency || config.defaultPayFrequency || 'Monthly';
      if (frequencyFilter === 'due_today') {
        const isDue = isPayFrequencyDueOnDate(staffFreq, evaluationDate, config.rollRules);
        if (!isDue) return false;
      } else if (frequencyFilter !== 'all') {
        if (staffFreq !== frequencyFilter) return false;
      }

      // 2. Department filter
      if (departmentFilter !== 'All' && calc.department !== departmentFilter) {
        return false;
      }

      // 3. Grade filter
      if (gradeFilter !== 'All' && calc.payGrade !== gradeFilter) {
        return false;
      }

      // 4. Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matches =
          calc.name.toLowerCase().includes(q) ||
          calc.employeeId.toLowerCase().includes(q) ||
          (calc.role && calc.role.toLowerCase().includes(q)) ||
          (calc.department && calc.department.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });

    // Sorting
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'netDesc':
          return b.netSalary - a.netSalary;
        case 'netAsc':
          return a.netSalary - b.netSalary;
        case 'grossDesc':
          return b.baseSalary - a.baseSalary;
        case 'dept':
          return (a.department || '').localeCompare(b.department || '');
        default:
          return 0;
      }
    });

    return list;
  }, [allCalculations, frequencyFilter, departmentFilter, gradeFilter, searchTerm, sortBy, config.defaultPayFrequency, config.rollRules, evaluationDate]);

  // Summary KPI Metrics for the export
  const summary = useMemo(() => {
    let gross = 0;
    let allowances = 0;
    let deductions = 0;
    let net = 0;

    filteredCalculations.forEach((c) => {
      gross += c.baseSalary || 0;
      allowances += c.totalBonuses || 0;
      deductions += c.totalDeductions || 0;
      net += c.netSalary || 0;
    });

    return {
      count: filteredCalculations.length,
      gross,
      allowances,
      deductions,
      net,
    };
  }, [filteredCalculations]);

  // Helper to construct CSV data
  const generateTabulationRows = () => {
    return filteredCalculations.map((c) => {
      // Allowances comma separated
      const allowancesList =
        c.bonusBreakdown && c.bonusBreakdown.length > 0
          ? c.bonusBreakdown.map((b) => `${b.name} (${currencySymbol}${b.amount.toFixed(2)})`).join(', ')
          : 'None';

      // Deductions comma separated
      const deductionsList =
        c.deductionBreakdown && c.deductionBreakdown.length > 0
          ? c.deductionBreakdown.map((d) => `${d.name} (${currencySymbol}${d.amount.toFixed(2)})`).join(', ')
          : 'None';

      return {
        employeeId: c.employeeId,
        name: c.name,
        department: c.department || 'General',
        role: c.role || 'Staff',
        payFrequency: c.payFrequency || 'Monthly',
        baseSalary: c.baseSalary,
        allowancesList,
        allowancesSum: c.totalBonuses,
        deductionsList,
        deductionsSum: c.totalDeductions,
        netPay: c.netSalary,
      };
    });
  };

  // Download Tabulation CSV
  const handleDownloadCSV = () => {
    const headers = [
      'Employee ID',
      'Employee Name',
      'Department',
      'Role',
      'Pay Frequency',
      `Base Salary (${currencySymbol})`,
      'Allowances List',
      `Allowances Sum (${currencySymbol})`,
      'Deductions List',
      `Deductions Sum (${currencySymbol})`,
      `Net Pay (${currencySymbol})`,
    ];

    const tabRows = generateTabulationRows();
    const rows = tabRows.map((r) => [
      `"${r.employeeId}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.department.replace(/"/g, '""')}"`,
      `"${r.role.replace(/"/g, '""')}"`,
      `"${r.payFrequency}"`,
      r.baseSalary.toFixed(2),
      `"${r.allowancesList.replace(/"/g, '""')}"`,
      r.allowancesSum.toFixed(2),
      `"${r.deductionsList.replace(/"/g, '""')}"`,
      r.deductionsSum.toFixed(2),
      r.netPay.toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Payroll_Tabulation_${companyName.replace(/\s+/g, '_')}_${evaluationDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    emitGlobalToast(`Exported payroll tabulation for ${filteredCalculations.length} staff`, 'success');
  };

  // Download Tabulation as Microsoft Excel (.xlsx) Workbook
  const handleDownloadExcel = () => {
    const tabRows = generateTabulationRows();
    const excelData = tabRows.map((r) => ({
      'Employee ID': r.employeeId,
      'Employee Name': r.name,
      'Department': r.department,
      'Role': r.role,
      'Pay Frequency': r.payFrequency,
      [`Base Salary (${currencySymbol})`]: Number(r.baseSalary.toFixed(2)),
      'Allowances List': r.allowancesList,
      [`Allowances Sum (${currencySymbol})`]: Number(r.allowancesSum.toFixed(2)),
      'Deductions List (Manual & Automatic)': r.deductionsList,
      [`Deductions Sum (${currencySymbol})`]: Number(r.deductionsSum.toFixed(2)),
      [`Net Pay (${currencySymbol})`]: Number(r.netPay.toFixed(2)),
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll Tabulation');
    const fileName = `Payroll_Tabulation_${companyName.replace(/\s+/g, '_')}_${evaluationDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
    emitGlobalToast(`Exported Excel tabulation (.xlsx) for ${filteredCalculations.length} staff`, 'success');
  };

  // Copy Tab-Delimited Tabulation to Clipboard
  const handleCopyClipboard = () => {
    const headers = [
      'Employee ID',
      'Employee Name',
      'Department',
      'Role',
      'Pay Frequency',
      'Base Salary',
      'Allowances',
      'Allowances Sum',
      'Deductions',
      'Deductions Sum',
      'Net Pay',
    ];

    const tabRows = generateTabulationRows();
    const textRows = tabRows.map((r) => [
      r.employeeId,
      r.name,
      r.department,
      r.role,
      r.payFrequency,
      r.baseSalary.toFixed(2),
      r.allowancesList,
      r.allowancesSum.toFixed(2),
      r.deductionsList,
      r.deductionsSum.toFixed(2),
      r.netPay.toFixed(2),
    ].join('\t'));

    const fullText = [headers.join('\t'), ...textRows].join('\n');
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      emitGlobalToast('Payroll tabulation copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Print Tabulation
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      emitGlobalToast('Please allow popups to print payroll tabulation', 'error');
      return;
    }

    const tabRows = generateTabulationRows();
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payroll Tabulation - ${companyName} (${evaluationDate})</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; margin: 20px; color: #1e293b; }
            h2 { font-size: 16px; margin: 0 0 4px 0; }
            .subtitle { color: #64748b; font-size: 12px; margin-bottom: 16px; }
            .metrics { display: flex; gap: 20px; margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
            .metric-item { display: flex; flex-direction: column; }
            .metric-label { font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; }
            .metric-val { font-size: 14px; font-weight: bold; font-family: monospace; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background: #f1f5f9; font-weight: bold; font-size: 10px; text-transform: uppercase; }
            .num { text-align: right; font-family: monospace; }
            .net { font-weight: bold; color: #047857; }
            .allowance { color: #059669; font-size: 10px; }
            .deduction { color: #dc2626; font-size: 10px; }
            @media print {
              @page { size: landscape; margin: 12mm; }
              body { font-size: 10px; }
            }
          </style>
        </head>
        <body>
          <h2>${companyName} - Consolidated Payroll Tabulation</h2>
          <div class="subtitle">Generated on ${formatToDdMmYyyy(evaluationDate)} • Frequency Filter: ${frequencyFilter} • Department: ${departmentFilter}</div>
          
          <div class="metrics">
            <div class="metric-item"><span class="metric-label">Staff Count</span><span class="metric-val">${summary.count}</span></div>
            <div class="metric-item"><span class="metric-label">Gross Base</span><span class="metric-val">${currencySymbol}${summary.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div class="metric-item"><span class="metric-label">Allowances Sum</span><span class="metric-val" style="color:#059669">+${currencySymbol}${summary.allowances.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div class="metric-item"><span class="metric-label">Deductions Sum</span><span class="metric-val" style="color:#dc2626">-${currencySymbol}${summary.deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div class="metric-item"><span class="metric-label">Net Disbursal</span><span class="metric-val" style="color:#047857">${currencySymbol}${summary.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Employee Name</th>
                <th>Dept</th>
                <th>Role</th>
                <th>Freq</th>
                <th class="num">Base</th>
                <th>Allowances</th>
                <th class="num">Allowances Sum</th>
                <th>Deductions</th>
                <th class="num">Deductions Sum</th>
                <th class="num">Net Pay</th>
              </tr>
            </thead>
            <tbody>
              ${tabRows.map((r) => `
                <tr>
                  <td>${r.employeeId}</td>
                  <td><strong>${r.name}</strong></td>
                  <td>${r.department}</td>
                  <td>${r.role}</td>
                  <td>${r.payFrequency}</td>
                  <td class="num">${currencySymbol}${r.baseSalary.toFixed(2)}</td>
                  <td class="allowance">${r.allowancesList}</td>
                  <td class="num" style="color:#059669">+${currencySymbol}${r.allowancesSum.toFixed(2)}</td>
                  <td class="deduction">${r.deductionsList}</td>
                  <td class="num" style="color:#dc2626">-${currencySymbol}${r.deductionsSum.toFixed(2)}</td>
                  <td class="num net">${currencySymbol}${r.netPay.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Reset filters inside modal
  const handleResetModalFilters = () => {
    setFrequencyFilter('all');
    setDepartmentFilter('All');
    setGradeFilter('All');
    setSearchTerm('');
    setSortBy('name');
    setEvaluationDate(defaultEvaluationDate || todayStr);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="w-full max-w-5xl max-h-[94vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Export Payroll Tabulation
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Single Tabulation CSV
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Download consolidated payroll records with every staff member's net pay, comma-separated deductions, and comma-separated allowances.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          
          {/* 1. Interactive Export Filters Grid */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Filter className="w-4 h-4 text-indigo-500" />
                <span>Select Filters To Apply On Export</span>
              </div>
              <button
                type="button"
                onClick={handleResetModalFilters}
                className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Export Filters</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              {/* Pay Frequency */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Pay Frequency
                </label>
                <select
                  value={frequencyFilter}
                  onChange={(e) => setFrequencyFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">All Frequencies ({activeStaff.length})</option>
                  <option value="due_today">Active Due on Date</option>
                  <option value="Weekly">Weekly Only</option>
                  <option value="Bi-Weekly">Bi-Weekly Only</option>
                  <option value="Monthly">Monthly Only</option>
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Department
                </label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="All">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Salary Grade */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Salary Grade Tier
                </label>
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="All">All Grade Tiers</option>
                  {config.payGrades.map((grade) => (
                    <option key={grade.id} value={grade.name}>
                      {grade.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Evaluation / Cycle Date */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Cycle Date
                </label>
                <input
                  type="date"
                  value={evaluationDate}
                  onChange={(e) => setEvaluationDate(e.target.value || todayStr)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono font-medium text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Quick Search & Sort Row */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700/60">
              <div className="relative flex-1 w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Quick search employee name, ID, or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-[11px] text-slate-500 whitespace-nowrap">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="name">Staff Name (A-Z)</option>
                  <option value="netDesc">Net Pay (Highest)</option>
                  <option value="netAsc">Net Pay (Lowest)</option>
                  <option value="grossDesc">Base Salary (Highest)</option>
                  <option value="dept">Department</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. Live Tabulation Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Staff Selected</span>
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                {summary.count}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Gross Base Sum</span>
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                {currencySymbol}{summary.gross.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Allowances Sum</span>
              <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                +{currencySymbol}{summary.allowances.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Deductions Sum</span>
              <span className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                -{currencySymbol}{summary.deductions.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Net Disbursal</span>
              <span className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                {currencySymbol}{summary.net.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* 3. Live Tabulation Preview Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Tabulation Preview ({filteredCalculations.length} records)
              </span>
              <span>Allowances and deductions will be separated by commas in the downloaded file</span>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px] z-10">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Freq</th>
                    <th className="py-2.5 px-3 text-right">Base</th>
                    <th className="py-2.5 px-3">Allowances (Commas)</th>
                    <th className="py-2.5 px-3 text-right">Allowances Sum</th>
                    <th className="py-2.5 px-3">Deductions (Commas)</th>
                    <th className="py-2.5 px-3 text-right">Deductions Sum</th>
                    <th className="py-2.5 px-3 text-right">Net Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                  {filteredCalculations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No staff records match the current export filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCalculations.map((c) => {
                      const allowStr =
                        c.bonusBreakdown && c.bonusBreakdown.length > 0
                          ? c.bonusBreakdown.map((b) => `${b.name} (${currencySymbol}${b.amount.toFixed(0)})`).join(', ')
                          : '—';

                      const dedStr =
                        c.deductionBreakdown && c.deductionBreakdown.length > 0
                          ? c.deductionBreakdown.map((d) => `${d.name} (${currencySymbol}${d.amount.toFixed(0)})`).join(', ')
                          : '—';

                      return (
                        <tr key={c.staffId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2 px-3">
                            <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{c.employeeId} • {c.department || 'General'}</div>
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-600 dark:text-slate-400">
                            {c.payFrequency || 'Monthly'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                            {currencySymbol}{c.baseSalary.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-emerald-700 dark:text-emerald-400 max-w-xs truncate" title={allowStr}>
                            {allowStr}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            +{currencySymbol}{c.totalBonuses.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-rose-700 dark:text-rose-400 max-w-xs truncate" title={dedStr}>
                            {dedStr}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                            -{currencySymbol}{c.totalDeductions.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                            {currencySymbol}{c.netSalary.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyClipboard}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Tabulation!' : 'Copy to Clipboard'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Tabulation</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleDownloadCSV}
              disabled={filteredCalculations.length === 0}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download .CSV</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={filteredCalculations.length === 0}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Excel (.XLSX)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
