import React, { useState } from 'react';
import {
  UtensilsCrossed,
  Sparkles,
  Coffee,
  CheckCircle2,
  Clock,
  Building2,
  AlertCircle,
  Coins
} from 'lucide-react';
import { StaffMember } from '../types';

interface FeedingBenefitsViewProps {
  staffList: StaffMember[];
  isLight?: boolean;
}

export const FeedingBenefitsView: React.FC<FeedingBenefitsViewProps> = ({
  staffList,
  isLight = false,
}) => {
  const [dailyMealAllowance, setDailyMealAllowance] = useState<number>(10); // $10/day
  const activeDaysInMonth = 22; // Standard working days

  const activeStaffCount = staffList.filter((s) => s.status === 'Active').length;
  const estimatedMonthlyFeedingBudget = activeStaffCount * dailyMealAllowance * activeDaysInMonth;

  // Departmental Feeding breakdown
  const depts = Array.from(new Set(staffList.map((s) => s.department)));
  const deptBreakdown = depts.map((d) => {
    const count = staffList.filter((s) => s.department === d && s.status === 'Active').length;
    return {
      department: d,
      activeStaff: count,
      monthlyAllowance: count * dailyMealAllowance * activeDaysInMonth,
    };
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white shadow-xl border border-amber-900/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-semibold uppercase tracking-wider">
            <UtensilsCrossed className="w-4 h-4" />
            Skima HR Tool
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            Feeding & Meal Allowance Aid
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Estimate cafeteria stipends and daily feeding allowances for active workforce members.
          </p>
        </div>
      </div>

      {/* Feature Announcement Notice */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
            Features Coming Soon!
          </h4>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            This tool allows you to set daily meal allowance rates per staff member today. Full automated POS cafeteria integrations, digital QR feeding vouchers, and daily attendance badge sync features will be communicated soon!
          </p>
        </div>
      </div>

      {/* Interactive Daily Allowance Calculator */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-500" />
          Meal Stipend Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Daily Meal Allowance Rate ($ / Staff / Day)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-400 font-mono">$</span>
              <input
                type="number"
                min={1}
                max={100}
                value={dailyMealAllowance}
                onChange={(e) => setDailyMealAllowance(Math.max(1, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Eligible Active Staff
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {activeStaffCount} <span className="text-xs text-slate-400 font-normal">employees</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              Est. Monthly Feeding Budget
            </div>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
              ${estimatedMonthlyFeedingBudget.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Department Feeding Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-500" />
            Departmental Meal Allowance Breakdown
          </h3>
          <span className="text-xs text-slate-500">
            Based on {activeDaysInMonth} active working days per month
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Active Staff</th>
                <th className="px-4 py-3">Daily Stipend Rate</th>
                <th className="px-4 py-3 text-right">Est. Monthly Department Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {deptBreakdown.map((d, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                    {d.department}
                  </td>
                  <td className="px-4 py-3 font-mono">{d.activeStaff} staff</td>
                  <td className="px-4 py-3 font-mono">${dailyMealAllowance} / day</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                    ${d.monthlyAllowance.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
