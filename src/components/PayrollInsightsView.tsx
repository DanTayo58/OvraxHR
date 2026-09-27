import React from 'react';
import {
  BadgeDollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  Building2,
  ShieldAlert,
  Download,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Layers
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { StaffMember } from '../types';
import { getCompanyCurrencySymbol, loadCompanyPayrollConfig, deriveStaffPayGrade } from '../utils/payrollUtils';
import { getActiveSessionCompany } from '../utils/companyStorage';

interface PayrollInsightsViewProps {
  staffList: StaffMember[];
  isLight?: boolean;
  companyName?: string;
}

export const PayrollInsightsView: React.FC<PayrollInsightsViewProps> = ({
  staffList,
  isLight = false,
  companyName,
}) => {
  const resolvedCompany = companyName || getActiveSessionCompany() || '';
  const currencySymbol = getCompanyCurrencySymbol(resolvedCompany);
  const payrollConfig = loadCompanyPayrollConfig(resolvedCompany);
  const configuredPayGrades = payrollConfig.payGrades || [];

  // Aggregate payroll weight per department
  const deptPayroll = staffList.reduce((acc, staff) => {
    const dept = staff.department || 'General';
    acc[dept] = (acc[dept] || 0) + (staff.estimatedMonthlySalary || 0);
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(deptPayroll).map(([department, totalSalary]) => ({
    department,
    totalSalary,
    staffCount: staffList.filter((s) => s.department === department).length,
  }));

  const totalPayrollWeight = staffList.reduce(
    (sum, s) => sum + (s.estimatedMonthlySalary || 0),
    0
  );
  const avgMonthlySalary =
    staffList.length > 0 ? Math.round(totalPayrollWeight / staffList.length) : 0;

  // Colors for charts
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  const handleExportPayrollReport = () => {
    const headers = [
      'Department',
      'Staff Count',
      `Total Monthly Base Weight (${currencySymbol})`,
      `Est. Average Salary (${currencySymbol})`,
    ];

    const rows = chartData.map((d) => [
      `"${d.department}"`,
      d.staffCount,
      Number(d.totalSalary),
      Math.round(Number(d.totalSalary) / (d.staffCount || 1)),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `skima_structural_payroll_insights_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white shadow-xl border border-blue-900/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-mono font-semibold uppercase tracking-wider">
            <BadgeDollarSign className="w-4 h-4" />
            Skima Structural HR Aid
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Payroll Planning & Salary Insights
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Departmental pay grade analysis and monthly wage allocation estimates based on your staff directory and attendance data.
          </p>
        </div>

        <button
          onClick={handleExportPayrollReport}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Export Planning Summary
        </button>
      </div>

      {/* Mandatory Disclaimer Box */}
      <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">
            Structural HR Assistance Notice
          </h4>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Skima provides organizational insights and budget calculations to assist HR teams with payroll structure planning. Skima does not process money, bank transfers, or payment disbursements directly.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            Total Monthly Base Payroll Weight
          </div>
          <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white mt-2">
            {currencySymbol}{totalPayrollWeight.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across all {staffList.length} staff members</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            Average Monthly Salary Per Staff
          </div>
          <div className="text-3xl font-extrabold font-mono text-blue-600 dark:text-blue-400 mt-2">
            {currencySymbol}{avgMonthlySalary.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Mean departmental wage rate</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            Active Pay Grades
          </div>
          <div className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-2">
            {configuredPayGrades.length > 0 ? configuredPayGrades.length : new Set(staffList.map((s) => deriveStaffPayGrade(s, configuredPayGrades))).size} <span className="text-xs text-slate-400">Tiers</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Structured grade levels</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Bar Chart */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            Departmental Base Payroll Breakdown ({currencySymbol})
          </h3>
          <div className="h-64 w-full">
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

        {/* Department Distribution Table */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            Department Budget Allocation Summary
          </h3>

          <div className="overflow-x-auto">
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
      </div>
    </div>
  );
};
