import React, { useState, useMemo } from 'react';
import {
  Coins,
  Building2,
  Search,
  CheckCircle2,
  X,
  Shield,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { PayrollConfig } from '../../types';
import { GLOBAL_CURRENCY_OPTIONS } from '../../utils/payrollUtils';
import { DebitAccountSection } from './DebitAccountSection';

export interface BankAndCurrencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PayrollConfig;
  canEdit: boolean;
  onSaveConfig: (newConfig: PayrollConfig, msg?: string) => void;
  companyName: string;
  defaultTab?: 'bank' | 'currency';
}

export const BankAndCurrencyModal: React.FC<BankAndCurrencyModalProps> = ({
  isOpen,
  onClose,
  config,
  canEdit,
  onSaveConfig,
  companyName,
  defaultTab = 'bank',
}) => {
  const [activeTab, setActiveTab] = useState<'bank' | 'currency'>(defaultTab);
  const [currencySearch, setCurrencySearch] = useState('');

  const filteredCurrencies = useMemo(() => {
    if (!currencySearch.trim()) return GLOBAL_CURRENCY_OPTIONS;
    const term = currencySearch.toLowerCase();
    return GLOBAL_CURRENCY_OPTIONS.filter(
      (c) =>
        c.code.toLowerCase().includes(term) ||
        c.name.toLowerCase().includes(term) ||
        c.symbol.toLowerCase().includes(term)
    );
  }, [currencySearch]);

  const handleSelectCurrency = (curr: typeof GLOBAL_CURRENCY_OPTIONS[0]) => {
    if (!canEdit) return;
    const updated: PayrollConfig = {
      ...config,
      currencyCode: curr.code,
      currencySymbol: curr.symbol,
      currencyName: curr.name,
    };
    onSaveConfig(updated, `Active currency set to ${curr.name} (${curr.symbol})`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Bank & Currency Configurations
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {config.currencyCode} ({config.currencySymbol})
                </span>
                {config.debitAccount?.isConfigured && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Bank Linked</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Set up corporate debit bank details for transfers and customize global currency standards.
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

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'bank'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Debit Bank Information</span>
            {config.debitAccount?.isConfigured ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            ) : (
              <span className="text-[10px] font-normal text-slate-400">(Optional)</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('currency')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'currency'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Global Currency Standard</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {config.currencyCode}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'bank' ? (
            <div>
              <DebitAccountSection
                config={config}
                canEdit={canEdit}
                onSaveConfig={onSaveConfig}
                isHighlighted={false}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Currency Summary */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Current Standard:</span>
                    <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                      {config.currencyCode} ({config.currencySymbol}) — {config.currencyName}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Affects all payslips, reports & calculations.
                </span>
              </div>

              {/* Currency Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search currency code, country or name (e.g. USD, EUR, NGN, GBP, CAD)..."
                  value={currencySearch}
                  onChange={(e) => setCurrencySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Currencies Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto p-1">
                {filteredCurrencies.map((curr) => {
                  const isSelected = config.currencyCode === curr.code;
                  return (
                    <button
                      key={curr.code}
                      type="button"
                      onClick={() => handleSelectCurrency(curr)}
                      className={`p-3 rounded-2xl border text-left text-xs transition flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30'
                          : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <span className="font-mono font-bold text-sm block">
                          {curr.code} <span className="opacity-80">{curr.symbol}</span>
                        </span>
                        <span className={`text-[11px] truncate block mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {curr.name}
                        </span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 shrink-0 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {activeTab === 'bank' ? (
              <span>Corporate debit details are strictly confidential and stored securely.</span>
            ) : (
              <span>Currency modifications take effect immediately across all calculations.</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs cursor-pointer transition shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
