import React, { useState, useEffect } from 'react';
import {
  Tag,
  Gift,
  Plus,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Sparkles,
  Shuffle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { VoucherCode, VoucherDuration, SubscriptionTier } from '../types';
import {
  loadAllVouchers,
  createVoucher,
  deleteVoucher,
  toggleVoucherActive,
  generateRandomVoucherCode,
} from '../utils/vouchers';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface AdminVouchersTabProps {
  onShowNotice: (msg: string) => void;
}

export const AdminVouchersTab: React.FC<AdminVouchersTabProps> = ({ onShowNotice }) => {
  const [vouchers, setVouchers] = useState<VoucherCode[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedVoucherId, setExpandedVoucherId] = useState<string | null>(null);

  // Form State for creating voucher
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(50);
  const [duration, setDuration] = useState<VoucherDuration>('6 months');
  const [applicableTier, setApplicableTier] = useState<'All' | SubscriptionTier>('All');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string } | null>(null);

  const refreshList = () => {
    setVouchers(loadAllVouchers());
  };

  useEffect(() => {
    refreshList();
    const handleUpdate = () => refreshList();
    window.addEventListener('ovraxhr_vouchers_updated', handleUpdate);
    return () => window.removeEventListener('ovraxhr_vouchers_updated', handleUpdate);
  }, []);

  const handleGenerateCode = () => {
    const randomCode = generateRandomVoucherCode();
    setCode(randomCode);
    setFormError(null);
  };

  const handleCopyCode = (codeToCopy: string) => {
    navigator.clipboard.writeText(codeToCopy);
    setCopiedCode(codeToCopy);
    onShowNotice(`Copied voucher code "${codeToCopy}" to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const result = createVoucher({
      code: code.trim() || undefined,
      discountPercent,
      duration,
      applicableTier,
      notes: notes.trim(),
      createdBy: 'OvraxHR Admin',
    });

    if (!result.success) {
      setFormError(result.error || 'Failed to create voucher.');
      return;
    }

    onShowNotice(`Voucher code "${result.voucher?.code}" successfully created!`);
    setCode('');
    setNotes('');
    setDiscountPercent(50);
    setIsCreating(false);
    refreshList();
  };

  const handleDelete = (id: string, codeVal: string) => {
    setDeleteTarget({ id, code: codeVal });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteVoucher(deleteTarget.id);
    refreshList();
    onShowNotice(`Voucher "${deleteTarget.code}" was deleted.`);
    setDeleteTarget(null);
  };

  const handleToggle = (id: string, codeVal: string) => {
    toggleVoucherActive(id);
    refreshList();
    onShowNotice(`Toggled status for "${codeVal}".`);
  };

  const totalRedemptions = vouchers.reduce((acc, v) => acc + (v.redemptions?.length || 0), 0);
  const activeCount = vouchers.filter((v) => v.isActive).length;
  const avgDiscount =
    vouchers.length > 0
      ? Math.round(vouchers.reduce((acc, v) => acc + v.discountPercent, 0) / vouchers.length)
      : 0;

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-400" />
              <span>Vouchers &amp; Promotional Campaigns</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Issue unique 6-character alphanumeric promo codes, set percentage discounts, specify duration batches (1 mo &mdash; 2 yrs), and track registered company redemptions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsCreating(!isCreating);
              if (!code) handleGenerateCode();
            }}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer shadow-lg shadow-amber-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>{isCreating ? 'Close Generator' : 'Generate New Voucher'}</span>
          </button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono text-slate-400 uppercase">Active Vouchers</div>
              <div className="text-xl font-bold font-mono text-emerald-400">{activeCount} of {vouchers.length}</div>
            </div>
            <Tag className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono text-slate-400 uppercase">Company Redemptions</div>
              <div className="text-xl font-bold font-mono text-amber-400">{totalRedemptions} Registered</div>
            </div>
            <Building2 className="w-5 h-5 text-amber-400" />
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono text-slate-400 uppercase">Avg. Discount Level</div>
              <div className="text-xl font-bold font-mono text-blue-400">{avgDiscount}% Off</div>
            </div>
            <Sparkles className="w-5 h-5 text-blue-400" />
          </div>
        </div>
      </div>

      {/* CREATE VOUCHER FORM (COLLAPSIBLE) */}
      {isCreating && (
        <form
          onSubmit={handleCreateVoucher}
          className="p-5 rounded-2xl bg-slate-900 border-2 border-amber-500/40 space-y-4 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Create 6-Character Voucher Code</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">Case-Sensitive Alphanumeric</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* 6-Character Code Randomizer */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 flex items-center justify-between">
                <span>Voucher Code (6 Characters)</span>
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  className="text-amber-400 hover:text-amber-300 font-normal flex items-center gap-1 cursor-pointer"
                >
                  <Shuffle className="w-3 h-3" />
                  <span>Randomize</span>
                </button>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim())}
                  placeholder="e.g. K9x7Wm"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono font-extrabold text-base tracking-widest text-amber-300 outline-none focus:border-amber-500"
                  required
                />
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 cursor-pointer"
                  title="Generate another 6-char code"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Discount Percentage */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-bold text-slate-300">
                <span>Discount Percentage</span>
                <span className="font-mono text-emerald-400 text-sm">{discountPercent}% OFF</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex items-center gap-1.5 pt-0.5">
                {[10, 25, 50, 75, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDiscountPercent(preset)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      discountPercent === preset
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {preset === 100 ? '100% Free' : `${preset}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Batch */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300">
                Duration Batch Setting
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value as VoucherDuration)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 outline-none focus:border-amber-500"
              >
                <option value="1 month">1 Month</option>
                <option value="2 months">2 Months</option>
                <option value="6 months">6 Months</option>
                <option value="1 year">1 Year</option>
                <option value="2 years">2 Years</option>
              </select>
            </div>

            {/* Applicable Tier */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300">
                Applicable Pricing Tier
              </label>
              <select
                value={applicableTier}
                onChange={(e) => setApplicableTier(e.target.value as 'All' | SubscriptionTier)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 outline-none focus:border-amber-500"
              >
                <option value="All">All Tiers (Small &amp; Large Scale)</option>
                <option value="Small Scale">Small Scale Tier Only</option>
                <option value="Large Scale">Large Scale Tier Only</option>
              </select>
            </div>

            {/* Campaign Notes / Label */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-bold text-slate-300">
                Campaign Description / Internal Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Q3 Launch Partner Grant - Free access for early beta partners"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {formError && (
            <p className="text-xs text-rose-400 font-medium">{formError}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Publish Voucher ({code || '6-Char Code'})</span>
            </button>
          </div>
        </form>
      )}

      {/* VOUCHERS LIST */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-400" />
            <span>Active Voucher Codes Directory ({vouchers.length})</span>
          </h4>
          <span className="text-[11px] text-slate-400 font-mono">
            One-time redemption enforced per organization
          </span>
        </div>

        {vouchers.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 space-y-2">
            <Gift className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-400">No voucher codes yet</p>
            <p className="text-[11px] text-slate-500">
              Click &ldquo;Generate New Voucher&rdquo; above to issue your first promo code.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {vouchers.map((v) => {
              const isExpanded = expandedVoucherId === v.id;
              const hasRedemptions = (v.redemptions?.length || 0) > 0;

              return (
                <div
                  key={v.id}
                  className={`rounded-2xl border transition ${
                    v.isActive
                      ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/40 border-slate-900 opacity-70'
                  }`}
                >
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Code badge and Details */}
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-2">
                        <span className="font-mono text-base font-extrabold tracking-widest text-amber-300">
                          {v.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(v.code)}
                          className="p-1 text-slate-400 hover:text-white transition"
                          title="Copy Code"
                        >
                          {copiedCode === v.code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {v.discountPercent}% OFF
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            Duration: {v.duration}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
                            Tier: {v.applicableTier}
                          </span>
                          {!v.isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Inactive / Paused
                            </span>
                          )}
                        </div>
                        {v.notes && (
                          <p className="text-xs text-slate-300">{v.notes}</p>
                        )}
                      </div>
                    </div>

                    {/* Right: Redemptions count & Actions */}
                    <div className="flex items-center gap-3 self-end md:self-center">
                      <button
                        type="button"
                        onClick={() => setExpandedVoucherId(isExpanded ? null : v.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                          hasRedemptions
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{v.redemptions?.length || 0} Redemptions</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggle(v.id, v.code)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          v.isActive
                            ? 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                            : 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50 hover:bg-emerald-900/50'
                        }`}
                      >
                        {v.isActive ? 'Pause' : 'Activate'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(v.id, v.code)}
                        className="p-2 rounded-xl text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition cursor-pointer"
                        title="Delete Voucher"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Drawer: List of Registered Companies that used this voucher */}
                  {isExpanded && (
                    <div className="border-t border-slate-800 p-4 bg-slate-950/90 rounded-b-2xl space-y-2">
                      <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-amber-400" />
                        <span>Registered Companies that have redeemed &ldquo;{v.code}&rdquo;</span>
                      </div>

                      {!hasRedemptions ? (
                        <p className="text-xs text-slate-500 py-2">
                          No company has redeemed this voucher code yet.
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-800/60 text-xs">
                          {v.redemptions.map((r, rIdx) => (
                            <div key={rIdx} className="py-2.5 flex items-center justify-between">
                              <div>
                                <div className="font-bold text-white flex items-center gap-2">
                                  <span>{r.companyName}</span>
                                  <span className="font-mono text-[10px] text-amber-400">({r.companyId})</span>
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Admin: <span className="text-slate-200">{r.adminEmail}</span> &bull; Tier: <strong className="text-blue-300">{r.tier}</strong>
                                </div>
                              </div>
                              <div className="text-right font-mono text-[11px] text-slate-400">
                                <div className="text-emerald-400 font-bold">{r.discountPercent}% Discount</div>
                                <div>{new Date(r.redeemedAt).toLocaleDateString()}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Voucher Code"
        message={`Are you sure you want to permanently delete voucher "${deleteTarget?.code}"? Any future attempts to redeem this voucher will be blocked.`}
        itemName={deleteTarget?.code}
        confirmLabel="Delete Voucher"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
