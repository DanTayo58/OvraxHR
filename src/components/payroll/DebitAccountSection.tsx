import React, { useState, useEffect } from 'react';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Edit2,
  Trash2,
  Save,
  CreditCard,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { PayrollConfig, DebitAccountConfig } from '../../types';
import { emitGlobalToast } from '../../context/ToastContext';

interface DebitAccountSectionProps {
  config: PayrollConfig;
  canEdit?: boolean;
  onSaveConfig: (updated: PayrollConfig, successMsg?: string) => void;
  isHighlighted?: boolean;
}

export const DebitAccountSection: React.FC<DebitAccountSectionProps> = ({
  config,
  canEdit = true,
  onSaveConfig,
  isHighlighted = false,
}) => {
  const currentDebit = config.debitAccount;
  const isCurrentlySet = Boolean(currentDebit?.isConfigured && currentDebit?.accountNumber);

  const [isEditing, setIsEditing] = useState(!isCurrentlySet);
  const [formData, setFormData] = useState<DebitAccountConfig>({
    bankName: currentDebit?.bankName || '',
    accountNumber: currentDebit?.accountNumber || '',
    accountName: currentDebit?.accountName || '',
    routingNumber: currentDebit?.routingNumber || '',
    currency: currentDebit?.currency || config.currencyCode || 'USD',
    notes: currentDebit?.notes || '',
    isConfigured: currentDebit?.isConfigured || false,
  });

  // Keep in sync if config updates
  useEffect(() => {
    if (config.debitAccount) {
      setFormData({
        bankName: config.debitAccount.bankName || '',
        accountNumber: config.debitAccount.accountNumber || '',
        accountName: config.debitAccount.accountName || '',
        routingNumber: config.debitAccount.routingNumber || '',
        currency: config.debitAccount.currency || config.currencyCode || 'USD',
        notes: config.debitAccount.notes || '',
        isConfigured: Boolean(config.debitAccount.isConfigured),
      });
      setIsEditing(!config.debitAccount.isConfigured);
    } else {
      setIsEditing(false);
    }
  }, [config.debitAccount, config.currencyCode]);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.bankName?.trim() && !formData.accountNumber?.trim()) {
      emitGlobalToast('Please enter a bank name or account number, or leave it as unset.', 'warning');
      return;
    }

    const updatedDebit: DebitAccountConfig = {
      ...formData,
      bankName: formData.bankName?.trim() || '',
      accountNumber: formData.accountNumber?.trim() || '',
      accountName: formData.accountName?.trim() || '',
      routingNumber: formData.routingNumber?.trim() || '',
      currency: formData.currency || config.currencyCode,
      notes: formData.notes?.trim() || '',
      isConfigured: true,
      updatedAt: new Date().toISOString(),
    };

    onSaveConfig(
      {
        ...config,
        debitAccount: updatedDebit,
      },
      'Corporate debit account successfully saved'
    );
    setIsEditing(false);
  };

  const handleClearUnset = () => {
    onSaveConfig(
      {
        ...config,
        debitAccount: undefined,
      },
      'Debit account cleared. Disbursement source marked as Unset (Optional)'
    );
    setFormData({
      bankName: '',
      accountNumber: '',
      accountName: '',
      routingNumber: '',
      currency: config.currencyCode,
      notes: '',
      isConfigured: false,
    });
    setIsEditing(false);
  };

  const maskAccountNumber = (acc?: string) => {
    if (!acc) return '••••';
    const clean = acc.trim();
    if (clean.length <= 4) return clean;
    const last4 = clean.slice(-4);
    return `•••• •••• •••• ${last4}`;
  };

  return (
    <div
      id="debit-account-section"
      className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-500 shadow-sm space-y-4 ${
        isHighlighted
          ? 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Building2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Organization Debit Account (Disbursement Source)</span>
            </h3>

            {/* Optional & Status badges */}
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Optional
            </span>

            {isCurrentlySet ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Configured</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                Unset (Default)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Configure the corporate bank account that funds employee payroll transfers. This is completely <strong>optional</strong> — you may leave it as unset if your organization handles disbursals externally or through physical checks.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {isCurrentlySet && !isEditing && canEdit && (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Edit Account</span>
              </button>

              <button
                type="button"
                onClick={handleClearUnset}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-semibold text-xs flex items-center gap-1.5 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                title="Remove debit account details and leave unset"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Leave as Unset</span>
              </button>
            </>
          )}

          {!isCurrentlySet && !isEditing && canEdit && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm shadow-indigo-600/20"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Configure Debit Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Body: Display or Edit Mode */}
      {isCurrentlySet && !isEditing ? (
        /* Configured Display Card */
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-900/50 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono tracking-wider text-indigo-300 font-bold">
                  Corporate Clearing Account
                </span>
                <span className="px-2 py-0.2 rounded-full text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Ready for Transfers
                </span>
              </div>
              <div className="text-lg font-bold text-white flex items-center gap-2">
                <span>{currentDebit?.bankName}</span>
                {currentDebit?.currency && (
                  <span className="text-xs font-mono font-normal text-indigo-300">
                    ({currentDebit.currency})
                  </span>
                )}
              </div>
              <div className="text-sm font-mono text-slate-200 tracking-wider">
                Account: <strong className="font-bold text-white">{maskAccountNumber(currentDebit?.accountNumber)}</strong>
              </div>
              {currentDebit?.accountName && (
                <div className="text-xs text-slate-300">
                  Account Name: <span className="font-semibold text-white">{currentDebit.accountName}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col md:items-end justify-between gap-2 border-t md:border-t-0 border-white/10 pt-3 md:pt-0">
              {currentDebit?.routingNumber && (
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-mono">Routing / Sort Code / SWIFT</span>
                  <span className="font-mono text-xs font-bold text-slate-200">{currentDebit.routingNumber}</span>
                </div>
              )}
              {currentDebit?.notes && (
                <div className="text-[11px] text-slate-300 italic max-w-xs text-left md:text-right">
                  "{currentDebit.notes}"
                </div>
              )}
              {currentDebit?.updatedAt && (
                <span className="text-[9px] text-slate-400 font-mono">
                  Saved: {new Date(currentDebit.updatedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : !isCurrentlySet && !isEditing ? (
        /* Unset Notice Card */
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Debit Account is Unset (Optional)
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                No corporate debit account is specified. You can leave this unset without any restrictions. When executing payroll or generating bank transfers, the system can proceed using generic disbursal instructions or your external banking portal.
              </p>
            </div>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 transition cursor-pointer whitespace-nowrap shadow-2xs self-start sm:self-center"
            >
              Set Up (Optional)
            </button>
          )}
        </div>
      ) : (
        /* Edit Form */
        <form onSubmit={handleSave} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-indigo-500" />
              <span>{isCurrentlySet ? 'Edit Debit Account Details' : 'Set Up Corporate Debit Account (Optional)'}</span>
            </span>
            <span className="text-[10px] text-slate-400">
              Leave fields blank or click "Leave as Unset" if not using an automated debit account
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
            {/* Bank Name */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={formData.bankName || ''}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                placeholder="e.g. Chase Commercial, Barclays, First Bank"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Account Number */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Account Number / IBAN
              </label>
              <input
                type="text"
                value={formData.accountNumber || ''}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                placeholder="e.g. 1029384756 or GB29NWBK..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Account Name */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Account Name / Beneficiary Title
              </label>
              <input
                type="text"
                value={formData.accountName || ''}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                placeholder="e.g. Acme Corporation Payroll Account"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Routing / Sort Code */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Routing / Sort Code / SWIFT <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.routingNumber || ''}
                onChange={(e) => setFormData({ ...formData, routingNumber: e.target.value })}
                placeholder="e.g. 021000021 or 20-00-00"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Account Currency
              </label>
              <input
                type="text"
                value={formData.currency || config.currencyCode}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                placeholder="e.g. USD, EUR, GBP, NGN"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Disbursement Notes <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g. Corporate monthly payroll disbursement source"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={handleClearUnset}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              Clear & Leave as Unset
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm shadow-indigo-600/30"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Debit Account</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
