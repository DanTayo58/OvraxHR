import React from 'react';
import {
  Home,
  Car,
  Cake,
  HeartPulse,
  Users,
  Baby,
  Sliders,
  Edit2,
  CheckCircle2,
  DollarSign,
  Percent,
  Sparkles,
  Info,
  Gift,
  ExternalLink,
} from 'lucide-react';
import { PayrollBonus, PayrollConfig } from '../../types';

interface DefaultAllowancesSectionProps {
  config: PayrollConfig;
  canEdit: boolean;
  onUpdateConfig?: (updatedConfig: PayrollConfig, toastMessage?: string) => void;
  onToggleAllowance?: (id: string) => void;
  onEditAllowance?: (allowance: PayrollBonus) => void;
  onOpenWelfareLedger?: () => void;
}

export const DefaultAllowancesSection: React.FC<DefaultAllowancesSectionProps> = ({
  config,
  canEdit,
  onUpdateConfig,
  onToggleAllowance,
  onEditAllowance,
  onOpenWelfareLedger,
}) => {
  const currencySymbol = config?.currencySymbol || '$';

  // Extract all default allowances from config.bonuses
  const defaultAllowances = (config.bonuses || []).filter((b) => b.isDefault);

  const handleToggle = (id: string, name: string, currentState: boolean) => {
    if (!canEdit) return;
    if (onToggleAllowance) {
      onToggleAllowance(id);
      return;
    }
    if (onUpdateConfig) {
      const updated = (config.bonuses || []).map((b) =>
        b.id === id ? { ...b, isEnabled: !currentState } : b
      );
      onUpdateConfig(
        { ...config, bonuses: updated },
        `${name} ${!currentState ? 'Enabled' : 'Disabled'}`
      );
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'housing':
        return <Home className="w-4 h-4 text-sky-500" />;
      case 'transport':
        return <Car className="w-4 h-4 text-blue-500" />;
      case 'birthday':
        return <Cake className="w-4 h-4 text-rose-500" />;
      case 'medical':
        return <HeartPulse className="w-4 h-4 text-emerald-500" />;
      case 'bereavement':
        return <Users className="w-4 h-4 text-indigo-500" />;
      case 'childbirth':
        return <Baby className="w-4 h-4 text-pink-500" />;
      default:
        return <Gift className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Default Corporate Allowances & Packages</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">
                Standard Policies
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pre-configured statutory and corporate welfare allowances. Toggle and configure each benefit individually.
            </p>
          </div>
        </div>

        {onOpenWelfareLedger && (
          <button
            type="button"
            onClick={onOpenWelfareLedger}
            className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
          >
            <Cake className="w-3.5 h-3.5" />
            <span>Open Welfare & Grants Ledger</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </button>
        )}
      </div>

      {/* Info notice about Recurring vs Welfare Ledger */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Policy Integration:</strong> Routine allowances like Housing & Transport automatically apply to scheduled payroll runs when active. Discretionary benefits like Birthday vouchers, Medical relief, and Bereavement grants are managed and logged directly via the <strong>Staff Welfare & Grants Ledger</strong> so they do not artificially distort monthly base pay.
        </div>
      </div>

      {/* Grid of Default Allowances */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
        {defaultAllowances.map((allowance) => {
          const isPayrollRun = allowance.disbursementType !== 'welfare_log';
          return (
            <div
              key={allowance.id}
              className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-3 ${
                allowance.isEnabled
                  ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 shadow-xs'
                  : 'bg-slate-50/30 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/40 opacity-65'
              }`}
            >
              {/* Card Header with Icon, Name & Toggle */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                    {getCategoryIcon(allowance.category)}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                      {allowance.name}
                    </h4>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider ${
                        isPayrollRun
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
                      }`}
                    >
                      {isPayrollRun ? 'Recurring Payroll' : 'Welfare Ledger'}
                    </span>
                  </div>
                </div>

                {/* Enable/Disable Toggle */}
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => handleToggle(allowance.id, allowance.name, allowance.isEnabled)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono transition cursor-pointer shrink-0 ${
                      allowance.isEnabled
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {allowance.isEnabled ? 'Active' : 'Disabled'}
                  </button>
                ) : (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono shrink-0 ${
                      allowance.isEnabled
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {allowance.isEnabled ? 'Active' : 'Disabled'}
                  </span>
                )}
              </div>

              {/* Amount Display */}
              <div className="flex items-baseline justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">Standard Value</span>
                <span className="text-base font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {allowance.type === 'percentage'
                    ? `+${allowance.value}% of Salary`
                    : `+${currencySymbol}${Number(allowance.value).toLocaleString()}`}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed min-h-[32px]">
                {allowance.description || 'Standard corporate allowance benefit.'}
              </p>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[10px]">
                <span className="text-slate-400 font-mono">
                  Applies to:{' '}
                  <strong className="text-slate-600 dark:text-slate-300">
                    {allowance.applicableTo || 'All Staff'}
                  </strong>
                </span>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onEditAllowance?.(allowance)}
                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer flex items-center gap-1 font-semibold"
                    title="Edit Rate & Details"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
