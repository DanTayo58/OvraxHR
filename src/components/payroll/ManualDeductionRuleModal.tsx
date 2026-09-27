import React, { useState } from 'react';
import { X, Sliders, CheckCircle2 } from 'lucide-react';
import { ManualDeductionRule, PayrollConfig } from '../../types';

interface ManualDeductionRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  config?: PayrollConfig;
  currencySymbol?: string;
  editingRule: ManualDeductionRule | null;
  onSave: (rule: Omit<ManualDeductionRule, 'id'>) => void;
}

export const ManualDeductionRuleModal: React.FC<ManualDeductionRuleModalProps> = ({
  isOpen,
  onClose,
  config,
  currencySymbol: customCurrencySymbol,
  editingRule,
  onSave,
}) => {
  const currencySymbol = customCurrencySymbol || config?.currencySymbol || '$';
  const [name, setName] = useState(editingRule?.name || '');
  const [type, setType] = useState<'percentage' | 'fixed'>(editingRule?.type || 'fixed');
  const [defaultValue, setDefaultValue] = useState<number>(editingRule?.defaultValue || 25);
  const [description, setDescription] = useState(editingRule?.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      type,
      defaultValue,
      description: description.trim(),
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-md max-h-[92vh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {editingRule ? 'Edit Disciplinary Fine Rule' : 'New Disciplinary Fine Rule'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Configure standard manual workplace infractions and fixed disciplinary surcharges.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1 min-h-0">
          <form id="manual-deduction-rule-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Infraction / Fine Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Late Attendance, Equipment Damage, Unexcused Absence"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Calculation Mode
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'percentage' | 'fixed')}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="fixed">Fixed Amount ({currencySymbol})</option>
                  <option value="percentage">Percentage (%) of Base</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Default Value ({type === 'percentage' ? '%' : currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  required
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Description / Reference Guidelines
              </label>
              <textarea
                rows={3}
                placeholder="Standard employee handbook policy or sanction rule notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
            <span>Preset fine amounts when issuing manual disciplinary penalties.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="manual-deduction-rule-form"
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md shadow-purple-600/30 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>{editingRule ? 'Save Changes' : 'Create Fine Rule'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
