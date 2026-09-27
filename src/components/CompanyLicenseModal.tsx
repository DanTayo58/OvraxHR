import React, { useState } from 'react';
import { CompanyUserAccount } from '../utils/userManagement';
import { User, SubscriptionTier, VoucherDuration } from '../types';
import {
  PRICING_TIERS,
  activateCompanyLicense,
  CompanyAccessGuardResult,
} from '../utils/licensing';
import { validateVoucher } from '../utils/vouchers';
import {
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  CreditCard,
  Gift,
  ArrowRight,
  AlertTriangle,
  LogOut,
  Building2,
  CheckCircle2,
  Lock,
  X,
} from 'lucide-react';

interface CompanyLicenseModalProps {
  user?: CompanyUserAccount | User | null;
  guardResult?: CompanyAccessGuardResult;
  isOpen?: boolean;
  companyId?: string;
  companyName?: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  disturbanceMessage?: string;
  onActivated?: () => void;
  onLicenseActivated?: () => void;
  onLogout?: () => void;
  onClose?: () => void;
}

export const CompanyLicenseModal: React.FC<CompanyLicenseModalProps> = ({
  user,
  guardResult,
  isOpen = true,
  companyId: propCompanyId,
  companyName: propCompanyName,
  userEmail: propUserEmail,
  userName: propUserName,
  userRole: propUserRole,
  disturbanceMessage,
  onActivated,
  onLicenseActivated,
  onLogout,
  onClose,
}) => {
  if (!isOpen) return null;

  const role = user?.role || propUserRole || 'Member';
  const isAdmin = role === 'Admin' || !!user?.isAdmin;
  const companyName = user?.company || propCompanyName || 'My Organization';
  const companyId = user?.companyId || propCompanyId || 'CMP';
  const userName = user?.name || propUserName || 'Administrator';
  const userEmail = user?.email || propUserEmail || '';

  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('Small Scale');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string;
    discountPercent: number;
    duration?: VoucherDuration;
  } | null>(null);

  // Mock Card Form state (for visual representation as requested)
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('•••');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  const handleExit = () => {
    if (onClose) onClose();
    if (onLogout) onLogout();
  };

  const handleApplyVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    setVoucherError(null);
    const clean = voucherCode.trim();
    if (!clean) return;

    const res = validateVoucher(clean, companyId || companyName, selectedTier);
    if (!res.valid || !res.voucher) {
      setVoucherError(res.error || 'Invalid or expired voucher code.');
      setAppliedVoucher(null);
    } else {
      setAppliedVoucher({
        code: res.voucher.code,
        discountPercent: res.voucher.discountPercent,
        duration: res.voucher.duration,
      });
      setVoucherError(null);
    }
  };

  const handleSkipDevMode = () => {
    // Development mode temporary skip:
    // Does NOT save a persistent license to storage.
    // The user will be prompted again on their next login session.
    if (onClose) onClose();
  };

  const handleActivate = () => {
    setIsSubmitting(true);
    setActivationError(null);

    const result = activateCompanyLicense({
      companyId,
      companyName,
      tier: selectedTier,
      billingCycle,
      voucherCode: appliedVoucher ? appliedVoucher.code : undefined,
      adminEmail: userEmail,
      adminName: userName,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setActivationError(result.error || 'Failed to activate company license.');
      return;
    }

    if (onActivated) onActivated();
    if (onLicenseActivated) onLicenseActivated();
    if (onClose) onClose();
  };

  // If the logged in user is a regular member and the admin is unverified or unlicensed,
  // show the Organization Disturbance screen
  const isDisturbed =
    !isAdmin &&
    (guardResult?.reason === 'admin_unverified' ||
      guardResult?.reason === 'unlicensed' ||
      guardResult?.reason === 'admin_missing' ||
      !!disturbanceMessage);

  if (isDisturbed) {
    const displayReason =
      guardResult?.reason === 'admin_unverified'
        ? 'Administrator Email Verification Pending'
        : 'Organization License Required';
    const displayMessage =
      guardResult?.message ||
      disturbanceMessage ||
      'Team member workspace access is held until the administrator completes setup.';

    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">
              {displayReason}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {displayMessage}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>Organization: <strong className="text-white">{companyName}</strong></span>
            </div>
            {guardResult?.adminName && (
              <div className="text-slate-400">
                Designated Admin: <strong className="text-slate-200">{guardResult.adminName}</strong> ({guardResult.adminEmail})
              </div>
            )}
            <div className="text-[11px] text-amber-400/90 flex items-center gap-1.5 pt-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Team member workspace access is held until the administrator completes setup.</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleExit}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out / Switch Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admin Licensing Screen
  const tierInfo = PRICING_TIERS[selectedTier];
  const basePrice = billingCycle === 'annual' ? tierInfo.annualPrice : tierInfo.monthlyPrice;
  const discountedPrice = appliedVoucher
    ? Math.max(0, Math.round(basePrice * (1 - appliedVoucher.discountPercent / 100)))
    : basePrice;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-2xl w-full my-8 p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>OvraxHR Organization License Activation</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-2">
              Activate Subscription for {companyName}
            </h2>
            <p className="text-xs text-slate-400">
              Welcome, Administrator ({userName}). Select an OvraxHR subscription tier or apply a promo voucher code.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExit}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Sign Out / Close"
          >
            {onClose ? <X className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
          </button>
        </div>

        {/* Step 1: Select Tier (Small Scale vs Large Scale) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              1. Choose Subscription Tier
            </label>

            {/* Billing cycle pill */}
            <div className="p-0.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-2 py-1 rounded ${billingCycle === 'monthly' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-2 py-1 rounded flex items-center gap-1 ${billingCycle === 'annual' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
              >
                <span>Annual</span>
                <span className="text-emerald-300 font-mono">(-16%)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Small Scale */}
            <div
              onClick={() => setSelectedTier('Small Scale')}
              className={`p-4 rounded-2xl border cursor-pointer transition space-y-2 ${
                selectedTier === 'Small Scale'
                  ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-white">Small Scale Tier</div>
                <span className="text-[10px] font-mono text-slate-400">Up to 50 Staff</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Standard biometric attendance, shift roster &amp; payroll export.
              </p>
              <div className="text-base font-extrabold text-white font-mono">
                ${billingCycle === 'annual' ? PRICING_TIERS['Small Scale'].annualPrice : PRICING_TIERS['Small Scale'].monthlyPrice}
                <span className="text-[11px] text-slate-400 font-normal"> / {billingCycle === 'annual' ? 'yr' : 'mo'}</span>
              </div>
            </div>

            {/* Large Scale */}
            <div
              onClick={() => setSelectedTier('Large Scale')}
              className={`p-4 rounded-2xl border cursor-pointer transition space-y-2 ${
                selectedTier === 'Large Scale'
                  ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-white flex items-center gap-1.5">
                  <span>Large Scale Tier</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-[10px] font-mono text-blue-300">Unlimited Staff</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Unlimited staff, multi-device biometrics, full statutory tax &amp; ZIP exports.
              </p>
              <div className="text-base font-extrabold text-white font-mono">
                ${billingCycle === 'annual' ? PRICING_TIERS['Large Scale'].annualPrice : PRICING_TIERS['Large Scale'].monthlyPrice}
                <span className="text-[11px] text-slate-400 font-normal"> / {billingCycle === 'annual' ? 'yr' : 'mo'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Promo Voucher Code */}
        <div className="space-y-2 p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5 text-amber-400" />
            <span>2. Have a 6-Character Promo / Voucher Code?</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.trim())}
              placeholder="e.g. OVX100"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold uppercase text-white outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleApplyVoucher}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition"
            >
              Apply Code
            </button>
          </div>

          {voucherError && (
            <p className="text-[11px] text-rose-400 font-medium">{voucherError}</p>
          )}

          {appliedVoucher && (
            <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold">
                  Voucher &ldquo;{appliedVoucher.code}&rdquo; Applied:
                </span>{' '}
                {appliedVoucher.discountPercent}% Discount Granted ({appliedVoucher.duration})
              </div>
              <button
                type="button"
                onClick={() => {
                  setAppliedVoucher(null);
                  setVoucherCode('');
                }}
                className="text-[10px] text-slate-400 hover:text-white underline"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Step 3: Payment Card Form (Visual representation with skip) */}
        <div className="space-y-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-blue-400" />
              <span>3. Payment Method (Card Interface)</span>
            </span>
            <span className="text-[10px] text-slate-500">256-Bit Encrypted Mock</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3">
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300 outline-none"
                placeholder="Card Number"
              />
            </div>
            <div className="col-span-2">
              <input
                type="text"
                value={cardExpiry}
                onChange={(e) => setCardExpiry(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300 outline-none"
                placeholder="MM/YY"
              />
            </div>
            <div>
              <input
                type="text"
                value={cardCvc}
                onChange={(e) => setCardCvc(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300 outline-none"
                placeholder="CVC"
              />
            </div>
          </div>

          {/* Pricing summary */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs font-mono">
            <span className="text-slate-400">Total Charge:</span>
            <div className="flex items-center gap-2">
              {appliedVoucher && (
                <span className="text-slate-500 line-through text-[11px]">${basePrice}</span>
              )}
              <span className="text-sm font-extrabold text-emerald-400">${discountedPrice} USD</span>
            </div>
          </div>
        </div>

        {activationError && (
          <p className="text-xs text-rose-400 font-medium">{activationError}</p>
        )}

        {/* Actions: Activate License & SKIP FOR NOW (DEV MODE) */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          {/* Skip for now (Dev mode button) - as explicitly requested */}
          <button
            type="button"
            onClick={handleSkipDevMode}
            disabled={isSubmitting}
            className="w-full sm:w-auto order-2 sm:order-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 transition cursor-pointer"
          >
            Skip for now (Development Mode)
          </button>

          <button
            type="button"
            onClick={() => handleActivate()}
            disabled={isSubmitting}
            className="w-full sm:flex-1 order-1 sm:order-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Activate {selectedTier} License (${discountedPrice})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
