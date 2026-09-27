import React, { useState } from 'react';
import { RheivatechLogo } from './RheivatechLogo';
import { SubscriptionTier } from '../types';
import { PRICING_TIERS } from '../utils/licensing';
import { validateVoucher } from '../utils/vouchers';
import {
  Check,
  Zap,
  ShieldCheck,
  Clock,
  FileText,
  Users,
  Download,
  Building2,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Star,
  CheckCircle2,
  Tag,
  Gift,
  HelpCircle,
} from 'lucide-react';

interface WebsiteViewProps {
  onOpenLogin: (tier?: SubscriptionTier) => void;
  onOpenRegister?: (tier?: SubscriptionTier) => void;
  onClose?: () => void;
  onBackToApp?: () => void;
  isInsideApp?: boolean;
}

export const WebsiteView: React.FC<WebsiteViewProps> = ({
  onOpenLogin,
  onOpenRegister,
  onClose,
  onBackToApp,
  isInsideApp = false,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [voucherInput, setVoucherInput] = useState('');
  const [testedVoucher, setTestedVoucher] = useState<{
    code: string;
    discountPercent: number;
    duration?: string;
  } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  const handleTestVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    setVoucherError(null);
    const clean = voucherInput.trim();
    if (!clean) return;

    const res = validateVoucher(clean, 'DEMO_PREVIEW');
    if (!res.valid || !res.voucher) {
      setVoucherError(res.error || 'Invalid or expired voucher code.');
      setTestedVoucher(null);
    } else {
      setTestedVoucher({
        code: res.voucher.code,
        discountPercent: res.voucher.discountPercent,
        duration: res.voucher.duration,
      });
      setVoucherError(null);
    }
  };

  const calculateDisplayPrice = (tierKey: SubscriptionTier) => {
    const tier = PRICING_TIERS[tierKey];
    const base = billingCycle === 'annual' ? tier.annualPrice : tier.monthlyPrice;
    if (testedVoucher) {
      return Math.max(0, Math.round(base * (1 - testedVoucher.discountPercent / 100)));
    }
    return base;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <RheivatechLogo size="md" showSubtext={false} theme="dark" />
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-blue-400 transition">Features</a>
            <a href="#pricing" className="hover:text-blue-400 transition">Pricing (2 Tiers)</a>
            <a href="#biometrics" className="hover:text-blue-400 transition">Biometric Sync</a>
            <a href="#enterprise" className="hover:text-blue-400 transition">Enterprise</a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isInsideApp && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition"
            >
              Back to Workspace
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenLogin()}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-700/80 transition"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onOpenRegister ? onOpenRegister('Small Scale') : onOpenLogin('Small Scale')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5"
          >
            <span>Start Free Trial</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-4 sm:px-8 max-w-6xl mx-auto w-full text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Announcing OvraxHR &mdash; Complete Enterprise Workforce Suite</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto">
          Modern Attendance, Shift Rosters &amp; Automated Payroll
        </h1>

        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          OvraxHR unifies biometric clock-in synchronization, statutory payroll generation, dynamic multi-department shift rosters, and official HR letters into one high-performance platform.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <a
            href="#pricing"
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-xl shadow-blue-600/30 transition flex items-center gap-2"
          >
            <span>View Pricing Plans (2 Tiers)</span>
            <ChevronRight className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={() => onOpenLogin()}
            className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-bold border border-slate-700 transition flex items-center gap-2"
          >
            <span>Login to Console</span>
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-12 text-left">
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <div className="font-bold text-xs text-white">Biometric Sync</div>
            <p className="text-[11px] text-slate-400">Live multi-device clock-in with grace-period logic &amp; fines.</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <div className="font-bold text-xs text-white">Automated Payroll</div>
            <p className="text-[11px] text-slate-400">Statutory tax deductions, housing allowances &amp; instant PDF slips.</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <div className="font-bold text-xs text-white">HR Documents</div>
            <p className="text-[11px] text-slate-400">Job descriptions, appointment letters with custom letterhead.</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <div className="font-bold text-xs text-white">Enterprise Data Isolated</div>
            <p className="text-[11px] text-slate-400">Isolated database partitions with one-click full ZIP archives.</p>
          </div>
        </div>
      </section>

      {/* PRICING SECTION - STRICTLY 2 TIERS */}
      <section id="pricing" className="py-16 px-4 sm:px-8 bg-slate-900/50 border-t border-b border-slate-800/80">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Tag className="w-3.5 h-3.5" />
              <span>Transparent &amp; Predictable Pricing</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Two Tailored Tiers for Every Scale
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
              Choose the tier that aligns with your organization size. Upgrade, downgrade, or apply promo vouchers anytime.
            </p>

            {/* Monthly / Annual Toggle */}
            <div className="flex items-center justify-center pt-2">
              <div className="p-1 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                    billingCycle === 'monthly'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    billingCycle === 'annual'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Annual Billing</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-mono">
                    2 Months Free
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Promo Voucher Code Tester */}
          <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-amber-400" />
                <span>Have a 6-Character Voucher Code?</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">e.g., OVX100, RHEI50</span>
            </div>
            <form onSubmit={handleTestVoucher} className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={voucherInput}
                onChange={(e) => setVoucherInput(e.target.value.trim())}
                placeholder="6-Char Code"
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold uppercase text-white outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition cursor-pointer"
              >
                Apply Voucher
              </button>
            </form>
            {voucherError && (
              <p className="text-[11px] text-rose-400 font-medium">{voucherError}</p>
            )}
            {testedVoucher && (
              <div className="p-2 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[11px] flex items-center justify-between">
                <span className="font-bold">
                  Code &ldquo;{testedVoucher.code}&rdquo; Applied: {testedVoucher.discountPercent}% OFF ({testedVoucher.duration})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTestedVoucher(null);
                    setVoucherInput('');
                  }}
                  className="text-slate-400 hover:text-white text-[10px] underline ml-2"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* 2 TIERS PRICING CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* TIER 1: SMALL SCALE */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-6 hover:border-slate-700 transition">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">Small Scale Tier</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{PRICING_TIERS['Small Scale'].tagline}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-blue-300 border border-slate-700">
                    Up to 50 Staff
                  </span>
                </div>

                <div className="pt-2">
                  <div className="flex items-baseline gap-1.5">
                    {testedVoucher && testedVoucher.discountPercent > 0 && (
                      <span className="text-base text-slate-500 line-through font-mono">
                        ${billingCycle === 'annual' ? PRICING_TIERS['Small Scale'].annualPrice : PRICING_TIERS['Small Scale'].monthlyPrice}
                      </span>
                    )}
                    <span className="text-4xl font-extrabold text-white font-mono">
                      ${calculateDisplayPrice('Small Scale')}
                    </span>
                    <span className="text-xs text-slate-400">
                      / {billingCycle === 'annual' ? 'year' : 'month'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Billed {billingCycle === 'annual' ? 'annually' : 'monthly'}. No long-term lock-in.
                  </p>
                </div>

                <div className="border-t border-slate-800/80 pt-4 space-y-2.5 text-xs text-slate-300">
                  <div className="font-bold text-slate-100 text-[11px] uppercase tracking-wider font-mono">Included Features:</div>
                  {PRICING_TIERS['Small Scale'].features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenRegister ? onOpenRegister('Small Scale') : onOpenLogin('Small Scale')}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Select Small Scale Tier</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* TIER 2: LARGE SCALE (RECOMMENDED) */}
            <div className="p-6 rounded-3xl bg-gradient-to-b from-blue-950/40 to-slate-900 border-2 border-blue-500/40 flex flex-col justify-between space-y-6 shadow-2xl shadow-blue-950/50 relative">
              <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow">
                Recommended for Enterprise
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <span>Large Scale Tier</span>
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{PRICING_TIERS['Large Scale'].tagline}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    Unlimited Staff
                  </span>
                </div>

                <div className="pt-2">
                  <div className="flex items-baseline gap-1.5">
                    {testedVoucher && testedVoucher.discountPercent > 0 && (
                      <span className="text-base text-slate-500 line-through font-mono">
                        ${billingCycle === 'annual' ? PRICING_TIERS['Large Scale'].annualPrice : PRICING_TIERS['Large Scale'].monthlyPrice}
                      </span>
                    )}
                    <span className="text-4xl font-extrabold text-white font-mono">
                      ${calculateDisplayPrice('Large Scale')}
                    </span>
                    <span className="text-xs text-slate-400">
                      / {billingCycle === 'annual' ? 'year' : 'month'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Billed {billingCycle === 'annual' ? 'annually' : 'monthly'}. Complete enterprise scalability.
                  </p>
                </div>

                <div className="border-t border-blue-500/20 pt-4 space-y-2.5 text-xs text-slate-200">
                  <div className="font-bold text-blue-300 text-[11px] uppercase tracking-wider font-mono">Full Enterprise Capabilities:</div>
                  {PRICING_TIERS['Large Scale'].features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenRegister ? onOpenRegister('Large Scale') : onOpenLogin('Large Scale')}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Select Large Scale Tier</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 py-8 px-4 sm:px-8 text-center text-xs text-slate-500 space-y-2">
        <div className="flex items-center justify-center gap-2">
          <RheivatechLogo size="sm" showSubtext={false} theme="dark" />
        </div>
        <p>
          &copy; {new Date().getFullYear()} OvraxHR by Rheivatech Enterprise Solutions. All rights reserved.
        </p>
      </footer>
    </div>
  );
};
