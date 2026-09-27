import JSZip from 'jszip';
import {
  STORAGE_KEYS,
  loadCompanyData,
  saveCompanyData,
  getActiveCompanyId,
  getActiveSessionCompany,
  normalizeCompanyId,
} from './companyStorage';
import {
  StaffMember,
  ProjectFile,
  AppSettings,
  LeaveRequest,
  DepartmentInfo,
  DepartmentRole,
  JobDescriptionItem,
  User,
} from '../types';
import { getCleanDepartments, saveCleanDepartments } from './departmentUtils';
import {
  DEFAULT_JD_SECTIONS,
  DEFAULT_HEADER_META,
  DEFAULT_SIGNATURES,
  DEFAULT_CONFIRMATION_SECTIONS,
  DEFAULT_APPOINTMENT_SECTIONS,
} from './documentTemplates';
import { loadAllCompanyUsers, CompanyUserAccount } from './userManagement';
import { encryptPayload, decryptPayload, isEncryptedVault, EncryptedVaultEnvelope } from './cryptoVault';
import { getCompanyCurrencySymbol } from './payrollUtils';

export interface RoleCatalogEntry {
  id: string;
  title: string;
  department: string;
  departmentCode: string;
  headOfDepartment: string;
  reportsTo?: string;
  summary?: string;
  jobDescription: string;
  dutiesCount: number;
  keyDeliverables: string[];
  items: JobDescriptionItem[];
}

export interface DocumentTemplatesExport {
  jobDescriptionTemplate: {
    companyName?: string;
    documentTitle?: string;
    lineColor?: string;
    textColor?: string;
    hrSigLabel?: string;
    employeeSigLabel?: string;
    sections: any[];
    headerMeta: any;
    signatures: any;
  };
  confirmationLetterTemplate: {
    companyName?: string;
    documentTitle?: string;
    lineColor?: string;
    textColor?: string;
    hrSigLabel?: string;
    employeeSigLabel?: string;
    sections: any[];
    headerMeta: any;
    signatures: any;
  };
  appointmentLetterTemplate: {
    companyName?: string;
    documentTitle?: string;
    lineColor?: string;
    textColor?: string;
    hrSigLabel?: string;
    employeeSigLabel?: string;
    sections: any[];
    headerMeta: any;
    signatures: any;
  };
  savedShiftPresets?: any[];
  savedRosterTemplates?: any[];
  dailyShiftRosterHistory?: Record<string, any>;
  shifts?: any[];
}

export interface PortableDatabasePayload {
  _skima_portable_backup: true;
  version: string;
  exportedAt: string;
  datasets: {
    staff: StaffMember[];
    departments: DepartmentInfo[];
    roles?: RoleCatalogEntry[];
    templates?: DocumentTemplatesExport;
    projects: ProjectFile[];
    leaves: LeaveRequest[];
    settings: AppSettings | null;
    transfers: any[];
    staffHistory: Record<string, any[]>;
    kpiRatings: Record<string, Record<string, string>>;
    feeding: any;
    applicants?: any[];
    payroll?: any;
    suspensionLogs?: any[];
    bonuses?: any[];
    welfare?: any[];
    recurringOffs?: any[];
    logo?: string;
    users?: Partial<CompanyUserAccount>[];
  };
  summary: {
    totalStaff: number;
    totalProjects: number;
    totalDepartments: number;
    totalRoles: number;
    totalLeaves: number;
    totalTransfers: number;
    totalApplicants?: number;
  };
}

export interface RestoreResult {
  success: boolean;
  requiresPassword?: boolean;
  companyId?: string;
  companyName?: string;
  details?: string;
  error?: string;
}

/**
 * Builds the portable, company-agnostic database payload from the active company storage.
 */
export function buildPortableDatabasePayload(companyIdOrName?: string): PortableDatabasePayload {
  const companyId = getActiveCompanyId(companyIdOrName);

  const staff = loadCompanyData<StaffMember[]>(STORAGE_KEYS.STAFF, companyId, []);
  let rawDepartments = loadCompanyData<DepartmentInfo[]>(STORAGE_KEYS.DEPARTMENTS, companyId, []);
  if (!rawDepartments || rawDepartments.length === 0) {
    rawDepartments = getCleanDepartments(companyIdOrName || companyId);
  }

  // Deep-clean departments and guarantee every role has id, title, jobDescription, and items
  const departments: DepartmentInfo[] = (rawDepartments || []).map((dept) => {
    const roles: DepartmentRole[] = Array.isArray(dept.roles)
      ? dept.roles
          .filter((r) => r && (r.title || '').trim() !== '')
          .map((r, rIdx) => {
            const title = (r.title || '').trim();
            const items = Array.isArray(r.items)
              ? r.items
                  .filter((it) => it && it.text && it.text.trim() !== '')
                  .map((it, itIdx) => ({
                    id: it.id || `item-${rIdx}-${itIdx}`,
                    text: it.text.trim(),
                    keyword: (it.keyword || '').trim(),
                    isKey: !!it.isKey,
                  }))
              : [];
            const jobDescription =
              (r.jobDescription || '').trim() ||
              (items.length > 0 ? items.map((it) => it.text).join('; ') : `Core operational duties for ${title}`);
            return {
              ...r,
              id: r.id || `role-${Date.now()}-${rIdx}`,
              title,
              summary: (r.summary || '').trim(),
              reportsTo: (r.reportsTo || '').trim(),
              jobDescription,
              items,
            };
          })
      : [];
    return {
      ...dept,
      roles,
    };
  });

  // Extract comprehensive role and description catalog
  const roleCatalog: RoleCatalogEntry[] = [];
  const seenRoleKeys = new Set<string>();

  departments.forEach((dept) => {
    (dept.roles || []).forEach((r) => {
      const key = `${dept.name.trim().toLowerCase()}__${r.title.trim().toLowerCase()}`;
      if (!seenRoleKeys.has(key)) {
        seenRoleKeys.add(key);
        const keyDeliverables = (r.items || []).filter((it) => it.isKey).map((it) => it.text);
        roleCatalog.push({
          id: r.id || `role-${roleCatalog.length + 1}`,
          title: r.title,
          department: dept.name,
          departmentCode: dept.code || '',
          headOfDepartment: dept.headOfDepartment || 'Unassigned',
          reportsTo: r.reportsTo || dept.headOfDepartment || 'Unassigned',
          summary: r.summary || r.jobDescription || '',
          jobDescription: r.jobDescription || '',
          dutiesCount: (r.items || []).length,
          keyDeliverables,
          items: r.items || [],
        });
      }
    });
  });

  // Also ensure any unique roles from active staff are represented
  staff.forEach((s) => {
    const roleTitle = (s.role || '').trim();
    const deptName = (s.department || 'General').trim();
    if (roleTitle) {
      const key = `${deptName.toLowerCase()}__${roleTitle.toLowerCase()}`;
      if (!seenRoleKeys.has(key)) {
        seenRoleKeys.add(key);
        roleCatalog.push({
          id: `role-staff-${roleCatalog.length + 1}`,
          title: roleTitle,
          department: deptName,
          departmentCode: deptName.slice(0, 3).toUpperCase(),
          headOfDepartment: 'Unassigned',
          jobDescription: `Operational staff deliverables for ${roleTitle}`,
          dutiesCount: 1,
          keyDeliverables: [`Operational execution as ${roleTitle}`],
          items: [{ id: `item-${Date.now()}`, text: `Operational execution as ${roleTitle}`, isKey: true }],
        });
      }
    }
  });

  const projects = loadCompanyData<ProjectFile[]>(STORAGE_KEYS.PROJECTS, companyId, []);
  const leaves = loadCompanyData<LeaveRequest[]>(STORAGE_KEYS.LEAVES, companyId, []);
  const settings = loadCompanyData<AppSettings | null>(STORAGE_KEYS.SETTINGS, companyId, null);
  const transfers = loadCompanyData<any[]>(STORAGE_KEYS.TRANSFERS, companyId, []);
  const staffHistory = loadCompanyData<Record<string, any[]>>(STORAGE_KEYS.STAFF_HISTORY, companyId, {});
  const kpiRatings = loadCompanyData<Record<string, Record<string, string>>>(STORAGE_KEYS.KPI_RATINGS, companyId, {});
  const feeding = loadCompanyData<any>(STORAGE_KEYS.FEEDING, companyId, {});

  // Document templates export
  const documentTemplates: DocumentTemplatesExport = {
    jobDescriptionTemplate: {
      companyName: settings?.jdCompanyName || '',
      documentTitle: settings?.jdDocumentTitle || 'Job Description & Performance Expectations',
      lineColor: settings?.jdLineColor || '#0284c7',
      textColor: settings?.jdTextColor || '#0f172a',
      hrSigLabel: settings?.jdHrSigLabel || 'Authorized HR Representative',
      employeeSigLabel: settings?.jdEmployeeSigLabel || 'Employee Acknowledgment',
      sections: settings?.jdSections || DEFAULT_JD_SECTIONS,
      headerMeta: settings?.jdHeaderMeta || DEFAULT_HEADER_META,
      signatures: settings?.jdSignatures || DEFAULT_SIGNATURES,
    },
    confirmationLetterTemplate: {
      companyName: settings?.confirmationCompanyName || '',
      documentTitle: settings?.confirmationDocumentTitle || 'Employment Confirmation Letter',
      lineColor: settings?.confirmationLineColor || '#059669',
      textColor: settings?.confirmationTextColor || '#0f172a',
      hrSigLabel: settings?.confirmationHrSigLabel || 'Authorized HR Signatory',
      employeeSigLabel: settings?.confirmationEmployeeSigLabel || 'Employee Acceptance',
      sections: settings?.confirmationSections || DEFAULT_CONFIRMATION_SECTIONS,
      headerMeta: settings?.confirmationHeaderMeta || DEFAULT_HEADER_META,
      signatures: settings?.confirmationSignatures || DEFAULT_SIGNATURES,
    },
    appointmentLetterTemplate: {
      companyName: settings?.appointmentCompanyName || '',
      documentTitle: settings?.appointmentDocumentTitle || 'Letter of Appointment',
      lineColor: settings?.appointmentLineColor || '#2563eb',
      textColor: settings?.appointmentTextColor || '#0f172a',
      hrSigLabel: settings?.appointmentHrSigLabel || 'Authorized Human Resources Officer',
      employeeSigLabel: settings?.appointmentEmployeeSigLabel || 'Candidate Acceptance & Signature',
      sections: settings?.appointmentSections || DEFAULT_APPOINTMENT_SECTIONS,
      headerMeta: settings?.appointmentHeaderMeta || DEFAULT_HEADER_META,
      signatures: settings?.appointmentSignatures || DEFAULT_SIGNATURES,
    },
    savedShiftPresets: settings?.savedShiftPresets || [],
    savedRosterTemplates: settings?.savedRosterTemplates || [],
    dailyShiftRosterHistory: settings?.dailyShiftRosterHistory || {},
    shifts: settings?.shifts || [],
  };

  // Other savables
  const applicants = loadCompanyData<any[]>(STORAGE_KEYS.APPLICANTS, companyId, []);
  const payroll = loadCompanyData<any>(STORAGE_KEYS.PAYROLL, companyId, {});
  const suspensionLogs = loadCompanyData<any[]>(STORAGE_KEYS.SUSPENSION_LOGS, companyId, []);
  const bonuses = loadCompanyData<any[]>('skima_manual_staff_bonuses_v1', companyId, []);
  const welfare =
    loadCompanyData<any[]>('skima_staff_welfare_records', companyId, []) ||
    loadCompanyData<any[]>('skima_welfare_records_v1', companyId, []);
  const recurringOffs = loadCompanyData<any[]>('skima_recurring_offs_v1', companyId, []);
  const logo = loadCompanyData<string>('skima_company_logo_v1', companyId, '') || settings?.companyLogo || '';

  // Clean and sanitize any user credentials so only roles/names are exported
  const allUsers = loadAllCompanyUsers();
  const companyUsers = allUsers
    .filter((u) => u.companyId && normalizeCompanyId(u.companyId) === companyId)
    .map((u) => ({
      name: u.name,
      email: u.email,
      username: u.username,
      role: u.role,
    }));

  return {
    _skima_portable_backup: true,
    version: '5.0',
    exportedAt: new Date().toISOString(),
    datasets: {
      staff,
      departments,
      roles: roleCatalog,
      templates: documentTemplates,
      projects,
      leaves,
      settings,
      transfers,
      staffHistory,
      kpiRatings,
      feeding,
      applicants,
      payroll,
      suspensionLogs,
      bonuses,
      welfare,
      recurringOffs,
      logo,
      users: companyUsers,
    },
    summary: {
      totalStaff: staff.length,
      totalProjects: projects.length,
      totalDepartments: departments.length,
      totalRoles: roleCatalog.length,
      totalLeaves: leaves.length,
      totalTransfers: transfers.length,
      totalApplicants: applicants.length,
    },
  };
}

/**
 * Generates individual staff member attendance summary in CSV format.
 */
function generateStaffAttendanceCsv(staff: StaffMember, projects: ProjectFile[]): string {
  const rows: string[][] = [
    ['Month / Project', 'Day #', 'Date', 'Shift', 'Clock In', 'Clock Out', 'Total Hours', 'Status', 'Notes']
  ];

  const normId = (staff.employeeId || staff.id || '').trim().toLowerCase();
  const normName = (staff.name || '').trim().toLowerCase();

  projects.forEach((proj) => {
    if (!proj.records || proj.records.length === 0) return;
    const staffRecords = proj.records.filter((rec) => {
      const recId = (rec.employeeId || '').trim().toLowerCase();
      const recName = (rec.employeeName || '').trim().toLowerCase();
      return (recId && normId && recId === normId) || (recName && normName && recName === normName);
    });

    staffRecords.forEach((rec) => {
      rows.push([
        `"${(proj.name || '').replace(/"/g, '""')}"`,
        `${rec.dayNumber ?? 'N/A'}`,
        `"${rec.date || ''}"`,
        `"${rec.shift || staff.shiftSchedule || ''}"`,
        `"${rec.clockIn || '--:--'}"`,
        `"${rec.clockOut || '--:--'}"`,
        `${rec.totalHours ?? 0}`,
        `"${rec.status || 'N/A'}"`,
        `"${(rec.notes || '').replace(/"/g, '""')}"`
      ]);
    });
  });

  return rows.map((r) => r.join(',')).join('\n');
}

/**
 * Generates an individual staff member's text summary report.
 */
function generateStaffSummaryReport(
  staff: StaffMember,
  staffLeaves: LeaveRequest[],
  staffTransfers: any[],
  staffCustomLogs: any[]
): string {
  const divider = '='.repeat(70);
  const subDivider = '-'.repeat(70);

  const currSymbol = getCompanyCurrencySymbol(getActiveSessionCompany() || '');
  const lines: string[] = [
    divider,
    `SKIMA WORKFORCE INTELLIGENCE - EMPLOYEE DOSSIER`,
    divider,
    `Generated: ${new Date().toLocaleString()}`,
    `Employee Name: ${staff.name}`,
    `Staff / Employee ID: ${staff.employeeId || staff.id || 'N/A'}`,
    `Designation / Role: ${staff.role || 'N/A'}`,
    `Department: ${staff.department || 'General'}`,
    `Pay Grade / Tier: ${staff.payGrade || 'Standard'}`,
    `Shift Schedule: ${staff.shiftSchedule || 'Standard Morning'}`,
    `Employment Status: ${staff.status || 'Active'}`,
    `Estimated Monthly Salary: ${currSymbol}${(staff.estimatedMonthlySalary || 0).toLocaleString()}`,
    `Date Joined: ${staff.joinDate || 'N/A'}`,
    `Contact Phone: ${staff.phone || 'N/A'}`,
    `Contact Email: ${staff.email || 'N/A'}`,
    '',
    subDivider,
    `1. LEAVE & ABSENCE HISTORY (${staffLeaves.length} Records)`,
    subDivider,
  ];

  if (staffLeaves.length === 0) {
    lines.push('  No leave records recorded for this staff member.');
  } else {
    staffLeaves.forEach((l, idx) => {
      lines.push(
        `  [${idx + 1}] Type: ${l.leaveType} | Duration: ${l.startDate} to ${l.endDate} (${l.daysCount} days) | Status: ${l.status}`
      );
      if (l.reason) lines.push(`      Reason: ${l.reason}`);
    });
  }

  lines.push('');
  lines.push(subDivider);
  lines.push(`2. DEPARTMENT TRANSFER LOGS (${staffTransfers.length} Records)`);
  lines.push(subDivider);

  if (staffTransfers.length === 0) {
    lines.push('  No department transfer actions on record.');
  } else {
    staffTransfers.forEach((t, idx) => {
      lines.push(
        `  [${idx + 1}] Date: ${t.transferDate || t.date || 'N/A'} | From: ${t.fromDepartment} -> To: ${t.toDepartment} | Status: ${t.status || 'Completed'}`
      );
      if (t.reason) lines.push(`      Reason: ${t.reason}`);
    });
  }

  lines.push('');
  lines.push(subDivider);
  lines.push(`3. AUDIT NOTES & ACTIVITY TIMELINE (${staffCustomLogs.length} Entries)`);
  lines.push(subDivider);

  if (staffCustomLogs.length === 0) {
    lines.push('  No custom audit notes on record.');
  } else {
    staffCustomLogs.forEach((log, idx) => {
      lines.push(`  [${idx + 1}] ${log.date || ''} - ${log.title || 'Note'}: ${log.details || log.description || ''}`);
    });
  }

  lines.push('');
  lines.push(divider);
  lines.push('END OF EMPLOYEE DOSSIER');
  lines.push(divider);

  return lines.join('\n');
}

/**
 * Generates a clean, human-readable CSV export of all organizational roles and job descriptions.
 */
function generateRolesCsv(roles: RoleCatalogEntry[]): string {
  const headers = [
    'Role Title',
    'Department',
    'Department Code',
    'Head of Department',
    'Reports To',
    'Role Summary',
    'Total Duties Count',
    'Key ATS Keywords & Deliverables',
    'Full Job Description / Performance Expectations',
  ];
  const rows: string[][] = [headers];

  roles.forEach((r) => {
    const keyDeliverables = (r.keyDeliverables || []).join('; ');
    const keywords = (r.items || []).map((it) => it.keyword).filter(Boolean).join(', ');
    const allKeyPoints = [keywords, keyDeliverables].filter(Boolean).join(' | ');

    const fullDescription =
      (r.jobDescription || '').trim() ||
      (r.items && r.items.length > 0
        ? r.items.map((it, idx) => `${idx + 1}. ${it.text}`).join(' | ')
        : 'General departmental duties');

    rows.push([
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${(r.department || '').replace(/"/g, '""')}"`,
      `"${(r.departmentCode || '').replace(/"/g, '""')}"`,
      `"${(r.headOfDepartment || '').replace(/"/g, '""')}"`,
      `"${(r.reportsTo || r.headOfDepartment || 'Unassigned').replace(/"/g, '""')}"`,
      `"${(r.summary || r.jobDescription || '').replace(/"/g, '""')}"`,
      `${r.dutiesCount || (r.items ? r.items.length : 0)}`,
      `"${allKeyPoints.replace(/"/g, '""')}"`,
      `"${fullDescription.replace(/"/g, '""')}"`,
    ]);
  });

  return rows.map((row) => row.join(',')).join('\n');
}

/**
 * Generates an encrypted ZIP database archive protected with a user-provided one-time export password.
 */
export async function generateFullDatabaseArchiveZip(
  companyIdOrName?: string,
  exportPassword?: string
): Promise<{ blob: Blob; fileName: string }> {
  if (!exportPassword || exportPassword.trim().length === 0) {
    throw new Error('An export password is required to encrypt the database archive.');
  }

  const zip = new JSZip();
  const dbPayload = buildPortableDatabasePayload(companyIdOrName);

  // 1. Encrypt complete portable database with user's one-time export password
  const encryptedVault = await encryptPayload(dbPayload, exportPassword, 'skima_complete_database');
  zip.file('encrypted_database_vault.skm', JSON.stringify(encryptedVault, null, 2));

  // 2. Individual human-readable and system-parseable dataset files
  zip.file('roles_and_descriptions.json', JSON.stringify(dbPayload.datasets.roles || [], null, 2));
  zip.file('roles_and_descriptions.csv', generateRolesCsv(dbPayload.datasets.roles || []));
  zip.file('document_templates.json', JSON.stringify(dbPayload.datasets.templates || {}, null, 2));
  zip.file('departments.json', JSON.stringify(dbPayload.datasets.departments, null, 2));
  zip.file('staff_roster.json', JSON.stringify(dbPayload.datasets.staff, null, 2));
  zip.file('attendance_projects.json', JSON.stringify(dbPayload.datasets.projects, null, 2));
  zip.file('leaves_and_offs.json', JSON.stringify(dbPayload.datasets.leaves, null, 2));
  zip.file(
    'shifts_and_presets.json',
    JSON.stringify(
      {
        savedShiftPresets: dbPayload.datasets.templates?.savedShiftPresets || dbPayload.datasets.settings?.savedShiftPresets || [],
        savedRosterTemplates: dbPayload.datasets.templates?.savedRosterTemplates || dbPayload.datasets.settings?.savedRosterTemplates || [],
        dailyShiftRosterHistory: dbPayload.datasets.templates?.dailyShiftRosterHistory || dbPayload.datasets.settings?.dailyShiftRosterHistory || {},
        shifts: dbPayload.datasets.templates?.shifts || dbPayload.datasets.settings?.shifts || [],
      },
      null,
      2
    )
  );
  zip.file('department_transfers.json', JSON.stringify(dbPayload.datasets.transfers, null, 2));
  zip.file('feeding_schedule.json', JSON.stringify(dbPayload.datasets.feeding, null, 2));
  zip.file('kpi_ratings.json', JSON.stringify(dbPayload.datasets.kpiRatings, null, 2));
  zip.file('payroll_and_deductions.json', JSON.stringify(dbPayload.datasets.payroll || {}, null, 2));
  zip.file('applicants_and_recruitment.json', JSON.stringify(dbPayload.datasets.applicants || [], null, 2));
  zip.file('disciplinary_and_suspensions.json', JSON.stringify(dbPayload.datasets.suspensionLogs || [], null, 2));
  zip.file(
    'staff_welfare_and_bonuses.json',
    JSON.stringify(
      {
        bonuses: dbPayload.datasets.bonuses || [],
        welfare: dbPayload.datasets.welfare || [],
        recurringOffs: dbPayload.datasets.recurringOffs || [],
      },
      null,
      2
    )
  );
  zip.file('system_settings.json', JSON.stringify(dbPayload.datasets.settings, null, 2));
  zip.file('database_complete.json', JSON.stringify(dbPayload, null, 2));

  // 3. Readme file explaining how to restore with password
  const readmeText = `================================================================================
SKIMA WORKFORCE MANAGEMENT - COMPREHENSIVE DATABASE ARCHIVE
================================================================================
Export Timestamp: ${dbPayload.exportedAt}
Archive Format: Skima Secure Vault v5.0 (AES-GCM-256 + PBKDF2)

TOTAL DATASETS INCLUDED:
- Staff Members: ${dbPayload.summary.totalStaff}
- Departments: ${dbPayload.summary.totalDepartments}
- Roles & Job Descriptions: ${dbPayload.summary.totalRoles}
- Document Templates: Job Descriptions, Confirmation Letters, Appointment Letters
- Shift Presets & Rosters
- Attendance Projects & Sheets: ${dbPayload.summary.totalProjects}
- Approved & Pending Leaves: ${dbPayload.summary.totalLeaves}
- Department Transfer Audits: ${dbPayload.summary.totalTransfers}
- Cafeteria & Feeding Schedules
- Performance & Involvement KPI Ratings
- Payroll Configurations & Deductions
- Recruitment & Applicant Pipelines
- Disciplinary & Suspension Logs
- Staff Welfare & Bonus Records

HOW TO RESTORE THIS BACKUP:
1. Open the Skima Workforce Management web app on any device.
2. Log into your company account (or create a new organization account).
3. Go to System Settings -> "Organizational Full Database Backup & Archive Restore".
4. Click "Restore Backup" and select this .zip file.
5. Enter the one-time export password you created when downloading this file.
6. The Universal Restore Engine will decrypt all records (Staff, Departments,
   Roles & Job Descriptions, Document Templates, Attendance, Leaves, Shifts,
   Feeding, Settings) directly into your active workspace.

SECURITY & COMPATIBILITY NOTICE:
- All sensitive organizational data in 'encrypted_database_vault.skm' is protected
  with military-grade AES-GCM 256-bit encryption.
- This archive is company-name and tenant-ID agnostic, meaning it can be cleanly
  restored even after organizational name changes or workspace recreations.
================================================================================
`;
  zip.file('READ_ME_SKIMA_RESTORE.txt', readmeText);

  // 4. Manifest file with non-sensitive archive metadata
  const manifest = {
    archiveType: 'SKIMA_ENCRYPTED_PORTABLE_ARCHIVE',
    version: '5.0',
    encryption: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    exportedAt: dbPayload.exportedAt,
    datasetsIncluded: [
      'encrypted_database_vault.skm',
      'roles_and_descriptions.json',
      'roles_and_descriptions.csv',
      'document_templates.json',
      'staff_roster.json',
      'departments.json',
      'attendance_projects.json',
      'leaves_and_offs.json',
      'shifts_and_presets.json',
      'department_transfers.json',
      'feeding_schedule.json',
      'kpi_ratings.json',
      'payroll_and_deductions.json',
      'applicants_and_recruitment.json',
      'disciplinary_and_suspensions.json',
      'staff_welfare_and_bonuses.json',
      'system_settings.json',
      'database_complete.json',
      'staff_logs/',
    ],
    summary: dbPayload.summary,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // 5. Also include individual unencrypted staff dossiers and inspection reports for HR viewing convenience
  const staffLogsFolder = zip.folder('staff_logs');
  if (staffLogsFolder) {
    dbPayload.datasets.staff.forEach((staff) => {
      const rawStaffId = staff.employeeId || staff.id || 'STAFF_UNKNOWN';
      const cleanFolderId = rawStaffId.replace(/[/\\?%*:|"<>]/g, '_');
      const singleStaffFolder = staffLogsFolder.folder(cleanFolderId);

      if (singleStaffFolder) {
        // Individual staff attendance CSV
        const attendanceCsv = generateStaffAttendanceCsv(staff, dbPayload.datasets.projects);
        singleStaffFolder.file('attendance_summary.csv', attendanceCsv);

        // Staff specific leaves
        const normId = (staff.employeeId || staff.id || '').trim().toLowerCase();
        const normName = (staff.name || '').trim().toLowerCase();

        const staffLeaves = dbPayload.datasets.leaves.filter((l) => {
          const lId = (l.employeeId || '').trim().toLowerCase();
          const lName = (l.employeeName || '').trim().toLowerCase();
          return (lId && normId && lId === normId) || (lName && normName && lName === normName);
        });

        // Staff specific transfers
        const staffTransfers = dbPayload.datasets.transfers.filter((t) => {
          const tId = (t.employeeId || t.staffId || '').trim().toLowerCase();
          const tName = (t.staffName || '').trim().toLowerCase();
          return (tId && normId && tId === normId) || (tName && normName && tName === normName);
        });

        const staffKey = staff.employeeId || staff.id;
        const staffCustomLogs = dbPayload.datasets.staffHistory[staffKey] || [];

        // Comprehensive Text Report
        const reportTxt = generateStaffSummaryReport(staff, staffLeaves, staffTransfers, staffCustomLogs);
        singleStaffFolder.file('staff_summary_report.txt', reportTxt);
      }
    });
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `Skima_Secure_Database_Backup_${dateStr}.zip`;
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return { blob, fileName };
}

/**
 * Universal Restore Engine:
 * Accepts .zip, .skm, or .json backup files, decrypts using the provided password if encrypted,
 * and seamlessly restores all datasets into the current active company workspace.
 */
export async function restoreUniversalBackup(
  file: File,
  decryptionPassword?: string,
  targetCompanyId?: string,
  targetCompanyName?: string
): Promise<RestoreResult> {
  try {
    const isZip =
      file.name.toLowerCase().endsWith('.zip') ||
      file.type === 'application/zip' ||
      file.type === 'application/x-zip-compressed';

    let payload: PortableDatabasePayload | null = null;
    let fileIsEncrypted = false;
    let rawVaultContent: string | null = null;

    if (isZip) {
      const zip = await JSZip.loadAsync(file);

      // Check for encrypted vault file first
      const vaultFile = zip.file('encrypted_database_vault.skm');
      if (vaultFile) {
        fileIsEncrypted = true;
        rawVaultContent = await vaultFile.async('text');
      } else {
        // Check for complete json or rebuild from individual files
        const completeFile = zip.file('database_complete.json');
        if (completeFile) {
          const text = await completeFile.async('text');
          if (isEncryptedVault(text)) {
            fileIsEncrypted = true;
            rawVaultContent = text;
          } else {
            payload = JSON.parse(text);
          }
        } else {
          // Rebuild from individual files inside the archive if available
          const staffFile = zip.file('staff_roster.json');
          const deptsFile = zip.file('departments.json');
          const rolesFile = zip.file('roles_and_descriptions.json');
          const templatesFile = zip.file('document_templates.json');
          const projectsFile = zip.file('attendance_projects.json');
          const leavesFile = zip.file('leaves_and_offs.json');
          const settingsFile = zip.file('system_settings.json');
          const transfersFile = zip.file('department_transfers.json');
          const feedingFile = zip.file('feeding_schedule.json');
          const kpiFile = zip.file('kpi_ratings.json');
          const payrollFile = zip.file('payroll_and_deductions.json');
          const applicantsFile = zip.file('applicants_and_recruitment.json');
          const suspensionFile = zip.file('disciplinary_and_suspensions.json');
          const welfareFile = zip.file('staff_welfare_and_bonuses.json');

          const loadedStaff = staffFile ? JSON.parse(await staffFile.async('text')) : [];
          const loadedDepts = deptsFile ? JSON.parse(await deptsFile.async('text')) : [];
          const loadedRoles = rolesFile ? JSON.parse(await rolesFile.async('text')) : [];
          const loadedTemplates = templatesFile ? JSON.parse(await templatesFile.async('text')) : undefined;
          const loadedProjects = projectsFile ? JSON.parse(await projectsFile.async('text')) : [];
          const loadedLeaves = leavesFile ? JSON.parse(await leavesFile.async('text')) : [];
          const loadedSettings = settingsFile ? JSON.parse(await settingsFile.async('text')) : null;
          const loadedTransfers = transfersFile ? JSON.parse(await transfersFile.async('text')) : [];
          const loadedFeeding = feedingFile ? JSON.parse(await feedingFile.async('text')) : {};
          const loadedKpi = kpiFile ? JSON.parse(await kpiFile.async('text')) : {};
          const loadedPayroll = payrollFile ? JSON.parse(await payrollFile.async('text')) : {};
          const loadedApplicants = applicantsFile ? JSON.parse(await applicantsFile.async('text')) : [];
          const loadedSuspensions = suspensionFile ? JSON.parse(await suspensionFile.async('text')) : [];
          const loadedWelfare = welfareFile ? JSON.parse(await welfareFile.async('text')) : {};

          payload = {
            _skima_portable_backup: true,
            version: '5.0',
            exportedAt: new Date().toISOString(),
            datasets: {
              staff: loadedStaff,
              departments: loadedDepts,
              roles: loadedRoles,
              templates: loadedTemplates,
              projects: loadedProjects,
              leaves: loadedLeaves,
              settings: loadedSettings,
              transfers: loadedTransfers,
              staffHistory: {},
              kpiRatings: loadedKpi,
              feeding: loadedFeeding,
              applicants: loadedApplicants,
              payroll: loadedPayroll,
              suspensionLogs: loadedSuspensions,
              bonuses: loadedWelfare.bonuses || [],
              welfare: loadedWelfare.welfare || [],
              recurringOffs: loadedWelfare.recurringOffs || [],
            },
            summary: {
              totalStaff: loadedStaff.length,
              totalProjects: loadedProjects.length,
              totalDepartments: loadedDepts.length,
              totalRoles: loadedRoles.length,
              totalLeaves: loadedLeaves.length,
              totalTransfers: loadedTransfers.length,
              totalApplicants: loadedApplicants.length,
            },
          };
        }
      }
    } else {
      // .json or .skm file
      const text = await file.text();
      if (isEncryptedVault(text)) {
        fileIsEncrypted = true;
        rawVaultContent = text;
      } else {
        payload = JSON.parse(text);
      }
    }

    // If file is encrypted, we require the decryption password
    if (fileIsEncrypted && rawVaultContent) {
      if (!decryptionPassword || decryptionPassword.trim().length === 0) {
        return {
          success: false,
          requiresPassword: true,
          error: 'This backup is encrypted. Please provide the export password set on this archive.',
        };
      }

      try {
        payload = await decryptPayload<PortableDatabasePayload>(rawVaultContent, decryptionPassword);
      } catch (decryptErr: any) {
        return {
          success: false,
          requiresPassword: true,
          error: decryptErr.message || 'Incorrect decryption password. Verification failed.',
        };
      }
    }

    if (!payload || !payload.datasets) {
      return {
        success: false,
        error: 'Backup archive contains no valid Skima datasets or could not be parsed.',
      };
    }

    // Determine target company space (active user workspace)
    const activeCompanyId = targetCompanyId || getActiveCompanyId();
    const activeCompanyName = targetCompanyName || getActiveSessionCompany() || activeCompanyId;

    const { datasets } = payload;

    // 1. Restore staff
    if (datasets.staff !== undefined) {
      saveCompanyData(STORAGE_KEYS.STAFF, datasets.staff, activeCompanyId);
    }

    // 2. Restore departments and deep-merge roles & job descriptions
    if (datasets.departments !== undefined) {
      let deptsToSave = datasets.departments;
      if (Array.isArray(datasets.roles) && datasets.roles.length > 0) {
        const deptMap = new Map<string, DepartmentInfo>();
        deptsToSave.forEach((d) => deptMap.set(d.name.toLowerCase().trim(), { ...d }));

        datasets.roles.forEach((r) => {
          const deptKey = (r.department || 'General').toLowerCase().trim();
          let dept = deptMap.get(deptKey);
          if (!dept) {
            dept = {
              id: `dept-${Date.now()}-${deptMap.size + 1}`,
              name: r.department || 'General',
              code: r.departmentCode || (r.department || 'GEN').slice(0, 3).toUpperCase(),
              headOfDepartment: r.headOfDepartment || 'Unassigned',
              description: `Department for ${r.department || 'General'}`,
              roles: [],
            };
            deptMap.set(deptKey, dept);
          }
          const roles = dept.roles || [];
          const existingIdx = roles.findIndex((er) => (er.title || '').toLowerCase().trim() === (r.title || '').toLowerCase().trim());
          if (existingIdx === -1) {
            roles.push({
              id: r.id || `role-${Date.now()}-${roles.length}`,
              title: r.title,
              summary: r.summary || r.jobDescription || '',
              reportsTo: r.reportsTo || '',
              jobDescription: r.jobDescription || '',
              items: r.items || [],
            });
            dept.roles = roles;
          } else {
            roles[existingIdx] = {
              ...roles[existingIdx],
              summary: r.summary || roles[existingIdx].summary || '',
              reportsTo: r.reportsTo || roles[existingIdx].reportsTo || '',
              jobDescription: r.jobDescription || roles[existingIdx].jobDescription || '',
            };
          }
        });
        deptsToSave = Array.from(deptMap.values());
      }
      saveCleanDepartments(deptsToSave, activeCompanyId);
    }

    // 3. Restore templates & system settings
    if (datasets.settings !== undefined && datasets.settings !== null) {
      let finalSettings: AppSettings = { ...datasets.settings };
      if (datasets.templates) {
        finalSettings = {
          ...finalSettings,
          jdSections: datasets.templates.jobDescriptionTemplate?.sections || finalSettings.jdSections,
          jdHeaderMeta: datasets.templates.jobDescriptionTemplate?.headerMeta || finalSettings.jdHeaderMeta,
          jdSignatures: datasets.templates.jobDescriptionTemplate?.signatures || finalSettings.jdSignatures,
          jdCompanyName: datasets.templates.jobDescriptionTemplate?.companyName || finalSettings.jdCompanyName,
          jdDocumentTitle: datasets.templates.jobDescriptionTemplate?.documentTitle || finalSettings.jdDocumentTitle,
          jdLineColor: datasets.templates.jobDescriptionTemplate?.lineColor || finalSettings.jdLineColor,
          jdTextColor: datasets.templates.jobDescriptionTemplate?.textColor || finalSettings.jdTextColor,
          jdHrSigLabel: datasets.templates.jobDescriptionTemplate?.hrSigLabel || finalSettings.jdHrSigLabel,
          jdEmployeeSigLabel: datasets.templates.jobDescriptionTemplate?.employeeSigLabel || finalSettings.jdEmployeeSigLabel,

          confirmationSections: datasets.templates.confirmationLetterTemplate?.sections || finalSettings.confirmationSections,
          confirmationHeaderMeta: datasets.templates.confirmationLetterTemplate?.headerMeta || finalSettings.confirmationHeaderMeta,
          confirmationSignatures: datasets.templates.confirmationLetterTemplate?.signatures || finalSettings.confirmationSignatures,
          confirmationCompanyName: datasets.templates.confirmationLetterTemplate?.companyName || finalSettings.confirmationCompanyName,
          confirmationDocumentTitle: datasets.templates.confirmationLetterTemplate?.documentTitle || finalSettings.confirmationDocumentTitle,
          confirmationLineColor: datasets.templates.confirmationLetterTemplate?.lineColor || finalSettings.confirmationLineColor,
          confirmationTextColor: datasets.templates.confirmationLetterTemplate?.textColor || finalSettings.confirmationTextColor,
          confirmationHrSigLabel: datasets.templates.confirmationLetterTemplate?.hrSigLabel || finalSettings.confirmationHrSigLabel,
          confirmationEmployeeSigLabel: datasets.templates.confirmationLetterTemplate?.employeeSigLabel || finalSettings.confirmationEmployeeSigLabel,

          appointmentSections: datasets.templates.appointmentLetterTemplate?.sections || finalSettings.appointmentSections,
          appointmentHeaderMeta: datasets.templates.appointmentLetterTemplate?.headerMeta || finalSettings.appointmentHeaderMeta,
          appointmentSignatures: datasets.templates.appointmentLetterTemplate?.signatures || finalSettings.appointmentSignatures,
          appointmentCompanyName: datasets.templates.appointmentLetterTemplate?.companyName || finalSettings.appointmentCompanyName,
          appointmentDocumentTitle: datasets.templates.appointmentLetterTemplate?.documentTitle || finalSettings.appointmentDocumentTitle,
          appointmentLineColor: datasets.templates.appointmentLetterTemplate?.lineColor || finalSettings.appointmentLineColor,
          appointmentTextColor: datasets.templates.appointmentLetterTemplate?.textColor || finalSettings.appointmentTextColor,
          appointmentHrSigLabel: datasets.templates.appointmentLetterTemplate?.hrSigLabel || finalSettings.appointmentHrSigLabel,
          appointmentEmployeeSigLabel: datasets.templates.appointmentLetterTemplate?.employeeSigLabel || finalSettings.appointmentEmployeeSigLabel,

          savedShiftPresets: datasets.templates?.savedShiftPresets || finalSettings.savedShiftPresets,
          savedRosterTemplates: datasets.templates?.savedRosterTemplates || finalSettings.savedRosterTemplates,
          dailyShiftRosterHistory: datasets.templates?.dailyShiftRosterHistory || finalSettings.dailyShiftRosterHistory,
          shifts: datasets.templates?.shifts || finalSettings.shifts,
        };
      }
      saveCompanyData(STORAGE_KEYS.SETTINGS, finalSettings, activeCompanyId);
    }

    // 4. Restore attendance projects & leaves
    if (datasets.projects !== undefined) saveCompanyData(STORAGE_KEYS.PROJECTS, datasets.projects, activeCompanyId);
    if (datasets.leaves !== undefined) saveCompanyData(STORAGE_KEYS.LEAVES, datasets.leaves, activeCompanyId);
    if (datasets.transfers !== undefined) saveCompanyData(STORAGE_KEYS.TRANSFERS, datasets.transfers, activeCompanyId);
    if (datasets.staffHistory !== undefined) saveCompanyData(STORAGE_KEYS.STAFF_HISTORY, datasets.staffHistory, activeCompanyId);
    if (datasets.kpiRatings !== undefined) saveCompanyData(STORAGE_KEYS.KPI_RATINGS, datasets.kpiRatings, activeCompanyId);
    if (datasets.feeding !== undefined) saveCompanyData(STORAGE_KEYS.FEEDING, datasets.feeding, activeCompanyId);

    // 5. Restore additional savables
    if (datasets.applicants !== undefined) saveCompanyData(STORAGE_KEYS.APPLICANTS, datasets.applicants, activeCompanyId);
    if (datasets.payroll !== undefined) saveCompanyData(STORAGE_KEYS.PAYROLL, datasets.payroll, activeCompanyId);
    if (datasets.suspensionLogs !== undefined) saveCompanyData(STORAGE_KEYS.SUSPENSION_LOGS, datasets.suspensionLogs, activeCompanyId);
    if (datasets.bonuses !== undefined) saveCompanyData('skima_manual_staff_bonuses_v1', datasets.bonuses, activeCompanyId);
    if (datasets.welfare !== undefined) {
      saveCompanyData('skima_staff_welfare_records', datasets.welfare, activeCompanyId);
      saveCompanyData('skima_welfare_records_v1', datasets.welfare, activeCompanyId);
    }
    if (datasets.recurringOffs !== undefined) saveCompanyData('skima_recurring_offs_v1', datasets.recurringOffs, activeCompanyId);
    if (datasets.logo) saveCompanyData('skima_company_logo_v1', datasets.logo, activeCompanyId);

    const rolesCount = datasets.roles?.length || 0;
    const deptsCount = datasets.departments?.length || 0;
    const staffCount = datasets.staff?.length || 0;
    const projectsCount = datasets.projects?.length || 0;

    const details = `Successfully restored ${staffCount} staff, ${deptsCount} departments (${rolesCount} roles & job descriptions), custom document templates, ${projectsCount} attendance worksheets, and all organizational records into ${activeCompanyName} (${activeCompanyId})!`;

    return {
      success: true,
      companyId: activeCompanyId,
      companyName: activeCompanyName,
      details,
    };
  } catch (err: any) {
    console.error('Error during universal backup restore:', err);
    return {
      success: false,
      error: err.message || 'Corrupted or unsupported archive file format.',
    };
  }
}
