import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Shield, Info } from 'lucide-react';
import { PayrollConfig, PayrollDeduction } from '../../types';

interface CorporateDeductionsSectionProps {
  config: PayrollConfig;
  canEdit: boolean;
  onOpenNew: () => void;
  onEdit: (ded: PayrollDeduction) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

export const CorporateDeductionsSection: React.FC<CorporateDeductionsSectionProps> = ({
  config,
  canEdit,
  onOpenNew,
  onEdit,
  onDelete,
  onToggle,
}) => {
  const deductions = config?.deductions || [];
  const currencySymbol = config?.currencySymbol || '$';

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Corporate Automated Deductions
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                Company-wide
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Statutory tax withholdings, pensions, and healthcare automatically applied to every payroll cycle.
            </p>
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={onOpenNew}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Corporate Deduction</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {deductions.map((ded) => (
          <div
            key={ded.id}
            className={`p-3.5 rounded-xl border transition flex flex-col justify-between ${
              ded.isEnabled
                ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                : 'bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/40 opacity-60'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-1.5 mb-1.5">
                <span className="font-bold text-xs text-slate-900 dark:text-white truncate" title={ded.name}>
                  {ded.name}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => onToggle(ded.id)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition cursor-pointer ${
                          ded.isEnabled
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {ded.isEnabled ? 'ON' : 'OFF'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(ded)}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                        title="Edit deduction"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(ded.id)}
                        className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-400 hover:text-rose-600 cursor-pointer"
                        title="Delete deduction"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-baseline justify-between gap-1.5 mb-1.5 flex-wrap">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-black font-mono text-rose-600 dark:text-rose-400">
                    {ded.type === 'percentage'
                      ? `${ded.value}%`
                      : ded.type === 'formula'
                      ? 'Formula'
                      : `${currencySymbol}${ded.value}`}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {ded.type === 'percentage'
                      ? ded.calculationBasis === 'net'
                        ? 'of Net'
                        : 'of Base'
                      : ded.type === 'formula'
                      ? 'Dynamic'
                      : 'Fixed'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900"
                    title="Priority Weight: Higher weights execute first"
                  >
                    Weight: {ded.weight ?? 50}%
                  </span>
                  {ded.calculationBasis === 'net' && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      Net Basis
                    </span>
                  )}
                </div>
              </div>

              {ded.type === 'formula' && ded.formula && (
                <div className="mb-2 p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-[10px] font-mono text-purple-700 dark:text-purple-300 truncate" title={ded.formula}>
                  {ded.formula}
                </div>
              )}

              {ded.description && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 leading-tight">
                  {ded.description}
                </p>
              )}

              {(Boolean(ded.applicableEmployeeTypes?.length && !ded.applicableEmployeeTypes.includes('All')) ||
                Boolean(ded.grossSalaryCondition?.enabled)) && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {ded.applicableEmployeeTypes && !ded.applicableEmployeeTypes.includes('All') && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {ded.applicableEmployeeTypes.join(', ')}
                    </span>
                  )}
                  {ded.grossSalaryCondition?.enabled && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Gross {ded.grossSalaryCondition.operator} {currencySymbol}{ded.grossSalaryCondition.value}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="text-[10px] font-mono text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60 pt-1.5 mt-auto flex items-center justify-between gap-1">
              <span className="shrink-0">Scope:</span>
              <span
                className="font-semibold text-slate-700 dark:text-slate-300 truncate text-right"
                title={
                  ded.applicableDepartments && ded.applicableDepartments.length > 0
                    ? ded.applicableDepartments.includes('All')
                      ? 'All Departments (Company-wide)'
                      : ded.applicableDepartments.join(', ')
                    : ded.applicableTo || 'All Staff'
                }
              >
                {ded.applicableDepartments && ded.applicableDepartments.length > 0
                  ? ded.applicableDepartments.includes('All')
                    ? 'All Departments'
                    : ded.applicableDepartments.length === 1
                    ? `${ded.applicableDepartments[0]}`
                    : `${ded.applicableDepartments.length} Depts (${ded.applicableDepartments.join(', ')})`
                  : ded.applicableTo || 'All Staff'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
