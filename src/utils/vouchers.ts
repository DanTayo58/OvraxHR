import { VoucherCode, VoucherDuration, SubscriptionTier, VoucherRedemption } from '../types';
import { normalizeCompanyId } from './companyStorage';

const VOUCHERS_STORAGE_KEY = 'ovraxhr_vouchers_v1';

// Alphanumeric character pool for 6-character randomizer (clear, readable, case-sensitive)
const ALPHANUMERIC_POOL = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';

/**
 * Generates a unique, case-sensitive 6-character alphanumeric code.
 * e.g. "K9x7Wm", "R2tQ8p", "X3p7Bq"
 */
export function generateRandomVoucherCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * ALPHANUMERIC_POOL.length);
    code += ALPHANUMERIC_POOL[idx];
  }
  return code;
}

// Sample seed vouchers for demo and testing
const INITIAL_VOUCHERS: VoucherCode[] = [
  {
    id: 'vch-seed-01',
    code: 'OVX100',
    discountPercent: 100,
    duration: '1 year',
    applicableTier: 'All',
    createdAt: new Date().toISOString(),
    isActive: true,
    notes: 'Master 100% Launch Grant - 1 Year Full Platform Access',
    createdBy: 'OvraxHR Admin',
    redemptions: [],
  },
  {
    id: 'vch-seed-02',
    code: 'RHEI50',
    discountPercent: 50,
    duration: '6 months',
    applicableTier: 'All',
    createdAt: new Date().toISOString(),
    isActive: true,
    notes: 'Rheivatech Partner 50% Discount (6 Months)',
    createdBy: 'OvraxHR Admin',
    redemptions: [],
  },
  {
    id: 'vch-seed-03',
    code: 'GROW25',
    discountPercent: 25,
    duration: '2 months',
    applicableTier: 'Small Scale',
    createdAt: new Date().toISOString(),
    isActive: true,
    notes: 'Small Business Growth Promo 25% Off',
    createdBy: 'OvraxHR Admin',
    redemptions: [],
  },
];

export function loadAllVouchers(): VoucherCode[] {
  try {
    const saved = localStorage.getItem(VOUCHERS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load vouchers:', e);
  }
  // Initialize with initial vouchers if empty
  saveAllVouchers(INITIAL_VOUCHERS);
  return INITIAL_VOUCHERS;
}

export function saveAllVouchers(vouchers: VoucherCode[]): void {
  try {
    localStorage.setItem(VOUCHERS_STORAGE_KEY, JSON.stringify(vouchers));
    window.dispatchEvent(new CustomEvent('ovraxhr_vouchers_updated'));
  } catch (e) {
    console.error('Failed to save vouchers:', e);
  }
}

export interface CreateVoucherParams {
  code?: string;
  discountPercent: number;
  duration: VoucherDuration;
  applicableTier: 'All' | SubscriptionTier;
  notes?: string;
  createdBy?: string;
}

export function createVoucher(params: CreateVoucherParams): { success: boolean; voucher?: VoucherCode; error?: string } {
  const all = loadAllVouchers();
  
  // Format or generate 6-character code
  let cleanCode = (params.code || '').trim();
  if (!cleanCode) {
    cleanCode = generateRandomVoucherCode();
    // Guarantee uniqueness
    while (all.some((v) => v.code === cleanCode)) {
      cleanCode = generateRandomVoucherCode();
    }
  } else {
    // Validate custom code: exactly 6 alphanumeric characters
    if (cleanCode.length !== 6) {
      return { success: false, error: 'Voucher code must be exactly 6 alphanumeric characters.' };
    }
    // Check if duplicate (case-sensitive)
    if (all.some((v) => v.code === cleanCode)) {
      return { success: false, error: `Voucher code "${cleanCode}" already exists. Please generate or choose another code.` };
    }
  }

  const discount = Math.min(100, Math.max(1, Math.round(params.discountPercent)));

  const newVoucher: VoucherCode = {
    id: `vch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    code: cleanCode,
    discountPercent: discount,
    duration: params.duration,
    applicableTier: params.applicableTier,
    createdAt: new Date().toISOString(),
    isActive: true,
    notes: params.notes?.trim() || undefined,
    createdBy: params.createdBy || 'SuperAdmin',
    redemptions: [],
  };

  const updated = [newVoucher, ...all];
  saveAllVouchers(updated);
  return { success: true, voucher: newVoucher };
}

export function deleteVoucher(voucherId: string): boolean {
  const all = loadAllVouchers();
  const filtered = all.filter((v) => v.id !== voucherId);
  if (filtered.length !== all.length) {
    saveAllVouchers(filtered);
    return true;
  }
  return false;
}

export function toggleVoucherActive(voucherId: string): boolean {
  const all = loadAllVouchers();
  let found = false;
  const updated = all.map((v) => {
    if (v.id === voucherId) {
      found = true;
      return { ...v, isActive: !v.isActive };
    }
    return v;
  });
  if (found) {
    saveAllVouchers(updated);
  }
  return found;
}

export interface VoucherValidationResult {
  valid: boolean;
  voucher?: VoucherCode;
  error?: string;
  discountPercent?: number;
  duration?: VoucherDuration;
}

/**
 * Validates a case-sensitive 6-character voucher code for a specific company and tier.
 * Ensures the company has not already redeemed this code!
 */
export function validateVoucher(
  code: string,
  companyIdOrName: string,
  tier?: SubscriptionTier
): VoucherValidationResult {
  const cleanCode = (code || '').trim();
  if (!cleanCode) {
    return { valid: false, error: 'Please enter a voucher code.' };
  }

  const all = loadAllVouchers();
  // Exact case-sensitive match
  const voucher = all.find((v) => v.code === cleanCode);

  if (!voucher) {
    return { valid: false, error: `Voucher code "${cleanCode}" was not found or is invalid.` };
  }

  if (!voucher.isActive) {
    return { valid: false, error: `Voucher code "${cleanCode}" is currently inactive or paused.` };
  }

  // Tier check
  if (tier && voucher.applicableTier !== 'All' && voucher.applicableTier !== tier) {
    return {
      valid: false,
      error: `This voucher is only applicable to the ${voucher.applicableTier} tier.`,
    };
  }

  // Check if this company already used this voucher
  const normalizedCompId = normalizeCompanyId(companyIdOrName);
  const normalizedCompName = (companyIdOrName || '').trim().toLowerCase();

  const alreadyUsed = voucher.redemptions.some((r) => {
    const rId = normalizeCompanyId(r.companyId);
    const rName = (r.companyName || '').trim().toLowerCase();
    return (normalizedCompId && rId === normalizedCompId) || (rName && rName === normalizedCompName);
  });

  if (alreadyUsed) {
    return {
      valid: false,
      error: `Your organization has already redeemed voucher "${cleanCode}". Each voucher can only be used once per company.`,
    };
  }

  return {
    valid: true,
    voucher,
    discountPercent: voucher.discountPercent,
    duration: voucher.duration,
  };
}

/**
 * Records redemption of a voucher code by an authorized company admin.
 */
export function redeemVoucher(
  code: string,
  companyId: string,
  companyName: string,
  adminEmail: string,
  tier: SubscriptionTier
): { success: boolean; redemption?: VoucherRedemption; error?: string } {
  const validation = validateVoucher(code, companyId || companyName, tier);
  if (!validation.valid || !validation.voucher) {
    return { success: false, error: validation.error || 'Invalid voucher code.' };
  }

  const voucher = validation.voucher;
  const redemption: VoucherRedemption = {
    companyId: normalizeCompanyId(companyId) || companyId,
    companyName: companyName.trim(),
    adminEmail: adminEmail.trim(),
    redeemedAt: new Date().toISOString(),
    discountPercent: voucher.discountPercent,
    tier,
    batchPeriod: voucher.duration,
  };

  const all = loadAllVouchers();
  const updated = all.map((v) => {
    if (v.id === voucher.id) {
      return {
        ...v,
        redemptions: [redemption, ...(v.redemptions || [])],
      };
    }
    return v;
  });

  saveAllVouchers(updated);
  return { success: true, redemption };
}
