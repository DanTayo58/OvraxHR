import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  Zap,
  RotateCcw,
  Sliders,
  Filter,
  UserCheck,
} from 'lucide-react';
import { BookedPenalty, ManualDeductionRule, PayrollConfig, StaffMember } from '../../types';

interface ManualDeductionsAndPenaltiesSectionProps {
  config: PayrollConfig;
  staffList: StaffMember[];
  canEdit: boolean;
  onOpenNewRule: () => void;
  onEditRule: (rule: ManualDeductionRule) => void;
  onDeleteRule: (id: string) => void;
  onOpenPenalizeModal: (presetStaff?: StaffMember, presetRule?: ManualDeductionRule) => void;
  onSettlePenalty: (penaltyId: string) => void;
  onRevokePenalty: (penaltyId: string) => void;
  onExecuteRollAndSettle: () => void;
}

export const ManualDeductionsAndPenaltiesSection: React.FC<
  ManualDeductionsAndPenaltiesSectionProps
> = ({
  config,
  staffList,
  canEdit,
  onOpenNewRule,
  onEditRule,
  onDeleteRule,
  onOpenPenalizeModal,
  onSettlePenalty,
  onRevokePenalty,
  onExecuteRollAndSettle,
}) => {
  const [penaltyStatusFilter, setPenaltyStatusFilter] = useState<'all' | 'active' | 'settled'>('active');
  const [penaltySearch, setPenaltySearch] = useState('');

  const rules = config?.manualDeductionRules || [];
  const bookedPenalties = config?.bookedPenalties || [];
  const currencySymbol = config?.currencySymbol || '$';

  const activePenaltiesCount = bookedPenalties.filter((p) => p.status === 'Active').length;
  const settledPenaltiesCount = bookedPenalties.filter((p) => p.status === 'Settled').length;

  const filteredPenalties = useMemo(() => {
    return bookedPenalties.filter((p) => {
      const matchesStatus =
        penaltyStatusFilter === 'all' ||
        (penaltyStatusFilter === 'active' && p.status === 'Active') ||
        (penaltyStatusFilter === 'settled' && p.status === 'Settled');

      const matchesQuery =
        !penaltySearch.trim() ||
        p.staffName.toLowerCase().includes(penaltySearch.toLowerCase()) ||
        (p.employeeId && p.employeeId.toLowerCase().includes(penaltySearch.toLowerCase())) ||
        p.reason.toLowerCase().includes(penaltySearch.toLowerCase());

      return matchesStatus && matchesQuery;
    });
  }, [bookedPenalties, penaltyStatusFilter, penaltySearch]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* LEFT COLUMN (5 cols): Manual Deductions Catalog */}
      <div className="lg:col-span-5 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  Manual Deductions Catalog
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Pre-configured infraction templates & fine rules
                </p>
              </div>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={onOpenNewRule}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-purple-600/30 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Penalty</span>
              </button>
            )}
          </div>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
            {rules.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
                <p className="text-xs mb-2">No manual penalty rules configured yet.</p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={onOpenNewRule}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create First Penalty</span>
                  </button>
                )}
              </div>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/40 hover:border-purple-300 dark:hover:border-purple-800 transition space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {rule.name}
                      </span>
                      {rule.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 line-clamp-2">
                          {rule.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditRule(rule)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                            title="Edit rule template"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRule(rule.id)}
                            className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-400 hover:text-rose-600 cursor-pointer"
                            title="Delete rule template"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60 pt-2 text-[11px]">
                    <div className="flex items-baseline gap-1 font-mono font-bold text-purple-600 dark:text-purple-400">
                      <span>
                        {rule.type === 'percentage'
                          ? `${rule.defaultValue}% of Base`
                          : `${currencySymbol}${rule.defaultValue.toLocaleString()}`}
                      </span>
                      <span className="text-[9px] text-slate-400 font-normal">
                        ({rule.type === 'percentage' ? 'variable' : 'fixed'})
                      </span>
                    </div>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onOpenPenalizeModal(undefined, rule)}
                        className="px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950/80 hover:bg-purple-200 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition"
                        title="Book a penalty for a staff using this template"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Penalize Staff</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-700 dark:text-purple-300">
          💡 <strong>Tip:</strong> Rules defined here serve as the standardized catalog for booking staff penalties. You can customize amounts when penalizing.
        </div>
      </div>

      {/* RIGHT COLUMN (7 cols): Penalty Booking Section */}
      <div className="lg:col-span-7 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm flex flex-col justify-between">
        <div className="space-y-3">
          {/* Header & Main Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Incurred Staff Penalties
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    {activePenaltiesCount} Active
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Applied to staff's current net pay; resets upon payroll roll
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onOpenPenalizeModal()}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-600/20 transition cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Penalize Staff</span>
                </button>
              )}
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by staff name, ID, or incident..."
                value={penaltySearch}
                onChange={(e) => setPenaltySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setPenaltyStatusFilter('active')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  penaltyStatusFilter === 'active'
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Active ({activePenaltiesCount})
              </button>
              <button
                type="button"
                onClick={() => setPenaltyStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  penaltyStatusFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({bookedPenalties.length})
              </button>
              <button
                type="button"
                onClick={() => setPenaltyStatusFilter('settled')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  penaltyStatusFilter === 'settled'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Settled ({settledPenaltiesCount})
              </button>
            </div>
          </div>

          {/* Booked Penalties List */}
          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {filteredPenalties.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 space-y-1">
                <p className="text-xs font-medium">No incurred staff penalties found.</p>
                <p className="text-[11px] text-slate-500">
                  Use the Penalize Staff button above to record unexcused absences, late arrivals, or policy infractions.
                </p>
              </div>
            ) : (
              filteredPenalties.map((pen) => (
                <div
                  key={pen.id}
                  className={`p-3.5 rounded-xl border transition space-y-2 ${
                    pen.status === 'Active'
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/60'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {pen.staffName}
                        </span>
                        {pen.employeeId && (
                          <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {pen.employeeId}
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                            pen.status === 'Active'
                              ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                              : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                          }`}
                        >
                          {pen.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                        {pen.reason}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono font-black text-rose-600 dark:text-rose-400">
                        {pen.type === 'percentage'
                          ? `-${pen.value}%`
                          : `-${currencySymbol}${pen.value.toLocaleString()}`}
                      </div>
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-semibold">
                        fine * {pen.multiplier || 1} ({pen.multiplier || 1} {(pen.multiplier || 1) === 1 ? 'time' : 'times'} fined)
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono">
                        {pen.incurredDate || 'Recent'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-700/50 pt-2 text-[10px] font-mono">
                    <span className="text-slate-400">
                      Booked by: <strong className="text-slate-600 dark:text-slate-300">{pen.incurredBy || 'Admin'}</strong>
                    </span>

                    {canEdit && (
                      <div className="flex items-center gap-1.5">
                        {pen.status === 'Active' ? (
                          <button
                            type="button"
                            onClick={() => onSettlePenalty(pen.id)}
                            className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] transition cursor-pointer"
                            title="Mark penalty settled"
                          >
                            Mark Settled
                          </button>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Settled
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => onRevokePenalty(pen.id)}
                          className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-400 hover:text-rose-600 cursor-pointer"
                          title="Revoke / Remove penalty"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom Banner & Roll Execution Trigger */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
          <div className="text-[11px] text-amber-800 dark:text-amber-300">
            <strong>Cycle Reset Rule:</strong> Active penalties are automatically deducted from the current payroll calculations and marked as settled when you roll the payroll.
          </div>

          {canEdit && activePenaltiesCount > 0 && (
            <button
              type="button"
              onClick={onExecuteRollAndSettle}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Settle All on Roll</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
