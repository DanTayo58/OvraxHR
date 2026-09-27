export type AttendanceStatus =
  | 'On Time'
  | 'Late'
  | 'Absent'
  | 'Half Day'
  | 'Overtime'
  | 'Early Departure'
  | 'On Leave';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  shift: string;
  date: string; // YYYY-MM-DD
  scheduledIn: string; // HH:MM
  clockIn: string; // HH:MM
  clockOut: string; // HH:MM
  totalHours: number;
  status: AttendanceStatus;
  notes?: string;
  dayNumber?: number; // 1..31 for monthly matrix
}

export interface StaffMember {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  role: string;
  jobTitle?: string;
  email: string;
  phone?: string;
  emergencyContact?: string;
  dob?: string; // Date of Birth (YYYY-MM-DD)
  homeAddress?: string; // Residential Home Address
  guarantorName?: string; // Guarantor / Sponsor Full Name
  guarantorPhone?: string; // Guarantor Contact Phone
  guarantorRelationship?: string; // Relationship (e.g. Parent, Sibling, Legal Sponsor)
  guarantorAddress?: string; // Guarantor Residential Address
  nextOfKinName?: string; // Next of Kin Full Name
  nextOfKinPhone?: string; // Next of Kin Phone
  nextOfKinRelationship?: string; // Next of Kin Relationship
  nextOfKinAddress?: string; // Next of Kin Address
  payGrade: string; // e.g. "Grade L1", "Grade L2", "Executive"
  payFrequency?: 'Weekly' | 'Bi-Weekly' | 'Monthly' | string; // Pay Frequency
  estimatedMonthlySalary: number; // For structural payroll planning assistance
  shiftSchedule: string; // e.g. "Morning Shift", "Night Shift", "Flexible"
  status: 'Active' | 'Probation' | 'On Leave' | 'Off Duty' | 'Suspended' | 'Exited' | 'On Query';
  employeeCategory?: 'Full-time' | 'Part-time' | 'Contract' | 'Trainee' | string;
  joinDate?: string;
  exitDate?: string;
  exitReason?: string;
  exitDepartureType?: string; // e.g. 'Voluntary Resignation', 'Contract Termination', etc.
  exitDocuments?: { name: string; size?: number; type?: string; data: string; uploadDate: string }[];
  suspensionStartDate?: string; // e.g. YYYY-MM-DD
  suspensionEndDate?: string; // e.g. YYYY-MM-DD
  suspensionEndTime?: string; // Suspension end date/time logged in staff history log
  suspensionReason?: string;
  suspensionDeductedDays?: number; // Days already deducted and settled in payroll executions
  suspensionLastSettledDate?: string; // Date of last payroll execution that deducted suspension
  suspensionTotalDays?: number; // Total duration days of current suspension
  bankName?: string;
  accountNumber?: string;
  photo?: string; // Profile photo (Base64 data URL or image link)
  avatar?: string;
}

export interface JobDescriptionItem {
  id: string;
  text: string;
  isKey?: boolean;
  keyword?: string;
  target?: string;
  weight?: number;
  mappedParameters?: string[];
}

export type InvolvementLevel =
  | 'Very good'
  | 'Good'
  | 'OK'
  | 'Bad'
  | 'Very Bad';

export interface DepartmentRole {
  id: string;
  title: string;
  jobDescription?: string;
  summary?: string;
  reportsTo?: string;
  targets?: string;
  mappedParameters?: string[];
  items?: JobDescriptionItem[];
}

export interface DepartmentInfo {
  id: string;
  name: string;
  code: string;
  headOfDepartment: string;
  description: string;
  roles?: DepartmentRole[];
}

export interface ShiftSchedule {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  shiftType: string;
  startTime: string; // e.g. "08:00"
  endTime: string; // e.g. "17:00"
  workDays: string[]; // e.g. ["Mon", "Tue", "Wed", "Thu", "Fri"]
  isSyncedWithAttendance: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  leaveType: 'Annual' | 'Sick' | 'Maternity' | 'Casual' | 'Unpaid Off';
  startDate: string;
  endDate: string;
  daysCount: number;
  status: 'Approved' | 'Pending' | 'Rejected';
  leaveStatus?: 'Ongoing' | 'Pending' | 'Ended' | 'Active' | 'Restored' | 'Concluded';
  reason?: string;
  attachmentName?: string;
  attachmentUrl?: string;
}

export interface FeedingAllowanceConfig {
  dailyRate: number; // Meal allowance per active day (e.g. 15)
  currency: string;
  activeStaffOnly: boolean;
  departmentRates?: Record<string, number>;
}

export interface ProjectFile {
  id: string;
  name: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  isLocked: boolean;
  lockPassword?: string; // Encrypted / Password for access control
  monthYear: string; // e.g. "2026-08"
  daysInMonth: number; // e.g. 31
  staffCount: number; // e.g. 5
  customColumns: string[]; // Extra custom non-mandatory columns (separate from mandatory columns)
  records: AttendanceRecord[];
  category?: string;
  // File-specific settings overrides
  fileResumptionTime?: string;
  fileClosingTime?: string;
  fileGracePeriodMinutes?: number;
  fileExtraColumns?: string[]; // Extra custom columns added specifically for this file
  customValues?: Record<string, Record<string, string>>; // staffId -> extraColumnName -> cell value
}

export interface User {
  id: string;
  email: string;
  username?: string;
  name: string;
  company: string;
  companyId?: string; // Company Initials / Unique Company ID (letters & numbers only)
  role: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  isInternalCrew?: boolean;
  departmentId?: string;
  departmentName?: string;
  assignedTabs?: string[];
  isEmailVerified?: boolean;
  password?: string;
  createdAt?: string;
}

export interface ReviewReply {
  id: string;
  authorId?: string;
  authorName: string;
  authorRole: string;
  companyName?: string;
  departmentName?: string;
  message: string;
  createdAt: string;
  isOfficialSupport?: boolean;
}

export interface PlatformReview {
  id: string;
  authorId?: string;
  authorName: string;
  companyName: string;
  companyId?: string;
  companyLogo?: string;
  rating: number; // 1 to 5
  category?: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  likes?: number;
  dislikes?: number;
  likedBy?: string[];
  dislikedBy?: string[];
  replies?: ReviewReply[];
}

export interface TicketMessage {
  id: string;
  sender: 'client' | 'support';
  authorName: string;
  text: string;
  timestamp: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  authorId?: string;
  authorName: string;
  email: string;
  companyName: string;
  companyId?: string;
  category: string;
  customSubject?: string;
  priority: string;
  message: string;
  status: 'Open' | 'In Review' | 'Resolved' | 'Closed';
  createdAt: string;
  adminNote?: string;
  messages?: TicketMessage[];
  unreadBySupport?: boolean;
  unreadByClient?: boolean;
  lastMessageAt?: string;
}

export interface AIAnalysisResult {
  executiveSummary: string;
  anomalies: string[];
  departmentInsights: { department: string; insight: string }[];
  recommendations: string[];
}

export interface DynamicShift {
  id: string;
  name: string; // e.g. "Morning Shift", "Afternoon Shift", "Night Shift"
  startTime: string; // e.g. "08:00"
  endTime: string; // e.g. "17:00"
  gracePeriodMinutes: number; // e.g. 15
  isDefault?: boolean;
  color?: string;
}

export interface ShiftPreset {
  id: string;
  presetName: string; // e.g. "Standard 3-Rotation Factory", "Single Morning Shift"
  shifts: DynamicShift[];
  createdAt: string;
}

export interface ShiftRosterTemplate {
  id: string;
  name: string; // e.g. "Template 1", "Morning Rotation Week 1"
  assignments: Record<string, string>; // employeeId -> shiftName
  createdAt: string;
}

export interface DailyShiftRosterSnapshot {
  date: string; // "YYYY-MM-DD"
  templateId: string;
  templateName: string;
  assignments: Record<string, string>; // employeeId/id -> shiftName (e.g., "Morning Shift", "Night Shift")
  savedAt: string; // ISO timestamp
}

export type EnumerationFormat = 'roman' | 'numbers' | 'letters' | 'dots' | 'none';
export type ListEnumerationFormat = 'dots' | 'numbers' | 'letters' | 'roman';
export type DocumentItemType =
  | 'text'
  | 'duties_list'
  | 'all_roles'
  | 'key_roles'
  | 'normal_roles'
  | 'skills'
  | 'list'
  | 'table'
  | 'jd_targets_table';

export interface DocumentHeaderMetaItem {
  id: string;
  label: string;
  value: string;
}

export interface DocumentHeaderMetaConfig {
  leftItems: DocumentHeaderMetaItem[];
  rightItems: DocumentHeaderMetaItem[];
}

export interface SignatureBlock {
  id: string;
  title: string;
  subtitle?: string;
}

export type DocumentSignatureBlock = SignatureBlock;

export type SignatureLayoutType = '1_col' | '2_col' | '3_col' | '4_col' | '2x2';

export interface SignatureConfig {
  layout: SignatureLayoutType;
  signatures: SignatureBlock[];
}

export interface DocumentSubsection {
  id: string;
  title: string;
  type: DocumentItemType;
  enumeration?: EnumerationFormat;
  listEnumeration?: ListEnumerationFormat;
  heading?: string;
  text?: string;
  listItems?: string[];
  tableHeaders?: string[];
  tableRows?: string[][];
  dutyFilter?: 'all' | 'key' | 'normal';
  sortByWeight?: boolean;
}

export interface DocumentSection {
  id: string;
  title: string;
  type: DocumentItemType;
  enumeration?: EnumerationFormat;
  listEnumeration?: ListEnumerationFormat;
  heading?: string;
  text?: string;
  listItems?: string[];
  tableHeaders?: string[];
  tableRows?: string[][];
  subsections?: DocumentSubsection[];
  dutyFilter?: 'all' | 'key' | 'normal';
  sortByWeight?: boolean;
}

// Backward compatibility alias for JdSection & JdSubsection
export type JdSubsection = DocumentSubsection;
export type JdSection = DocumentSection;

export interface AppSettings {
  theme: 'dark' | 'light';
  companyName?: string;
  companyId?: string; // Company Initials / Unique Identifier (e.g. SKM, APEX)
  companyLogo?: string; // Global base64 / URL company logo
  resumptionTime: string; // e.g. "08:00"
  closingTime: string; // e.g. "17:00"
  gracePeriodMinutes: number;
  defaultColumns: string[];
  extraColumns?: string[]; // Extra custom columns configured in settings modal for attendance sheets
  autoSyncStaffFromAttendance?: boolean; // Toggle for Auto-Sync
  shifts?: DynamicShift[]; // Dynamic shifts list
  savedShiftPresets?: ShiftPreset[]; // Saved presets
  savedRosterTemplates?: ShiftRosterTemplate[]; // Saved shift roster templates
  activeTemplateId?: string; // Currently active template ID
  dailyShiftRosterHistory?: Record<string, DailyShiftRosterSnapshot>; // Date (YYYY-MM-DD) -> snapshot entity of shift template for that day for tight worksheet accuracy
  
  // Job Description Document Template Format & Styling
  jdCompanyName?: string;
  jdDocumentTitle?: string;
  jdLogo?: string;
  jdLineColor?: string;
  jdTextColor?: string;
  jdSection1Title?: string;
  jdSection1Text?: string;
  jdSection2Title?: string;
  jdSection3Title?: string;
  jdSection3Text?: string;
  jdEmployeeSigLabel?: string;
  jdHrSigLabel?: string;
  jdSections?: DocumentSection[];
  jdHeaderMeta?: DocumentHeaderMetaConfig;
  jdSignatures?: SignatureConfig;
  
  // Confirmation Letter Document Template Format & Styling
  confirmationCompanyName?: string;
  confirmationDocumentTitle?: string;
  confirmationLogo?: string;
  confirmationLineColor?: string;
  confirmationTextColor?: string;
  confirmationSalutation?: string;
  confirmationBodyParagraph1?: string;
  confirmationBodyParagraph2?: string;
  confirmationClosingText?: string;
  confirmationEmployeeSigLabel?: string;
  confirmationHrSigLabel?: string;
  confirmationSections?: DocumentSection[];
  confirmationHeaderMeta?: DocumentHeaderMetaConfig;
  confirmationSignatures?: SignatureConfig;

  // Appointment Letter Document Template Format & Styling
  appointmentCompanyName?: string;
  appointmentDocumentTitle?: string;
  appointmentLogo?: string;
  appointmentLineColor?: string;
  appointmentTextColor?: string;
  appointmentEmployeeSigLabel?: string;
  appointmentHrSigLabel?: string;
  appointmentSections?: DocumentSection[];
  appointmentHeaderMeta?: DocumentHeaderMetaConfig;
  appointmentSignatures?: SignatureConfig;

  // Performance Appraisal Document Template Format & Styling
  appraisalCompanyName?: string;
  appraisalDocumentTitle?: string;
  appraisalLogo?: string;
  appraisalLineColor?: string;
  appraisalTextColor?: string;
  appraisalEmployeeSigLabel?: string;
  appraisalAppraiserSigLabel?: string;
  appraisalHrSigLabel?: string;
  appraisalSections?: DocumentSection[];
  appraisalHeaderMeta?: DocumentHeaderMetaConfig;
  appraisalSignatures?: SignatureConfig;

  // Candidate Offer Letter Document Template Format & Styling (Onboarding Pipeline)
  offerLetterCompanyName?: string;
  offerLetterDocumentTitle?: string;
  offerLetterLogo?: string;
  offerLetterLineColor?: string;
  offerLetterTextColor?: string;
  offerLetterEmployeeSigLabel?: string;
  offerLetterHrSigLabel?: string;
  offerLetterSections?: DocumentSection[];
  offerLetterHeaderMeta?: DocumentHeaderMetaConfig;
  offerLetterSignatures?: SignatureConfig;
}

export interface InterviewQuestionItem {
  id: string;
  question: string;
  category?: 'Technical / Domain' | 'Operational / SOP' | 'Behavioral / Culture' | 'Problem Solving';
  status?: 'pass' | 'fail' | 'pending';
  notes?: string;
}

export interface JobVacancy {
  id: string;
  title: string;
  department: string;
  role: string;
  targetHeadcount: number; // Number of open positions
  filledCount: number; // Count of candidates employed for this role
  hiredStaffNames: string[];
  hiredStaffDetails?: Array<{
    applicantId: string;
    staffId: string;
    name: string;
    hiredDate: string;
    role?: string;
  }>;
  status: 'Open' | 'Filled' | 'Closed' | 'Draft';
  employmentType: 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
  experienceRequired: number; // Years required
  minEducationalLevel: string;
  requiredSkills: string[];
  titleKeywords?: string[]; // Expected previous job titles / role keywords
  salaryRange?: {
    min: number;
    max: number;
    payGrade?: string;
  };
  description?: string;
  requestedBy?: string; // Department Head / Requester
  createdDate: string; // YYYY-MM-DD
  closedDate?: string; // YYYY-MM-DD
  notes?: string;
}

export interface Applicant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  vacancyId?: string;
  vacancyTitle?: string;
  appliedDepartment: string;
  appliedRole: string;
  experienceYears?: number;
  expectedSalary?: number;
  education?: string;
  educationalLevel?: string;
  courseOfStudy?: string;
  schoolGrade?: string;
  skills: string[];
  resumeText: string;
  resumeFileName?: string;
  appliedDate: string; // YYYY-MM-DD
  status: 'Pending' | 'Screened' | 'Interviewing' | 'Hired' | 'Rejected';
  notes?: string;
  rating?: number; // 1 to 5
  interviewQuestions?: InterviewQuestionItem[];
  interviewNotes?: string;
  interviewDate?: string;
  offerLetterPrinted?: boolean;
}

export interface ATSScoreResult {
  overallPercentage: number;
  grade: 'Exceptional Match' | 'Strong Correlation' | 'Moderate Match' | 'Low Correlation';
  color: string;
  keywordScore: number;
  experienceScore: number;
  educationScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  dutyBreakdown: Array<{ duty: string; matched: boolean; score: number }>;
  summary: string;
  strengths: string[];
  growthAreas: string[];
}

export type PayFrequencyType = 'Weekly' | 'Bi-Weekly' | 'Monthly';

export interface PayGradeTier {
  id: string;
  name: string; // e.g. "Grade L1", "Grade L2", "Executive"
  minSalary: number;
  maxSalary: number;
  defaultFrequency?: PayFrequencyType;
  description?: string;
  allowedBonusIds?: string[]; // IDs of mapped allowances / bonuses (if undefined, all enabled are mapped by default)
  allowedDeductionIds?: string[]; // IDs of mapped corporate deductions (if undefined, all enabled are mapped by default)
}

export interface DynamicConditionRule {
  id: string;
  field: string; // e.g. 'role', 'shiftSchedule', 'payFrequency', 'status', 'estimatedMonthlySalary', 'custom'
  operator: string; // e.g. '==', '!=', '>', '>=', '<', '<=', 'in', 'not_in', 'contains'
  value: string | number;
  values?: string[]; // Multiple selections support (e.g. multiple roles, multiple shifts)
  departmentScope?: string; // Scoped department for dynamic role/job title dropdown
  customKey?: string; // Custom attribute key name when field === 'custom'
}

export interface DeductionRuleSet {
  id: string;
  name: string; // e.g. "Rule 1", "Rule 2"
  applicableDepartments?: string[]; // Department mappings or ['All']
  applicableEmployeeTypes?: string[]; // Employee categories or ['All']
  applicablePayGrades?: string[]; // Pay grades or ['All']
  grossSalaryCondition?: {
    enabled: boolean;
    operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
    value: number;
  };
  customConditions?: DynamicConditionRule[];
}

export interface PayrollDeduction {
  id: string;
  name: string; // e.g. "Income Tax / PAYE", "Pension Fund", "Health Insurance"
  type: 'percentage' | 'fixed' | 'formula';
  value: number; // e.g. 10 (for 10%) or 50 (for $50) or computed sample
  formula?: string; // Custom HR formula expression e.g. "({base_salary} / {days_in_month}) * 2"
  applicableTo: 'All' | string;
  applicableDepartments?: string[]; // Array of department names or ['All']
  applicableEmployeeTypes?: string[]; // e.g. ['Full-time', 'Contract'] or ['All']
  applicablePayGrades?: string[]; // e.g. ['Grade L1'] or ['All']
  grossSalaryCondition?: {
    enabled: boolean;
    operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
    value: number;
  };
  customConditions?: DynamicConditionRule[];
  rules?: DeductionRuleSet[]; // Configured condition rulesets (Rule 1, Rule 2, ...)
  weight?: number; // Priority weight 1 - 100 (100 highest priority, deducted first)
  calculationBasis?: 'base' | 'net'; // 'base' = Base Salary, 'net' = Net Disbursal
  isEnabled: boolean;
  description?: string;
}

export interface ManualDeductionRule {
  id: string;
  name: string; // e.g. "Late Attendance Fine", "Unexcused Absence", "Equipment Damage", "Disciplinary Charge"
  type: 'percentage' | 'fixed';
  defaultValue: number;
  description?: string;
}

export interface BookedPenalty {
  id: string;
  staffId: string;
  employeeId: string;
  staffName: string;
  department?: string;
  ruleId?: string;
  penaltyRuleId?: string;
  ruleName?: string; // e.g. "Late Attendance Fine"
  type: 'percentage' | 'fixed' | 'formula';
  value: number; // rate or percentage applied
  baseValue?: number; // base penalty unit amount before multiplier
  multiplier?: number; // times multiplier (default 1)
  formula?: string;
  calculatedAmount?: number; // monetary amount deducted
  amount?: number; // alias for calculated amount
  reason?: string;
  incurredDate?: string;
  incurredBy?: string;
  incidentDate?: string; // YYYY-MM-DD
  bookedAt?: string;
  status: 'Active' | 'Settled' | 'Voided';
}

export interface PayrollBonus {
  id: string;
  name: string; // e.g. "Housing Allowance", "Transport Allowance", "KPI Performance Bonus"
  type: 'percentage' | 'fixed';
  value: number;
  applicableTo: 'All' | string;
  isEnabled: boolean;
  description?: string;
  isDefault?: boolean;
  category?: string; // 'housing' | 'transport' | 'birthday' | 'medical' | 'bereavement' | 'childbirth' | 'performance' | 'attendance' | 'overtime' | 'custom'
  disbursementType?: 'payroll' | 'welfare_log'; // 'payroll' = added to recurring monthly payroll; 'welfare_log' = manual grant logged to welfare ledger
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  label: string; // e.g. "USD $ - US Dollar (United States)"
}

export interface PayrollRollRules {
  monthly: {
    ruleType: 'specific_day' | 'beginning_of_month' | 'end_of_month';
    dayOfMonth?: number; // 1..31
  };
  biWeekly: {
    dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
    startDate?: string; // e.g. "2026-09-04" kick-off date to anchor every 14 days
    interval?: 'every_2nd_week';
  };
  weekly: {
    dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  };
}

export interface SuspensionDeductionConfig {
  isEnabled: boolean; // default automatic suspension deduction active or disabled
  calculationType: 'daily_pay' | 'rigid'; // 'daily_pay' = monthlySalary / 31; 'rigid' = custom fixed amount per day
  rigidDailyAmount: number; // e.g. 50
  daysBasis?: number; // 31 (for 31-day month daily pay)
}

export type AttendanceDeductionCalculationType = 'day_calculation' | 'percentage' | 'exact_value';

export interface AttendanceEventDeductionConfig {
  isEnabled: boolean; // default automatic deduction active or disabled
  calculationType: AttendanceDeductionCalculationType; // 'day_calculation' | 'percentage' | 'exact_value'
  useSalaryDailyRate?: boolean; // When 'day_calculation': true = (baseSalary / daysInMonth) * count; false = rigidDailyAmount * count
  rigidDailyAmount?: number; // Rigid daily monetary rate when useSalaryDailyRate is false
  percentageRate: number; // When 'percentage': rate e.g. 2.0 (for 2% of base salary per occurrence)
  exactAmount: number; // When 'exact_value': fixed monetary amount per occurrence, e.g. 25
}

export interface SuspensionHistoryRecord {
  id: string;
  staffId: string;
  employeeId: string;
  staffName: string;
  department: string;
  role?: string;
  category: 'Disciplinary Suspension';
  type: 'created' | 'updated' | 'restored' | 'ended';
  title: string;
  date: string; // YYYY-MM-DD
  startDate: string;
  endDate: string;
  durationDays: number;
  reason: string;
  deductionPolicy: string;
  deductionAmount: number;
  dailyRate?: number;
  calculationType: 'daily_pay' | 'rigid' | 'catalog' | 'none';
  penaltyRuleName?: string;
  notes: string;
  authorizedBy: string;
  status: 'Currently Suspended' | 'Concluded' | 'Restored' | 'Pardoned';
  timestamp: string;
}

export interface QueryDocumentFile {
  name: string;
  size?: number;
  type?: string;
  data: string; // Base64 or Object URL
  uploadDate: string;
  uploadedAt?: string;
}

export type QueryActionVerdict = 'fine' | 'suspension' | 'warning' | 'pardon' | 'exit';

export interface QueryRecord {
  id: string;
  staffId: string;
  employeeId: string;
  staffName: string;
  department: string;
  role?: string;
  title: string;
  deadlineHours: 24 | 48;
  issuedAt: string; // ISO string
  deadlineAt: string; // ISO string
  status: 'pending' | 'closed';
  queryFile?: QueryDocumentFile;
  responseFile?: QueryDocumentFile;
  queryDocument?: QueryDocumentFile;
  responseDocument?: QueryDocumentFile;
  closedAt?: string;
  verdict?: QueryActionVerdict;
  verdictDetails?: {
    action: QueryActionVerdict;
    note?: string;
    notes?: string;
    warningNumber?: number; // 1, 2, or 3 (3 max per year)
    warningYear?: number;
    fineAmount?: number;
    fineRuleName?: string;
    suspensionStartDate?: string;
    suspensionEndDate?: string;
    authorizedBy?: string;
  };
  authorizedBy?: string;
  lastNotifiedWarningAt?: string;
}

export interface DebitAccountConfig {
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  routingNumber?: string;
  currency?: string;
  notes?: string;
  isConfigured?: boolean;
  updatedAt?: string;
}

export interface PayrollRunRecord {
  id: string;
  executedAt: string;
  completedAt?: string;
  status: 'Draft' | 'Executed' | 'Completed' | 'Transferred';
  cycleDate: string;
  frequency?: string;
  staffCount: number;
  totalGross: number;
  totalAllowances: number;
  totalDeductions: number;
  totalNet: number;
}

export interface PayrollConfig {
  currencyCode: string; // e.g. "USD"
  currencySymbol: string; // e.g. "$"
  currencyName: string; // e.g. "US Dollar"
  payGrades: PayGradeTier[];
  deductions: PayrollDeduction[]; // Statutory / Automatic corporate deductions
  manualDeductionRules?: ManualDeductionRule[]; // Configured catalog of manual penalty rules
  suspensionDeductionConfig?: SuspensionDeductionConfig; // Default automatic suspension deduction settings
  absenteeDeductionConfig?: AttendanceEventDeductionConfig; // Default automatic absenteeism deduction from monthly attendance worksheet
  latenessDeductionConfig?: AttendanceEventDeductionConfig; // Default automatic lateness deduction from monthly attendance worksheet
  bookedPenalties?: BookedPenalty[]; // Active penalty bookings
  bonuses: PayrollBonus[];
  defaultPayFrequency?: PayFrequencyType;
  rollRules?: PayrollRollRules;
  taxIdentificationNumber?: string;
  debitAccount?: DebitAccountConfig; // Organization Debit Account (Disbursement Source) - Optional
  recentRuns?: PayrollRunRecord[];
  lastRolledAt?: string;
  updatedAt?: string;
}

export type SubscriptionTier = 'Small Scale' | 'Large Scale';

export type VoucherDuration = '1 month' | '2 months' | '6 months' | '1 year' | '2 years';

export interface VoucherRedemption {
  companyId: string;
  companyName: string;
  adminEmail: string;
  redeemedAt: string;
  discountPercent: number;
  tier: SubscriptionTier;
  batchPeriod: VoucherDuration;
}

export interface VoucherCode {
  id: string;
  code: string; // 6-character alphanumeric, case-sensitive
  discountPercent: number; // 1 to 100
  duration: VoucherDuration;
  applicableTier: 'All' | SubscriptionTier;
  createdAt: string;
  expiresAt?: string;
  isActive: boolean;
  notes?: string;
  createdBy?: string;
  redemptions: VoucherRedemption[];
}

export interface CompanyLicense {
  companyId: string;
  companyName: string;
  tier: SubscriptionTier;
  billingCycle: 'monthly' | 'annual';
  durationBatch?: VoucherDuration | string;
  status: 'Active' | 'Unlicensed' | 'Suspended' | 'Expired';
  activatedAt: string;
  expiresAt?: string;
  voucherCodeUsed?: string;
  discountPercent?: number;
  amountPaid?: number;
  licenseKey: string;
  activatedBy?: string;
}

export interface RecurringOffRule {
  id: string;
  name: string;
  cycle: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  assignmentType: 'department' | 'role' | 'individual' | 'all';
  targetDepartments?: string[];
  targetRoles?: string[];
  targetStaffIds?: string[];
  effectiveStartDate?: string;
  notes?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface StaffBonusLog {
  id: string;
  staffId: string;
  staffName: string;
  employeeId?: string;
  department?: string;
  role?: string;
  avatar?: string;
  bonusTitle: string;
  category: 'performance' | 'recognition' | 'birthday' | 'anniversary' | 'milestone' | 'hardship' | 'childbirth' | 'medical' | 'attendance' | 'bereavement' | 'general' | 'custom' | string;
  amount: number;
  currencySymbol?: string;
  disbursementType: 'welfare_log' | 'payroll';
  dateGranted: string;
  notes?: string;
  appliedBy?: string;
  createdAt?: string;
}



