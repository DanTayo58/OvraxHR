import {
  CurrencyOption,
  PayGradeTier,
  PayrollBonus,
  PayrollConfig,
  PayrollDeduction,
  DeductionRuleSet,
  DynamicConditionRule,
  ManualDeductionRule,
  SuspensionDeductionConfig,
  AttendanceDeductionCalculationType,
  AttendanceEventDeductionConfig,
  BookedPenalty,
  PayrollRollRules,
  StaffMember,
  SuspensionHistoryRecord,
  ProjectFile,
  AttendanceRecord,
} from '../types';
import { loadCompanyData, saveCompanyData, STORAGE_KEYS } from './companyStorage';

export const GLOBAL_CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', label: 'USD $ - US Dollar (United States)' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', label: 'NGN ₦ - Nigerian Naira (Nigeria)' },
  { code: 'GBP', symbol: '£', name: 'British Pound', label: 'GBP £ - British Pound Sterling (UK)' },
  { code: 'EUR', symbol: '€', name: 'Euro', label: 'EUR € - Euro (European Union)' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar', label: 'CAD $ - Canadian Dollar (Canada)' },
  { code: 'AUD', symbol: '$', name: 'Australian Dollar', label: 'AUD $ - Australian Dollar (Australia)' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', label: 'JPY ¥ - Japanese Yen (Japan)' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', label: 'CNY ¥ - Chinese Yuan (China)' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', label: 'INR ₹ - Indian Rupee (India)' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi', label: 'GHS ₵ - Ghanaian Cedi (Ghana)' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', label: 'KES KSh - Kenyan Shilling (Kenya)' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', label: 'ZAR R - South African Rand (South Africa)' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', label: 'EGP E£ - Egyptian Pound (Egypt)' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', label: 'AED د.إ - UAE Dirham (United Arab Emirates)' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', label: 'SAR ﷼ - Saudi Riyal (Saudi Arabia)' },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal', label: 'QAR QR - Qatari Riyal (Qatar)' },
  { code: 'SGD', symbol: '$', name: 'Singapore Dollar', label: 'SGD $ - Singapore Dollar (Singapore)' },
  { code: 'HKD', symbol: '$', name: 'Hong Kong Dollar', label: 'HKD $ - Hong Kong Dollar (Hong Kong)' },
  { code: 'NZD', symbol: '$', name: 'New Zealand Dollar', label: 'NZD $ - New Zealand Dollar (New Zealand)' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', label: 'CHF Fr - Swiss Franc (Switzerland)' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', label: 'BRL R$ - Brazilian Real (Brazil)' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso', label: 'MXN $ - Mexican Peso (Mexico)' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', label: 'PHP ₱ - Philippine Peso (Philippines)' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', label: 'MYR RM - Malaysian Ringgit (Malaysia)' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', label: 'IDR Rp - Indonesian Rupiah (Indonesia)' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', label: 'THB ฿ - Thai Baht (Thailand)' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', label: 'VND ₫ - Vietnamese Dong (Vietnam)' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', label: 'PKR ₨ - Pakistani Rupee (Pakistan)' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', label: 'BDT ৳ - Bangladeshi Taka (Bangladesh)' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', label: 'KRW ₩ - South Korean Won (South Korea)' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', label: 'TRY ₺ - Turkish Lira (Turkey)' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', label: 'PLN zł - Polish Zloty (Poland)' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', label: 'SEK kr - Swedish Krona (Sweden)' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', label: 'NOK kr - Norwegian Krone (Norway)' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', label: 'DKK kr - Danish Krone (Denmark)' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', label: 'ILS ₪ - Israeli New Shekel (Israel)' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', label: 'UGX USh - Ugandan Shilling (Uganda)' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', label: 'TZS TSh - Tanzanian Shilling (Tanzania)' },
  { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc', label: 'RWF FRw - Rwandan Franc (Rwanda)' },
  { code: 'ZMW', symbol: 'K', name: 'Zambian Kwacha', label: 'ZMW K - Zambian Kwacha (Zambia)' },
];

export const DEFAULT_PAY_GRADES: PayGradeTier[] = [
  {
    id: 'pg-l1',
    name: 'Grade L1 (Junior / Associate)',
    minSalary: 1200,
    maxSalary: 2800,
    defaultFrequency: 'Monthly',
    description: 'Junior associates, interns, and entry-level operations specialists.',
  },
  {
    id: 'pg-l2',
    name: 'Grade L2 (Mid-Level Professional)',
    minSalary: 2800,
    maxSalary: 5500,
    defaultFrequency: 'Monthly',
    description: 'Core professionals, departmental specialists, and qualified practitioners.',
  },
  {
    id: 'pg-l3',
    name: 'Grade L3 (Senior / Lead Specialist)',
    minSalary: 5500,
    maxSalary: 9500,
    defaultFrequency: 'Monthly',
    description: 'Senior analysts, team leads, system architects, and senior supervisors.',
  },
  {
    id: 'pg-l4',
    name: 'Grade L4 (Principal / Department Head)',
    minSalary: 9500,
    maxSalary: 15000,
    defaultFrequency: 'Monthly',
    description: 'Department heads, principal managers, and senior operations leaders.',
  },
  {
    id: 'pg-exec',
    name: 'Grade Executive (C-Suite / Director)',
    minSalary: 15000,
    maxSalary: 35000,
    defaultFrequency: 'Monthly',
    description: 'Managing directors, VPs, and senior corporate officers.',
  },
  {
    id: 'pg-hourly',
    name: 'Grade Hourly / Contract Shift',
    minSalary: 15,
    maxSalary: 65,
    defaultFrequency: 'Weekly',
    description: 'Shift production workers, contract staff, and temporary personnel.',
  },
];

export const DEFAULT_DEDUCTIONS: PayrollDeduction[] = [
  {
    id: 'ded-tax',
    name: 'Income Tax (PAYE / Statutory)',
    type: 'percentage',
    value: 7.5,
    applicableTo: 'All',
    isEnabled: true,
    description: 'Statutory income tax withholding.',
  },
  {
    id: 'ded-pension',
    name: 'Pension Contribution Fund',
    type: 'percentage',
    value: 8.0,
    applicableTo: 'All',
    isEnabled: true,
    description: 'Employee statutory retirement pension savings.',
  },
  {
    id: 'ded-health',
    name: 'Healthcare / National Health Scheme',
    type: 'fixed',
    value: 45,
    applicableTo: 'All',
    isEnabled: true,
    description: 'Corporate and statutory healthcare insurance contribution.',
  },
  {
    id: 'ded-welfare',
    name: 'Staff Welfare & Union Dues',
    type: 'fixed',
    value: 15,
    applicableTo: 'All',
    isEnabled: false,
    description: 'Voluntary staff welfare association dues.',
  },
];

export const DEFAULT_BONUSES: PayrollBonus[] = [
  // Default Corporate Allowances & Welfare Benefits
  {
    id: 'bon-housing',
    name: 'Housing Allowance',
    type: 'fixed',
    value: 150,
    applicableTo: 'All',
    isEnabled: true,
    isDefault: true,
    category: 'housing',
    disbursementType: 'payroll',
    description: 'Standard monthly housing and accommodation assistance stipend.',
  },
  {
    id: 'bon-transport',
    name: 'Transport & Commuting Allowance',
    type: 'fixed',
    value: 80,
    applicableTo: 'All',
    isEnabled: true,
    isDefault: true,
    category: 'transport',
    disbursementType: 'payroll',
    description: 'Standard monthly commuting and transit subsidy allowance.',
  },
  {
    id: 'bon-birthday',
    name: 'Birthday Celebration Voucher',
    type: 'fixed',
    value: 50,
    applicableTo: 'All',
    isEnabled: true,
    isDefault: true,
    category: 'birthday',
    disbursementType: 'welfare_log',
    description: 'Annual corporate celebration gift voucher or birthday grant. Logged in Staff Welfare & Grants ledger.',
  },
  {
    id: 'bon-med',
    name: 'Emergency Medical & Health Aid',
    type: 'fixed',
    value: 250,
    applicableTo: 'All',
    isEnabled: false,
    isDefault: true,
    category: 'medical',
    disbursementType: 'welfare_log',
    description: 'Direct subsidy for non-elective medical emergencies or outpatient medication support.',
  },
  {
    id: 'bon-bereave',
    name: 'Compassionate & Bereavement Grant',
    type: 'fixed',
    value: 300,
    applicableTo: 'All',
    isEnabled: false,
    isDefault: true,
    category: 'bereavement',
    disbursementType: 'welfare_log',
    description: 'Financial aid provided to staff during immediate family bereavement.',
  },
  {
    id: 'bon-child',
    name: 'Childbirth & Maternity / Paternity Gift',
    type: 'fixed',
    value: 200,
    applicableTo: 'All',
    isEnabled: false,
    isDefault: true,
    category: 'childbirth',
    disbursementType: 'welfare_log',
    description: 'Congratulatory cash grant upon the arrival of a newborn child.',
  },
  // Performance & Shift Incentives
  {
    id: 'bon-performance',
    name: 'KPI Performance Bonus',
    type: 'percentage',
    value: 5.0,
    applicableTo: 'All',
    isEnabled: true,
    isDefault: false,
    category: 'performance',
    disbursementType: 'payroll',
    description: 'Merit-based performance and target completion incentive.',
  },
  {
    id: 'bon-attendance',
    name: 'Punctuality & Attendance Stipend',
    type: 'fixed',
    value: 50,
    applicableTo: 'All',
    isEnabled: true,
    isDefault: false,
    category: 'attendance',
    disbursementType: 'payroll',
    description: 'Bonus awarded for perfect attendance without unexcused late arrivals.',
  },
  {
    id: 'bon-overtime',
    name: 'Shift Overtime Allowance',
    type: 'fixed',
    value: 120,
    applicableTo: 'All',
    isEnabled: false,
    isDefault: false,
    category: 'overtime',
    disbursementType: 'payroll',
    description: 'Extra allowance for verified weekend or night shift duty hours.',
  },
];

export const DEFAULT_MANUAL_DEDUCTIONS: ManualDeductionRule[] = [
  {
    id: 'man-late',
    name: 'Late Attendance Penalty',
    type: 'fixed',
    defaultValue: 25,
    description: 'Fine booked for unexcused tardiness or late arrival to designated work shift.',
  },
  {
    id: 'man-absence',
    name: 'Unexcused Absence Charge',
    type: 'fixed',
    defaultValue: 60,
    description: 'Charge for unnotified absence without prior authorized leave request.',
  },
  {
    id: 'man-damage',
    name: 'Equipment / Asset Damage Surcharge',
    type: 'fixed',
    defaultValue: 100,
    description: 'Recovery charge for damaged company property, tools, or lost inventory.',
  },
  {
    id: 'man-conduct',
    name: 'Policy Infraction / Disciplinary Fine',
    type: 'percentage',
    defaultValue: 3.0,
    description: 'Disciplinary surcharge for workplace policy non-compliance.',
  },
  {
    id: 'man-cash-short',
    name: 'Cash Register / Till Shortage',
    type: 'fixed',
    defaultValue: 35,
    description: 'Discrepancy recovery surcharge for till shortage or reconciliation deficit.',
  },
];

export const DEFAULT_ROLL_RULES: PayrollRollRules = {
  monthly: {
    ruleType: 'specific_day',
    dayOfMonth: 25,
  },
  biWeekly: {
    dayOfWeek: 'Friday',
    startDate: '2026-09-04',
    interval: 'every_2nd_week',
  },
  weekly: {
    dayOfWeek: 'Friday',
  },
};

export const DEFAULT_SUSPENSION_DEDUCTION_CONFIG: SuspensionDeductionConfig = {
  isEnabled: true,
  calculationType: 'daily_pay',
  rigidDailyAmount: 50,
  daysBasis: 30,
};

export const DEFAULT_ABSENTEE_DEDUCTION_CONFIG: AttendanceEventDeductionConfig = {
  isEnabled: true,
  calculationType: 'day_calculation',
  useSalaryDailyRate: true,
  rigidDailyAmount: 50,
  percentageRate: 3.0,
  exactAmount: 50,
};

export const DEFAULT_LATENESS_DEDUCTION_CONFIG: AttendanceEventDeductionConfig = {
  isEnabled: true,
  calculationType: 'exact_value',
  useSalaryDailyRate: true,
  rigidDailyAmount: 15,
  percentageRate: 1.0,
  exactAmount: 15,
};

export const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  currencyCode: 'USD',
  currencySymbol: '$',
  currencyName: 'US Dollar',
  payGrades: DEFAULT_PAY_GRADES,
  deductions: DEFAULT_DEDUCTIONS,
  manualDeductionRules: DEFAULT_MANUAL_DEDUCTIONS,
  suspensionDeductionConfig: DEFAULT_SUSPENSION_DEDUCTION_CONFIG,
  absenteeDeductionConfig: DEFAULT_ABSENTEE_DEDUCTION_CONFIG,
  latenessDeductionConfig: DEFAULT_LATENESS_DEDUCTION_CONFIG,
  bookedPenalties: [],
  bonuses: DEFAULT_BONUSES,
  rollRules: DEFAULT_ROLL_RULES,
  taxIdentificationNumber: 'TAX-CORP-0982',
};

/**
 * Loads company payroll configuration with fallback to defaults.
 */
export function loadCompanyPayrollConfig(companyName?: string): PayrollConfig {
  const saved = loadCompanyData<PayrollConfig>(
    STORAGE_KEYS.PAYROLL,
    companyName,
    DEFAULT_PAYROLL_CONFIG
  );

  if (!saved || typeof saved !== 'object') {
    return DEFAULT_PAYROLL_CONFIG;
  }

  const rawBonuses = Array.isArray(saved.bonuses) ? saved.bonuses : [];
  // Ensure default allowances exist even if an older configuration is loaded
  const existingBonusIds = new Set(rawBonuses.map((b) => b.id));
  const existingBonusNames = new Set(rawBonuses.map((b) => b.name?.toLowerCase()));
  const missingDefaults = DEFAULT_BONUSES.filter(
    (db) => db.isDefault && !existingBonusIds.has(db.id) && !existingBonusNames.has(db.name.toLowerCase())
  );
  const resolvedBonuses = rawBonuses.length > 0 ? [...rawBonuses, ...missingDefaults] : DEFAULT_BONUSES;

  return {
    currencyCode: saved.currencyCode || 'USD',
    currencySymbol: saved.currencySymbol || '$',
    currencyName: saved.currencyName || 'US Dollar',
    payGrades: Array.isArray(saved.payGrades) && saved.payGrades.length > 0 ? saved.payGrades : DEFAULT_PAY_GRADES,
    deductions: Array.isArray(saved.deductions) ? saved.deductions : DEFAULT_DEDUCTIONS,
    manualDeductionRules: Array.isArray(saved.manualDeductionRules) && saved.manualDeductionRules.length > 0 ? saved.manualDeductionRules : DEFAULT_MANUAL_DEDUCTIONS,
    suspensionDeductionConfig: saved.suspensionDeductionConfig && typeof saved.suspensionDeductionConfig === 'object'
      ? {
          isEnabled: saved.suspensionDeductionConfig.isEnabled !== false,
          calculationType: saved.suspensionDeductionConfig.calculationType === 'rigid' ? 'rigid' : 'daily_pay',
          rigidDailyAmount: Number(saved.suspensionDeductionConfig.rigidDailyAmount) >= 0 ? Number(saved.suspensionDeductionConfig.rigidDailyAmount) : 50,
          daysBasis: Number(saved.suspensionDeductionConfig.daysBasis) || 31,
        }
      : DEFAULT_SUSPENSION_DEDUCTION_CONFIG,
    absenteeDeductionConfig: saved.absenteeDeductionConfig && typeof saved.absenteeDeductionConfig === 'object'
      ? {
          isEnabled: saved.absenteeDeductionConfig.isEnabled !== false,
          calculationType: (['day_calculation', 'percentage', 'exact_value'].includes(saved.absenteeDeductionConfig.calculationType)
            ? saved.absenteeDeductionConfig.calculationType
            : 'day_calculation') as AttendanceDeductionCalculationType,
          useSalaryDailyRate: saved.absenteeDeductionConfig.useSalaryDailyRate !== false,
          rigidDailyAmount: Number(saved.absenteeDeductionConfig.rigidDailyAmount) >= 0 ? Number(saved.absenteeDeductionConfig.rigidDailyAmount) : 50,
          percentageRate: Number(saved.absenteeDeductionConfig.percentageRate) >= 0 ? Number(saved.absenteeDeductionConfig.percentageRate) : 3.0,
          exactAmount: Number(saved.absenteeDeductionConfig.exactAmount) >= 0 ? Number(saved.absenteeDeductionConfig.exactAmount) : 50,
        }
      : DEFAULT_ABSENTEE_DEDUCTION_CONFIG,
    latenessDeductionConfig: saved.latenessDeductionConfig && typeof saved.latenessDeductionConfig === 'object'
      ? {
          isEnabled: saved.latenessDeductionConfig.isEnabled !== false,
          calculationType: (['day_calculation', 'percentage', 'exact_value'].includes(saved.latenessDeductionConfig.calculationType)
            ? saved.latenessDeductionConfig.calculationType
            : 'exact_value') as AttendanceDeductionCalculationType,
          useSalaryDailyRate: saved.latenessDeductionConfig.useSalaryDailyRate !== false,
          rigidDailyAmount: Number(saved.latenessDeductionConfig.rigidDailyAmount) >= 0 ? Number(saved.latenessDeductionConfig.rigidDailyAmount) : 15,
          percentageRate: Number(saved.latenessDeductionConfig.percentageRate) >= 0 ? Number(saved.latenessDeductionConfig.percentageRate) : 1.0,
          exactAmount: Number(saved.latenessDeductionConfig.exactAmount) >= 0 ? Number(saved.latenessDeductionConfig.exactAmount) : 15,
        }
      : DEFAULT_LATENESS_DEDUCTION_CONFIG,
    bookedPenalties: Array.isArray(saved.bookedPenalties) ? saved.bookedPenalties : [],
    bonuses: resolvedBonuses,
    defaultPayFrequency: saved.defaultPayFrequency || 'Monthly',
    rollRules: saved.rollRules || DEFAULT_ROLL_RULES,
    taxIdentificationNumber: saved.taxIdentificationNumber || 'TAX-CORP-0982',
  };
}

/**
 * Gets total calendar days in the specified month (or current month by default).
 */
export function getDaysInCurrentMonth(date?: Date | string | null): number {
  const d = date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/**
 * Calculates the total inclusive days between suspension start and end dates.
 */
export function calculateSuspensionDays(startDate?: string, endDate?: string): number {
  if (!startDate) return 1;
  if (!endDate) return 1;
  try {
    const d1 = new Date(startDate);
    const d2 = new Date(endDate);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 1;
    const diffTime = d2.getTime() - d1.getTime();
    if (diffTime < 0) return 1;
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24)) + 1;
    return Math.max(1, diffDays);
  } catch {
    return 1;
  }
}

export interface StaffSuspensionCalculationResult {
  hasActiveSuspension: boolean;
  dailyRateX: number;
  countedDays: number;
  totalDays: number;
  alreadyDeductedDays: number;
  remainingDaysAfterRoll: number;
  deductionAmount: number;
  formulaText: string;
  summaryText: string;
  daysBasis: number;
  monthName: string;
  counterStopped: boolean;
  isFullySettled: boolean;
  startDate?: string;
  endDate?: string;
}

/**
 * Safe local-date parsing that prevents UTC-offset day shifts
 */
export function parseLocalDate(input: Date | string | undefined | null): Date {
  if (!input) return new Date();
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;
  const str = String(input).trim();
  if (str.includes('-')) {
    const clean = str.split('T')[0];
    const parts = clean.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Formats a Date object to YYYY-MM-DD string using local calendar values
 */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Retrieves the currently active suspension record for a specific staff member from company history logs.
 * Strictly respects the rule:
 * "If the date spans beyond or on the current date, it is active. If not, it is completed/inactive."
 */
export function getStaffActiveSuspensionFromHistory(
  staff: Partial<StaffMember>,
  companyNameOrId?: string,
  referenceDate?: string | Date | null
): SuspensionHistoryRecord | null {
  try {
    const refDate = parseLocalDate(referenceDate);
    const todayStr = formatLocalDate(refDate);

    const globalLogs = loadCompanyData<SuspensionHistoryRecord[]>(STORAGE_KEYS.SUSPENSION_LOGS, companyNameOrId, []);
    const staffHistory = loadCompanyData<Record<string, any[]>>(STORAGE_KEYS.STAFF_HISTORY, companyNameOrId, {});

    const allRecords: SuspensionHistoryRecord[] = Array.isArray(globalLogs) ? [...globalLogs] : [];

    const targetStaffId = staff.id ? String(staff.id).trim() : '';
    const targetEmpId = staff.employeeId ? String(staff.employeeId).trim() : '';
    const targetName = staff.name ? String(staff.name).trim().toLowerCase() : '';

    // Search staffHistory by staff.id and staff.employeeId keys
    if (targetStaffId && staffHistory[targetStaffId] && Array.isArray(staffHistory[targetStaffId])) {
      staffHistory[targetStaffId].forEach((item) => {
        if (item && (item.category === 'Disciplinary Suspension' || item.type?.includes('suspension') || item.title?.toLowerCase().includes('suspension'))) {
          allRecords.push(item);
        }
      });
    }

    if (targetEmpId && targetEmpId !== targetStaffId && staffHistory[targetEmpId] && Array.isArray(staffHistory[targetEmpId])) {
      staffHistory[targetEmpId].forEach((item) => {
        if (item && (item.category === 'Disciplinary Suspension' || item.type?.includes('suspension') || item.title?.toLowerCase().includes('suspension'))) {
          allRecords.push(item);
        }
      });
    }

    // Filter strictly to this specific staff member to prevent universal application of fines
    const forThisStaff = allRecords.filter((r) => {
      if (!r) return false;
      const rStaffId = r.staffId ? String(r.staffId).trim() : '';
      const rEmpId = r.employeeId ? String(r.employeeId).trim() : '';
      const rName = r.staffName ? String(r.staffName).trim().toLowerCase() : '';

      // If record has explicit IDs that conflict with this staff, reject it
      if (targetStaffId && rStaffId && targetStaffId !== rStaffId) return false;
      if (targetEmpId && rEmpId && targetEmpId.toLowerCase() !== rEmpId.toLowerCase()) return false;

      // Positive match by ID, employee ID, or exact name
      const idMatch = Boolean(targetStaffId && rStaffId && targetStaffId === rStaffId);
      const empMatch = Boolean(targetEmpId && rEmpId && targetEmpId.toLowerCase() === rEmpId.toLowerCase());
      const nameMatch = Boolean(targetName && rName && targetName === rName && targetName.length > 1);

      return idMatch || empMatch || nameMatch;
    });

    // Deduplicate records by id
    const uniqueMap = new Map<string, SuspensionHistoryRecord>();
    forThisStaff.forEach((r) => {
      const key = r.id || `${r.startDate}-${r.endDate}-${r.timestamp}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, r);
      }
    });
    const uniqueRecords = Array.from(uniqueMap.values());

    // Sort descending by timestamp or date (latest first)
    uniqueRecords.sort((a, b) => {
      const tA = new Date(a.timestamp || a.date).getTime() || 0;
      const tB = new Date(b.timestamp || b.date).getTime() || 0;
      return tB - tA;
    });

    for (const rec of uniqueRecords) {
      if (rec.status === 'Restored' || rec.type === 'restored' || rec.title?.toLowerCase().includes('restored')) {
        // Staff member was unsuspended/restored; not currently active
        continue;
      }
      const sDate = (rec.startDate || rec.date || '').split('T')[0].trim();
      const eDate = (rec.endDate || '').split('T')[0].trim();

      // Rule: "If the date spans beyond or on the current date, it is active. If not, it is completed/inactive."
      if (eDate) {
        if (eDate >= todayStr) {
          return rec;
        }
      } else if (sDate && sDate <= todayStr) {
        return rec;
      }
    }

    return null;
  } catch (err) {
    console.error('Failed to get staff suspension from history:', err);
    return null;
  }
}

/**
 * Calculates active suspension deduction using the multi-cycle counter reset formula:
 * base salary / days of the month = x.
 * Then counted days before payroll * x = deduction on payroll.
 * After payroll is executed, counted days resets to 0.
 * On the final day of suspension, the counter stops.
 * Accurately supports Weekly, Bi-Weekly, and Monthly pay frequencies and honors the suspension history log.
 */
export function calculateStaffActiveSuspensionDeduction(
  staff: Partial<StaffMember>,
  payrollConfig?: PayrollConfig | null,
  referenceDate?: string | Date | null,
  companyNameOrId?: string
): StaffSuspensionCalculationResult {
  const refD = parseLocalDate(referenceDate);
  const todayStr = formatLocalDate(refD);
  const daysBasis = getDaysInCurrentMonth(refD);
  const monthName = refD.toLocaleString('default', { month: 'short' });
  const currencySymbol = payrollConfig?.currencySymbol || '$';

  const defaultRes: StaffSuspensionCalculationResult = {
    hasActiveSuspension: false,
    dailyRateX: 0,
    countedDays: 0,
    totalDays: 0,
    alreadyDeductedDays: 0,
    remainingDaysAfterRoll: 0,
    deductionAmount: 0,
    formulaText: 'No active suspension deduction',
    summaryText: '0 days',
    daysBasis,
    monthName,
    counterStopped: false,
    isFullySettled: true,
  };

  // Inspect history log first for accurate suspension configuration
  const historySuspension = getStaffActiveSuspensionFromHistory(staff, companyNameOrId, referenceDate);

  let sDate = staff.suspensionStartDate?.split('T')[0] || historySuspension?.startDate?.split('T')[0];
  let eDate = staff.suspensionEndDate?.split('T')[0] || historySuspension?.endDate?.split('T')[0];

  // If no history record and staff is not actively suspended, return default 0
  if (!sDate && !historySuspension && staff.status !== 'Suspended') {
    return defaultRes;
  }

  // Evaluate date span: "If the date spans beyond or on the current date, it is active. If not, it is completed/inactive."
  if (eDate && eDate < todayStr) {
    return {
      ...defaultRes,
      formulaText: `Suspension concluded on ${eDate} (inactive for this cycle).`,
      summaryText: 'Concluded',
      isFullySettled: true,
      startDate: sDate,
      endDate: eDate,
    };
  }

  if (!sDate) {
    sDate = todayStr;
  }

  // Total duration days of suspension
  let totalDays = 0;
  if (staff.suspensionTotalDays && staff.suspensionTotalDays > 0) {
    totalDays = staff.suspensionTotalDays;
  } else if (historySuspension?.durationDays && historySuspension.durationDays > 0) {
    totalDays = historySuspension.durationDays;
  } else if (sDate && eDate) {
    totalDays = calculateSuspensionDays(sDate, eDate);
  } else {
    totalDays = 999;
  }

  const alreadyDeducted = Math.max(0, staff.suspensionDeductedDays || 0);

  // Active configuration from Deductions tab
  const activeConfig = payrollConfig?.suspensionDeductionConfig || DEFAULT_SUSPENSION_DEDUCTION_CONFIG;
  const isGloballyEnabled = activeConfig.isEnabled !== false;

  // 1. UNIVERSAL DISABLE CHECK: If suspension deduction is disabled globally in Deductions tab
  if (!isGloballyEnabled) {
    return {
      ...defaultRes,
      hasActiveSuspension: true,
      dailyRateX: 0,
      countedDays: 0,
      totalDays,
      alreadyDeductedDays: alreadyDeducted,
      remainingDaysAfterRoll: 0,
      deductionAmount: 0,
      formulaText: 'Automatic suspension deduction is disabled globally in Deductions configuration.',
      summaryText: 'Globally Disabled (0 deduction)',
      counterStopped: true,
      isFullySettled: true,
      startDate: sDate,
      endDate: eDate,
    };
  }

  // 2. INDIVIDUAL STAFF DISABLE CHECK: If suspension fine/deduction is disabled or pardoned for this specific staff member
  const isIndividualPardonedOrDisabled =
    historySuspension?.status === 'Pardoned' ||
    Boolean(historySuspension?.deductionPolicy?.toLowerCase().includes('pardon')) ||
    Boolean(historySuspension?.deductionPolicy?.toLowerCase().includes('disabled')) ||
    Boolean(historySuspension?.deductionPolicy?.toLowerCase().includes('no automatic deduction')) ||
    Boolean(historySuspension?.deductionPolicy?.toLowerCase().includes('no deduction')) ||
    Boolean(historySuspension?.deductionPolicy?.toLowerCase().includes('no fine')) ||
    historySuspension?.calculationType === 'none' ||
    (historySuspension?.dailyRate === 0 && Number(historySuspension?.deductionAmount) === 0 && (!historySuspension?.penaltyRuleName || historySuspension?.penaltyRuleName === 'None' || historySuspension?.penaltyRuleName === 'Automatic Daily Suspension Deduction')) ||
    Boolean((staff as any).suspensionDeductionDisabled) ||
    Boolean((staff as any).isSuspensionPardoned) ||
    Boolean((staff as any).suspensionPardoned);

  if (isIndividualPardonedOrDisabled) {
    return {
      ...defaultRes,
      hasActiveSuspension: true,
      dailyRateX: 0,
      countedDays: 0,
      totalDays,
      alreadyDeductedDays: alreadyDeducted,
      remainingDaysAfterRoll: 0,
      deductionAmount: 0,
      formulaText: 'Disciplinary suspension deduction/fine is disabled or pardoned for this staff member (No deduction).',
      summaryText: 'Pardoned / Disabled (0 deduction)',
      counterStopped: true,
      isFullySettled: true,
      startDate: sDate,
      endDate: eDate,
    };
  }

  // 3. FIT THE CONFIGURED SETTINGS IN THE DEDUCTIONS TAB
  const baseSalary = Number(staff.estimatedMonthlySalary) || 0;
  const calculationType = activeConfig.calculationType === 'rigid' ? 'rigid' : 'daily_pay';
  let dailyRateX = 0;
  let calculationBasisDays = daysBasis;

  if (calculationType === 'rigid') {
    // Configured Rigid Daily Rate
    dailyRateX = Math.max(0, Number(activeConfig.rigidDailyAmount) >= 0 ? Number(activeConfig.rigidDailyAmount) : 50);
  } else {
    // Daily Pay: (Base Salary ÷ Days of Month)
    calculationBasisDays = Number(activeConfig.daysBasis) || daysBasis;
    dailyRateX = Math.round((baseSalary / calculationBasisDays) * 100) / 100;
  }

  // If already deducted all totalDays, suspension deduction is fully settled
  if (totalDays !== 999 && alreadyDeducted >= totalDays) {
    return {
      hasActiveSuspension: true,
      dailyRateX,
      countedDays: 0,
      totalDays,
      alreadyDeductedDays: alreadyDeducted,
      remainingDaysAfterRoll: 0,
      deductionAmount: 0,
      formulaText: `All ${totalDays} suspension day(s) already settled in past payroll runs.`,
      summaryText: `0 days (Fully settled ${alreadyDeducted}/${totalDays}d)`,
      daysBasis: calculationBasisDays,
      monthName,
      counterStopped: true,
      isFullySettled: true,
      startDate: sDate,
      endDate: eDate,
    };
  }

  // 4. Count days before payroll:
  // Elapsed inclusive calendar days from suspension start up to the payroll execution date
  const startDate = parseLocalDate(sDate);
  const dStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const dPayroll = new Date(refD.getFullYear(), refD.getMonth(), refD.getDate());

  let elapsedDaysBeforePayroll = 0;
  if (dPayroll >= dStart) {
    const diffMs = dPayroll.getTime() - dStart.getTime();
    const rawElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1; // inclusive of start day
    elapsedDaysBeforePayroll = Math.min(totalDays, Math.max(0, rawElapsed));
  }

  // Counter stops at the total duration days of the suspension
  const counterStopped = elapsedDaysBeforePayroll >= totalDays;

  // Unbilled counted days accrued for this payroll run:
  const countedDays = Math.max(
    0,
    Math.min(totalDays - alreadyDeducted, elapsedDaysBeforePayroll - alreadyDeducted)
  );

  const deductionAmount = Math.round(countedDays * dailyRateX * 100) / 100;
  const remainingDaysAfterRoll = Math.max(0, totalDays - (alreadyDeducted + countedDays));
  const isFullySettled = totalDays !== 999 && remainingDaysAfterRoll === 0;

  const formulaText =
    calculationType === 'rigid'
      ? `${countedDays} counted day(s) before payroll × ${currencySymbol}${dailyRateX}/day (Configured Rigid Daily Rate) = ${currencySymbol}${deductionAmount.toLocaleString()}`
      : `(${currencySymbol}${baseSalary.toLocaleString()} base salary ÷ ${calculationBasisDays}d [${monthName}] = ${currencySymbol}${dailyRateX}/day) × ${countedDays} counted day(s) before payroll = ${currencySymbol}${deductionAmount.toLocaleString()}`;

  const summaryText =
    countedDays > 0
      ? `${countedDays}d × ${currencySymbol}${dailyRateX}/d (${calculationType === 'rigid' ? 'Rigid Rate' : `Salary/${calculationBasisDays}d`}) = ${currencySymbol}${deductionAmount.toLocaleString()} (${alreadyDeducted}d settled, ${remainingDaysAfterRoll}d remaining)`
      : `${alreadyDeducted}d already settled (0d accrued before payroll)`;

  return {
    hasActiveSuspension: true,
    dailyRateX,
    countedDays,
    totalDays: totalDays === 999 ? elapsedDaysBeforePayroll : totalDays,
    alreadyDeductedDays: alreadyDeducted,
    remainingDaysAfterRoll: totalDays === 999 ? 0 : remainingDaysAfterRoll,
    deductionAmount,
    formulaText,
    summaryText,
    daysBasis: calculationBasisDays,
    monthName,
    counterStopped,
    isFullySettled,
    startDate: sDate,
    endDate: eDate,
  };
}

export interface StaffAttendanceDeductionResult {
  hasWorksheet: boolean;
  worksheetMonthYear?: string;
  worksheetName?: string;
  daysInMonth: number;
  absentDays: number;
  lateDays: number;
  preEmploymentDaysExcluded?: number;
  postExitDaysExcluded?: number;
  absenteeDeduction: number;
  absenteeSummary: string;
  latenessDeduction: number;
  latenessSummary: string;
  totalAttendanceDeduction: number;
}

/**
 * Accurately matches an attendance worksheet record against a staff member
 * using Employee ID, staff internal ID, or normalized staff name.
 */
export function isRecordForStaffMember(rec: AttendanceRecord, staff: Partial<StaffMember>): boolean {
  if (!rec || !staff) return false;
  const recEmpId = rec.employeeId ? String(rec.employeeId).trim().toLowerCase() : '';
  const staffEmpId = staff.employeeId ? String(staff.employeeId).trim().toLowerCase() : '';
  const staffId = staff.id ? String(staff.id).trim().toLowerCase() : '';

  if (recEmpId && staffEmpId && recEmpId === staffEmpId) return true;
  if (recEmpId && staffId && recEmpId === staffId) return true;

  const recName = rec.employeeName ? String(rec.employeeName).trim().toLowerCase() : '';
  const staffName = staff.name ? String(staff.name).trim().toLowerCase() : '';
  if (recName && staffName && recName === staffName && recName.length > 1) return true;

  return false;
}

/**
 * Calculates default automatic deductions for Absenteeism and Lateness
 * from the attendance worksheet corresponding to the payroll's reference month.
 *
 * Rules:
 * - If no worksheet exists for the month, deductions are not applied (0 deduction).
 * - Inside each worksheet spans the number of days in the month (e.g. 31, 30, 28/29).
 * - Deductions can be configured as:
 *   1. 'day_calculation': (Base Salary ÷ Days in Month) × Total Days, or rigid daily rate × Total Days
 *   2. 'percentage': (Base Salary × Rate%) × Total Days
 *   3. 'exact_value': Fixed monetary amount × Total Days
 */
export function calculateStaffAttendanceDeductions(
  staff: Partial<StaffMember>,
  payrollConfig?: PayrollConfig | null,
  referenceDate?: string | Date | null,
  companyNameOrId?: string,
  providedProjects?: ProjectFile[]
): StaffAttendanceDeductionResult {
  const refD = parseLocalDate(referenceDate);
  const targetYear = refD.getFullYear();
  const targetMonthNum = refD.getMonth() + 1;
  const targetMonthYear = `${targetYear}-${String(targetMonthNum).padStart(2, '0')}`;
  const calendarDays = new Date(targetYear, targetMonthNum, 0).getDate();
  const currencySymbol = payrollConfig?.currencySymbol || '$';

  const defaultRes: StaffAttendanceDeductionResult = {
    hasWorksheet: false,
    worksheetMonthYear: targetMonthYear,
    daysInMonth: calendarDays,
    absentDays: 0,
    lateDays: 0,
    absenteeDeduction: 0,
    absenteeSummary: 'No attendance worksheet found for this month',
    latenessDeduction: 0,
    latenessSummary: 'No attendance worksheet found for this month',
    totalAttendanceDeduction: 0,
  };

  const projects: ProjectFile[] = Array.isArray(providedProjects) && providedProjects.length > 0
    ? providedProjects
    : loadCompanyData<ProjectFile[]>(STORAGE_KEYS.PROJECTS, companyNameOrId, []);

  if (!projects || projects.length === 0) {
    return defaultRes;
  }

  // Find attendance worksheets matching targetMonthYear
  const matchingProjects = projects.filter((p) => {
    if (!p || !p.monthYear) return false;
    const cleanMY = p.monthYear.trim();
    return cleanMY === targetMonthYear || cleanMY.startsWith(targetMonthYear);
  });

  if (matchingProjects.length === 0) {
    return defaultRes;
  }

  const activeWorksheet = matchingProjects[0];
  const daysInMonth = (activeWorksheet.daysInMonth && activeWorksheet.daysInMonth >= 28)
    ? activeWorksheet.daysInMonth
    : calendarDays;

  let absentDays = 0;
  let lateDays = 0;
  let preEmploymentDaysExcluded = 0;
  let postExitDaysExcluded = 0;

  const normJoinDate = staff.joinDate ? staff.joinDate.trim() : '';
  const normExitDate = staff.exitDate ? staff.exitDate.trim() : '';

  matchingProjects.forEach((proj) => {
    (proj.records || []).forEach((rec) => {
      if (!isRecordForStaffMember(rec, staff)) return;

      const dayNum = Number(rec.dayNumber) || 1;
      const recDate =
        rec.date && rec.date.includes('-')
          ? rec.date.trim()
          : `${targetMonthYear}-${String(dayNum).padStart(2, '0')}`;

      // If record date is before employee's official start/join date, exclude from unexcused absence
      if (normJoinDate && recDate < normJoinDate) {
        if (rec.status === 'Absent') preEmploymentDaysExcluded += 1;
        return;
      }

      // If record date is after employee's official departure/exit date, exclude from unexcused absence
      if (normExitDate && recDate > normExitDate) {
        if (rec.status === 'Absent') postExitDaysExcluded += 1;
        return;
      }

      if (rec.status === 'Absent') absentDays += 1;
      if (rec.status === 'Late') lateDays += 1;
    });
  });

  const baseSalary = Number(staff.estimatedMonthlySalary) || 0;

  // 1. Absenteeism Deduction
  const absenteeConfig = payrollConfig?.absenteeDeductionConfig || DEFAULT_ABSENTEE_DEDUCTION_CONFIG;
  let absenteeDeduction = 0;
  let absenteeSummary = `${absentDays} absent day${absentDays === 1 ? '' : 's'}${
    preEmploymentDaysExcluded > 0
      ? ` (${preEmploymentDaysExcluded} pre-hire day${preEmploymentDaysExcluded === 1 ? '' : 's'} excluded)`
      : ''
  }`;

  if (absenteeConfig.isEnabled !== false && absentDays > 0) {
    if (absenteeConfig.calculationType === 'day_calculation') {
      if (absenteeConfig.useSalaryDailyRate !== false) {
        const dailyRate = daysInMonth > 0 ? baseSalary / daysInMonth : 0;
        absenteeDeduction = Math.round(dailyRate * absentDays * 100) / 100;
        absenteeSummary = `Day Pay: ${currencySymbol}${dailyRate.toFixed(2)}/day × ${absentDays}d`;
      } else {
        const rigid = Number(absenteeConfig.rigidDailyAmount) >= 0 ? Number(absenteeConfig.rigidDailyAmount) : 50;
        absenteeDeduction = rigid * absentDays;
        absenteeSummary = `Rigid: ${currencySymbol}${rigid}/day × ${absentDays}d`;
      }
    } else if (absenteeConfig.calculationType === 'percentage') {
      const rate = Number(absenteeConfig.percentageRate) >= 0 ? Number(absenteeConfig.percentageRate) : 3.0;
      const perDayAmt = (baseSalary * rate) / 100;
      absenteeDeduction = Math.round(perDayAmt * absentDays * 100) / 100;
      absenteeSummary = `${rate}% / day (${currencySymbol}${perDayAmt.toFixed(2)}) × ${absentDays}d`;
    } else {
      // exact_value
      const exact = Number(absenteeConfig.exactAmount) >= 0 ? Number(absenteeConfig.exactAmount) : 50;
      absenteeDeduction = exact * absentDays;
      absenteeSummary = `Exact: ${currencySymbol}${exact} × ${absentDays}d`;
    }
  }

  // 2. Lateness Deduction
  const latenessConfig = payrollConfig?.latenessDeductionConfig || DEFAULT_LATENESS_DEDUCTION_CONFIG;
  let latenessDeduction = 0;
  let latenessSummary = `${lateDays} late arrival${lateDays === 1 ? '' : 's'}`;

  if (latenessConfig.isEnabled !== false && lateDays > 0) {
    if (latenessConfig.calculationType === 'day_calculation') {
      if (latenessConfig.useSalaryDailyRate !== false) {
        const dailyRate = daysInMonth > 0 ? baseSalary / daysInMonth : 0;
        latenessDeduction = Math.round(dailyRate * lateDays * 100) / 100;
        latenessSummary = `Day Pay: ${currencySymbol}${dailyRate.toFixed(2)}/day × ${lateDays}d`;
      } else {
        const rigid = Number(latenessConfig.rigidDailyAmount) >= 0 ? Number(latenessConfig.rigidDailyAmount) : 15;
        latenessDeduction = rigid * lateDays;
        latenessSummary = `Rigid: ${currencySymbol}${rigid}/day × ${lateDays}d`;
      }
    } else if (latenessConfig.calculationType === 'percentage') {
      const rate = Number(latenessConfig.percentageRate) >= 0 ? Number(latenessConfig.percentageRate) : 1.0;
      const perDayAmt = (baseSalary * rate) / 100;
      latenessDeduction = Math.round(perDayAmt * lateDays * 100) / 100;
      latenessSummary = `${rate}% / arrival (${currencySymbol}${perDayAmt.toFixed(2)}) × ${lateDays}d`;
    } else {
      // exact_value
      const exact = Number(latenessConfig.exactAmount) >= 0 ? Number(latenessConfig.exactAmount) : 15;
      latenessDeduction = exact * lateDays;
      latenessSummary = `Exact: ${currencySymbol}${exact} × ${lateDays} arrival${lateDays > 1 ? 's' : ''}`;
    }
  }

  return {
    hasWorksheet: true,
    worksheetMonthYear: targetMonthYear,
    worksheetName: activeWorksheet.name,
    daysInMonth,
    absentDays,
    lateDays,
    preEmploymentDaysExcluded,
    postExitDaysExcluded,
    absenteeDeduction,
    absenteeSummary,
    latenessDeduction,
    latenessSummary,
    totalAttendanceDeduction: absenteeDeduction + latenessDeduction,
  };
}

/**
 * Checks whether a specific pay frequency (Weekly, Bi-Weekly, Monthly) is triggered / due on a given date.
 */
export function isPayFrequencyDueOnDate(
  frequency: string | undefined,
  date: Date | string,
  rollRules?: PayrollRollRules
): boolean {
  const d = parseLocalDate(date);
  if (isNaN(d.getTime())) return false;
  const rules = rollRules || DEFAULT_ROLL_RULES;

  const freq = (frequency || 'Monthly').trim().toLowerCase();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeekName = dayNames[d.getDay()];

  if (freq === 'weekly') {
    return dayOfWeekName === (rules.weekly?.dayOfWeek || 'Friday');
  }

  if (freq === 'bi-weekly' || freq === 'biweekly') {
    const targetDay = rules.biWeekly?.dayOfWeek || 'Friday';
    if (dayOfWeekName !== targetDay) return false;

    // Check interval from kick-off startDate if set
    if (rules.biWeekly?.startDate) {
      const anchor = parseLocalDate(rules.biWeekly.startDate);
      if (!isNaN(anchor.getTime())) {
        const anchorMidnight = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
        const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diffDays = Math.round((dMidnight.getTime() - anchorMidnight.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return false;
        return diffDays % 14 === 0;
      }
    }
    return true;
  }

  if (freq === 'monthly') {
    const ruleType = rules.monthly?.ruleType || 'specific_day';
    const day = d.getDate();
    const lastDayOfMonth = getDaysInCurrentMonth(d);

    if (ruleType === 'beginning_of_month') {
      return day === 1;
    }
    if (ruleType === 'end_of_month') {
      return day === lastDayOfMonth;
    }
    // specific_day
    const targetDay = Number(rules.monthly?.dayOfMonth) || 25;
    const effectiveDay = Math.min(targetDay, lastDayOfMonth);
    return day === effectiveDay;
  }

  return false;
}

/**
 * Returns list of frequencies due on a given date (supports simultaneous execution detection).
 */
export function getActiveFrequenciesOnDate(
  date: Date | string,
  rollRules?: PayrollRollRules
): Array<'Weekly' | 'Bi-Weekly' | 'Monthly'> {
  const active: Array<'Weekly' | 'Bi-Weekly' | 'Monthly'> = [];
  if (isPayFrequencyDueOnDate('Weekly', date, rollRules)) active.push('Weekly');
  if (isPayFrequencyDueOnDate('Bi-Weekly', date, rollRules)) active.push('Bi-Weekly');
  if (isPayFrequencyDueOnDate('Monthly', date, rollRules)) active.push('Monthly');
  return active;
}

/**
 * Calculates upcoming roll date for a given pay frequency.
 */
export function getNextRollDateForFrequency(
  frequency: 'Weekly' | 'Bi-Weekly' | 'Monthly',
  fromReferenceDate: Date | string = new Date(),
  rollRules?: PayrollRollRules
): string {
  const d = parseLocalDate(fromReferenceDate);
  const refDateStr = formatLocalDate(d);
  const rules = rollRules || DEFAULT_ROLL_RULES;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (frequency === 'Weekly') {
    const targetDay = rules.weekly?.dayOfWeek || 'Friday';
    const targetIdx = dayNames.indexOf(targetDay);
    const currIdx = d.getDay();
    let diff = (targetIdx - currIdx + 7) % 7;
    // If today is the target day, it is due today!
    const next = new Date(d);
    next.setDate(d.getDate() + diff);
    return formatLocalDate(next);
  }

  if (frequency === 'Bi-Weekly') {
    const dates = getBiWeeklyUpcomingDates(rules.biWeekly?.startDate, rules.biWeekly?.dayOfWeek, 5, d);
    const upcoming = dates.find((dt) => dt >= refDateStr);
    return upcoming || dates[0] || '';
  }

  // Monthly
  const ruleType = rules.monthly?.ruleType || 'specific_day';
  const targetDay = Number(rules.monthly?.dayOfMonth) || 25;
  const currYear = d.getFullYear();
  const currMonth = d.getMonth();
  const currentMonthDays = new Date(currYear, currMonth + 1, 0).getDate();

  let targetDateThisMonth: Date;
  if (ruleType === 'beginning_of_month') {
    targetDateThisMonth = new Date(currYear, currMonth, 1);
  } else if (ruleType === 'end_of_month') {
    targetDateThisMonth = new Date(currYear, currMonth, currentMonthDays);
  } else {
    targetDateThisMonth = new Date(currYear, currMonth, Math.min(targetDay, currentMonthDays));
  }

  const thisMonthStr = formatLocalDate(targetDateThisMonth);
  if (thisMonthStr >= refDateStr) {
    return thisMonthStr;
  } else {
    const nextMonthDays = new Date(currYear, currMonth + 2, 0).getDate();
    let nextDate: Date;
    if (ruleType === 'beginning_of_month') {
      nextDate = new Date(currYear, currMonth + 1, 1);
    } else if (ruleType === 'end_of_month') {
      nextDate = new Date(currYear, currMonth + 1, nextMonthDays);
    } else {
      nextDate = new Date(currYear, currMonth + 1, Math.min(targetDay, nextMonthDays));
    }
    return formatLocalDate(nextDate);
  }
}

/**
 * Calculates suspension automatic deduction breakdown for a staff member.
 * For daily pay calculation, uses base salary / days of the current month dynamically.
 */
export function calculateSuspensionDeduction(
  estimatedMonthlySalary: number = 0,
  suspensionDays: number = 1,
  config?: SuspensionDeductionConfig | null,
  currencySymbol: string = '$',
  referenceDate?: string | Date | null
): {
  dailyRate: number;
  totalAmount: number;
  calculationType: 'daily_pay' | 'rigid';
  formulaText: string;
  summaryText: string;
  daysBasis: number;
  monthName: string;
} {
  const days = Math.max(1, suspensionDays);
  const activeConfig = config || DEFAULT_SUSPENSION_DEDUCTION_CONFIG;
  const isEnabled = activeConfig.isEnabled !== false;
  const calcType = activeConfig.calculationType === 'rigid' ? 'rigid' : 'daily_pay';
  const refD = referenceDate ? new Date(referenceDate) : new Date();
  const validRefD = isNaN(refD.getTime()) ? new Date() : refD;
  const daysBasis = Number(activeConfig.daysBasis) || getDaysInCurrentMonth(validRefD);
  const monthName = validRefD.toLocaleString('default', { month: 'short' });

  if (!isEnabled) {
    return {
      dailyRate: 0,
      totalAmount: 0,
      calculationType: calcType,
      formulaText: 'Automatic suspension deduction is disabled in Deductions configuration.',
      summaryText: 'Deduction Disabled (0 deduction)',
      daysBasis,
      monthName,
    };
  }

  if (calcType === 'daily_pay') {
    const dailyRate = Math.round(((estimatedMonthlySalary || 0) / daysBasis) * 100) / 100;
    const totalAmount = Math.round(dailyRate * days * 100) / 100;
    return {
      dailyRate,
      totalAmount,
      calculationType: 'daily_pay',
      formulaText: `${currencySymbol}${estimatedMonthlySalary.toLocaleString()} / ${daysBasis} days (${monthName}) = ${currencySymbol}${dailyRate.toLocaleString()}/day`,
      summaryText: `${days} day${days > 1 ? 's' : ''} × ${currencySymbol}${dailyRate.toLocaleString()}/day = ${currencySymbol}${totalAmount.toLocaleString()}`,
      daysBasis,
      monthName,
    };
  } else {
    const dailyRate = Math.max(0, Number(activeConfig.rigidDailyAmount) >= 0 ? Number(activeConfig.rigidDailyAmount) : 50);
    const totalAmount = Math.round(dailyRate * days * 100) / 100;
    return {
      dailyRate,
      totalAmount,
      calculationType: 'rigid',
      formulaText: `Rigid Rate: ${currencySymbol}${dailyRate.toLocaleString()}/day`,
      summaryText: `${days} day${days > 1 ? 's' : ''} × ${currencySymbol}${dailyRate.toLocaleString()}/day = ${currencySymbol}${totalAmount.toLocaleString()}`,
      daysBasis,
      monthName,
    };
  }
}

/**
 * Saves company payroll configuration.
 */
export function saveCompanyPayrollConfig(config: PayrollConfig, companyName?: string): void {
  saveCompanyData(STORAGE_KEYS.PAYROLL, { ...config, updatedAt: new Date().toISOString() }, companyName);
}

/**
 * Gets the active currency symbol for a company.
 */
export function getCompanyCurrencySymbol(companyName?: string): string {
  const config = loadCompanyPayrollConfig(companyName);
  return config.currencySymbol || '$';
}

/**
 * Formats a numeric amount with the active company currency symbol.
 */
export function formatSalary(amount: number | undefined | null, companyName?: string): string {
  const symbol = getCompanyCurrencySymbol(companyName);
  const num = Number(amount) || 0;
  return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Calculates upcoming roll dates for bi-weekly payroll based on kickoff start date and day of week.
 */
export function getBiWeeklyUpcomingDates(
  startDateStr?: string,
  dayOfWeek?: string,
  count = 3,
  fromReferenceDate: Date | string = new Date()
): string[] {
  const dates: string[] = [];
  const ref = parseLocalDate(fromReferenceDate);
  const refDateStr = formatLocalDate(ref);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDayIndex = dayNames.indexOf(dayOfWeek || 'Friday');

  let anchor: Date;
  if (startDateStr && !isNaN(new Date(startDateStr).getTime())) {
    anchor = parseLocalDate(startDateStr);
  } else {
    anchor = new Date(ref);
    const currDay = anchor.getDay();
    let diff = (targetDayIndex - currDay + 7) % 7;
    anchor.setDate(anchor.getDate() + diff);
  }

  // Ensure anchor matches targetDayIndex
  if (targetDayIndex !== -1 && anchor.getDay() !== targetDayIndex) {
    const currDay = anchor.getDay();
    let diff = (targetDayIndex - currDay + 7) % 7;
    anchor.setDate(anchor.getDate() + diff);
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((ref.getTime() - anchor.getTime()) / msPerDay);

  let firstCycleDate: Date;
  if (diffDays <= 0) {
    firstCycleDate = new Date(anchor);
  } else {
    const cycles = Math.floor(diffDays / 14);
    const candidate = new Date(anchor.getTime() + cycles * 14 * msPerDay);
    if (formatLocalDate(candidate) >= refDateStr) {
      firstCycleDate = candidate;
    } else {
      firstCycleDate = new Date(anchor.getTime() + (cycles + 1) * 14 * msPerDay);
    }
  }

  for (let i = 0; i < count; i++) {
    const d = new Date(firstCycleDate.getTime() + i * 14 * msPerDay);
    dates.push(formatLocalDate(d));
  }

  return dates;
}

/**
 * Settles a list of booked penalties by setting Active penalties to Settled.
 */
export function settlePenaltiesList(penalties: BookedPenalty[] = []): BookedPenalty[] {
  return penalties.map((p) =>
    p.status === 'Active' ? { ...p, status: 'Settled' as const } : p
  );
}

/**
 * Settles all active booked penalties for a company after payroll finalization/disbursal.
 */
export function settleCompanyPenalties(companyName?: string): void {
  const config = loadCompanyPayrollConfig(companyName);
  if (!config.bookedPenalties || config.bookedPenalties.length === 0) return;
  const updatedPenalties = settlePenaltiesList(config.bookedPenalties);
  saveCompanyPayrollConfig({ ...config, bookedPenalties: updatedPenalties }, companyName);
}

/**
 * Computes individual staff payroll calculation (Gross, Corporate Deductions, Penalties, Bonuses, Net).
 */
export interface StaffPayrollCalculation {
  staffId: string;
  employeeId: string;
  name: string;
  department: string;
  role: string;
  payGrade: string;
  payFrequency: string;
  baseSalary: number;
  unproratedBaseSalary?: number;
  isProratedMidMonth?: boolean;
  prorationSummary?: string;
  employedDaysInCycle?: number;
  cycleDays?: number;
  corporateDeductions: number;
  penaltiesTotal: number;
  suspensionDeduction: number;
  suspensionDetails: StaffSuspensionCalculationResult;
  absenteeDeduction?: number;
  latenessDeduction?: number;
  attendanceDetails?: StaffAttendanceDeductionResult;
  totalDeductions: number;
  totalBonuses: number;
  netSalary: number;
  deductionBreakdown: Array<{ name: string; amount: number; type: string; category?: 'corporate' | 'penalty' | 'suspension' | 'attendance' }>;
  penaltiesBreakdown: BookedPenalty[];
  bonusBreakdown: Array<{ name: string; amount: number; type: string }>;
}

/**
 * Dynamically derives the matching configured Pay Grade tier from a given salary and pay grade configurations.
 */
export function derivePayGradeFromSalary(
  salary: number,
  payGrades: PayGradeTier[],
  fallbackGrade?: string
): string {
  if (!payGrades || payGrades.length === 0) {
    return fallbackGrade || 'Standard Grade';
  }

  const num = Number(salary) || 0;

  // 1. Direct range match
  const exactMatch = payGrades.find(
    (pg) => num >= pg.minSalary && num <= pg.maxSalary
  );
  if (exactMatch) {
    return exactMatch.name;
  }

  // 2. If staff has an explicit fallbackGrade that directly matches a configured pay grade
  if (fallbackGrade) {
    const cleanFallback = fallbackGrade.trim().toLowerCase();
    const existing = payGrades.find(
      (pg) =>
        pg.name.toLowerCase() === cleanFallback ||
        pg.name.toLowerCase().includes(cleanFallback) ||
        cleanFallback.includes(pg.name.toLowerCase().split('(')[0].trim())
    );
    if (existing) {
      return existing.name;
    }
  }

  // 3. If salary is lower than the lowest configured tier
  const sortedByMin = [...payGrades].sort((a, b) => a.minSalary - b.minSalary);
  if (num <= sortedByMin[0].minSalary) {
    return sortedByMin[0].name;
  }

  // 4. If salary exceeds the highest configured tier
  const sortedByMax = [...payGrades].sort((a, b) => b.maxSalary - a.maxSalary);
  if (num >= sortedByMax[0].maxSalary) {
    return sortedByMax[0].name;
  }

  // 5. Nearest tier match
  let closest = payGrades[0];
  let minDiff = Infinity;
  for (const pg of payGrades) {
    const mid = (pg.minSalary + pg.maxSalary) / 2;
    const diff = Math.abs(num - mid);
    if (diff < minDiff) {
      minDiff = diff;
      closest = pg;
    }
  }

  return closest.name;
}

/**
 * Derives a staff member's pay grade dynamically from their salary and the company's payroll config.
 */
export function deriveStaffPayGrade(
  staff: Partial<StaffMember>,
  payGrades: PayGradeTier[]
): string {
  const salary = Number(staff.estimatedMonthlySalary) || 0;
  return derivePayGradeFromSalary(salary, payGrades, staff.payGrade);
}

export interface DeductionFormulaContext {
  baseSalary?: number;
  netDisbursal?: number;
  grossSalary?: number;
  dailyRate?: number;
  hourlyRate?: number;
  daysInMonth?: number;
  attendanceDays?: number;
  overtimeHours?: number;
  lateOccurrences?: number;
}

/**
 * Safely evaluates custom HR deduction formulas containing dynamic tags like {base_salary}, {net_disbursal}, {days_in_month}, etc.
 */
export function evaluateDeductionFormula(
  formula: string,
  context: DeductionFormulaContext = {}
): { value: number; evaluatedExpression: string; isValid: boolean; error?: string } {
  if (!formula || !formula.trim()) {
    return { value: 0, evaluatedExpression: '', isValid: false, error: 'Empty formula' };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const defaultDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const baseSalary = context.baseSalary ?? 3000;
  const daysInMonth = context.daysInMonth ?? defaultDaysInMonth;
  const dailyRate = context.dailyRate ?? (daysInMonth > 0 ? baseSalary / daysInMonth : 0);
  const hourlyRate = context.hourlyRate ?? (dailyRate / 8);
  const grossSalary = context.grossSalary ?? baseSalary;
  const netDisbursal = context.netDisbursal ?? Math.max(0, baseSalary * 0.85);
  const attendanceDays = context.attendanceDays ?? 22;
  const overtimeHours = context.overtimeHours ?? 0;
  const lateOccurrences = context.lateOccurrences ?? 1;

  // Replace tags (case-insensitive, supporting spaces and underscores)
  let expr = formula
    .replace(/\{base[\s_]?salary\}/gi, String(baseSalary))
    .replace(/\{net[\s_]?disbursal\}/gi, String(netDisbursal))
    .replace(/\{gross[\s_]?salary\}/gi, String(grossSalary))
    .replace(/\{daily[\s_]?rate\}/gi, String(dailyRate))
    .replace(/\{hourly[\s_]?rate\}/gi, String(hourlyRate))
    .replace(/\{days[\s_]?in[\s_]?month\}/gi, String(daysInMonth))
    .replace(/\{attendance[\s_]?days\}/gi, String(attendanceDays))
    .replace(/\{overtime[\s_]?hours\}/gi, String(overtimeHours))
    .replace(/\{late[\s_]?occurrences\}/gi, String(lateOccurrences));

  // Sanitize expression - allow only digits, decimal points, spaces, parentheses, math operators (+, -, *, /, %)
  const sanitized = expr.replace(/[^0-9.\s+\-*/()%]/g, '');

  try {
    if (!sanitized || !/^[\d\s.+\-*/()%]+$/.test(sanitized)) {
      return { value: 0, evaluatedExpression: sanitized, isValid: false, error: 'Invalid characters in formula' };
    }

    // Convert percentages e.g. 5% to (5/100)
    const mathParsed = sanitized.replace(/(\d+(\.\d+)?)%/g, '($1/100)');

    // Safe mathematical evaluation
    // eslint-disable-next-line no-new-func
    const result = Function(`'use strict'; return (${mathParsed})`)();
    const num = Number(result);
    if (isNaN(num) || !isFinite(num)) {
      return { value: 0, evaluatedExpression: mathParsed, isValid: false, error: 'Evaluation resulted in NaN or Infinity' };
    }

    return { value: Math.max(0, Math.round(num * 100) / 100), evaluatedExpression: mathParsed, isValid: true };
  } catch (err: any) {
    return { value: 0, evaluatedExpression: sanitized, isValid: false, error: err?.message || 'Formula evaluation error' };
  }
}

export function matchesDynamicCustomCondition(
  cond: DynamicConditionRule,
  staff: Partial<StaffMember>
): boolean {
  if (!cond.field || !cond.operator) return true;

  let fieldVal: any;
  if (cond.field === 'custom') {
    const key = cond.customKey || 'custom';
    fieldVal = (staff as any)[key] || ((staff as any).customFields && (staff as any).customFields[key]);
  } else if (cond.field === 'role') {
    fieldVal = staff.role;
  } else if (cond.field === 'shiftSchedule') {
    fieldVal = staff.shiftSchedule;
  } else if (cond.field === 'payFrequency') {
    fieldVal = staff.payFrequency;
  } else if (cond.field === 'status') {
    fieldVal = staff.status;
  } else if (cond.field === 'estimatedMonthlySalary') {
    fieldVal = staff.estimatedMonthlySalary;
  } else {
    fieldVal = (staff as any)[cond.field];
  }

  // Extract list of target values if multiple selections exist
  const targetValues: string[] = cond.values && cond.values.length > 0
    ? cond.values
    : typeof cond.value === 'string' && cond.value.includes(',')
      ? cond.value.split(',').map((s) => s.trim()).filter(Boolean)
      : [String(cond.value ?? '')];

  const targetValStr = String(cond.value ?? '').trim().toLowerCase();
  const staffValStr = String(fieldVal ?? '').trim().toLowerCase();

  // Multi-value matching for 'in' (any of) and 'not_in' (none of)
  if (cond.operator === 'in') {
    if (targetValues.length === 0) return true;
    return targetValues.some((v) => v.trim().toLowerCase() === staffValStr);
  }

  if (cond.operator === 'not_in') {
    if (targetValues.length === 0) return true;
    return !targetValues.some((v) => v.trim().toLowerCase() === staffValStr);
  }

  // Equality / Inequality handling (handles array of values gracefully if user picked multiple)
  if (cond.operator === '==') {
    if (targetValues.length > 1) {
      return targetValues.some((v) => v.trim().toLowerCase() === staffValStr);
    }
    return staffValStr === targetValStr;
  }

  if (cond.operator === '!=') {
    if (targetValues.length > 1) {
      return !targetValues.some((v) => v.trim().toLowerCase() === staffValStr);
    }
    return staffValStr !== targetValStr;
  }

  // Numeric comparisons
  const numField = Number(fieldVal) || 0;
  const numTarget = Number(cond.value) || 0;

  if (cond.operator === '>') {
    return numField > numTarget;
  }
  if (cond.operator === '>=') {
    return numField >= numTarget;
  }
  if (cond.operator === '<') {
    return numField < numTarget;
  }
  if (cond.operator === '<=') {
    return numField <= numTarget;
  }
  if (cond.operator === 'contains') {
    return staffValStr.includes(targetValStr);
  }

  return true;
}

export function matchesSingleDeductionRule(
  rule: DeductionRuleSet,
  staff: Partial<StaffMember>,
  grossSalary?: number
): boolean {
  // 1. Departmental mapping check:
  if (rule.applicableDepartments && rule.applicableDepartments.length > 0) {
    if (!rule.applicableDepartments.includes('All')) {
      if (!staff.department || !rule.applicableDepartments.includes(staff.department)) {
        return false;
      }
    }
  }

  // 2. Employee Type / Category mapping check:
  if (rule.applicableEmployeeTypes && rule.applicableEmployeeTypes.length > 0) {
    if (!rule.applicableEmployeeTypes.includes('All')) {
      const staffCategory = staff.employeeCategory || 'Full-time';
      if (!rule.applicableEmployeeTypes.includes(staffCategory)) {
        return false;
      }
    }
  }

  // 3. Pay Grade mapping check:
  if (rule.applicablePayGrades && rule.applicablePayGrades.length > 0) {
    if (!rule.applicablePayGrades.includes('All')) {
      if (!staff.payGrade || !rule.applicablePayGrades.includes(staff.payGrade)) {
        return false;
      }
    }
  }

  // 4. Gross Salary Numeric Logic Conditional Statement:
  if (rule.grossSalaryCondition && rule.grossSalaryCondition.enabled) {
    const salaryToTest = typeof grossSalary === 'number'
      ? grossSalary
      : Number(staff.estimatedMonthlySalary) || 0;
    const threshold = Number(rule.grossSalaryCondition.value) || 0;
    const op = rule.grossSalaryCondition.operator;

    let satisfied = false;
    switch (op) {
      case '>':
        satisfied = salaryToTest > threshold;
        break;
      case '>=':
        satisfied = salaryToTest >= threshold;
        break;
      case '<':
        satisfied = salaryToTest < threshold;
        break;
      case '<=':
        satisfied = salaryToTest <= threshold;
        break;
      case '==':
        satisfied = Math.abs(salaryToTest - threshold) < 0.01;
        break;
      case '!=':
        satisfied = Math.abs(salaryToTest - threshold) >= 0.01;
        break;
      default:
        satisfied = true;
    }
    if (!satisfied) return false;
  }

  // 5. Dynamic Custom Conditions:
  if (rule.customConditions && rule.customConditions.length > 0) {
    for (const cond of rule.customConditions) {
      if (!matchesDynamicCustomCondition(cond, staff)) {
        return false;
      }
    }
  }

  return true;
}

export function isDeductionApplicableToStaff(
  ded: PayrollDeduction,
  staff: Partial<StaffMember>,
  matchingGradeTier?: any,
  grossSalary?: number
): boolean {
  if (!ded.isEnabled) return false;

  // Salary Grade Mapping check: if custom mapping configured, must be included
  if (
    matchingGradeTier?.allowedDeductionIds &&
    Array.isArray(matchingGradeTier.allowedDeductionIds) &&
    !matchingGradeTier.allowedDeductionIds.includes(ded.id)
  ) {
    return false;
  }

  // If configured with rulesets (Rule 1, Rule 2, ...), staff qualifies if they match ANY rule
  if (ded.rules && ded.rules.length > 0) {
    return ded.rules.some((rule) => matchesSingleDeductionRule(rule, staff, grossSalary));
  }

  // Fallback for legacy single-ruleset configuration:
  // 1. Departmental mapping check:
  if (ded.applicableDepartments && ded.applicableDepartments.length > 0) {
    if (!ded.applicableDepartments.includes('All')) {
      if (!staff.department || !ded.applicableDepartments.includes(staff.department)) {
        return false;
      }
    }
  } else if (ded.applicableTo && ded.applicableTo !== 'All') {
    if (!staff.department || ded.applicableTo !== staff.department) {
      return false;
    }
  }

  // 2. Employee Type / Category mapping check:
  if (ded.applicableEmployeeTypes && ded.applicableEmployeeTypes.length > 0) {
    if (!ded.applicableEmployeeTypes.includes('All')) {
      const staffCategory = staff.employeeCategory || 'Full-time';
      if (!ded.applicableEmployeeTypes.includes(staffCategory)) {
        return false;
      }
    }
  }

  // 3. Pay Grade mapping check:
  if (ded.applicablePayGrades && ded.applicablePayGrades.length > 0) {
    if (!ded.applicablePayGrades.includes('All')) {
      if (!staff.payGrade || !ded.applicablePayGrades.includes(staff.payGrade)) {
        return false;
      }
    }
  }

  // 4. Gross Salary Numeric Logic Conditional Statement:
  if (ded.grossSalaryCondition && ded.grossSalaryCondition.enabled) {
    const salaryToTest = typeof grossSalary === 'number'
      ? grossSalary
      : Number(staff.estimatedMonthlySalary) || 0;
    const threshold = Number(ded.grossSalaryCondition.value) || 0;
    const op = ded.grossSalaryCondition.operator;

    let satisfied = false;
    switch (op) {
      case '>':
        satisfied = salaryToTest > threshold;
        break;
      case '>=':
        satisfied = salaryToTest >= threshold;
        break;
      case '<':
        satisfied = salaryToTest < threshold;
        break;
      case '<=':
        satisfied = salaryToTest <= threshold;
        break;
      case '==':
        satisfied = Math.abs(salaryToTest - threshold) < 0.01;
        break;
      case '!=':
        satisfied = Math.abs(salaryToTest - threshold) >= 0.01;
        break;
      default:
        satisfied = true;
    }
    if (!satisfied) return false;
  }

  // 5. Dynamic Custom Conditions:
  if (ded.customConditions && ded.customConditions.length > 0) {
    for (const cond of ded.customConditions) {
      if (!matchesDynamicCustomCondition(cond, staff)) {
        return false;
      }
    }
  }

  return true;
}

export function calculateStaffPayroll(
  staff: StaffMember,
  config: PayrollConfig,
  referenceDate?: string | Date | null,
  companyName?: string,
  providedProjects?: ProjectFile[]
): StaffPayrollCalculation {
  const fullBaseSalary = Number(staff.estimatedMonthlySalary) || 0;
  const payGrade = deriveStaffPayGrade(staff, config.payGrades);
  const matchingGradeTier = (config.payGrades || []).find(
    (g) => g.name === payGrade || g.id === staff.payGrade
  );
  const payFrequency = staff.payFrequency || config.defaultPayFrequency || 'Monthly';

  // Mid-month tenure proration:
  // If staff joined mid-month or exited mid-month within the reference cycle month,
  // base salary is prorated by active days in that month.
  const refD = parseLocalDate(referenceDate);
  const refYear = refD.getFullYear();
  const refMonth = refD.getMonth() + 1; // 1-12
  const daysInCurrentMonth = new Date(refYear, refMonth, 0).getDate();
  const currentMonthPrefix = `${refYear}-${String(refMonth).padStart(2, '0')}`;

  let baseSalary = fullBaseSalary;
  let isProratedMidMonth = false;
  let employedDaysCount = daysInCurrentMonth;
  let prorationSummary = '';

  const joinStr = staff.joinDate ? staff.joinDate.trim() : '';
  const exitStr = staff.exitDate ? staff.exitDate.trim() : '';

  let startDay = 1;
  let endDay = daysInCurrentMonth;

  if (joinStr && joinStr.startsWith(currentMonthPrefix)) {
    const parts = joinStr.split('-');
    const jDay = parseInt(parts[2], 10);
    if (!isNaN(jDay) && jDay > 1 && jDay <= daysInCurrentMonth) {
      startDay = jDay;
      isProratedMidMonth = true;
    }
  }

  if (exitStr && exitStr.startsWith(currentMonthPrefix)) {
    const parts = exitStr.split('-');
    const eDay = parseInt(parts[2], 10);
    if (!isNaN(eDay) && eDay >= 1 && eDay < daysInCurrentMonth) {
      endDay = eDay;
      isProratedMidMonth = true;
    }
  }

  if (isProratedMidMonth && startDay <= endDay) {
    employedDaysCount = endDay - startDay + 1;
    const prorationRatio = employedDaysCount / daysInCurrentMonth;
    baseSalary = Math.round(fullBaseSalary * prorationRatio * 100) / 100;
    prorationSummary = `Prorated for ${employedDaysCount} active days (${startDay} to ${endDay} of ${daysInCurrentMonth} days in ${currentMonthPrefix})`;
  }

  // Estimate allowances for gross salary context
  let estimatedBonuses = 0;
  (config.bonuses || [])
    .filter((b) => {
      if (!b.isEnabled) return false;
      if (b.disbursementType === 'welfare_log') return false;
      if (
        matchingGradeTier?.allowedBonusIds &&
        Array.isArray(matchingGradeTier.allowedBonusIds) &&
        !matchingGradeTier.allowedBonusIds.includes(b.id)
      ) {
        return false;
      }
      if (b.applicableTo && b.applicableTo !== 'All') {
        if (staff.department && b.applicableTo !== staff.department) return false;
      }
      return true;
    })
    .forEach((bon) => {
      estimatedBonuses += bon.type === 'percentage' ? (baseSalary * bon.value) / 100 : bon.value;
    });

  const estimatedGrossSalary = baseSalary + estimatedBonuses;

  // 1. Corporate / Statutory Deductions (Ordered by priority weight descending: 100 first, 99 second, ...)
  const deductionBreakdown: Array<{ name: string; amount: number; type: string; category?: 'corporate' | 'penalty' | 'suspension' | 'attendance' }> = [];
  let corporateDeductions = 0;
  let runningNetForDeductions = Math.max(0, estimatedGrossSalary);

  (config.deductions || [])
    .filter((d) => isDeductionApplicableToStaff(d, staff, matchingGradeTier, estimatedGrossSalary))
    .sort((a, b) => (Number(b.weight) || 50) - (Number(a.weight) || 50))
    .forEach((ded) => {
      let amount = 0;
      const isNetBasis = ded.calculationBasis === 'net';

      if (ded.type === 'percentage') {
        const basisAmount = isNetBasis ? runningNetForDeductions : baseSalary;
        amount = (basisAmount * ded.value) / 100;
      } else if (ded.type === 'formula' && ded.formula) {
        const evalRes = evaluateDeductionFormula(ded.formula, {
          baseSalary,
          netDisbursal: runningNetForDeductions,
          grossSalary: estimatedGrossSalary,
        });
        amount = evalRes.isValid ? evalRes.value : ded.value;
      } else {
        amount = ded.value;
      }

      deductionBreakdown.push({
        name: ded.name,
        amount,
        type:
          ded.type === 'percentage'
            ? `${ded.value}% (${isNetBasis ? 'Net' : 'Base'})`
            : ded.type === 'formula'
            ? `Formula: ${ded.formula || 'Auto'}`
            : `${config.currencySymbol}${ded.value}`,
        category: 'corporate',
      });
      corporateDeductions += amount;
      runningNetForDeductions = Math.max(0, runningNetForDeductions - amount);
    });

  // 2. Active Suspension Deduction with dynamic multi-cycle formula:
  // Base salary / days of the month = x.
  // Then counted days before payroll * x = deduction on payroll.
  // After payroll executes, counted days resets to 0.
  const suspensionDetails = calculateStaffActiveSuspensionDeduction(staff, config, referenceDate, companyName);
  let suspensionDeduction = 0;

  if (suspensionDetails.hasActiveSuspension && suspensionDetails.deductionAmount > 0) {
    suspensionDeduction = suspensionDetails.deductionAmount;
    deductionBreakdown.push({
      name: `Suspension Deduction (${suspensionDetails.countedDays}d accrued)`,
      amount: suspensionDeduction,
      type: suspensionDetails.summaryText,
      category: 'suspension',
    });
  }

  // Check whether suspension deduction / fine is disabled universally or for this individual staff
  const isSuspensionGloballyEnabled = config?.suspensionDeductionConfig?.isEnabled !== false;
  const isIndividualSuspensionDisabledOrPardoned =
    suspensionDetails.summaryText.includes('Pardoned') ||
    suspensionDetails.summaryText.includes('Disabled') ||
    suspensionDetails.formulaText.includes('Pardoned') ||
    suspensionDetails.formulaText.includes('disabled') ||
    !suspensionDetails.hasActiveSuspension;

  // 3. Active Booked Penalties for this staff member
  // Strict non-empty string comparison so penalties booked for one staff member are NEVER mistakenly applied to others
  const activePenalties = (config.bookedPenalties || []).filter((p) => {
    if (p.status !== 'Active') return false;

    const targetStaffId = staff.id ? String(staff.id).trim() : '';
    const pStaffId = p.staffId ? String(p.staffId).trim() : '';
    const targetEmpId = staff.employeeId ? String(staff.employeeId).trim() : '';
    const pEmpId = p.employeeId ? String(p.employeeId).trim() : '';
    const targetName = staff.name ? String(staff.name).trim().toLowerCase() : '';
    const pName = p.staffName ? String(p.staffName).trim().toLowerCase() : '';

    // If ID conflicts exist, reject to prevent cross-contamination
    if (targetStaffId && pStaffId && targetStaffId !== pStaffId) return false;
    if (targetEmpId && pEmpId && targetEmpId.toLowerCase() !== pEmpId.toLowerCase()) return false;

    const isStaffIdMatch = Boolean(targetStaffId && pStaffId && targetStaffId === pStaffId);
    const isEmpIdMatch = Boolean(targetEmpId && pEmpId && targetEmpId.toLowerCase() === pEmpId.toLowerCase());
    const isNameMatch = Boolean(targetName && pName && targetName === pName && targetName.length > 1);

    const isForThisStaff = isStaffIdMatch || isEmpIdMatch || isNameMatch;
    if (!isForThisStaff) return false;

    // Auto-suspension deduction records (e.g. pen-auto-susp-) are handled dynamically above;
    // never double-charge or apply static records
    if (p.id.startsWith('pen-auto-susp-') || p.ruleName?.startsWith('Suspension Deduction')) {
      return false;
    }

    // Check if this penalty is a disciplinary suspension fine (pen-susp-)
    const isSuspensionFine = p.id.startsWith('pen-susp-') || p.reason?.toLowerCase().includes('suspension');
    if (isSuspensionFine) {
      // If suspension fine is disabled globally or disabled/pardoned for this staff, it does NOT count!
      if (!isSuspensionGloballyEnabled || isIndividualSuspensionDisabledOrPardoned) {
        return false;
      }
    }

    return true;
  });

  // Group active penalties for this staff member by rule so duplicate instances merge into a single "fine * #" times fined entry
  const groupedPenaltiesMap = new Map<string, {
    pen: BookedPenalty;
    totalMultiplier: number;
    baseUnitValue: number;
    totalValue: number;
    reasons: string[];
  }>();

  activePenalties.forEach((pen) => {
    const key = (pen.penaltyRuleId || pen.ruleId || pen.ruleName || 'fine').trim().toLowerCase();
    const mult = pen.multiplier && pen.multiplier > 0 ? pen.multiplier : 1;
    const unitVal = pen.baseValue ?? (pen.type === 'percentage' ? pen.value : (pen.value / mult));

    const existing = groupedPenaltiesMap.get(key);
    if (existing) {
      existing.totalMultiplier += mult;
      existing.totalValue += pen.value;
      if (pen.reason && !existing.reasons.includes(pen.reason)) {
        existing.reasons.push(pen.reason);
      }
    } else {
      groupedPenaltiesMap.set(key, {
        pen,
        totalMultiplier: mult,
        baseUnitValue: unitVal,
        totalValue: pen.value,
        reasons: pen.reason ? [pen.reason] : [],
      });
    }
  });

  let penaltiesTotal = 0;
  groupedPenaltiesMap.forEach(({ pen, totalMultiplier, baseUnitValue, totalValue }) => {
    let amount = 0;
    if (pen.type === 'percentage') {
      amount = (baseSalary * totalValue) / 100;
    } else {
      amount = totalValue;
    }
    penaltiesTotal += amount;

    const ruleLabel = pen.ruleName || pen.reason || 'Penalty';
    // Format descriptive summary: "fine * #" times fined
    const displayName = totalMultiplier > 1
      ? `${ruleLabel} * ${totalMultiplier} times fined`
      : `${ruleLabel} * 1 time fined`;

    deductionBreakdown.push({
      name: displayName,
      amount,
      type: pen.type === 'percentage' ? `${totalValue}%` : `${config.currencySymbol}${amount.toFixed(0)}`,
      category: 'penalty',
    });
  });

  // Check if suspension history has a dedicated catalog fine logged specifically for this staff member
  const historySusp = getStaffActiveSuspensionFromHistory(staff, companyName, referenceDate);
  if (historySusp) {
    const isPardoned =
      historySusp.status === 'Pardoned' ||
      Boolean(historySusp.deductionPolicy?.toLowerCase().includes('pardon')) ||
      Boolean(historySusp.deductionPolicy?.toLowerCase().includes('disabled')) ||
      (Number(historySusp.deductionAmount) === 0 && !historySusp.penaltyRuleName);

    // Only apply catalog disciplinary fine if:
    // 1. Suspension fine is enabled globally
    // 2. Not disabled or pardoned for this individual staff
    // 3. Is a true catalog disciplinary fine (not the automatic daily deduction, which is computed dynamically above)
    const isCatalogFine =
      historySusp.calculationType === 'catalog' ||
      (Boolean(historySusp.penaltyRuleName) &&
        historySusp.penaltyRuleName !== 'None' &&
        historySusp.penaltyRuleName !== 'Automatic Daily Suspension Deduction');

    if (isSuspensionGloballyEnabled && !isPardoned && !isIndividualSuspensionDisabledOrPardoned && isCatalogFine && Number(historySusp.deductionAmount) > 0) {
      const fineAmount = Number(historySusp.deductionAmount);
      const alreadyPresent = activePenalties.some(
        (pen) =>
          pen.calculatedAmount === fineAmount ||
          pen.value === fineAmount ||
          (historySusp.penaltyRuleName && pen.ruleName === historySusp.penaltyRuleName)
      );

      if (!alreadyPresent) {
        penaltiesTotal += fineAmount;
        deductionBreakdown.push({
          name: `Suspension Fine: ${historySusp.penaltyRuleName || 'Disciplinary Fine'}`,
          amount: fineAmount,
          type: historySusp.deductionPolicy || `${config.currencySymbol}${fineAmount}`,
          category: 'suspension',
        });
      }
    }
  }

  // 3. Attendance Worksheet Event Deductions (Absenteeism & Lateness)
  // Applied automatically if an attendance worksheet exists for the evaluated month
  const attendanceDetails = calculateStaffAttendanceDeductions(
    staff,
    config,
    referenceDate,
    companyName,
    providedProjects
  );
  let attendanceDeductionsTotal = 0;

  if (attendanceDetails.hasWorksheet) {
    if (attendanceDetails.absenteeDeduction > 0) {
      attendanceDeductionsTotal += attendanceDetails.absenteeDeduction;
      deductionBreakdown.push({
        name: `Absenteeism Deduction (${attendanceDetails.absentDays} unexcused day${attendanceDetails.absentDays > 1 ? 's' : ''})`,
        amount: attendanceDetails.absenteeDeduction,
        type: attendanceDetails.absenteeSummary,
        category: 'attendance',
      });
    }

    if (attendanceDetails.latenessDeduction > 0) {
      attendanceDeductionsTotal += attendanceDetails.latenessDeduction;
      deductionBreakdown.push({
        name: `Lateness Deduction (${attendanceDetails.lateDays} late arrival${attendanceDetails.lateDays > 1 ? 's' : ''})`,
        amount: attendanceDetails.latenessDeduction,
        type: attendanceDetails.latenessSummary,
        category: 'attendance',
      });
    }
  }

  const totalDeductions = corporateDeductions + penaltiesTotal + suspensionDeduction + attendanceDeductionsTotal;

  // 4. Bonuses & Allowances (Grade-mapped, department-aware, excluding manual welfare-only grants)
  const bonusBreakdown: Array<{ name: string; amount: number; type: string }> = [];
  let totalBonuses = 0;

  (config.bonuses || [])
    .filter((b) => {
      if (!b.isEnabled) return false;
      // Manual welfare grants (e.g. Birthday celebration vouchers) are disbursed via the Welfare & Grants ledger, not recurring payroll
      if (b.disbursementType === 'welfare_log') return false;
      // Salary Grade Mapping check: if custom mapping configured, must be included
      if (
        matchingGradeTier?.allowedBonusIds &&
        Array.isArray(matchingGradeTier.allowedBonusIds) &&
        !matchingGradeTier.allowedBonusIds.includes(b.id)
      ) {
        return false;
      }
      if (b.applicableTo && b.applicableTo !== 'All') {
        if (staff.department && b.applicableTo !== staff.department) return false;
      }
      return true;
    })
    .forEach((bon) => {
      let amount = 0;
      if (bon.type === 'percentage') {
        amount = (baseSalary * bon.value) / 100;
      } else {
        amount = bon.value;
      }
      bonusBreakdown.push({
        name: bon.name,
        amount,
        type: bon.type === 'percentage' ? `${bon.value}%` : `${config.currencySymbol}${bon.value}`,
      });
      totalBonuses += amount;
    });

  const netSalary = Math.max(0, baseSalary - totalDeductions + totalBonuses);

  return {
    staffId: staff.id,
    employeeId: staff.employeeId,
    name: staff.name,
    department: staff.department,
    role: staff.role,
    payGrade,
    payFrequency,
    baseSalary,
    unproratedBaseSalary: fullBaseSalary,
    isProratedMidMonth,
    prorationSummary,
    employedDaysInCycle: employedDaysCount,
    cycleDays: daysInCurrentMonth,
    corporateDeductions,
    penaltiesTotal,
    suspensionDeduction,
    suspensionDetails,
    absenteeDeduction: attendanceDetails.absenteeDeduction,
    latenessDeduction: attendanceDetails.latenessDeduction,
    attendanceDetails,
    totalDeductions,
    totalBonuses,
    netSalary,
    deductionBreakdown,
    penaltiesBreakdown: activePenalties,
    bonusBreakdown,
  };
}

/**
 * Checks if a salary matches the configured min/max for a given pay grade.
 */
export function validateSalaryForPayGrade(
  salary: number,
  payGradeName: string,
  payGrades: PayGradeTier[]
): {
  isValid: boolean;
  min?: number;
  max?: number;
  matchingTier?: PayGradeTier;
  warningMessage?: string;
} {
  if (!payGradeName || !payGrades || payGrades.length === 0) {
    return { isValid: true };
  }

  const cleanGrade = payGradeName.trim().toLowerCase();
  const matched = payGrades.find(
    (pg) =>
      pg.name.toLowerCase() === cleanGrade ||
      pg.name.toLowerCase().includes(cleanGrade) ||
      cleanGrade.includes(pg.name.toLowerCase().split('(')[0].trim())
  );

  if (!matched) {
    return { isValid: true };
  }

  const num = Number(salary) || 0;
  if (num < matched.minSalary) {
    return {
      isValid: false,
      min: matched.minSalary,
      max: matched.maxSalary,
      matchingTier: matched,
      warningMessage: `Salary (${num.toLocaleString()}) is below the minimum range (${matched.minSalary.toLocaleString()}) for ${matched.name}. Please select a different pay grade or adjust the base salary.`,
    };
  }

  if (num > matched.maxSalary) {
    return {
      isValid: false,
      min: matched.minSalary,
      max: matched.maxSalary,
      matchingTier: matched,
      warningMessage: `Salary (${num.toLocaleString()}) exceeds the maximum threshold (${matched.maxSalary.toLocaleString()}) for ${matched.name}. Please select a higher pay grade or adjust the base salary.`,
    };
  }

  return {
    isValid: true,
    min: matched.minSalary,
    max: matched.maxSalary,
    matchingTier: matched,
  };
}
