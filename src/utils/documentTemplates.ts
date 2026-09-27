import {
  DocumentSection,
  StaffMember,
  AppSettings,
  EnumerationFormat,
  ListEnumerationFormat,
  DepartmentInfo,
  JobDescriptionItem,
  DocumentHeaderMetaConfig,
  SignatureConfig,
} from '../types';
import { loadCompanyData, STORAGE_KEYS } from './companyStorage';
import { getCompanyCurrencySymbol, loadCompanyPayrollConfig, isDeductionApplicableToStaff } from './payrollUtils';
import { getCleanDepartments } from './departmentUtils';

export const DOCUMENT_TAGS = [
  { tag: '{STAFF_NAME}', label: 'Staff Name' },
  { tag: '{ROLE_TITLE}', label: 'Role Title' },
  { tag: '{DEPARTMENT}', label: 'Department' },
  { tag: '{EMPLOYEE_ID}', label: 'Employee ID' },
  { tag: '{STATUS}', label: 'Employment Status' },
  { tag: '{SALARY}', label: 'Monthly Salary' },
  { tag: '{SALARY_SUMMARY}', label: 'Salary Summary' },
  { tag: '{PAY_GRADE}', label: 'Pay Grade' },
  { tag: '{SHIFT_SCHEDULE}', label: 'Shift Roster' },
  { tag: '{ALL_DUTIES_COUNT}', label: 'All Duties Count' },
  { tag: '{KEY_DUTIES_COUNT}', label: 'Key Duties Count' },
  { tag: '{NORMAL_ROLES_COUNT}', label: 'Normal Roles Count' },
  { tag: '{REPORTS_TO}', label: 'Reports To' },
  { tag: '{JOB_SUMMARY}', label: 'Job Summary / Role Description' },
  { tag: '{TARGETS}', label: 'Performance Targets / KPIs' },
  { tag: '☐', label: 'Ballot Box ☐' },
  { tag: '{JOIN_DATE}', label: 'Join Date' },
  { tag: '{DATE}', label: 'Issue Date' },
  { tag: '{COMPANY_NAME}', label: 'Company Name' },
  { tag: '{BANK_NAME}', label: 'Bank Name' },
  { tag: '{ACCOUNT_NUMBER}', label: 'Account Number' },
  { tag: '{EMAIL}', label: 'Email' },
  { tag: '{PHONE}', label: 'Phone Number' },
  { tag: '{ROLE_SKILLS}', label: 'ATS Key Skills' },
  { tag: '{KEY_SKILLS}', label: 'Key Skills' },
];

export const DEFAULT_HEADER_META: DocumentHeaderMetaConfig = {
  leftItems: [
    { id: 'hm-l-1', label: 'Employee', value: '{STAFF_NAME}' },
    { id: 'hm-l-2', label: 'Role', value: '{ROLE_TITLE} ({DEPARTMENT})' },
  ],
  rightItems: [
    { id: 'hm-r-1', label: 'ID', value: '#{EMPLOYEE_ID}' },
    { id: 'hm-r-2', label: 'Status', value: '{STATUS}' },
  ],
};

export const DEFAULT_APPRAISAL_HEADER_META: DocumentHeaderMetaConfig = {
  leftItems: [
    { id: 'appr-hm-l-1', label: 'Appraisee', value: '{STAFF_NAME}' },
    { id: 'appr-hm-l-2', label: 'Designation', value: '{ROLE_TITLE} ({DEPARTMENT})' },
  ],
  rightItems: [
    { id: 'appr-hm-r-1', label: 'Employee ID', value: '#{EMPLOYEE_ID}' },
    { id: 'appr-hm-r-2', label: 'Evaluation Date', value: '{DATE}' },
    { id: 'appr-hm-r-3', label: 'Review Cycle', value: 'Annual Performance & KPI Review' },
  ],
};

export const DEFAULT_SIGNATURES: SignatureConfig = {
  layout: '2_col',
  signatures: [
    { id: 'sig-1', title: 'Authorized HR / Management Representative', subtitle: 'Date: ____ / ____ / ________' },
    { id: 'sig-2', title: 'Employee Acceptance & Signature', subtitle: 'Date: ____ / ____ / ________' },
  ],
};

export const DEFAULT_APPRAISAL_SIGNATURES: SignatureConfig = {
  layout: '3_col',
  signatures: [
    { id: 'appr-sig-1', title: 'Employee Acknowledgment & Signature', subtitle: 'Date: ____ / ____ / ________' },
    { id: 'appr-sig-2', title: 'Appraiser / Supervisor Signature', subtitle: 'Date: ____ / ____ / ________' },
    { id: 'appr-sig-3', title: 'Managing Director / HR Head Approval', subtitle: 'Date: ____ / ____ / ________' },
  ],
};

export const DEFAULT_JD_SECTIONS: DocumentSection[] = [
  {
    id: 'sec-jd-1',
    title: 'Position Overview & Organizational Context',
    type: 'text',
    enumeration: 'roman',
    text: 'This document defines the professional duties, responsibilities, and operational scope for the role of {ROLE_TITLE} within the {DEPARTMENT} Department at {COMPANY_NAME}. The designated employee is expected to uphold company standards, department protocols, and KPI targets.',
  },
  {
    id: 'sec-jd-2',
    title: 'Core Duties & Key Operational Responsibilities',
    type: 'duties_list',
    enumeration: 'roman',
    text: 'Below are the {KEY_DUTIES_COUNT} designated operational duties and responsibilities assigned to this role:',
  },
  {
    id: 'sec-jd-3',
    title: 'Employment Specifications & Performance Conditions',
    type: 'table',
    enumeration: 'roman',
    tableHeaders: ['Operational Parameter', 'Designated Specification & Value'],
    tableRows: [
      ['Designated Staff Member', '{STAFF_NAME} (ID: #{EMPLOYEE_ID})'],
      ['Department & Role Title', '{DEPARTMENT} • {ROLE_TITLE}'],
      ['Assigned Shift Schedule', '{SHIFT_SCHEDULE}'],
      ['Pay Grade & Monthly Base', '{PAY_GRADE} • {SALARY}'],
      ['Tenure & Effective Status', 'Active Formal Engagement (From {JOIN_DATE})'],
    ],
  },
  {
    id: 'sec-jd-4',
    title: 'Key Performance Indicators (KPI) & Reporting Alignment',
    type: 'text',
    enumeration: 'roman',
    text: 'Performance evaluations and monthly KPI scores are conducted against the {KEY_DUTIES_COUNT} core operational deliverables outlined in this document. The employee reports directly to the Department Lead and HR Management.',
    subsections: [
      {
        id: 'sub-jd-4-1',
        title: 'Review Cycle & Accountability',
        type: 'text',
        enumeration: 'numbers',
        text: 'Monthly performance reviews occur at the end of each billing cycle to ensure operational targets are achieved in accordance with organizational policies.',
      },
    ],
  },
];

export const DEFAULT_CONFIRMATION_SECTIONS: DocumentSection[] = [
  {
    id: 'sec-conf-1',
    title: 'Formal Confirmation of Permanent Employment',
    type: 'text',
    enumeration: 'roman',
    text: 'We are pleased to formally confirm your permanent employment appointment with {COMPANY_NAME} in the capacity of {ROLE_TITLE} within the {DEPARTMENT} Department, effective from {JOIN_DATE}. Having satisfactorily fulfilled the introductory assessment and operational requirements, your status is hereby fully confirmed.',
  },
  {
    id: 'sec-conf-2',
    title: 'Summary of Confirmed Terms & Remuneration',
    type: 'table',
    enumeration: 'roman',
    tableHeaders: ['Confirmed Parameter', 'Official Record Details'],
    tableRows: [
      ['Employee Full Name', '{STAFF_NAME}'],
      ['Official Employee ID', '#{EMPLOYEE_ID}'],
      ['Departmental Assignment', '{DEPARTMENT}'],
      ['Confirmed Role / Designation', '{ROLE_TITLE}'],
      ['Approved Monthly Base Salary', '{SALARY}'],
      ['Pay Grade Classification', '{PAY_GRADE}'],
      ['Designated Working Shift', '{SHIFT_SCHEDULE}'],
      ['Confirmation Effective Date', '{JOIN_DATE}'],
    ],
  },
  {
    id: 'sec-conf-3',
    title: 'Terms of Service & Operational Governance',
    type: 'text',
    enumeration: 'roman',
    text: 'In your confirmed capacity, you will continue to report to your Department Supervisor and remain bound by the terms and conditions outlined in the Employee Handbook, including confidentiality, workplace safety, attendance compliance, and code of conduct.',
    subsections: [
      {
        id: 'sub-conf-3-1',
        title: 'Benefits & Entitlements',
        type: 'text',
        enumeration: 'letters',
        text: 'As a confirmed staff member, you are entitled to statutory leave benefits, feeding allowances where applicable, and enrollment in the standard company healthcare and welfare programs.',
      },
      {
        id: 'sub-conf-3-2',
        title: 'Notice Period & Separation Terms',
        type: 'text',
        enumeration: 'letters',
        text: 'Either party may terminate this employment agreement by providing the statutory notice period as stipulated in your contract or salary in lieu thereof.',
      },
    ],
  },
  {
    id: 'sec-conf-4',
    title: 'Executive Endorsement & Next Steps',
    type: 'text',
    enumeration: 'roman',
    text: 'We congratulate you on this milestone and express our deep confidence in your continued professional contributions to {COMPANY_NAME}. Please sign the acknowledgement copy below and return to the Human Resources Department for your permanent file.',
  },
];

export const DEFAULT_APPOINTMENT_SECTIONS: DocumentSection[] = [
  {
    id: 'sec-app-1',
    title: 'Formal Offer of Employment Appointment',
    type: 'text',
    enumeration: 'roman',
    text: 'On behalf of {COMPANY_NAME}, we are pleased to formally offer you an appointment for the position of {ROLE_TITLE} in the {DEPARTMENT} Department, commencing on {JOIN_DATE}. This offer is subject to the verification of your credentials and references.',
  },
  {
    id: 'sec-app-2',
    title: 'Appointment Terms & Remuneration Structure',
    type: 'table',
    enumeration: 'roman',
    tableHeaders: ['Appointment Clause', 'Designated Terms'],
    tableRows: [
      ['Appointee Full Name', '{STAFF_NAME}'],
      ['Assigned Employee ID', '#{EMPLOYEE_ID}'],
      ['Appointed Position', '{ROLE_TITLE}'],
      ['Department', '{DEPARTMENT}'],
      ['Commencement Date', '{JOIN_DATE}'],
      ['Monthly Base Salary', '{SALARY}'],
      ['Pay Grade', '{PAY_GRADE}'],
      ['Standard Shift Roster', '{SHIFT_SCHEDULE}'],
    ],
  },
  {
    id: 'sec-app-3',
    title: 'Scope of Responsibilities & Reporting',
    type: 'duties_list',
    enumeration: 'roman',
    text: 'You will perform all operational responsibilities pertaining to your designated role as outlined in your official Job Description and report directly to the Department Lead:',
  },
  {
    id: 'sec-app-4',
    title: 'Probationary Period & Confirmation Standards',
    type: 'text',
    enumeration: 'roman',
    text: 'You will undergo an initial probationary period during which your performance, punctuality, and cultural alignment will be assessed. Upon successful completion, a formal letter of employment confirmation will be issued.',
    subsections: [
      {
        id: 'sub-app-4-1',
        title: 'Working Hours & Punctuality',
        type: 'text',
        enumeration: 'numbers',
        text: 'You are expected to adhere strictly to your assigned shift ({SHIFT_SCHEDULE}). Regular attendance tracking and biometric or log compliance will be maintained.',
      },
      {
        id: 'sub-app-4-2',
        title: 'Confidentiality & Non-Disclosure',
        type: 'text',
        enumeration: 'numbers',
        text: 'During and after your employment with {COMPANY_NAME}, you must keep confidential all proprietary trade secrets, business strategies, customer information, and financial data.',
      },
    ],
  },
  {
    id: 'sec-app-5',
    title: 'Acceptance of Appointment',
    type: 'text',
    enumeration: 'roman',
    text: 'If you accept this offer under the terms described above, please sign and return the duplicate copy of this letter within five (5) business days.',
  },
];

export const DEFAULT_OFFER_LETTER_SECTIONS: DocumentSection[] = [
  {
    id: 'sec-offer-1',
    title: 'Conditional Offer of Employment & Appointment Terms',
    type: 'text',
    enumeration: 'roman',
    text: 'On behalf of {COMPANY_NAME}, we are thrilled to extend this formal offer of employment to you for the position of {ROLE_TITLE} within the {DEPARTMENT} Department. Based on your impressive interview performance, track record, and technical credentials, we are confident in your capabilities to drive excellence in this role.',
  },
  {
    id: 'sec-offer-2',
    title: 'Key Terms of Employment & Compensation',
    type: 'table',
    enumeration: 'roman',
    tableHeaders: ['Employment Clause', 'Offered Specification & Terms'],
    tableRows: [
      ['Designated Candidate', '{STAFF_NAME}'],
      ['Position / Designation', '{ROLE_TITLE}'],
      ['Department Assignment', '{DEPARTMENT}'],
      ['Offered Monthly Salary', '{SALARY}'],
      ['Assigned Pay Grade', '{PAY_GRADE}'],
      ['Employment Classification', 'Full-time Permanent (Subject to Probation)'],
      ['Proposed Resumption Date', '{JOIN_DATE}'],
      ['Standard Shift Roster', '{SHIFT_SCHEDULE}'],
    ],
  },
  {
    id: 'sec-offer-3',
    title: 'Scope of Responsibilities & Role Mandate',
    type: 'duties_list',
    enumeration: 'roman',
    text: 'You will execute the core duties, deliverables, and operational standards assigned to the {ROLE_TITLE} role as outlined below and in your official Job Description:',
  },
  {
    id: 'sec-offer-4',
    title: 'Probationary Terms & Benefits Package',
    type: 'text',
    enumeration: 'roman',
    text: 'This appointment is subject to an introductory probationary period of three (3) months, during which performance milestones and workplace compliance will be assessed. Upon successful completion, a formal Confirmation Letter of Permanent Appointment will be issued.',
    subsections: [
      {
        id: 'sub-offer-4-1',
        title: 'Statutory Allowances & Healthcare',
        type: 'text',
        enumeration: 'letters',
        text: 'You are eligible for statutory leave entitlements, workplace amenities, and corporate welfare benefits in accordance with the {COMPANY_NAME} Employee Handbook.',
      },
      {
        id: 'sub-offer-4-2',
        title: 'Confidentiality & Code of Conduct',
        type: 'text',
        enumeration: 'letters',
        text: 'All company data, internal systems, trade secrets, and proprietary methodologies remain strictly confidential. You are required to uphold high standards of integrity and punctuality.',
      },
    ],
  },
  {
    id: 'sec-offer-5',
    title: 'Offer Acceptance & Response Protocol',
    type: 'text',
    enumeration: 'roman',
    text: 'To confirm your acceptance of this employment offer under the terms stated above, please sign the acknowledgment section below and return a scanned copy within five (5) business days. We eagerly anticipate welcoming you to the {COMPANY_NAME} team.',
  },
];

export const DEFAULT_APPRAISAL_SECTIONS: DocumentSection[] = [
  {
    id: 'sec-appr-1',
    title: 'Performance Appraisal Scope & Evaluation Framework',
    type: 'text',
    enumeration: 'roman',
    text: 'This official performance appraisal records the structured review for {STAFF_NAME} ({ROLE_TITLE} • {DEPARTMENT}) at {COMPANY_NAME}. Performance is evaluated across designated operational duties, measurable KPI targets, quality standards, and core organizational competencies. Standard scoring rubric: Very Good = 100% (Outstanding / Exceeds Target), Good = 80% (High Standard Delivery), OK = 60% (Meets Baseline Target), Bad = 40% (Below Expectations), Very Bad = 20% (Critical Deficiency).',
  },
  {
    id: 'sec-appr-2',
    title: 'Job Description Duties & Measurable Targets Matrix',
    type: 'jd_targets_table',
    enumeration: 'roman',
    dutyFilter: 'all',
    sortByWeight: false,
    tableHeaders: [
      'Job Description / Operational Duty',
      'Target / Performance Standard',
      'Evaluation Rating (Very Bad | Bad | OK | Good | Very Good)',
      'Score (%)',
      'Achievement & Remarks',
    ],
    text: 'Operational deliverables evaluated against agreed role standards, measurable targets, and core benchmarks:',
  },
  {
    id: 'sec-appr-3',
    title: 'Core Professional Competencies & Workplace Alignment',
    type: 'table',
    enumeration: 'roman',
    tableHeaders: ['Core Competency', 'Evaluation Standard', 'Performance Rating'],
    tableRows: [
      ['Operational Quality & Accuracy', 'Consistently delivers error-free work meeting organizational quality benchmarks', '[ ] Very Good  [ ] Good  [ ] OK  [ ] Bad  [ ] Very Bad'],
      ['Reliability & Ownership', 'Takes proactive ownership of deliverables and reliably meets scheduled milestones', '[ ] Very Good  [ ] Good  [ ] OK  [ ] Bad  [ ] Very Bad'],
      ['Collaboration & Teamwork', 'Communicates constructively and supports department colleagues and initiatives', '[ ] Very Good  [ ] Good  [ ] OK  [ ] Bad  [ ] Very Bad'],
      ['Punctuality & Shift Attendance', 'Complies strictly with assigned shift schedule ({SHIFT_SCHEDULE}) and attendance logs', '[ ] Very Good  [ ] Good  [ ] OK  [ ] Bad  [ ] Very Bad'],
      ['Innovation & Problem-Solving', 'Identifies process optimizations and actively solves operational challenges', '[ ] Very Good  [ ] Good  [ ] OK  [ ] Bad  [ ] Very Bad'],
    ],
  },
  {
    id: 'sec-appr-4',
    title: 'Development Objectives & Formal Recommendations',
    type: 'text',
    enumeration: 'roman',
    text: 'Comprehensive assessment of performance trends, growth areas, training needs, and supervisor recommendations for progression or merit adjustment.',
    subsections: [
      {
        id: 'sub-appr-4-1',
        title: 'Agreed Development & Capability Enhancement Actions',
        type: 'list',
        enumeration: 'numbers',
        heading: 'The appraiser and employee agree on the following key development actions:',
        listItems: [
          'Deepen technical proficiency in ATS workflows and core departmental productivity tools',
          'Maintain consistent minimum 95% target achievement across core weighted duties',
          'Participate in periodic departmental efficiency and safety seminars',
        ],
      },
      {
        id: 'sub-appr-4-2',
        title: 'Supervisor Final Recommendation',
        type: 'text',
        enumeration: 'numbers',
        text: 'Recommendation: [ ] Permanent Confirmation  [ ] Merit Salary Increment  [ ] Promotion / Grade Advance  [ ] Standard Progression  [ ] Performance Improvement Plan (PIP).',
      },
    ],
  },
];

export const getPrefix = (index: number, format?: EnumerationFormat, isSub = false): string => {
  if (format === 'none') return '';
  if (format === 'dots') return '• ';
  const i = index + 1;
  if (format === 'roman') {
    const r = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'][index] || `${i}`;
    return `${isSub ? r.toLowerCase() : r}. `;
  }
  if (format === 'letters') {
    const l = String.fromCharCode(96 + i);
    return `(${l}) `;
  }
  // default numbers
  return `${i}. `;
};

export const getListPrefix = (index: number, format?: ListEnumerationFormat): string => {
  if (format === 'dots') return '•';
  const i = index + 1;
  if (format === 'roman') {
    const r = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv'][index] || `${i}`;
    return `${r}.`;
  }
  if (format === 'letters') {
    const l = String.fromCharCode(96 + i);
    return `(${l})`;
  }
  // default numbers
  return `${i}.`;
};

/**
 * Returns the true organization name that the user email is assigned / registered to.
 * Ensures templates never display placeholders like "Registered Organization" or "Your Registered Company".
 */
export const getActiveOrganizationName = (settings?: AppSettings): string => {
  // 1. Explicitly configured company name in Settings
  if (
    settings?.companyName &&
    settings.companyName.trim() &&
    !settings.companyName.toLowerCase().includes('registered company') &&
    !settings.companyName.toLowerCase().includes('registered organization')
  ) {
    return settings.companyName.trim();
  }

  // 2. Active logged-in user session
  try {
    const sessionKeys = ['skima_user_session', 'taima_user_session', 'skima_current_user'];
    for (const key of sessionKeys) {
      const savedUser = localStorage.getItem(key);
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (
          u &&
          u.company &&
          u.company.trim() &&
          !u.company.toLowerCase().includes('registered organization') &&
          !u.company.toLowerCase().includes('registered company')
        ) {
          return u.company.trim();
        }
      }
    }
  } catch (e) {
    // ignore
  }

  // 3. Registered company users database
  try {
    const savedUsers =
      localStorage.getItem('skima_company_users_v4') ||
      localStorage.getItem('skima_company_users_v3');
    if (savedUsers) {
      const parsed = JSON.parse(savedUsers);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].company && parsed[0].company.trim()) {
        return parsed[0].company.trim();
      }
    }
  } catch (e) {
    // ignore
  }

  return 'My Organization';
};

/**
 * Looks up the assigned role, description, and list of duties for a given staff member.
 * Checks both explicit duty items and multi-line/sentence job descriptions.
 */
export const getStaffRoleDutiesInfo = (staff: Partial<StaffMember>, companyName?: string) => {
  let roleTitle = staff.role || 'Designated Role';
  let items: JobDescriptionItem[] = [];
  let jobDescription = '';
  let jobSummary = '';
  let reportsTo = '';
  let targets = '';
  let roleFound = false;

  try {
    const parsed = getCleanDepartments(companyName);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const staffDept = (staff.department || '').toLowerCase().trim();
      const staffRole = (staff.role || '').toLowerCase().trim();

      const dept = parsed.find(
        (d) => d.name.toLowerCase().trim() === staffDept || (d.code && d.code.toLowerCase().trim() === staffDept)
      );

      if (dept) {
        if (dept.headOfDepartment && dept.headOfDepartment.trim()) {
          reportsTo = dept.headOfDepartment.trim();
        }

        if (Array.isArray(dept.roles)) {
          const roleObj = dept.roles.find(
            (r) => r.title.toLowerCase().trim() === staffRole || r.id.toLowerCase() === staffRole
          );

          if (roleObj) {
            roleFound = true;
            roleTitle = roleObj.title;
            jobDescription = roleObj.jobDescription || '';
            jobSummary = (roleObj.summary && roleObj.summary.trim())
              ? roleObj.summary.trim()
              : (roleObj.jobDescription && roleObj.jobDescription.trim())
              ? roleObj.jobDescription.trim()
              : '';
            targets = (roleObj.targets && roleObj.targets.trim()) || '';

            if (roleObj.reportsTo && roleObj.reportsTo.trim()) {
              reportsTo = roleObj.reportsTo.trim();
            }

            if (roleObj.items && roleObj.items.length > 0) {
              items = roleObj.items
                .filter((it) => it.text && it.text.trim() !== '')
                .map((it) => ({
                  ...it,
                  target: (it.target && it.target.trim()) || targets || 'Execute operational targets with zero errors',
                  weight: it.weight !== undefined ? it.weight : (it.isKey ? 25 : 15),
                }));
            } else if (roleObj.jobDescription && roleObj.jobDescription.trim() !== '') {
              // Parse job description string into structured duty items
              const rawLines = roleObj.jobDescription
                .split(/\r?\n|•|;|\t/)
                .map((l) => l.trim().replace(/^[-*•\d.]\s*/, ''))
                .filter((l) => l.length > 0);

              if (rawLines.length > 0) {
                const defaultWeight = Math.round(100 / Math.max(1, rawLines.length));
                items = rawLines.map((line, idx) => ({
                  id: `item-parsed-${roleObj.id}-${idx}`,
                  text: line,
                  isKey: true,
                  target: targets || 'Achieve designated operational benchmark',
                  weight: defaultWeight,
                }));
              } else {
                items = [
                  {
                    id: `item-single-${roleObj.id}`,
                    text: roleObj.jobDescription.trim(),
                    isKey: true,
                    target: targets || 'Achieve designated operational benchmark',
                    weight: 100,
                  },
                ];
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error reading role duties from departments:', err);
  }

  // Calculate key vs normal duties and extract ATS key skills
  const keyItems = items.filter((it) => it.isKey);
  const normalItems = items.filter((it) => !it.isKey);
  const keyDutiesCount = keyItems.length > 0 ? keyItems.length : items.length;
  const allDutiesCount = items.length > 0 ? items.length : (keyItems.length + normalItems.length);

  const explicitSkills: string[] = [];
  items.forEach((it) => {
    if (it.keyword && it.keyword.trim()) {
      const parts = it.keyword.split(/[,;/|]+/).map((s) => s.trim()).filter(Boolean);
      explicitSkills.push(...parts);
    }
  });
  const skills = Array.from(new Set(explicitSkills));

  return {
    roleTitle,
    items,
    keyItems,
    normalItems,
    skills,
    targets: targets || 'Meet or exceed all defined operational and performance benchmarks.',
    keyDutiesCount,
    allDutiesCount,
    reportsTo: reportsTo || 'Department Lead',
    jobSummary: jobSummary || (jobDescription ? jobDescription : (items.length > 0 ? items.map((i) => i.text).join('; ') : 'Standard departmental deliverables and operational deliverables.')),
    jobDescription: jobDescription || (items.length > 0 ? items.map((i) => i.text).join('; ') : ''),
    roleFound,
  };
};

export const replaceDocumentTags = (
  text: string = '',
  staff: Partial<StaffMember> = {},
  companyName?: string,
  effectiveDateStr?: string
): string => {
  const resolvedCompany = (companyName && companyName.trim()) ? companyName.trim() : getActiveOrganizationName();
  const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const effDate = effectiveDateStr || (staff.joinDate ? new Date(staff.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : issueDate);
  const currencySymbol = getCompanyCurrencySymbol(resolvedCompany);
  const salaryStr = staff.estimatedMonthlySalary !== undefined && staff.estimatedMonthlySalary !== null
    ? `${currencySymbol}${Number(staff.estimatedMonthlySalary).toLocaleString()}/month`
    : 'Standard Grade Scale';

  const roleInfo = getStaffRoleDutiesInfo(staff, resolvedCompany);
  const keyCount = roleInfo.keyItems.length > 0 ? roleInfo.keyItems.length : roleInfo.items.filter((i) => i.isKey).length;
  const normalCount = roleInfo.normalItems.length > 0 ? roleInfo.normalItems.length : roleInfo.items.filter((i) => !i.isKey).length;
  const allDutiesCountVal = roleInfo.allDutiesCount || (keyCount + normalCount);
  const allDutiesCountStr = String(allDutiesCountVal);
  const keyDutiesCountStr = String(keyCount);
  const normalRolesCountStr = String(normalCount);

  // Generate clean salary summary from payslip data (Base + Statutory Deductions + Net, excluding transient fines/penalties)
  let salarySummaryStr = salaryStr;
  try {
    const pConfig = loadCompanyPayrollConfig(resolvedCompany);
    const baseSal = Number(staff.estimatedMonthlySalary) || 0;
    if (baseSal > 0) {
      let statutoryTotal = 0;
      const statutoryList: string[] = [];
      (pConfig.deductions || [])
        .filter((d) => isDeductionApplicableToStaff(d, staff))
        .sort((a, b) => (Number(b.weight) || 50) - (Number(a.weight) || 50))
        .forEach((d) => {
          const amt = d.type === 'percentage' ? (baseSal * d.value) / 100 : d.value;
          statutoryTotal += amt;
          statutoryList.push(`${d.name} (${d.type === 'percentage' ? `${d.value}%` : `${currencySymbol}${d.value}`})`);
        });

      let bonusTotal = 0;
      (pConfig.bonuses || []).filter((b) => b.isEnabled && (b.applicableTo === 'All' || b.applicableTo === staff.department)).forEach((b) => {
        const amt = b.type === 'percentage' ? (baseSal * b.value) / 100 : b.value;
        bonusTotal += amt;
      });

      const netRegular = Math.max(0, baseSal - statutoryTotal + bonusTotal);
      const freq = staff.payFrequency || pConfig.defaultPayFrequency || 'Monthly';
      
      const statutoryLabel = statutoryList.length > 0
        ? `Statutory Deductions: -${currencySymbol}${statutoryTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} [${statutoryList.join(', ')}]`
        : `Statutory Deductions: ${currencySymbol}0.00`;

      salarySummaryStr = `Base Salary: ${currencySymbol}${baseSal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ${statutoryLabel} | Net Regular Disbursal: ${currencySymbol}${netRegular.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${freq})`;
    }
  } catch (e) {
    salarySummaryStr = `${salaryStr} (Standard Remuneration)`;
  }

  return text
    .replace(/\{STAFF_NAME\}/gi, staff.name || 'Employee')
    .replace(/\{ROLE_TITLE\}/gi, staff.role || roleInfo.roleTitle || 'Designated Role')
    .replace(/\{DEPARTMENT\}/gi, staff.department || 'Operations')
    .replace(/\{EMPLOYEE_ID\}/gi, staff.employeeId || staff.id || 'N/A')
    .replace(/\{EMPLOYMENT_STATUS\}/gi, staff.status || 'Active')
    .replace(/\{STATUS\}/gi, staff.status || 'Active')
    .replace(/\{SALARY_SUMMARY\}/gi, salarySummaryStr)
    .replace(/\{SALARY\}/gi, salaryStr)
    .replace(/\{PAY_GRADE\}/gi, staff.payGrade || 'Standard Grade')
    .replace(/\{SHIFT_SCHEDULE\}/gi, staff.shiftSchedule || 'Standard Shift')
    .replace(/\{ALL_DUTIES_COUNT\}/gi, allDutiesCountStr)
    .replace(/\{ALL_ROLES_COUNT\}/gi, allDutiesCountStr)
    .replace(/\{KEY_DUTIES_COUNT\}/gi, keyDutiesCountStr)
    .replace(/\{DUTIES_COUNT\}/gi, keyDutiesCountStr)
    .replace(/\{NORMAL_ROLES_COUNT\}/gi, normalRolesCountStr)
    .replace(/\{NORMAL_DUTIES_COUNT\}/gi, normalRolesCountStr)
    .replace(/\{REPORTS[ _]?TO\}/gi, roleInfo.reportsTo || 'Direct Supervisor')
    .replace(/\{JOB_SUMMARY\}/gi, roleInfo.jobSummary || roleInfo.jobDescription || 'Standard departmental deliverables and KPIs.')
    .replace(/\{ROLE_SUMMARY\}/gi, roleInfo.jobSummary || roleInfo.jobDescription || 'Standard departmental deliverables and KPIs.')
    .replace(/\{TARGETS\}/gi, roleInfo.targets || 'Meet or exceed all defined operational targets.')
    .replace(/\{PERFORMANCE_TARGETS\}/gi, roleInfo.targets || 'Meet or exceed all defined operational targets.')
    .replace(/\{JOB_DESCRIPTION\}/gi, roleInfo.jobDescription || 'Standard departmental deliverables and KPIs.')
    .replace(/\{ROLE_DESCRIPTION\}/gi, roleInfo.jobDescription || 'Standard departmental deliverables and KPIs.')
    .replace(/\{KEY_DUTIES\}/gi, roleInfo.jobDescription || 'Standard departmental deliverables and KPIs.')
    .replace(/\{ROLE_SKILLS\}/gi, (roleInfo.skills && roleInfo.skills.length > 0) ? roleInfo.skills.join(', ') : 'Standard Departmental Competencies')
    .replace(/\{KEY_SKILLS\}/gi, (roleInfo.skills && roleInfo.skills.length > 0) ? roleInfo.skills.join(', ') : 'Standard Departmental Competencies')
    .replace(/\{EFFECTIVE_DATE\}/gi, effDate)
    .replace(/\{JOIN_DATE\}/gi, effDate)
    .replace(/\{DATE\}/gi, issueDate)
    .replace(/\{COMPANY_NAME\}/gi, resolvedCompany)
    .replace(/\{BANK_NAME\}/gi, staff.bankName || 'N/A')
    .replace(/\{ACCOUNT_NUMBER\}/gi, staff.accountNumber || 'N/A')
    .replace(/\{EMAIL\}/gi, staff.email || 'N/A')
    .replace(/\{PHONE\}/gi, staff.phone || 'N/A')
    .replace(/\{CHECKBOX\}/gi, '☐')
    .replace(/\{CHECKED_BOX\}/gi, '☑')
    .replace(/\{BALLOT_BOX\}/gi, '☐');
};
