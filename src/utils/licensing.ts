import { CompanyLicense, SubscriptionTier, VoucherDuration, User } from '../types';
import { normalizeCompanyId } from './companyStorage';
import { loadAllCompanyUsers, CompanyUserAccount } from './userManagement';
import { redeemVoucher, validateVoucher } from './vouchers';

const LICENSES_STORAGE_KEY = 'ovraxhr_company_licenses_v1';

export interface TierDetails {
  name: SubscriptionTier;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  maxStaff: string;
  maxAdmins: string;
  features: string[];
  recommendedFor: string;
}

export const PRICING_TIERS: Record<SubscriptionTier, TierDetails> = {
  'Small Scale': {
    name: 'Small Scale',
    tagline: 'Ideal for small offices, clinics, schools, and boutique agencies.',
    monthlyPrice: 49,
    annualPrice: 490,
    maxStaff: 'Up to 50 Staff Members',
    maxAdmins: '2 Admin & Manager Seats',
    features: [
      'Up to 50 Active Staff Profiles',
      'Biometric Clock-In & Shift Matrix',
      'Basic Payroll & Automatic Payslip PDF Export',
      'Department & Shift Roster Scheduling',
      'Standard Leave Approvals & Absence Tracking',
      'Automated Document Letterhead Generator',
      'Daily Local & Cloud Backup Encryption',
      'Email Customer Support Desk',
    ],
    recommendedFor: 'Growing businesses up to 50 employees looking for fast biometric and payroll automation.',
  },
  'Large Scale': {
    name: 'Large Scale',
    tagline: 'Enterprise-grade power for high-volume workforces & multi-branch teams.',
    monthlyPrice: 149,
    annualPrice: 1490,
    maxStaff: 'Unlimited Staff Members',
    maxAdmins: 'Unlimited Admin & Manager Seats',
    features: [
      'Unlimited Staff Member Directory',
      'Unlimited Admin, Manager & Viewer Roles',
      'Biometric Cloud Multi-Device Attendance Sync',
      'Full Statutory Tax & Multi-Tier Payroll Engine',
      'Custom Deductions, Late Penalties & Allowance Rules',
      'Comprehensive Job Descriptions & Confirmation Letters',
      'Direct Organization Full Folder ZIP Archive & Restore',
      'Priority 24/7 Dedicated Support Specialist Desk',
      'Custom Letterhead Styling & Digital Signature Seals',
      'Advanced ATS Applicant Screening & Resume Parsing',
    ],
    recommendedFor: 'Enterprises, hospitals, manufacturing plants, and multi-branch corporations.',
  },
};

export function loadAllCompanyLicenses(): Record<string, CompanyLicense> {
  try {
    const saved = localStorage.getItem(LICENSES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load company licenses:', e);
  }
  return {};
}

export function saveAllCompanyLicenses(licenses: Record<string, CompanyLicense>): void {
  try {
    localStorage.setItem(LICENSES_STORAGE_KEY, JSON.stringify(licenses));
    window.dispatchEvent(new CustomEvent('ovraxhr_licenses_updated'));
  } catch (e) {
    console.error('Failed to save company licenses:', e);
  }
}

/**
 * Retrieves the license for a given company ID or name.
 */
export function getCompanyLicense(companyIdOrName?: string): CompanyLicense | null {
  if (!companyIdOrName) return null;
  const all = loadAllCompanyLicenses();
  const cid = normalizeCompanyId(companyIdOrName);
  const cName = companyIdOrName.trim().toLowerCase();

  // Search by normalized ID or exact company name
  if (cid && all[cid]) return all[cid];
  if (all[cName]) return all[cName];

  for (const lic of Object.values(all)) {
    if (
      (cid && normalizeCompanyId(lic.companyId) === cid) ||
      (lic.companyName && lic.companyName.trim().toLowerCase() === cName)
    ) {
      return lic;
    }
  }

  return null;
}

/**
 * Checks if a company currently has an active license.
 */
export function isCompanyLicensed(companyIdOrName?: string): boolean {
  if (!companyIdOrName) return false;
  const lic = getCompanyLicense(companyIdOrName);
  if (!lic) return false;
  if (lic.status !== 'Active') return false;
  if ((lic as any).isDevBypass) return false;
  if (lic.expiresAt) {
    const exp = new Date(lic.expiresAt).getTime();
    if (Date.now() > exp) return false;
  }
  return true;
}

/**
 * Locates the designated admin for a given company.
 */
export function getCompanyAdmin(companyIdOrName: string): CompanyUserAccount | null {
  const users = loadAllCompanyUsers();
  const cid = normalizeCompanyId(companyIdOrName);
  const cName = (companyIdOrName || '').trim().toLowerCase();

  const companyUsers = (users || []).filter((u) => {
    if (!u) return false;
    const uCid = normalizeCompanyId(u.companyId);
    const uName = (u.company || '').trim().toLowerCase();
    return (cid && uCid === cid) || (uName && uName === cName);
  });

  if (companyUsers.length === 0) return null;
  const admin = companyUsers.find((u) => u && (u.role === 'Admin' || u.isAdmin));
  return admin || companyUsers[0] || null;
}

export interface CompanyAccessGuardResult {
  allowed: boolean;
  reason?: 'admin_unverified' | 'unlicensed' | 'admin_missing' | 'none';
  message?: string;
  disturbanceType?: any;
  adminName?: string;
  adminEmail?: string;
  companyName: string;
  companyId?: string;
}

/**
 * Disturbance & Verification Check:
 * "If the admin is not verified, no other user should be able to use.
 * Or if the admin is having an issue, other users should be disturbed as well."
 */
export function verifyCompanyMemberAccess(
  user?: CompanyUserAccount | User | null
): CompanyAccessGuardResult {
  if (!user) {
    return { allowed: true, companyName: 'Organization' };
  }

  const companyKey = user.companyId || user.company || 'My Organization';
  const companyName = user.company || 'Organization';
  const companyId = user.companyId || normalizeCompanyId(companyName);

  // Superadmins bypass tenant guards
  if (user.isSuperAdmin || user.role === 'SuperAdmin') {
    return { allowed: true, companyName, companyId };
  }

  const admin = getCompanyAdmin(companyKey);

  // If the user IS the admin:
  if (user.role === 'Admin' || user.isAdmin || (admin && admin.id === user.id)) {
    // Admin must be email verified first
    if (!user.isEmailVerified) {
      return {
        allowed: false,
        reason: 'admin_unverified',
        message: 'Please complete your 6-digit email verification code to access your workspace.',
        adminName: user.name,
        adminEmail: user.email,
        companyName,
        companyId,
      };
    }

    // Admin must have an active license
    const isLicensed = isCompanyLicensed(companyKey);
    if (!isLicensed) {
      return {
        allowed: false,
        reason: 'unlicensed',
        message: 'Your organization requires an active OvraxHR license to access your workspace.',
        adminName: user.name,
        adminEmail: user.email,
        companyName,
        companyId,
      };
    }

    return { allowed: true, companyName, companyId };
  }

  // Non-Admin Users (Managers, Members, Viewers):
  // Check if Admin exists and is verified
  if (!admin) {
    return {
      allowed: false,
      reason: 'admin_missing',
      message: `No active Administrator account was found for ${companyName}. Please contact support or your IT administrator.`,
      companyName,
      companyId,
    };
  }

  if (!admin.isEmailVerified) {
    return {
      allowed: false,
      reason: 'admin_unverified',
      message: `Organization Access Restricted: Your company Administrator (${admin.name} - ${admin.email}) has not verified their email address yet. OvraxHR requires company administrators to complete email verification before team members can access workspace tools.`,
      adminName: admin.name,
      adminEmail: admin.email,
      companyName,
      companyId,
    };
  }

  // Check if company has an active license
  const isLicensed = isCompanyLicensed(companyKey);
  if (!isLicensed) {
    return {
      allowed: false,
      reason: 'unlicensed',
      message: `Organization License Pending: Your company Administrator (${admin.name} - ${admin.email}) must activate a valid OvraxHR subscription tier for ${companyName} before team members can log into the workspace.`,
      adminName: admin.name,
      adminEmail: admin.email,
      companyName,
      companyId,
    };
  }

  return { allowed: true, companyName, companyId };
}

/**
 * Calculates license expiration date from a duration batch.
 */
export function calculateExpirationDate(durationBatch?: VoucherDuration | string): string {
  const d = new Date();
  switch (durationBatch) {
    case '1 month':
      d.setMonth(d.getMonth() + 1);
      break;
    case '2 months':
      d.setMonth(d.getMonth() + 2);
      break;
    case '6 months':
      d.setMonth(d.getMonth() + 6);
      break;
    case '1 year':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case '2 years':
      d.setFullYear(d.getFullYear() + 2);
      break;
    default:
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString();
}

export interface ActivateLicenseParams {
  companyId: string;
  companyName: string;
  tier: SubscriptionTier;
  billingCycle?: 'monthly' | 'annual';
  durationBatch?: VoucherDuration | string;
  voucherCode?: string;
  adminEmail: string;
  adminName?: string;
  isDevBypass?: boolean;
}

/**
 * Activates or grants a company license. Supports vouchers and dev bypass.
 */
export function activateCompanyLicense(params: ActivateLicenseParams): {
  success: boolean;
  license?: CompanyLicense;
  error?: string;
} {
  const cleanCid = normalizeCompanyId(params.companyId) || deriveCleanId(params.companyName);
  const cleanCname = params.companyName.trim();
  const tierInfo = PRICING_TIERS[params.tier];

  let discountPercent = 0;
  let voucherDuration: VoucherDuration | undefined;
  let codeUsed: string | undefined;

  // If a voucher code was supplied, validate and redeem it
  if (params.voucherCode && params.voucherCode.trim()) {
    const cleanCode = params.voucherCode.trim();
    const val = validateVoucher(cleanCode, cleanCid, params.tier);
    if (!val.valid || !val.voucher) {
      return { success: false, error: val.error || 'Invalid voucher code.' };
    }

    const redemptionRes = redeemVoucher(
      cleanCode,
      cleanCid,
      cleanCname,
      params.adminEmail,
      params.tier
    );

    if (!redemptionRes.success) {
      return { success: false, error: redemptionRes.error };
    }

    discountPercent = val.discountPercent || 0;
    voucherDuration = val.duration;
    codeUsed = cleanCode;
  }

  const basePrice =
    params.billingCycle === 'annual' ? tierInfo.annualPrice : tierInfo.monthlyPrice;
  const finalPrice = Math.max(0, Math.round(basePrice * (1 - discountPercent / 100)));

  const effectiveDuration = voucherDuration || params.durationBatch || (params.billingCycle === 'annual' ? '1 year' : '1 month');
  const expiresAt = calculateExpirationDate(effectiveDuration);

  const licenseKey = `OVX-${params.tier.substring(0, 2).toUpperCase()}-${cleanCid}-${Date.now().toString(36).toUpperCase()}`;

  const license: CompanyLicense = {
    companyId: cleanCid,
    companyName: cleanCname,
    tier: params.tier,
    billingCycle: params.billingCycle || 'monthly',
    durationBatch: effectiveDuration,
    status: 'Active',
    activatedAt: new Date().toISOString(),
    expiresAt,
    voucherCodeUsed: codeUsed,
    discountPercent,
    amountPaid: params.isDevBypass ? 0 : finalPrice,
    licenseKey,
    activatedBy: params.adminEmail,
  };

  if (params.isDevBypass) {
    // Temporary dev bypass: do not persist to storage so user is prompted again next session
    return { success: true, license: { ...license, status: 'Unlicensed' } };
  }

  const all = loadAllCompanyLicenses();
  all[cleanCid] = license;
  all[cleanCname.toLowerCase()] = license;
  saveAllCompanyLicenses(all);

  return { success: true, license };
}

/**
 * Revokes or resets a company's license.
 */
export function revokeCompanyLicense(companyIdOrName: string): boolean {
  const all = loadAllCompanyLicenses();
  const cid = normalizeCompanyId(companyIdOrName);
  const cName = (companyIdOrName || '').trim().toLowerCase();

  let modified = false;
  if (cid && all[cid]) {
    delete all[cid];
    modified = true;
  }
  if (all[cName]) {
    delete all[cName];
    modified = true;
  }

  if (modified) {
    saveAllCompanyLicenses(all);
    return true;
  }
  return false;
}

function deriveCleanId(name: string): string {
  const clean = (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.substring(0, 6) || 'CMP';
}
