import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileCheck,
  Table,
  Info,
  Building2,
  Clock,
  CreditCard,
  Users,
  ArrowRight,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { StaffMember, AppSettings, DynamicShift, DepartmentInfo } from '../types';
import {
  loadCompanyPayrollConfig,
  saveCompanyPayrollConfig,
  derivePayGradeFromSalary,
} from '../utils/payrollUtils';
import { getActiveSessionCompany } from '../utils/companyStorage';
import { getCleanDepartments, saveCleanDepartments } from '../utils/departmentUtils';
import { emitGlobalToast } from '../context/ToastContext';

export type UploadModalMode = 'scheme' | 'active' | 'suspended' | 'exited';

interface DetectedNewEntities {
  departments: { name: string; roles: string[] }[];
  shifts: string[];
  payGrades: string[];
  activeCount: number;
  suspendedCount: number;
  exitedCount: number;
}

interface StaffUploadGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportStaff: (staffList: StaffMember[]) => void;
  existingStaffList?: StaffMember[];
  mode?: UploadModalMode;
  settings?: AppSettings;
  onSaveSettings?: (settings: AppSettings) => void;
  companyName?: string;
}

export const StaffUploadGuideModal: React.FC<StaffUploadGuideModalProps> = ({
  isOpen,
  onClose,
  onImportStaff,
  existingStaffList = [],
  mode = 'scheme',
  settings,
  onSaveSettings,
  companyName,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'guide'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<StaffMember[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [restrictedNotice, setRestrictedNotice] = useState<string | null>(null);
  const [detectedEntities, setDetectedEntities] = useState<DetectedNewEntities | null>(null);
  const [showConfigWarning, setShowConfigWarning] = useState<boolean>(false);

  if (!isOpen) return null;

  const effectiveCompanyName = companyName || getActiveSessionCompany() || 'Rheivatech';

  // Standard 17-column templates tailored by upload mode
  const getSampleTemplateData = () => {
    if (mode === 'suspended') {
      return [
        {
          'Employee ID': 'SKM-103',
          'Full Name': 'Amina Diallo',
          Department: 'Human Resources',
          'Role / Designation': 'HR Officer',
          'Email Address': 'amina.d@company.com',
          'Phone Number': '+1 555-017-4432',
          'Pay Grade': 'Grade L4',
          'Estimated Monthly Salary ($)': 4200,
          'Shift Schedule': 'Morning',
          'Bank Name': 'Chase Bank',
          'Account Number': '9876543210',
          'Employment Status': 'Suspended',
          'Join Date': '2023-04-12',
          'Exit Date': '',
          'Exit Reason': '',
          'Suspension End Time': '2026-10-15',
          'Suspension Reason / Reference': 'Internal Compliance Review pending investigation',
        },
        {
          'Employee ID': 'SKM-105',
          'Full Name': 'Michael Torres',
          Department: 'Operations',
          'Role / Designation': 'Site Inspector',
          'Email Address': 'michael.t@company.com',
          'Phone Number': '+1 555-014-9988',
          'Pay Grade': 'Grade L2',
          'Estimated Monthly Salary ($)': 3100,
          'Shift Schedule': 'Night',
          'Bank Name': 'Wells Fargo',
          'Account Number': '1122334455',
          'Employment Status': 'Suspended',
          'Join Date': '2024-01-10',
          'Exit Date': '',
          'Exit Reason': '',
          'Suspension End Time': '2026-09-30',
          'Suspension Reason / Reference': 'Repeated unexcused late attendance (3rd query)',
        },
      ];
    }

    if (mode === 'exited') {
      return [
        {
          'Employee ID': 'SKM-104',
          'Full Name': 'Marcus Vance',
          Department: 'Operations',
          'Role / Designation': 'Shift Operations Lead',
          'Email Address': 'marcus.v@company.com',
          'Phone Number': '+1 555-016-8844',
          'Pay Grade': 'Grade L3',
          'Estimated Monthly Salary ($)': 3500,
          'Shift Schedule': 'Night',
          'Bank Name': 'Bank of America',
          'Account Number': '4455667788',
          'Employment Status': 'Exited',
          'Join Date': '2022-08-01',
          'Exit Date': '2026-07-31',
          'Exit Reason': 'Voluntary Resignation — Relocation abroad',
          'Suspension End Time': '',
          'Suspension Reason / Reference': '',
        },
        {
          'Employee ID': 'SKM-106',
          'Full Name': 'Elena Rostova',
          Department: 'Engineering',
          'Role / Designation': 'QA Automation Engineer',
          'Email Address': 'elena.r@company.com',
          'Phone Number': '+1 555-019-3322',
          'Pay Grade': 'Grade L3',
          'Estimated Monthly Salary ($)': 3900,
          'Shift Schedule': 'Morning',
          'Bank Name': 'Citibank',
          'Account Number': '5566778899',
          'Employment Status': 'Exited',
          'Join Date': '2023-02-15',
          'Exit Date': '2026-06-30',
          'Exit Reason': 'End of Fixed-Term Project Contract',
          'Suspension End Time': '',
          'Suspension Reason / Reference': '',
        },
      ];
    }

    if (mode === 'active') {
      return [
        {
          'Employee ID': 'SKM-101',
          'Full Name': 'Sarah Jenkins',
          Department: 'Engineering',
          'Role / Designation': 'Lead Software Architect',
          'Email Address': 'sarah.j@company.com',
          'Phone Number': '+1 555-019-2834',
          'Pay Grade': 'Grade L5',
          'Estimated Monthly Salary ($)': 5500,
          'Shift Schedule': 'Morning',
          'Bank Name': 'Chase Bank',
          'Account Number': '1234567890',
          'Employment Status': 'Active',
          'Join Date': '2022-01-15',
          'Exit Date': '',
          'Exit Reason': '',
          'Suspension End Time': '',
          'Suspension Reason / Reference': '',
        },
        {
          'Employee ID': 'SKM-102',
          'Full Name': 'David Chen',
          Department: 'Engineering',
          'Role / Designation': 'Frontend Developer',
          'Email Address': 'david.c@company.com',
          'Phone Number': '+1 555-018-9921',
          'Pay Grade': 'Grade L3',
          'Estimated Monthly Salary ($)': 3800,
          'Shift Schedule': 'Morning',
          'Bank Name': 'Wells Fargo',
          'Account Number': '2345678901',
          'Employment Status': 'Active',
          'Join Date': '2023-06-01',
          'Exit Date': '',
          'Exit Reason': '',
          'Suspension End Time': '',
          'Suspension Reason / Reference': '',
        },
      ];
    }

    // Default 'scheme' mode template containing full organizational scheme
    return [
      {
        'Employee ID': 'SKM-101',
        'Full Name': 'Sarah Jenkins',
        Department: 'Engineering',
        'Role / Designation': 'Lead Software Architect',
        'Email Address': 'sarah.j@company.com',
        'Phone Number': '+1 555-019-2834',
        'Pay Grade': 'Grade L5',
        'Estimated Monthly Salary ($)': 5500,
        'Shift Schedule': 'Morning',
        'Bank Name': 'Chase Bank',
        'Account Number': '1234567890',
        'Employment Status': 'Active',
        'Join Date': '2022-01-15',
        'Exit Date': '',
        'Exit Reason': '',
        'Suspension End Time': '',
        'Suspension Reason / Reference': '',
      },
      {
        'Employee ID': 'SKM-102',
        'Full Name': 'David Chen',
        Department: 'Engineering',
        'Role / Designation': 'Frontend Developer',
        'Email Address': 'david.c@company.com',
        'Phone Number': '+1 555-018-9921',
        'Pay Grade': 'Grade L3',
        'Estimated Monthly Salary ($)': 3800,
        'Shift Schedule': 'Morning',
        'Bank Name': 'Wells Fargo',
        'Account Number': '2345678901',
        'Employment Status': 'Active',
        'Join Date': '2023-06-01',
        'Exit Date': '',
        'Exit Reason': '',
        'Suspension End Time': '',
        'Suspension Reason / Reference': '',
      },
      {
        'Employee ID': 'SKM-103',
        'Full Name': 'Amina Diallo',
        Department: 'Human Resources',
        'Role / Designation': 'HR Officer',
        'Email Address': 'amina.d@company.com',
        'Phone Number': '+1 555-017-4432',
        'Pay Grade': 'Grade L4',
        'Estimated Monthly Salary ($)': 4200,
        'Shift Schedule': 'Morning',
        'Bank Name': 'Chase Bank',
        'Account Number': '9876543210',
        'Employment Status': 'Suspended',
        'Join Date': '2023-04-12',
        'Exit Date': '',
        'Exit Reason': '',
        'Suspension End Time': '2026-10-15',
        'Suspension Reason / Reference': 'Internal Compliance Review',
      },
      {
        'Employee ID': 'SKM-104',
        'Full Name': 'Marcus Vance',
        Department: 'Operations',
        'Role / Designation': 'Shift Operations Lead',
        'Email Address': 'marcus.v@company.com',
        'Phone Number': '+1 555-016-8844',
        'Pay Grade': 'Grade L3',
        'Estimated Monthly Salary ($)': 3500,
        'Shift Schedule': 'Night',
        'Bank Name': 'Bank of America',
        'Account Number': '4455667788',
        'Employment Status': 'Exited',
        'Join Date': '2022-08-01',
        'Exit Date': '2026-07-31',
        'Exit Reason': 'Voluntary Resignation — Relocation abroad',
        'Suspension End Time': '',
        'Suspension Reason / Reference': '',
      },
    ];
  };

  const templateHeaders = [
    'Employee ID',
    'Full Name',
    'Department',
    'Role / Designation',
    'Email Address',
    'Phone Number',
    'Pay Grade',
    'Estimated Monthly Salary ($)',
    'Shift Schedule',
    'Bank Name',
    'Account Number',
    'Employment Status',
    'Join Date',
    'Exit Date',
    'Exit Reason',
    'Suspension End Time',
    'Suspension Reason / Reference',
  ];

  const handleDownloadCSVTemplate = () => {
    const sampleData = getSampleTemplateData();
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = sampleData.map((d: any) => [
      escapeCsv(d['Employee ID']),
      escapeCsv(d['Full Name']),
      escapeCsv(d['Department']),
      escapeCsv(d['Role / Designation']),
      escapeCsv(d['Email Address']),
      escapeCsv(d['Phone Number']),
      escapeCsv(d['Pay Grade']),
      d['Estimated Monthly Salary ($)'] !== undefined ? d['Estimated Monthly Salary ($)'] : 0,
      escapeCsv(d['Shift Schedule']),
      escapeCsv(d['Bank Name']),
      escapeCsv(d['Account Number']),
      escapeCsv(d['Employment Status']),
      escapeCsv(d['Join Date']),
      escapeCsv(d['Exit Date']),
      escapeCsv(d['Exit Reason']),
      escapeCsv(d['Suspension End Time']),
      escapeCsv(d['Suspension Reason / Reference']),
    ]);

    const csvContent =
      templateHeaders.join(',') + '\n' + rows.map((r) => r.join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `skima_${mode}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcelTemplate = () => {
    const sampleData = getSampleTemplateData();
    const ws = XLSX.utils.json_to_sheet(sampleData, { header: templateHeaders });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${mode.toUpperCase()} Roster`);
    XLSX.writeFile(wb, `skima_${mode}_template.xlsx`);
  };

  const processUploadedFile = (file: File) => {
    setIsProcessing(true);
    setValidationErrors([]);
    setUploadSuccessMsg(null);
    setRestrictedNotice(null);
    setParsedPreview([]);
    setDetectedEntities(null);
    setShowConfigWarning(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!buffer) throw new Error('Could not read file data.');

        const workbook = XLSX.read(buffer, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          setValidationErrors(['The uploaded sheet contains no data rows.']);
          setIsProcessing(false);
          return;
        }

        // Retrieve existing organizational entities
        const existingDepartments = getCleanDepartments(effectiveCompanyName);
        const existingDeptMap = new Map<string, DepartmentInfo>();
        existingDepartments.forEach((d) =>
          existingDeptMap.set(d.name.trim().toLowerCase(), d)
        );

        const existingShifts = settings?.shifts || [];
        const existingShiftNames = new Set(
          existingShifts.map((s) => s.name.trim().toLowerCase())
        );
        const standardShifts = new Set([
          'morning',
          'morning shift',
          'afternoon',
          'afternoon shift',
          'night',
          'night shift',
          'flexible',
          'off',
          'off duty',
          'n/a',
          'none',
        ]);

        const payrollConfig = loadCompanyPayrollConfig(effectiveCompanyName);
        const configuredPayGrades = payrollConfig.payGrades || [];
        const existingPayGradeNames = new Set(
          configuredPayGrades.map((g) => g.name.trim().toLowerCase())
        );

        const errors: string[] = [];
        const parsedStaff: StaffMember[] = [];

        // For 'scheme' mode: track new entities detected in file
        const newDeptRolesMap = new Map<string, Set<string>>();
        const newShiftSet = new Set<string>();
        const newPayGradeSet = new Set<string>();

        let naDeptCount = 0;
        let activeCount = 0;
        let suspendedCount = 0;
        let exitedCount = 0;

        jsonData.forEach((row, idx) => {
          const rowNum = idx + 2; // header is row 1
          const empId = String(
            row['Employee ID'] || row['ID'] || row['Emp ID'] || ''
          ).trim();
          const name = String(
            row['Full Name'] || row['Name'] || row['Staff Name'] || ''
          ).trim();
          const rawDept = String(row['Department'] || row['Dept'] || '').trim();
          const role = String(
            row['Role / Designation'] || row['Role'] || row['Designation'] || 'Staff Member'
          ).trim();
          const email = String(row['Email Address'] || row['Email'] || '').trim();
          const phone = String(
            row['Phone Number'] || row['Phone'] || row['Telephone'] || ''
          ).trim();
          const rawPayGrade = String(row['Pay Grade'] || row['Grade'] || '').trim();
          const salaryVal =
            parseFloat(
              String(
                row['Estimated Monthly Salary ($)'] ||
                  row['Monthly Salary ($)'] ||
                  row['Salary'] ||
                  row['Base Salary'] ||
                  '0'
              ).replace(/[^0-9.]/g, '')
            ) || 0;

          const shiftRaw = String(row['Shift Schedule'] || row['Shift'] || '').trim();
          const bankName = String(row['Bank Name'] || row['Bank'] || '').trim();
          const accountNumber = String(
            row['Account Number'] || row['Account #'] || row['Account'] || ''
          ).trim();
          const statusRaw = String(
            row['Employment Status'] || row['Status'] || ''
          ).trim();
          const joinDate = String(row['Join Date'] || row['Joined'] || '').trim();
          const exitDate = String(row['Exit Date'] || '').trim();
          const exitReason = String(row['Exit Reason'] || '').trim();
          const suspensionEndTime = String(row['Suspension End Time'] || '').trim();
          const suspensionReason = String(
            row['Suspension Reason / Reference'] || row['Suspension Reason'] || ''
          ).trim();

          if (!name) {
            errors.push(`Row ${rowNum}: Missing 'Full Name'.`);
          }

          // Department Resolution
          let finalDept = rawDept;
          const lowerDept = rawDept.toLowerCase();
          const isDeptEmptyOrNa =
            !rawDept || lowerDept === 'n/a' || lowerDept === 'unassigned' || lowerDept === 'none';

          if (mode === 'scheme') {
            if (!isDeptEmptyOrNa) {
              if (!existingDeptMap.has(lowerDept)) {
                if (!newDeptRolesMap.has(rawDept)) {
                  newDeptRolesMap.set(rawDept, new Set());
                }
                if (role && role !== 'Staff Member') {
                  newDeptRolesMap.get(rawDept)!.add(role);
                }
              }
              finalDept = rawDept;
            } else {
              finalDept = 'General';
            }
          } else {
            // Specific mode uploads: restricted to existing departments.
            // If new department name is uploaded here, default to 'N/A' to avoid creating unused departments.
            if (isDeptEmptyOrNa) {
              finalDept = 'N/A';
            } else if (existingDeptMap.has(lowerDept)) {
              finalDept = existingDeptMap.get(lowerDept)!.name;
            } else {
              finalDept = 'N/A';
              naDeptCount++;
            }
          }

          // Shift Resolution
          let finalShift = shiftRaw || 'Morning';
          const lowerShift = shiftRaw.toLowerCase();
          if (mode === 'scheme') {
            if (
              shiftRaw &&
              !existingShiftNames.has(lowerShift) &&
              !standardShifts.has(lowerShift)
            ) {
              newShiftSet.add(shiftRaw);
            }
            if (/night/i.test(shiftRaw)) finalShift = 'Night';
            else if (/afternoon/i.test(shiftRaw)) finalShift = 'Afternoon';
            else if (/morning/i.test(shiftRaw)) finalShift = 'Morning';
            else if (/flex/i.test(shiftRaw)) finalShift = 'Flexible';
            else if (/off/i.test(shiftRaw)) finalShift = 'Off';
          } else {
            if (!shiftRaw || lowerShift === 'n/a') {
              finalShift = 'N/A';
            } else if (
              existingShiftNames.has(lowerShift) ||
              standardShifts.has(lowerShift)
            ) {
              if (/night/i.test(shiftRaw)) finalShift = 'Night';
              else if (/afternoon/i.test(shiftRaw)) finalShift = 'Afternoon';
              else if (/morning/i.test(shiftRaw)) finalShift = 'Morning';
              else if (/flex/i.test(shiftRaw)) finalShift = 'Flexible';
              else if (/off/i.test(shiftRaw)) finalShift = 'Off';
              else finalShift = shiftRaw;
            } else {
              finalShift = 'N/A';
            }
          }

          // Pay Grade Resolution
          let finalPayGrade = rawPayGrade || 'N/A';
          const lowerPayGrade = rawPayGrade.toLowerCase();
          if (mode === 'scheme') {
            if (rawPayGrade && lowerPayGrade !== 'n/a' && !existingPayGradeNames.has(lowerPayGrade)) {
              newPayGradeSet.add(rawPayGrade);
            }
            if (!rawPayGrade || lowerPayGrade === 'n/a') {
              finalPayGrade = derivePayGradeFromSalary(salaryVal, configuredPayGrades, 'N/A');
            }
          } else {
            if (rawPayGrade && existingPayGradeNames.has(lowerPayGrade)) {
              finalPayGrade = rawPayGrade;
            } else if (salaryVal > 0) {
              finalPayGrade = derivePayGradeFromSalary(salaryVal, configuredPayGrades, 'N/A');
            } else {
              finalPayGrade = 'N/A';
            }
          }

          // Employment Status Resolution
          let finalStatus: 'Active' | 'On Leave' | 'Off Duty' | 'Suspended' | 'Exited' = 'Active';
          if (mode === 'suspended') {
            finalStatus = 'Suspended';
            suspendedCount++;
          } else if (mode === 'exited') {
            finalStatus = 'Exited';
            exitedCount++;
          } else if (mode === 'active') {
            if (/leave/i.test(statusRaw)) finalStatus = 'On Leave';
            else if (/off/i.test(statusRaw)) finalStatus = 'Off Duty';
            else finalStatus = 'Active';
            activeCount++;
          } else {
            // 'scheme' mode: captures all statuses accurately
            if (/exit|resig|terminat/i.test(statusRaw) || exitDate) {
              finalStatus = 'Exited';
              exitedCount++;
            } else if (/suspend/i.test(statusRaw) || suspensionEndTime) {
              finalStatus = 'Suspended';
              suspendedCount++;
            } else if (/leave/i.test(statusRaw)) {
              finalStatus = 'On Leave';
              activeCount++;
            } else if (/off/i.test(statusRaw)) {
              finalStatus = 'Off Duty';
              activeCount++;
            } else {
              finalStatus = 'Active';
              activeCount++;
            }
          }

          const finalEmpId = empId && empId.trim() !== '' ? empId.trim() : 'N/A';

          parsedStaff.push({
            id: `staff-imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${idx}`,
            employeeId: finalEmpId,
            name: name || `Employee #${idx + 1}`,
            department: finalDept,
            role: role,
            email: email || '',
            phone: phone || '',
            payGrade: finalPayGrade,
            estimatedMonthlySalary: salaryVal,
            shiftSchedule: finalShift,
            bankName: bankName,
            accountNumber: accountNumber,
            status: finalStatus,
            joinDate: joinDate || new Date().toISOString().split('T')[0],
            exitDate: exitDate || undefined,
            exitReason: exitReason || undefined,
            suspensionEndTime: suspensionEndTime || undefined,
            suspensionReason: suspensionReason || undefined,
          });
        });

        if (errors.length > 0) {
          setValidationErrors(errors);
        }

        setParsedPreview(parsedStaff);

        if (mode === 'scheme') {
          const detectedDeptsArray = Array.from(newDeptRolesMap.entries()).map(
            ([name, rolesSet]) => ({
              name,
              roles: Array.from(rolesSet),
            })
          );
          const detectedShiftsArray = Array.from(newShiftSet);
          const detectedPayGradesArray = Array.from(newPayGradeSet);

          setDetectedEntities({
            departments: detectedDeptsArray,
            shifts: detectedShiftsArray,
            payGrades: detectedPayGradesArray,
            activeCount,
            suspendedCount,
            exitedCount,
          });

          setUploadSuccessMsg(
            `Validated complete organizational scheme with ${parsedStaff.length} personnel records.`
          );
        } else {
          if (naDeptCount > 0) {
            setRestrictedNotice(
              `${naDeptCount} record(s) had their department defaulted to 'N/A' because the uploaded department does not exist in the system directory.`
            );
          }
          setUploadSuccessMsg(
            `Extracted ${parsedStaff.length} ${mode} staff records from ${file.name}.`
          );
        }
      } catch (err: any) {
        setValidationErrors([`File extraction failed: ${err?.message || 'Invalid format'}`]);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleInitiateImport = () => {
    if (parsedPreview.length === 0) return;

    // In 'scheme' mode, if new departments, shifts, or pay grades were detected,
    // trigger the configuration warning modal as requested by user.
    if (
      mode === 'scheme' &&
      detectedEntities &&
      (detectedEntities.departments.length > 0 ||
        detectedEntities.shifts.length > 0 ||
        detectedEntities.payGrades.length > 0)
    ) {
      setShowConfigWarning(true);
      return;
    }

    // Direct commit if no new entities need provisioning
    onImportStaff(parsedPreview);
    onClose();
  };

  const handleConfirmApplySchemeWithEntities = () => {
    if (!detectedEntities) {
      onImportStaff(parsedPreview);
      onClose();
      return;
    }

    // 1. Provision new departments into storage
    if (detectedEntities.departments.length > 0) {
      const existingDepts = getCleanDepartments(effectiveCompanyName);
      const updatedDepts = [...existingDepts];

      detectedEntities.departments.forEach((newD, idx) => {
        const code =
          newD.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || `DPT${idx + 1}`;
        const roles = newD.roles.map((rTitle, rIdx) => ({
          id: `role-auto-${Date.now()}-${idx}-${rIdx}`,
          title: rTitle,
          departmentId: `dept-auto-${Date.now()}-${idx}`,
          departmentName: newD.name,
          jobDescription: `Standard operational duties and responsibilities for ${rTitle}.`,
          items: [],
        }));

        updatedDepts.push({
          id: `dept-auto-${Date.now()}-${idx}`,
          name: newD.name,
          code: code,
          roles: roles,
          description: `${newD.name} Department (Auto-provisioned via Scheme Upload)`,
          headOfDepartment: '',
        });
      });

      saveCleanDepartments(updatedDepts, effectiveCompanyName);
    }

    // 2. Provision new shifts into AppSettings
    if (detectedEntities.shifts.length > 0 && settings && onSaveSettings) {
      const currentShifts = settings.shifts || [];
      const newShiftObjects: DynamicShift[] = detectedEntities.shifts.map((sName, sIdx) => ({
        id: `shift-auto-${Date.now()}-${sIdx}`,
        name: sName,
        startTime: '08:00',
        endTime: '17:00',
        gracePeriodMinutes: 15,
        color: '#6366f1',
      }));

      onSaveSettings({
        ...settings,
        shifts: [...currentShifts, ...newShiftObjects],
      });
    }

    // 3. Provision new pay grades into Company Payroll Config
    if (detectedEntities.payGrades.length > 0) {
      const payrollConfig = loadCompanyPayrollConfig(effectiveCompanyName);
      const currentGrades = payrollConfig.payGrades || [];
      const newGradeObjects = detectedEntities.payGrades.map((gName, gIdx) => ({
        id: `grade-auto-${Date.now()}-${gIdx}`,
        name: gName,
        minSalary: 2500,
        maxSalary: 5000,
        description: `Imported Pay Grade: ${gName}`,
      }));

      saveCompanyPayrollConfig(
        {
          ...payrollConfig,
          payGrades: [...currentGrades, ...newGradeObjects],
        },
        effectiveCompanyName
      );
    }

    // 4. Commit parsed staff roster
    onImportStaff(parsedPreview);
    setShowConfigWarning(false);
    onClose();

    emitGlobalToast(
      `Applied organizational scheme: ${parsedPreview.length} staff synchronized. Newly registered entities require configuration in their respective tabs.`,
      'success'
    );
  };

  const getModeTitle = () => {
    switch (mode) {
      case 'active':
        return 'Upload Active Staff Directory';
      case 'suspended':
        return 'Upload Suspended Staff Directory';
      case 'exited':
        return 'Upload Exited Staff Directory';
      case 'scheme':
      default:
        return 'Upload Organizational Scheme';
    }
  };

  const getModeSubtitle = () => {
    switch (mode) {
      case 'active':
        return 'Restricted to existing information — Unregistered departments, shifts, or pay grades will default to N/A';
      case 'suspended':
        return 'Disciplinary Roster — All imported personnel will be filed under Suspended status';
      case 'exited':
        return 'Former Personnel — Records will be filed under Exited status with reason and departure dates';
      case 'scheme':
      default:
        return 'Captures all staff-related data and automatically provisions new departments, roles, and shift types';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                mode === 'scheme'
                  ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                  : mode === 'suspended'
                  ? 'bg-amber-600/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  : mode === 'exited'
                  ? 'bg-rose-600/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  : 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              }`}
            >
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {getModeTitle()}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {getModeSubtitle()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/80 px-6 pt-2">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload & Validate File
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
              activeTab === 'guide'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Columns Guide & Download Template
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {activeTab === 'upload' && (
            <div className="space-y-6">
              {/* Context Banner */}
              {mode === 'scheme' ? (
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">
                      Organizational Scheme Mode Active
                    </h4>
                    <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                      This master upload captures complete staff data across Active, Suspended, and Exited records. If the sheet contains departments, shift types, or pay grades that do not exist yet in the system, they will be registered automatically with a configuration warning step before applying.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Restricted Directory Mode: {mode.toUpperCase()}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Uploads made directly to this directory tab are restricted to existing information. If a field contains an unrecognized department name, it will default to <span className="font-mono font-bold text-amber-600 dark:text-amber-400">N/A</span> to avoid creating unused departments.
                    </p>
                  </div>
                </div>
              )}

              {/* Template Download Quick Bar */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Standardized 17-Column Structure
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Download the tailored template to ensure 100% column matching and zero-error imports.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleDownloadCSVTemplate}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    .CSV Template
                  </button>
                  <button
                    onClick={handleDownloadExcelTemplate}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    .XLSX Excel
                  </button>
                </div>
              </div>

              {/* Upload Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition flex flex-col items-center justify-center gap-3 ${
                  dragOver
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-blue-400'
                }`}
              >
                <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Drag and drop your staff roster here (.csv, .xlsx, .xls)
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Exported directories from Skima can be re-uploaded here directly.
                  </p>
                </div>

                <label className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold cursor-pointer shadow transition">
                  <FileCheck className="w-4 h-4" />
                  Select File from Computer
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Loading State */}
              {isProcessing && (
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-xs text-slate-600 dark:text-slate-300 animate-pulse">
                  Analyzing headers and validating entities...
                </div>
              )}

              {/* Success Banner */}
              {uploadSuccessMsg && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      File Read & Validated Successfully
                    </h5>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {uploadSuccessMsg}
                    </p>
                  </div>
                </div>
              )}

              {/* Restricted Notice for non-scheme mode */}
              {restrictedNotice && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Notice: Unregistered Entity Fallback
                    </h5>
                    <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5">
                      {restrictedNotice}
                    </p>
                  </div>
                </div>
              )}

              {/* Validation Warning Box */}
              {validationErrors.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Validation Warnings ({validationErrors.length}):
                  </div>
                  <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc list-inside space-y-1 max-h-36 overflow-y-auto">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Scheme Mode: Detected Entities Summary Pill */}
              {mode === 'scheme' && detectedEntities && (
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      Scheme Structure Analysis
                    </div>
                    <span className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300">
                      {detectedEntities.activeCount} Active · {detectedEntities.suspendedCount} Suspended · {detectedEntities.exitedCount} Exited
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50">
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-blue-500" />
                        New Departments
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {detectedEntities.departments.length > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            +{detectedEntities.departments.length} to Provision
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">All match existing</span>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50">
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-500" />
                        New Shifts
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {detectedEntities.shifts.length > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            +{detectedEntities.shifts.length} to Register
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">All match existing</span>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50">
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-emerald-500" />
                        New Pay Grades
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {detectedEntities.payGrades.length > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            +{detectedEntities.payGrades.length} to Add
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">All match existing</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Extracted Data Preview Table */}
              {parsedPreview.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Table className="w-4 h-4 text-blue-500" />
                      Extracted Preview ({parsedPreview.length} Records)
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Review records before applying
                    </span>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-60">
                    <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 uppercase text-[10px] font-bold sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Emp ID</th>
                          <th className="px-3 py-2">Full Name</th>
                          <th className="px-3 py-2">Department</th>
                          <th className="px-3 py-2">Role</th>
                          <th className="px-3 py-2">Pay Grade</th>
                          <th className="px-3 py-2">Shift</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {parsedPreview.slice(0, 10).map((st, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-3 py-2 font-mono font-bold text-blue-600 dark:text-blue-400">
                              {st.employeeId}
                            </td>
                            <td className="px-3 py-2 font-medium">{st.name}</td>
                            <td className="px-3 py-2">
                              {st.department === 'N/A' ? (
                                <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                                  N/A
                                </span>
                              ) : (
                                st.department
                              )}
                            </td>
                            <td className="px-3 py-2">{st.role}</td>
                            <td className="px-3 py-2 font-mono">{st.payGrade}</td>
                            <td className="px-3 py-2">{st.shiftSchedule}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  st.status === 'Active'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : st.status === 'Suspended'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : st.status === 'Exited'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                }`}
                              >
                                {st.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {parsedPreview.length > 10 && (
                    <p className="text-[11px] text-slate-500 text-right">
                      + {parsedPreview.length - 10} additional records will be imported
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Skima Standardized Staff Directory & Scheme Specification
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  The output from every Skima export matches this 17-column specification exactly, ensuring 100% symmetric import and export capability:
                </p>
              </div>

              {/* Column Rules Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                    1. Employee ID & Full Name
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Unique identifier code (e.g. SKM-101) and official employee name.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                    2. Department & Role
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Organizational division and job designation. On scheme upload, new departments are auto-provisioned.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                    3. Pay Grade & Monthly Salary ($)
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Salary band designation and estimated monthly salary for payroll structure calculations.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                    4. Shift Schedule & Status
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Assigned shift (Morning, Afternoon, Night, etc.) and employment status (Active, Suspended, Exited).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                    5. Bank & Account Details
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Bank Name and Account Number for direct payroll transfer preparation.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                    6. Exit & Suspension Details
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Exit Date & Reason for departed staff; Suspension End Time & Reason for disciplined staff.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={handleDownloadCSVTemplate}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-2 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download .CSV Template
                </button>
                <button
                  onClick={handleDownloadExcelTemplate}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download .XLSX Template
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {parsedPreview.length > 0
              ? `${parsedPreview.length} records ready to import.`
              : 'Supports standard CSV and Microsoft Excel (.xlsx, .xls)'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            {parsedPreview.length > 0 && (
              <button
                onClick={handleInitiateImport}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {mode === 'scheme' &&
                detectedEntities &&
                (detectedEntities.departments.length > 0 ||
                  detectedEntities.shifts.length > 0 ||
                  detectedEntities.payGrades.length > 0)
                  ? `Review Scheme & Provision (${parsedPreview.length} Staff)`
                  : `Commit & Import ${parsedPreview.length} Staff`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Configuration Required Warning Modal for Scheme Upload */}
      {showConfigWarning && detectedEntities && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/80 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden p-6 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 uppercase tracking-wider">
                  Configuration Required for Accuracy
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  New System Entities Detected in Scheme
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  The uploaded scheme introduces new organizational entities that require administrative configuration. We will automatically create them in your system, but please review and configure their operational rules in their respective tabs:
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              {detectedEntities.departments.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    New Departments ({detectedEntities.departments.length}):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detectedEntities.departments.map((d, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono text-[11px]"
                      >
                        {d.name} {d.roles.length > 0 && `(${d.roles.length} roles)`}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Please visit the <strong>Departments</strong> tab to configure Department Heads, descriptions, and job descriptions.
                  </p>
                </div>
              )}

              {detectedEntities.shifts.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    New Shift Types ({detectedEntities.shifts.length}):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detectedEntities.shifts.map((s, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-mono text-[11px]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Please visit <strong>Shifts & Rosters</strong> settings to configure official start times, closing times, and grace periods.
                  </p>
                </div>
              )}

              {detectedEntities.payGrades.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                    New Pay Grades ({detectedEntities.payGrades.length}):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detectedEntities.payGrades.map((g, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono text-[11px]"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Please visit <strong>Payroll Workspace</strong> to configure salary bands and allowances.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowConfigWarning(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              >
                Back to Preview
              </button>
              <button
                type="button"
                onClick={handleConfirmApplySchemeWithEntities}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/30 flex items-center gap-2 transition cursor-pointer"
              >
                <span>I Understand — Provision & Apply Scheme</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
