import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StaffMember,
  Applicant,
  ATSScoreResult,
  DepartmentInfo,
  AppSettings,
  User,
  JobVacancy,
  InterviewQuestionItem,
  DocumentSection,
  DocumentHeaderMetaConfig,
  SignatureConfig,
} from '../types';
import { calculateATSScore } from '../utils/atsMatcher';
import { INITIAL_APPLICANTS } from '../data/seedApplicants';
import { loadCompanyData, saveCompanyData, STORAGE_KEYS } from '../utils/companyStorage';
import { generateStaffId, getDepartmentCode, formatStaffId, isNaEmployeeId, isEmployeeIdUnique } from '../utils/staffUtils';
import { getCompanyCurrencySymbol, loadCompanyPayrollConfig, derivePayGradeFromSalary, deriveStaffPayGrade } from '../utils/payrollUtils';
import {
  getStaffRoleDutiesInfo,
  DEFAULT_OFFER_LETTER_SECTIONS,
  DEFAULT_HEADER_META,
  DEFAULT_SIGNATURES,
  replaceDocumentTags,
  getPrefix,
  getListPrefix,
  getActiveOrganizationName,
} from '../utils/documentTemplates';
import { DocumentTemplateEditor } from './DocumentTemplateEditor';
import {
  X,
  UserCheck,
  UserPlus,
  Users,
  Search,
  Filter,
  Sparkles,
  FileText,
  Briefcase,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  FileCheck,
  Eye,
  Building2,
  GraduationCap,
  Award,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Percent,
  Check,
  Download,
  Copy,
  Upload,
  Loader2,
  FileUp,
  BookOpen,
  RotateCcw,
  Home,
  Edit3,
  ShieldCheck,
  History,
  Target,
  BadgeCheck,
  Lock,
  Printer,
  CheckSquare,
  XCircle,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import JSZip from 'jszip';

export const EDUCATIONAL_LEVELS = [
  "Associate Degree (A.A. / A.S.)",
  "Bachelor's Degree (B.Sc / B.A / B.Eng / B.Tech)",
  "Doctorate / Ph.D. / DBA",
  "Higher National Diploma (HND)",
  "High School Diploma / SSCE / WASSCE / O'Level",
  "Master's Degree (M.Sc / M.A / MBA / M.Eng)",
  "National Diploma (ND / OND)",
  "None / No Formal Education",
  "Postgraduate Diploma (PGD)",
  "Primary / Elementary School Certificate",
  "Professional Certification / Chartered Qualification",
  "Vocational / Technical Certificate / Trade Diploma",
];

export const SCHOOL_GRADES = [
  "Distinction / First Class Honours (4.0+ GPA / Summa Cum Laude)",
  "Second Class Upper (2:1) / Upper Credit (3.5+ GPA / Magna Cum Laude)",
  "Second Class Lower (2:2) / Lower Credit (3.0+ GPA / Cum Laude)",
  "Third Class Honours / Pass / Merit (2.0+ GPA)",
  "High School Honours / A-Grade",
  "Credit / Standard Pass",
  "Not Applicable / None / Ungraded",
];

export const COMMON_COURSES_OF_STUDY = [
  "Accounting",
  "Banking & Finance",
  "Biochemistry",
  "Business Administration",
  "Civil Engineering",
  "Computer Engineering",
  "Computer Science",
  "Economics",
  "Electrical & Electronics Engineering",
  "Estate Management",
  "Human Resource Management",
  "Information Technology / Cyber Security",
  "Law / Legal Studies",
  "Marketing & Public Relations",
  "Mass Communication / Journalism",
  "Mathematics / Statistics",
  "Mechanical Engineering",
  "Medicine / Nursing / Public Health",
  "Microbiology",
  "Physics",
  "Political Science / International Relations",
  "Project Management",
  "Psychology",
  "Supply Chain & Logistics",
];

interface TrackApplicantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  onUpdateStaffList: (newStaffList: StaffMember[]) => void;
  departments: string[];
  dbDepartments: DepartmentInfo[];
  companyName: string;
  isLight?: boolean;
  settings?: AppSettings;
  onDirectAddEmployee: () => void;
  onOpenConfirmationLetter?: (staff: StaffMember) => void;
  onOpenJobDescription?: (staff: StaffMember) => void;
}

const INITIAL_VACANCIES: JobVacancy[] = [
  {
    id: 'vac-101',
    title: 'Senior Full Stack Engineer',
    department: 'Engineering',
    role: 'Senior Full Stack Engineer',
    targetHeadcount: 2,
    filledCount: 0,
    hiredStaffNames: [],
    hiredStaffDetails: [],
    status: 'Open',
    employmentType: 'Full-time',
    experienceRequired: 4,
    minEducationalLevel: "Bachelor's Degree (B.Sc / B.A / B.Eng)",
    requiredSkills: ['TypeScript', 'React', 'Node.js', 'SQL', 'Docker', 'API Architecture', 'Git'],
    salaryRange: { min: 4500, max: 6500, payGrade: 'Grade L3' },
    description: 'Lead engineering team on enterprise web applications, scalable APIs, and system performance.',
    requestedBy: 'Engineering Head',
    createdDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  },
  {
    id: 'vac-102',
    title: 'Operations Officer',
    department: 'Operations',
    role: 'Operations Officer',
    targetHeadcount: 1,
    filledCount: 0,
    hiredStaffNames: [],
    hiredStaffDetails: [],
    status: 'Open',
    employmentType: 'Full-time',
    experienceRequired: 2,
    minEducationalLevel: "Bachelor's Degree (B.Sc / B.A / B.Eng)",
    requiredSkills: ['Workflow Optimization', 'Logistics', 'KPI Tracking', 'SOP Compliance', 'Spreadsheets'],
    salaryRange: { min: 3000, max: 4200, payGrade: 'Grade L2' },
    description: 'Coordinate daily field operations, roster shifts, logistics execution, and compliance audits.',
    requestedBy: 'Operations Lead',
    createdDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  },
];

export const TrackApplicantsModal: React.FC<TrackApplicantsModalProps> = ({
  isOpen,
  onClose,
  staffList,
  onUpdateStaffList,
  departments,
  dbDepartments,
  companyName,
  isLight = false,
  settings,
  onDirectAddEmployee,
  onOpenConfirmationLetter,
  onOpenJobDescription,
}) => {
  const [activeTab, setActiveTab] = useState<'vacancies' | 'interviewees' | 'history'>('vacancies');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [selectedVacancyFilter, setSelectedVacancyFilter] = useState('All');
  const currencySymbol = getCompanyCurrencySymbol(companyName);
  const payrollConfig = useMemo(() => loadCompanyPayrollConfig(companyName), [companyName]);
  const configuredPayGrades = payrollConfig.payGrades || [];

  // Expanded vacancy in Vacancies tab (to drill down into applicants)
  const [expandedVacancyId, setExpandedVacancyId] = useState<string | null>(null);
  // Selected applicant in that expanded vacancy (to see deep ATS analysis)
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);

  // CV Preview Modal
  const [viewingCvApplicant, setViewingCvApplicant] = useState<Applicant | null>(null);

  // Print Offer Letter Confirmation Modal
  const [offerLetterConfirmApplicant, setOfferLetterConfirmApplicant] = useState<Applicant | null>(null);

  // Edit Offer Letter Template Modal
  const [isEditingOfferLetterTemplate, setIsEditingOfferLetterTemplate] = useState(false);
  const [offerLetterSettings, setOfferLetterSettings] = useState({
    documentTitle: settings?.offerLetterDocumentTitle || 'OFFICIAL OFFER OF EMPLOYMENT & APPOINTMENT TERMS',
    companyName: settings?.offerLetterCompanyName || settings?.companyName || companyName,
    lineColor: settings?.offerLetterLineColor || '#059669',
    textColor: settings?.offerLetterTextColor || '#0f172a',
    employeeSigLabel: settings?.offerLetterEmployeeSigLabel || 'Candidate Acceptance & Signature',
    hrSigLabel: settings?.offerLetterHrSigLabel || 'Managing Director / Authorized Representative',
    sections: settings?.offerLetterSections || DEFAULT_OFFER_LETTER_SECTIONS,
    headerMeta: settings?.offerLetterHeaderMeta || DEFAULT_HEADER_META,
    signatures: settings?.offerLetterSignatures || DEFAULT_SIGNATURES,
  });

  // Vacancies State persisted by company
  const [vacancies, setVacancies] = useState<JobVacancy[]>(() => {
    try {
      const isDemo = typeof window !== 'undefined' && localStorage.getItem('skima_is_demo_session') === 'true';
      const stored = loadCompanyData<JobVacancy[]>(STORAGE_KEYS.VACANCIES, companyName, []);
      if (Array.isArray(stored) && stored.length > 0) return stored;
      if (isDemo) return INITIAL_VACANCIES;
    } catch (e) {
      console.error('Failed to load vacancies:', e);
    }
    return [];
  });

  const saveVacanciesList = (newList: JobVacancy[]) => {
    setVacancies(newList);
    try {
      saveCompanyData(STORAGE_KEYS.VACANCIES, newList, companyName);
    } catch (e) {
      console.error('Failed to save vacancies:', e);
    }
  };

  // Dropdown Form Accordion state for Vacancies & Roles tab (initialized after vacancies is declared)
  const [openVacancyDropdownIds, setOpenVacancyDropdownIds] = useState<string[]>(() =>
    vacancies.length > 0 ? [vacancies[0].id] : []
  );

  const toggleVacancyDropdown = (vacId: string) => {
    setOpenVacancyDropdownIds((prev) =>
      prev.includes(vacId) ? prev.filter((id) => id !== vacId) : [...prev, vacId]
    );
  };

  // Applicants State persisted by company
  const [applicants, setApplicants] = useState<Applicant[]>(() => {
    try {
      const isDemo = typeof window !== 'undefined' && localStorage.getItem('skima_is_demo_session') === 'true';
      const stored = loadCompanyData<Applicant[]>(STORAGE_KEYS.APPLICANTS, companyName, []);
      if (Array.isArray(stored) && stored.length > 0) return stored;
      if (isDemo) return INITIAL_APPLICANTS;
    } catch (e) {
      console.error('Failed to load applicants:', e);
    }
    return [];
  });

  const activeCompanyRef = useRef(companyName);
  useEffect(() => {
    if (activeCompanyRef.current !== companyName) {
      activeCompanyRef.current = companyName;
      const isDemo = typeof window !== 'undefined' && localStorage.getItem('skima_is_demo_session') === 'true';
      const stored = loadCompanyData<Applicant[]>(STORAGE_KEYS.APPLICANTS, companyName, []);
      if (Array.isArray(stored) && stored.length > 0) {
        setApplicants(stored);
      } else if (isDemo) {
        setApplicants(INITIAL_APPLICANTS);
      } else {
        setApplicants([]);
      }

      const storedVac = loadCompanyData<JobVacancy[]>(STORAGE_KEYS.VACANCIES, companyName, []);
      if (Array.isArray(storedVac) && storedVac.length > 0) {
        setVacancies(storedVac);
      } else if (isDemo) {
        setVacancies(INITIAL_VACANCIES);
      } else {
        setVacancies([]);
      }
    }
  }, [companyName]);

  const saveApplicantsList = (newList: Applicant[]) => {
    setApplicants(newList);
    try {
      saveCompanyData(STORAGE_KEYS.APPLICANTS, newList, companyName);
    } catch (e) {
      console.error('Failed to save applicants:', e);
    }
  };

  // State for Create / Edit Vacancy Modal
  const [isCreateVacancyOpen, setIsCreateVacancyOpen] = useState(false);
  const [editingVacancy, setEditingVacancy] = useState<JobVacancy | null>(null);

  // Sub-modal: Select Vacancy before adding applicant
  const [isSelectVacancyModalOpen, setIsSelectVacancyModalOpen] = useState(false);
  const [vacancySearchQuery, setVacancySearchQuery] = useState('');

  // Warning modal for role without configured duties/keywords
  const [unconfiguredRoleWarning, setUnconfiguredRoleWarning] = useState<{ role: string; department: string } | null>(null);

  // Title keywords / expected previous titles
  const [vacancyTitleKeywords, setVacancyTitleKeywords] = useState<string[]>([]);
  const [currentTitleKeywordInput, setCurrentTitleKeywordInput] = useState('');

  // Effective pay grades dynamically retrieved with fallback
  const effectivePayGrades = useMemo(() => {
    if (configuredPayGrades && configuredPayGrades.length > 0) {
      return configuredPayGrades;
    }
    return [
      { id: 'pg-l1', name: 'Grade L1 - Entry / Junior', minSalary: 2000, maxSalary: 3500 },
      { id: 'pg-l2', name: 'Grade L2 - Mid-Level Specialist', minSalary: 3500, maxSalary: 5500 },
      { id: 'pg-l3', name: 'Grade L3 - Senior Specialist', minSalary: 5500, maxSalary: 8500 },
      { id: 'pg-l4', name: 'Grade L4 - Lead / Supervisor', minSalary: 8500, maxSalary: 13000 },
      { id: 'pg-l5', name: 'Grade L5 - Executive / Director', minSalary: 13000, maxSalary: 22000 },
    ];
  }, [configuredPayGrades]);

  const [vacancyFormData, setVacancyFormData] = useState<Partial<JobVacancy>>({
    title: '',
    department: departments.filter((d) => d !== 'All')[0] || 'Engineering',
    role: '',
    targetHeadcount: 1,
    employmentType: 'Full-time',
    experienceRequired: 2,
    minEducationalLevel: "Bachelor's Degree (B.Sc / B.A / B.Eng)",
    requiredSkills: [],
    titleKeywords: [],
    salaryRange: { min: 3500, max: 5000, payGrade: 'Grade L2 - Mid-Level Specialist' },
    description: '',
    requestedBy: '',
  });
  const [isCustomVacancyRole, setIsCustomVacancyRole] = useState(false);
  const [customVacancyRoleInput, setCustomVacancyRoleInput] = useState('');

  // State for Add Applicant Form Modal
  const [isAddApplicantOpen, setIsAddApplicantOpen] = useState(false);
  const [applicantFormData, setApplicantFormData] = useState<Partial<Applicant>>({
    name: '',
    email: '',
    phone: '',
    appliedDepartment: departments.filter((d) => d !== 'All')[0] || 'Engineering',
    appliedRole: '',
    vacancyId: '',
    vacancyTitle: '',
    experienceYears: 3,
    expectedSalary: 4000,
    education: "Bachelor's Degree (B.Sc / B.A / B.Eng)",
    educationalLevel: "Bachelor's Degree (B.Sc / B.A / B.Eng)",
    courseOfStudy: '',
    schoolGrade: 'First Class Honours / 4.0+ GPA / Summa Cum Laude',
    skills: [],
    resumeText: '',
    status: 'Pending',
    notes: '',
  });
  const [skillsInput, setSkillsInput] = useState('');
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute available existing roles for the selected department
  const availableRolesForDept = useMemo(() => {
    const deptName = (applicantFormData.appliedDepartment || '').trim().toLowerCase();
    const rolesSet = new Set<string>();

    // 1. From dbDepartments
    const targetDept = dbDepartments.find(
      (d) => (d.name || '').trim().toLowerCase() === deptName
    );
    if (targetDept && targetDept.roles && targetDept.roles.length > 0) {
      targetDept.roles.forEach((r) => {
        if (r.title && r.title.trim()) rolesSet.add(r.title.trim());
      });
    }

    // 2. From staffList
    staffList.forEach((s) => {
      if (
        (s.department || '').trim().toLowerCase() === deptName &&
        s.role &&
        s.role.trim()
      ) {
        rolesSet.add(s.role.trim());
      }
    });

    // 3. Fallback common department roles if none registered yet
    if (rolesSet.size === 0) {
      rolesSet.add('Associate Specialist');
      rolesSet.add('Team Lead / Officer');
      rolesSet.add('Coordinator');
      rolesSet.add('Executive Assistant');
    }

    return Array.from(rolesSet).sort();
  }, [applicantFormData.appliedDepartment, dbDepartments, staffList]);

  // Compute available roles for Vacancy Form Department
  const availableRolesForVacancyDept = useMemo(() => {
    const deptName = (vacancyFormData.department || '').trim().toLowerCase();
    const rolesSet = new Set<string>();

    const targetDept = dbDepartments.find(
      (d) => (d.name || '').trim().toLowerCase() === deptName
    );
    if (targetDept && targetDept.roles && targetDept.roles.length > 0) {
      targetDept.roles.forEach((r) => {
        if (r.title && r.title.trim()) rolesSet.add(r.title.trim());
      });
    }

    staffList.forEach((s) => {
      if ((s.department || '').trim().toLowerCase() === deptName && s.role && s.role.trim()) {
        rolesSet.add(s.role.trim());
      }
    });

    if (rolesSet.size === 0) {
      rolesSet.add('Associate Specialist');
      rolesSet.add('Operations Officer');
      rolesSet.add('Team Lead / Officer');
      rolesSet.add('Executive Assistant');
    }

    return Array.from(rolesSet).sort();
  }, [vacancyFormData.department, dbDepartments, staffList]);

  // Helper to check if a role in a department has duties, keywords, or description configured
  const checkRoleConfiguration = (deptName: string, roleName: string) => {
    const targetDept = dbDepartments.find((d) => (d.name || '').trim().toLowerCase() === deptName.trim().toLowerCase());
    const deptRole = (targetDept?.roles || []).find((r) => (r.title || '').trim().toLowerCase() === roleName.trim().toLowerCase());
    const dutiesInfo = getStaffRoleDutiesInfo({ department: deptName, role: roleName });

    const hasConfiguredValues =
      (dutiesInfo.items && dutiesInfo.items.length > 0) ||
      (deptRole?.items && deptRole.items.length > 0) ||
      Boolean(deptRole?.jobDescription?.trim()) ||
      Boolean(deptRole?.summary?.trim());

    return {
      hasConfiguredValues,
      deptRole,
      dutiesInfo,
    };
  };

  // Helper to extract keywords & duties dynamically from a role
  const extractRoleBenchmarkDetails = (deptName: string, roleName: string) => {
    const { hasConfiguredValues, deptRole, dutiesInfo } = checkRoleConfiguration(deptName, roleName);

    const skillsSet = new Set<string>();
    (dutiesInfo.items || []).forEach((item) => {
      if (item.keyword) {
        item.keyword.split(/[,;/|]+/).forEach((k) => {
          const trimmed = k.trim();
          if (trimmed) skillsSet.add(trimmed);
        });
      }
    });

    if (deptRole?.items) {
      deptRole.items.forEach((item) => {
        if (item.keyword) {
          item.keyword.split(/[,;/|]+/).forEach((k) => {
            const trimmed = k.trim();
            if (trimmed) skillsSet.add(trimmed);
          });
        }
      });
    }

    const collectedSkills = Array.from(skillsSet);

    const dynamicDesc = (dutiesInfo.items && dutiesInfo.items.length > 0)
      ? dutiesInfo.items.map((it, idx) => `${idx + 1}. ${it.text}`).join('\n')
      : (deptRole?.jobDescription || deptRole?.summary || '');

    return {
      hasConfiguredValues,
      collectedSkills,
      dynamicDesc,
    };
  };

  // When vacancy department changes
  const handleVacancyDeptChange = (newDept: string) => {
    const nextDeptLower = newDept.trim().toLowerCase();
    const targetDept = dbDepartments.find((d) => (d.name || '').trim().toLowerCase() === nextDeptLower);
    const existingRoles = (targetDept?.roles || []).map((r) => r.title.trim()).filter(Boolean);
    const defaultRole = existingRoles[0] || 'Associate Specialist';

    const { hasConfiguredValues, collectedSkills, dynamicDesc } = extractRoleBenchmarkDetails(newDept, defaultRole);

    setVacancyFormData((prev) => ({
      ...prev,
      department: newDept,
      role: defaultRole,
      title: defaultRole,
      requiredSkills: collectedSkills,
      description: dynamicDesc,
    }));

    setIsCustomVacancyRole(false);

    if (!hasConfiguredValues) {
      setUnconfiguredRoleWarning({ role: defaultRole, department: newDept });
    } else {
      setUnconfiguredRoleWarning(null);
    }
  };

  // When vacancy role is chosen, auto-extract duties & skills from department duties
  const handleVacancyRoleSelect = (roleName: string) => {
    const currentDept = vacancyFormData.department || departments.filter((d) => d !== 'All')[0] || 'Engineering';
    const { hasConfiguredValues, collectedSkills, dynamicDesc } = extractRoleBenchmarkDetails(currentDept, roleName);

    setVacancyFormData((prev) => ({
      ...prev,
      role: roleName,
      title: prev.title && prev.title !== prev.role ? prev.title : roleName,
      requiredSkills: collectedSkills,
      description: dynamicDesc,
    }));

    if (!hasConfiguredValues) {
      setUnconfiguredRoleWarning({ role: roleName, department: currentDept });
    } else {
      setUnconfiguredRoleWarning(null);
    }
  };

  // Title keywords / previous titles management
  const handleAddTitleKeyword = () => {
    const trimmed = currentTitleKeywordInput.trim();
    if (trimmed && !vacancyTitleKeywords.includes(trimmed)) {
      setVacancyTitleKeywords([...vacancyTitleKeywords, trimmed]);
      setCurrentTitleKeywordInput('');
    }
  };

  const handleRemoveTitleKeyword = (indexToRemove: number) => {
    setVacancyTitleKeywords(vacancyTitleKeywords.filter((_, idx) => idx !== indexToRemove));
  };

  const handleOpenCreateVacancy = (vac?: JobVacancy) => {
    if (vac) {
      setEditingVacancy(vac);
      setVacancyFormData({ ...vac });
      setVacancyTitleKeywords(vac.titleKeywords || []);
      setCurrentTitleKeywordInput('');
      setIsCustomVacancyRole(false);
      setCustomVacancyRoleInput('');
      setUnconfiguredRoleWarning(null);
    } else {
      setEditingVacancy(null);
      const defaultDept = departments.filter((d) => d !== 'All')[0] || 'Engineering';
      const targetDept = dbDepartments.find((d) => (d.name || '').trim().toLowerCase() === defaultDept.toLowerCase());
      const defaultRole = targetDept?.roles?.[0]?.title || 'Associate Specialist';

      const { hasConfiguredValues, collectedSkills, dynamicDesc } = extractRoleBenchmarkDetails(defaultDept, defaultRole);
      const initialPayGrade = effectivePayGrades[0];

      setVacancyFormData({
        title: defaultRole,
        department: defaultDept,
        role: defaultRole,
        targetHeadcount: 1,
        employmentType: 'Full-time',
        experienceRequired: 2,
        minEducationalLevel: "Bachelor's Degree (B.Sc / B.A / B.Eng)",
        requiredSkills: collectedSkills,
        titleKeywords: [],
        salaryRange: {
          payGrade: initialPayGrade?.name || 'Grade L2',
          min: initialPayGrade?.minSalary || 3500,
          max: initialPayGrade?.maxSalary || 5000,
        },
        description: dynamicDesc,
        notes: '',
      });
      setVacancyTitleKeywords([]);
      setCurrentTitleKeywordInput('');
      setIsCustomVacancyRole(false);
      setCustomVacancyRoleInput('');

      if (!hasConfiguredValues) {
        setUnconfiguredRoleWarning({ role: defaultRole, department: defaultDept });
      } else {
        setUnconfiguredRoleWarning(null);
      }
    }
    setIsCreateVacancyOpen(true);
  };

  const handleSaveVacancy = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRole = isCustomVacancyRole ? customVacancyRoleInput.trim() : (vacancyFormData.role?.trim() || '');
    const finalTitle = vacancyFormData.title?.trim() || finalRole;
    if (!finalTitle || !finalRole) {
      showToast('Please provide a title and role for the vacancy requisition.');
      return;
    }

    const targetSeats = Math.max(1, Number(vacancyFormData.targetHeadcount) || 1);

    if (editingVacancy) {
      const isCapacityMet = (editingVacancy.filledCount || 0) >= targetSeats;
      const isReopened = (editingVacancy.status === 'Closed' || editingVacancy.status === 'Filled') && !isCapacityMet;
      const updated: JobVacancy = {
        ...editingVacancy,
        ...vacancyFormData,
        title: finalTitle,
        role: finalRole,
        targetHeadcount: targetSeats,
        titleKeywords: vacancyTitleKeywords,
        status: isCapacityMet ? 'Closed' : (isReopened ? 'Open' : (vacancyFormData.status || editingVacancy.status || 'Open')),
      } as JobVacancy;
      const updatedList = vacancies.map((v) => (v.id === updated.id ? updated : v));
      saveVacanciesList(updatedList);
      if (isReopened) {
        showToast(`🎉 Requisition "${updated.title}" headcount increased to ${targetSeats} and re-opened for recruitment!`);
      } else {
        showToast(`Vacancy requisition "${updated.title}" updated.`);
      }
    } else {
      const newVac: JobVacancy = {
        id: `vac-${Date.now()}`,
        title: finalTitle,
        department: vacancyFormData.department || departments.filter((d) => d !== 'All')[0] || 'Engineering',
        role: finalRole,
        targetHeadcount: targetSeats,
        filledCount: 0,
        hiredStaffNames: [],
        hiredStaffDetails: [],
        status: 'Open',
        employmentType: vacancyFormData.employmentType || 'Full-time',
        experienceRequired: Number(vacancyFormData.experienceRequired) || 1,
        minEducationalLevel: vacancyFormData.minEducationalLevel || "Bachelor's Degree (B.Sc / B.A / B.Eng)",
        requiredSkills: vacancyFormData.requiredSkills || [],
        titleKeywords: vacancyTitleKeywords,
        salaryRange: vacancyFormData.salaryRange || {
          payGrade: effectivePayGrades[0]?.name || 'Grade L2',
          min: effectivePayGrades[0]?.minSalary || 3500,
          max: effectivePayGrades[0]?.maxSalary || 5000,
        },
        description: vacancyFormData.description?.trim() || '',
        createdDate: new Date().toISOString().split('T')[0],
        notes: vacancyFormData.notes?.trim() || '',
      };
      const updatedList = [newVac, ...vacancies];
      saveVacanciesList(updatedList);
      showToast(`🎉 Vacancy requisition "${newVac.title}" created with ${targetSeats} open position(s)!`);
    }
    setIsCreateVacancyOpen(false);
  };

  const handleDeleteVacancy = (vacId: string) => {
    const updated = vacancies.filter((v) => v.id !== vacId);
    saveVacanciesList(updated);
    showToast('Vacancy requisition removed.');
  };

  const handleToggleVacancyStatus = (vac: JobVacancy) => {
    const nextStatus = vac.status === 'Open' ? 'Closed' : 'Open';
    const updated: JobVacancy = {
      ...vac,
      status: nextStatus,
      closedDate: nextStatus === 'Closed' ? new Date().toISOString().split('T')[0] : undefined,
    };
    const updatedList = vacancies.map((v) => (v.id === vac.id ? updated : v));
    saveVacanciesList(updatedList);
    showToast(`Vacancy "${vac.title}" marked as ${nextStatus}.`);
  };

  // Open the "Select Vacancy" step before adding applicant
  const handleOpenAddApplicant = () => {
    setVacancySearchQuery('');
    setIsSelectVacancyModalOpen(true);
  };

  // When a specific vacancy is chosen for candidate tracking
  const handleSelectVacancyForApplicant = (vac: JobVacancy) => {
    setIsSelectVacancyModalOpen(false);
    setApplicantFormData({
      name: '',
      email: '',
      phone: '',
      appliedDepartment: vac.department,
      appliedRole: vac.role,
      vacancyId: vac.id,
      vacancyTitle: vac.title,
      expectedSalary: vac.salaryRange?.min || 3500,
      experienceYears: vac.experienceRequired || 2,
      educationalLevel: vac.minEducationalLevel || "Bachelor's Degree (B.Sc / B.A / B.Eng)",
      education: vac.minEducationalLevel || "Bachelor's Degree (B.Sc / B.A / B.Eng)",
      skills: [...(vac.requiredSkills || [])],
      resumeText: '',
      status: 'Pending',
      notes: '',
    });
    setSkillsInput((vac.requiredSkills || []).join(', '));
    setIsCustomRole(false);
    setCustomRoleInput('');
    setIsAddApplicantOpen(true);
  };

  // Legacy/Convenience alias: if vacancy passed, directly track for it; otherwise open selector modal
  const handleOpenAddApplicantForVacancy = (vac?: JobVacancy) => {
    if (vac) {
      handleSelectVacancyForApplicant(vac);
    } else {
      handleOpenAddApplicant();
    }
  };

  // Handle department change to synchronize role dropdown
  const handleDepartmentChange = (newDept: string) => {
    const nextDeptLower = newDept.trim().toLowerCase();
    const targetDept = dbDepartments.find((d) => (d.name || '').trim().toLowerCase() === nextDeptLower);
    const existingRoles = (targetDept?.roles || []).map((r) => r.title.trim()).filter(Boolean);
    const staffRoles = staffList
      .filter((s) => (s.department || '').trim().toLowerCase() === nextDeptLower && s.role)
      .map((s) => s.role.trim());
    const allRoles = Array.from(new Set([...existingRoles, ...staffRoles]));

    const defaultRole = allRoles.length > 0 ? allRoles[0] : 'Associate Specialist';

    setApplicantFormData((prev) => ({
      ...prev,
      appliedDepartment: newDept,
      appliedRole: defaultRole,
    }));
    setIsCustomRole(false);
  };

  // State for ATS Deep Dive Modal
  const [inspectingApplicant, setInspectingApplicant] = useState<Applicant | null>(null);

  // State for "Push as Staff" Modal (Enrollment)
  const [enrollingApplicant, setEnrollingApplicant] = useState<Applicant | null>(null);
  const [enrollmentForm, setEnrollmentForm] = useState({
    employeeId: '',
    name: '',
    department: '',
    role: '',
    email: '',
    phone: '',
    dob: '',
    homeAddress: '',
    guarantorName: '',
    guarantorPhone: '',
    guarantorRelationship: 'Parent / Guardian',
    guarantorAddress: '',
    payFrequency: 'Monthly',
    payGrade: 'Grade L2',
    estimatedMonthlySalary: 3500,
    shiftSchedule: 'Morning',
    bankName: '',
    accountNumber: '',
    joinDate: new Date().toISOString().split('T')[0],
  });

  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4500);
  };

  // Reset / Clear Add Applicant Form entries
  const handleClearApplicantForm = () => {
    const defaultDept = departments.filter((d) => d !== 'All')[0] || 'Engineering';
    const deptLower = defaultDept.trim().toLowerCase();
    const targetDept = dbDepartments.find((d) => (d.name || '').trim().toLowerCase() === deptLower);
    const existingRoles = (targetDept?.roles || []).map((r) => r.title.trim()).filter(Boolean);
    const defaultRole = existingRoles[0] || 'Associate Specialist';

    setApplicantFormData({
      name: '',
      appliedDepartment: defaultDept,
      appliedRole: defaultRole,
      email: '',
      phone: '',
      educationalLevel: "Bachelor's Degree (B.Sc / B.A / B.Eng)",
      courseOfStudy: '',
      schoolGrade: 'Second Class Upper (2:1)',
      experienceYears: 2,
      expectedSalary: 3500,
      resumeText: '',
    });
    setSkillsInput('');
    setUploadedFileName(null);
    setIsCustomRole(false);
    setCustomRoleInput('');
    showToast('Add Applicant form fields cleared.');
  };

  // AI Resume Parser integration
  const handleResumeFileUpload = async (file: File) => {
    if (!file) return;
    setUploadedFileName(file.name);
    setIsParsingResume(true);

    try {
      const isTxt = file.type === 'text/plain' || file.name.endsWith('.txt');
      const isDocx = file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      if (isTxt) {
        const textContent = await file.text();
        await parseResumeWithAI({ resumeText: textContent, fileName: file.name });
      } else if (isDocx) {
        // Attempt clean client-side DOCX text extraction using JSZip
        let clientExtractedText = '';
        try {
          const arrayBuffer = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(arrayBuffer);
          const docXml = zip.file('word/document.xml');
          if (docXml) {
            const xmlStr = await docXml.async('string');
            clientExtractedText = xmlStr
              .replace(/<w:p(?: [^>]*)?>/g, '\n')
              .replace(/<w:br(?:\s+[^>]*)?\/>/g, '\n')
              .replace(/<w:tab(?:\s+[^>]*)?\/>/g, '\t')
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'")
              .replace(/\r/g, '')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
          }
        } catch (docxErr) {
          console.warn('Browser DOCX extract error, delegating to server:', docxErr);
        }

        if (clientExtractedText) {
          await parseResumeWithAI({ resumeText: clientExtractedText, fileName: file.name });
        } else {
          // If browser extraction failed, stream base64 to server parser
          const reader = new FileReader();
          reader.onload = async () => {
            const rawBase64 = (reader.result as string).split(',')[1] || '';
            await parseResumeWithAI({
              fileBase64: rawBase64,
              mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              fileName: file.name,
            });
          };
          reader.readAsDataURL(file);
        }
      } else {
        // Read binary/PDF/Doc file as base64
        const reader = new FileReader();
        reader.onload = async () => {
          const rawBase64 = (reader.result as string).split(',')[1] || '';
          let mime = file.type;
          if (!mime) {
            if (file.name.endsWith('.pdf')) mime = 'application/pdf';
            else if (file.name.endsWith('.doc')) mime = 'application/msword';
            else mime = 'application/octet-stream';
          }
          await parseResumeWithAI({
            fileBase64: rawBase64,
            mimeType: mime,
            fileName: file.name,
          });
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error('Error reading resume file:', err);
      showToast('Could not read file. Please paste resume content manually.');
      setIsParsingResume(false);
    }
  };

  const parseResumeWithAI = async (payload: {
    resumeText?: string;
    fileBase64?: string;
    mimeType?: string;
    fileName?: string;
  }) => {
    try {
      const res = await fetch('/api/gemini/parse-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success && result.data) {
        const data = result.data;
        setApplicantFormData((prev) => {
          // Find matching educational level if returned
          let matchedEduLevel = prev.educationalLevel;
          if (data.educationalLevel) {
            const found = EDUCATIONAL_LEVELS.find((l) =>
              l.toLowerCase().includes(data.educationalLevel.toLowerCase()) ||
              data.educationalLevel.toLowerCase().includes(l.toLowerCase().split(' ')[0])
            );
            if (found) matchedEduLevel = found;
            else matchedEduLevel = data.educationalLevel;
          }

          // Find matching grade if returned
          let matchedGrade = prev.schoolGrade;
          if (data.schoolGrade) {
            const foundGrade = SCHOOL_GRADES.find((g) =>
              g.toLowerCase().includes(data.schoolGrade.toLowerCase()) ||
              data.schoolGrade.toLowerCase().includes(g.toLowerCase().split(' ')[0])
            );
            if (foundGrade) matchedGrade = foundGrade;
            else matchedGrade = data.schoolGrade;
          }

          // Clean up any binary fragments if any slipped through
          let cleanResume = data.resumeText || payload.resumeText || prev.resumeText || '';
          if (cleanResume.startsWith('PK') || cleanResume.includes('[Content_Types].xml') || cleanResume.startsWith('%PDF')) {
            cleanResume = payload.resumeText && !payload.resumeText.startsWith('PK') ? payload.resumeText : `[Parsed from ${payload.fileName || 'CV'}]`;
          }

          // Do NOT overwrite user-selected appliedRole or appliedDepartment
          return {
            ...prev,
            name: data.name || prev.name,
            email: data.email || prev.email,
            phone: data.phone || prev.phone,
            experienceYears: typeof data.experienceYears === 'number' ? data.experienceYears : prev.experienceYears,
            educationalLevel: matchedEduLevel,
            courseOfStudy: data.courseOfStudy || prev.courseOfStudy,
            schoolGrade: matchedGrade,
            resumeText: cleanResume,
          };
        });

        if (Array.isArray(data.skills) && data.skills.length > 0) {
          setSkillsInput(data.skills.join(', '));
        }

        if (result.isFallback) {
          showToast('📄 Candidate credentials extracted from CV (Free local parser fallback).');
        } else {
          showToast('✨ AI successfully extracted candidate credentials! Evaluated against role keywords.');
        }
      } else {
        showToast('CV uploaded. Please verify candidate details.');
      }
    } catch (e) {
      console.warn('AI Resume parse network notice:', e);
      // Emergency client-side extraction if backend is completely unreachable
      if (payload.resumeText || payload.fileName) {
        const text = payload.resumeText || '';
        const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const phoneMatch = text.match(/(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}/);
        setApplicantFormData((prev) => ({
          ...prev,
          email: emailMatch ? emailMatch[0] : prev.email,
          phone: phoneMatch ? phoneMatch[0] : prev.phone,
          resumeText: text || prev.resumeText,
        }));
      }
      showToast('CV file loaded. You can verify and edit fields.');
    } finally {
      setIsParsingResume(false);
    }
  };

  // Filter 1: New Employees added in the past 3 months (90 days)
  const newEmployees = useMemo(() => {
    const now = new Date().getTime();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

    return staffList.filter((staff) => {
      if (staff.status === 'Exited') return false;
      if (!staff.joinDate) {
        // If joinDate is missing, consider them recent if they are active
        return true;
      }
      const joinTime = new Date(staff.joinDate).getTime();
      if (isNaN(joinTime)) return true;
      return now - joinTime <= ninetyDaysMs || joinTime > now;
    });
  }, [staffList]);

  // Filtered New Employees by search & department
  const filteredNewEmployees = useMemo(() => {
    return newEmployees.filter((staff) => {
      const matchesSearch =
        !searchTerm ||
        staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.department.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept =
        selectedDeptFilter === 'All' ||
        (staff.department || '').trim().toLowerCase() === selectedDeptFilter.trim().toLowerCase();

      return matchesSearch && matchesDept;
    });
  }, [newEmployees, searchTerm, selectedDeptFilter]);

  // Filtered Pending Applicants
  const filteredApplicants = useMemo(() => {
    return applicants.filter((app) => {
      const matchesSearch =
        !searchTerm ||
        app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.appliedRole.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.appliedDepartment.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept =
        selectedDeptFilter === 'All' ||
        (app.appliedDepartment || '').trim().toLowerCase() === selectedDeptFilter.trim().toLowerCase();

      const matchesStatus =
        selectedStatusFilter === 'All' || app.status === selectedStatusFilter;

      const matchesVacancy =
        selectedVacancyFilter === 'All' ||
        app.vacancyId === selectedVacancyFilter ||
        app.vacancyTitle?.toLowerCase() === selectedVacancyFilter.toLowerCase();

      return matchesSearch && matchesDept && matchesStatus && matchesVacancy;
    });
  }, [applicants, searchTerm, selectedDeptFilter, selectedStatusFilter, selectedVacancyFilter]);

  // Filtered Interviewees (candidates in Interview Stage awaiting live evaluation)
  const filteredInterviewees = useMemo(() => {
    return applicants.filter((app) => {
      if (app.status !== 'Interviewing') return false;
      const matchesSearch =
        !searchTerm ||
        app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.appliedRole.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.appliedDepartment.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (app.vacancyTitle && app.vacancyTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
        app.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept =
        selectedDeptFilter === 'All' ||
        (app.appliedDepartment || '').trim().toLowerCase() === selectedDeptFilter.trim().toLowerCase();

      const matchesVacancy =
        selectedVacancyFilter === 'All' ||
        app.vacancyId === selectedVacancyFilter ||
        app.vacancyTitle?.toLowerCase() === selectedVacancyFilter.toLowerCase();

      return matchesSearch && matchesDept && matchesVacancy;
    });
  }, [applicants, searchTerm, selectedDeptFilter, selectedVacancyFilter]);

  // Helper: Calculate Headcount Metrics for a Vacancy (Filled + In-Interview vs Target)
  const getVacancyHeadcountMetrics = (vac: JobVacancy) => {
    const filled = vac.filledCount || 0;
    const inInterview = applicants.filter((a) =>
      (a.vacancyId === vac.id || (
        a.appliedDepartment.toLowerCase() === vac.department.toLowerCase() &&
        a.appliedRole.toLowerCase() === vac.role.toLowerCase()
      )) && a.status === 'Interviewing'
    ).length;
    const reserved = filled + inInterview;
    const remaining = Math.max(0, vac.targetHeadcount - reserved);
    const isMaxReached = remaining <= 0;
    const percentFilled = Math.min(100, Math.round((filled / Math.max(1, vac.targetHeadcount)) * 100));
    const percentInterview = Math.min(100 - percentFilled, Math.round((inInterview / Math.max(1, vac.targetHeadcount)) * 100));

    return { filled, inInterview, reserved, remaining, isMaxReached, percentFilled, percentInterview };
  };

  // Helper: Get or Generate Tailored Interview Prep Questions
  const getOrGenerateInterviewQuestions = (applicant: Applicant, vac?: JobVacancy): InterviewQuestionItem[] => {
    if (applicant.interviewQuestions && applicant.interviewQuestions.length > 0) {
      return applicant.interviewQuestions;
    }
    const roleDuties = getStaffRoleDutiesInfo({
      department: applicant.appliedDepartment,
      role: applicant.appliedRole,
    });
    const keyDuty = roleDuties.keyItems?.[0]?.text || roleDuties.items?.[0]?.text || 'operational KPI deliverables and team execution';
    const topSkills = applicant.skills && applicant.skills.length > 0 ? applicant.skills.slice(0, 3).join(', ') : 'core technical and domain capabilities';

    return [
      {
        id: `q-1-${applicant.id}`,
        question: `Can you walk us through a recent project where you applied your expertise in ${topSkills}? What was your specific architectural or execution contribution?`,
        category: 'Technical / Domain',
        status: 'pending',
      },
      {
        id: `q-2-${applicant.id}`,
        question: `In this position, a core operational deliverable is: "${keyDuty}". How have you managed similar deliverables under tight timelines and strict quality standards?`,
        category: 'Operational / SOP',
        status: 'pending',
      },
      {
        id: `q-3-${applicant.id}`,
        question: `Describe an instance where you identified a workflow bottleneck, compliance risk, or quality discrepancy. What corrective procedures did you institute?`,
        category: 'Operational / SOP',
        status: 'pending',
      },
      {
        id: `q-4-${applicant.id}`,
        question: `How do you handle competing priorities when working with cross-functional team members from other departments? Give an example of a resolved negotiation.`,
        category: 'Problem Solving',
        status: 'pending',
      },
      {
        id: `q-5-${applicant.id}`,
        question: `What motivated you to apply for the ${applicant.appliedRole} position at ${companyName}, and how does this align with your career milestones over the next 2-3 years?`,
        category: 'Behavioral / Culture',
        status: 'pending',
      },
    ];
  };

  // Helper: Toggle Question status (pass, fail, pending)
  const handleToggleQuestionStatus = (applicantId: string, questionId: string, newStatus: 'pass' | 'fail' | 'pending') => {
    const updated = applicants.map((app) => {
      if (app.id !== applicantId) return app;
      const questions = (app.interviewQuestions || getOrGenerateInterviewQuestions(app)).map((q) => {
        if (q.id === questionId) {
          return { ...q, status: newStatus };
        }
        return q;
      });
      return { ...app, interviewQuestions: questions };
    });
    saveApplicantsList(updated);
  };

  // Helper: Update question notes
  const handleUpdateQuestionNotes = (applicantId: string, questionId: string, notes: string) => {
    const updated = applicants.map((app) => {
      if (app.id !== applicantId) return app;
      const questions = (app.interviewQuestions || getOrGenerateInterviewQuestions(app)).map((q) => {
        if (q.id === questionId) {
          return { ...q, notes };
        }
        return q;
      });
      return { ...app, interviewQuestions: questions };
    });
    saveApplicantsList(updated);
  };

  // Helper: Invite candidate for Interview (Push to Interviewees tab & reserve 1 headcount seat)
  const handleInviteToInterview = (applicant: Applicant, vac: JobVacancy) => {
    const metrics = getVacancyHeadcountMetrics(vac);
    if (metrics.isMaxReached) {
      showToast(`⚠️ Headcount capacity reached on "${vac.title}" (${metrics.filled} hired, ${metrics.inInterview} in interview). Cancel an interview in the Interviewees tab to reopen seats.`);
      return;
    }

    const questions = getOrGenerateInterviewQuestions(applicant, vac);
    const updated = applicants.map((a) =>
      a.id === applicant.id
        ? {
            ...a,
            status: 'Interviewing' as const,
            interviewQuestions: questions,
            interviewDate: new Date().toISOString().split('T')[0],
          }
        : a
    );
    saveApplicantsList(updated);
    showToast(`🎉 "${applicant.name}" has been invited for interview! Pushed to Interviewees tab.`);
  };

  // Helper: Cancel Onboarding / Reject candidate (Releases 1 headcount seat)
  const handleCancelOnboarding = (applicant: Applicant) => {
    const linkedVac = vacancies.find((v) => v.id === applicant.vacancyId);
    const vacTitle = linkedVac ? linkedVac.title : applicant.appliedRole;

    const updated = applicants.map((a) =>
      a.id === applicant.id ? { ...a, status: 'Rejected' as const } : a
    );
    saveApplicantsList(updated);
    showToast(`Onboarding cancelled for "${applicant.name}". 1 headcount seat reopened on "${vacTitle}".`);
  };

  // Helper: Print Official Offer Letter
  const handlePrintOfferLetter = (applicant: Applicant) => {
    const vac = vacancies.find((v) => v.id === applicant.vacancyId);
    const effSalary = applicant.expectedSalary || vac?.salaryRange?.min || 3500;
    const salaryStr = `${currencySymbol}${effSalary.toLocaleString()}/month`;
    const payGradeStr = vac?.salaryRange?.payGrade || derivePayGradeFromSalary(effSalary, configuredPayGrades);
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const compName = offerLetterSettings.companyName || companyName;
    const roleDuties = getStaffRoleDutiesInfo({ department: applicant.appliedDepartment, role: applicant.appliedRole });

    // Mock staff object for template replacements
    const mockStaff: any = {
      id: applicant.id,
      name: applicant.name,
      employeeId: `CAND-${applicant.id.slice(-4).toUpperCase()}`,
      role: applicant.appliedRole,
      department: applicant.appliedDepartment,
      estimatedMonthlySalary: effSalary,
      salary: salaryStr,
      payGrade: payGradeStr,
      shiftSchedule: 'Morning Standard Shift',
      joinDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      email: applicant.email,
      phone: applicant.phone,
    };

    const renderedSections = offerLetterSettings.sections.map((sec, secIdx) => {
      const secPrefix = getPrefix(secIdx, sec.enumeration, false);
      const title = secPrefix + replaceDocumentTags(sec.title, mockStaff, compName, currentDate);
      let body = '';
      if (sec.type === 'table') {
        const headers = (sec.tableHeaders || ['Employment Clause', 'Offered Specification & Terms'])
          .map((h) => `<th style="border: 1px solid ${offerLetterSettings.lineColor}40; background: ${offerLetterSettings.lineColor}15; padding: 7px 10px; text-align: left; font-size: 10pt; color: ${offerLetterSettings.textColor}; font-weight: 700;">${replaceDocumentTags(h, mockStaff, compName, currentDate)}</th>`)
          .join('');
        const rows = (sec.tableRows || []).map((r) => {
          const cells = r.map((c) => `<td style="border: 1px solid ${offerLetterSettings.lineColor}25; padding: 7px 10px; font-size: 9.5pt; color: ${offerLetterSettings.textColor};">${replaceDocumentTags(c, mockStaff, compName, currentDate)}</td>`).join('');
          return `<tr>${cells}</tr>`;
        }).join('');
        body = `<div style="margin: 10px 0;"><table style="width: 100%; border-collapse: collapse;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
      } else if (sec.type === 'duties_list') {
        const dutyList = (roleDuties.items && roleDuties.items.length > 0 ? roleDuties.items : [{ text: 'Execute designated operational responsibilities and standards' }])
          .map((d) => `<li style="margin-bottom: 5px;">${replaceDocumentTags(d.text, mockStaff, compName, currentDate)}</li>`).join('');
        body = `<ul style="padding-left: 20px; font-size: 10pt; color: ${offerLetterSettings.textColor}; line-height: 1.6; margin: 8px 0;">${dutyList}</ul>`;
      } else {
        body = `<p style="font-size: 10.5pt; color: ${offerLetterSettings.textColor}; line-height: 1.6; margin: 8px 0;">${replaceDocumentTags(sec.text || '', mockStaff, compName, currentDate)}</p>`;
      }

      return `
        <div style="margin-bottom: 18px;">
          <div style="font-weight: 800; font-size: 11pt; color: ${offerLetterSettings.lineColor}; text-transform: uppercase; border-bottom: 1.5px solid ${offerLetterSettings.lineColor}; padding-bottom: 4px; margin-bottom: 8px;">
            ${title}
          </div>
          ${body}
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Offer Letter - ${applicant.name}</title>
          <style>
            @page { size: A4; margin: 18mm; }
            body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; color: ${offerLetterSettings.textColor}; background: #fff; margin: 0; padding: 10px; font-size: 10.5pt; line-height: 1.6; }
            .header-bar { border-bottom: 2.5px solid ${offerLetterSettings.lineColor}; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
            .org-title { font-size: 18px; font-weight: 900; color: ${offerLetterSettings.lineColor}; text-transform: uppercase; letter-spacing: 0.5px; }
            .doc-title { font-size: 14px; font-weight: 800; color: #1e293b; margin-top: 4px; }
            .badge-date { background: #f0fdfa; color: ${offerLetterSettings.lineColor}; border: 1.5px solid ${offerLetterSettings.lineColor}60; font-weight: 700; font-size: 10px; padding: 3px 8px; border-radius: 6px; }
            .sig-container { display: flex; justify-content: space-between; gap: 40px; margin-top: 35px; page-break-inside: avoid; }
            .sig-block { flex: 1; border-top: 1.5px solid #94a3b8; padding-top: 8px; font-size: 9.5pt; }
            .sig-title { font-weight: 700; color: #1e293b; }
            .sig-sub { color: #64748b; font-size: 9pt; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <div class="org-title">${compName}</div>
              <div class="doc-title">${offerLetterSettings.documentTitle}</div>
            </div>
            <div class="badge-date">Date: ${currentDate}</div>
          </div>
          ${renderedSections}
          <div class="sig-container">
            <div class="sig-block">
              <div class="sig-title">${offerLetterSettings.hrSigLabel}</div>
              <div class="sig-sub">For and on behalf of ${compName}</div>
            </div>
            <div class="sig-block">
              <div class="sig-title">${offerLetterSettings.employeeSigLabel}</div>
              <div class="sig-sub">${applicant.name} (Candidate Acknowledgment)</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch (e) {}
    }, 1500);

    const updated = applicants.map((a) => (a.id === applicant.id ? { ...a, offerLetterPrinted: true } : a));
    saveApplicantsList(updated);
    showToast(`📄 Official Offer Letter printed for ${applicant.name}!`);
  };

  // Filtered Vacancies for Vacancies Tab
  const filteredVacancies = useMemo(() => {
    return vacancies.filter((vac) => {
      const matchesSearch =
        !searchTerm ||
        vac.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vac.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vac.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (vac.description && vac.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (vac.requestedBy && vac.requestedBy.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesDept =
        selectedDeptFilter === 'All' ||
        (vac.department || '').trim().toLowerCase() === selectedDeptFilter.trim().toLowerCase();

      const matchesStatus =
        selectedStatusFilter === 'All' || vac.status === selectedStatusFilter;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [vacancies, searchTerm, selectedDeptFilter, selectedStatusFilter]);

  // Closed and occupied vacancies for the History tab
  const closedVacancies = useMemo(() => {
    return vacancies.filter((vac) => {
      const isClosed =
        vac.status === 'Closed' ||
        vac.status === 'Filled' ||
        (vac.targetHeadcount > 0 && (vac.filledCount || 0) >= vac.targetHeadcount);
      if (!isClosed) return false;

      const matchesSearch =
        !searchTerm ||
        vac.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vac.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vac.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (vac.hiredStaffNames && vac.hiredStaffNames.some((n) => n.toLowerCase().includes(searchTerm.toLowerCase())));

      const matchesDept =
        selectedDeptFilter === 'All' ||
        (vac.department || '').trim().toLowerCase() === selectedDeptFilter.trim().toLowerCase();

      return matchesSearch && matchesDept;
    });
  }, [vacancies, searchTerm, selectedDeptFilter]);

  // Handler: Open Push as Staff Modal
  const handleOpenEnrollment = (applicant: Applicant) => {
    const dept = applicant.appliedDepartment || departments[1] || 'Engineering';
    const deptCode = getDepartmentCode(dept);
    const newEmpId = generateStaffId(deptCode, staffList);
    const initialSalary = applicant.expectedSalary || 3500;
    const derivedGrade = derivePayGradeFromSalary(initialSalary, configuredPayGrades);

    setEnrollingApplicant(applicant);
    setEnrollmentForm({
      employeeId: newEmpId,
      name: applicant.name,
      department: dept,
      role: applicant.appliedRole,
      email: applicant.email || '',
      phone: applicant.phone || '',
      dob: '',
      homeAddress: '',
      guarantorName: '',
      guarantorPhone: '',
      guarantorRelationship: 'Parent / Guardian',
      guarantorAddress: '',
      payFrequency: payrollConfig.defaultPayFrequency || 'Monthly',
      payGrade: derivedGrade,
      estimatedMonthlySalary: initialSalary,
      shiftSchedule: 'Morning',
      bankName: '',
      accountNumber: '',
      joinDate: new Date().toISOString().split('T')[0],
    });
  };

  // Handler: Save Enrollment (Push as Staff)
  const handleConfirmEnrollment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollingApplicant || !enrollmentForm.name) return;

    const rawEmpId = (enrollmentForm.employeeId || '').trim();
    const formattedEmpId = isNaEmployeeId(rawEmpId) ? 'N/A' : formatStaffId(rawEmpId);

    const uniqueness = isEmployeeIdUnique(formattedEmpId, staffList);
    if (!uniqueness.isUnique) {
      showToast(`⚠️ Employee ID "${formattedEmpId}" already belongs to ${uniqueness.conflictingStaff?.name || 'another staff member'}. IDs must be unique.`);
      return;
    }

    const newMember: StaffMember = {
      id: `staff-${Date.now()}`,
      employeeId: formattedEmpId,
      name: enrollmentForm.name.trim(),
      department: enrollmentForm.department || 'General',
      role: enrollmentForm.role || 'Staff Member',
      email: enrollmentForm.email.trim(),
      phone: enrollmentForm.phone.trim(),
      dob: enrollmentForm.dob.trim() || undefined,
      homeAddress: enrollmentForm.homeAddress.trim() || undefined,
      guarantorName: enrollmentForm.guarantorName.trim() || undefined,
      guarantorPhone: enrollmentForm.guarantorPhone.trim() || undefined,
      guarantorRelationship: enrollmentForm.guarantorRelationship.trim() || undefined,
      guarantorAddress: enrollmentForm.guarantorAddress.trim() || undefined,
      payGrade: enrollmentForm.payGrade || derivePayGradeFromSalary(Number(enrollmentForm.estimatedMonthlySalary) || 3500, configuredPayGrades),
      payFrequency: enrollmentForm.payFrequency || payrollConfig.defaultPayFrequency || 'Monthly',
      estimatedMonthlySalary: Number(enrollmentForm.estimatedMonthlySalary) || 3500,
      shiftSchedule: enrollmentForm.shiftSchedule || 'Morning',
      status: 'Active',
      joinDate: enrollmentForm.joinDate || new Date().toISOString().split('T')[0],
      bankName: enrollmentForm.bankName.trim() || undefined,
      accountNumber: enrollmentForm.accountNumber.trim() || undefined,
    };

    // Update global staff list
    const updatedStaff = [newMember, ...staffList];
    onUpdateStaffList(updatedStaff);

    // Update applicant status to Hired
    const updatedApplicants = applicants.map((app) =>
      app.id === enrollingApplicant.id ? { ...app, status: 'Hired' as const } : app
    );
    saveApplicantsList(updatedApplicants);

    // Update linked vacancy headcount and record hired staff details
    const linkedVac = vacancies.find(
      (v) => (enrollingApplicant.vacancyId && v.id === enrollingApplicant.vacancyId) ||
             (v.status === 'Open' && v.department.toLowerCase() === enrollmentForm.department.toLowerCase() && v.role.toLowerCase() === enrollmentForm.role.toLowerCase())
    );

    if (linkedVac) {
      const newFilled = (linkedVac.filledCount || 0) + 1;
      const isClosedNow = newFilled >= linkedVac.targetHeadcount;
      const updatedVac: JobVacancy = {
        ...linkedVac,
        filledCount: newFilled,
        hiredStaffNames: Array.from(new Set([...(linkedVac.hiredStaffNames || []), newMember.name])),
        hiredStaffDetails: [
          ...(linkedVac.hiredStaffDetails || []),
          {
            applicantId: enrollingApplicant.id,
            staffId: newMember.id,
            name: newMember.name,
            hiredDate: newMember.joinDate || new Date().toISOString().split('T')[0],
            role: newMember.role,
          },
        ],
        status: isClosedNow ? 'Closed' : 'Open',
        closedDate: isClosedNow ? (newMember.joinDate || new Date().toISOString().split('T')[0]) : linkedVac.closedDate,
      };

      const updatedVacancies = vacancies.map((v) => (v.id === linkedVac.id ? updatedVac : v));
      saveVacanciesList(updatedVacancies);

      if (isClosedNow) {
        showToast(`🎉 Requisition "${linkedVac.title}" is now fully occupied (${newFilled}/${linkedVac.targetHeadcount} seats) and closed! Recorded in History.`);
      }
    }

    showToast(`🎉 "${newMember.name}" has been successfully enrolled into the active Staff Directory!`);
    setEnrollingApplicant(null);

    // Switch to History tab to display newly enrolled employee and closed role
    setActiveTab('history');

    // Prompt confirmation letter if available
    if (onOpenConfirmationLetter) {
      setTimeout(() => {
        onOpenConfirmationLetter(newMember);
      }, 600);
    }
  };

  // Handler: Save New Applicant
  const handleSaveNewApplicant = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRole = isCustomRole ? customRoleInput.trim() : (applicantFormData.appliedRole?.trim() || '');
    if (!applicantFormData.name || !finalRole) {
      showToast('Please provide candidate name and applied role.');
      return;
    }

    const skillsArray = skillsInput
      ? skillsInput.split(',').map((s) => s.trim()).filter(Boolean)
      : applicantFormData.skills || [];

    const eduLevel = applicantFormData.educationalLevel || "Bachelor's Degree (B.Sc / B.A / B.Eng)";
    const course = applicantFormData.courseOfStudy?.trim() || '';
    const grade = applicantFormData.schoolGrade?.trim() || '';
    const compositeEducation = course
      ? `${eduLevel} in ${course}${grade && grade !== 'Not Applicable / None' ? ` (${grade.split('/')[0].trim()})` : ''}`
      : eduLevel;

    const newApplicant: Applicant = {
      id: `app-${Date.now()}`,
      name: applicantFormData.name.trim(),
      email: applicantFormData.email?.trim() || '',
      phone: applicantFormData.phone?.trim() || '',
      appliedDepartment: applicantFormData.appliedDepartment || departments.filter((d) => d !== 'All')[0] || 'Operations',
      appliedRole: finalRole,
      vacancyId: applicantFormData.vacancyId || undefined,
      vacancyTitle: applicantFormData.vacancyTitle || undefined,
      experienceYears: Number(applicantFormData.experienceYears) || 1,
      expectedSalary: Number(applicantFormData.expectedSalary) || 3000,
      education: compositeEducation,
      educationalLevel: eduLevel,
      courseOfStudy: course || undefined,
      schoolGrade: grade || undefined,
      skills: skillsArray,
      resumeText: applicantFormData.resumeText?.trim() || `${applicantFormData.name}\n${finalRole}\nEducation: ${compositeEducation}\nSkills: ${skillsArray.join(', ')}`,
      appliedDate: new Date().toISOString().split('T')[0],
      status: 'Pending',
      notes: applicantFormData.notes?.trim() || '',
      rating: 4,
    };

    const updated = [newApplicant, ...applicants];
    saveApplicantsList(updated);
    showToast(`Applicant "${newApplicant.name}" added to screening pipeline!`);
    setIsAddApplicantOpen(false);
    handleClearApplicantForm();
  };

  // Handler: Delete Applicant
  const handleDeleteApplicant = (appId: string) => {
    const updated = applicants.filter((a) => a.id !== appId);
    saveApplicantsList(updated);
    showToast('Applicant record removed from pipeline.');
  };

  // Helper: Calculate relative days since joining
  const getTenureText = (joinDateStr?: string) => {
    if (!joinDateStr) return 'Recently Onboarded';
    const joinDate = new Date(joinDateStr);
    if (isNaN(joinDate.getTime())) return 'Recently Onboarded';
    const now = new Date();
    const diffMs = now.getTime() - joinDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Starts on ${joinDateStr}`;
    if (diffDays === 0) return 'Joined Today (New)';
    if (diffDays === 1) return 'Joined Yesterday';
    if (diffDays <= 30) return `Joined ${diffDays} days ago`;
    const months = Math.floor(diffDays / 30);
    return `Joined ~${months} month${months > 1 ? 's' : ''} ago (${diffDays}d)`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 px-4 py-3 rounded-2xl bg-emerald-600 text-white font-medium text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      <div
        className={`w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        {/* Top Header */}
        <div
          className={`p-4 sm:p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 ${
            isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">Applicant Tracking & Onboarding</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  ATS Hub
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Screen applicant CVs with ATS role correlation, track recent hires, and enroll candidates directly as staff.
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => handleOpenAddApplicant()}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition cursor-pointer"
              title="Add a candidate to a vacant role or pipeline"
            >
              <Plus className="w-4 h-4" />
              <span>Add Applicant</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onDirectAddEmployee();
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Add Employee directly into directory without ATS screening"
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>Direct Add Employee</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              title="Close ATS Workspace"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Strip Immediately Underneath Header */}
        <div
          className={`px-4 sm:px-6 py-2.5 border-b flex items-center justify-between gap-4 text-xs font-mono flex-wrap shrink-0 ${
            isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-slate-950/80 border-slate-800/80'
          }`}
        >
          <div className="flex items-center gap-2.5 sm:gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-slate-500 dark:text-slate-400">Open Vacancies:</span>
              <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-500 font-bold border border-blue-500/20">
                {vacancies.filter((v) => v.status === 'Open').length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-slate-500 dark:text-slate-400">Interview Stage:</span>
              <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
                {applicants.filter((a) => a.status === 'Interviewing').length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-slate-500 dark:text-slate-400">Total Applicants:</span>
              <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                {applicants.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-500 dark:text-slate-400">Occupied & Closed:</span>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                {closedVacancies.length}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 font-sans">
            <BadgeCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>Modular Headcount & Role Benchmark ATS</span>
          </div>
        </div>

        {/* Tab Navigation & Search Filters Bar */}
        <div className={`p-4 border-b space-y-3 shrink-0 ${isLight ? 'bg-slate-50/40 border-slate-200' : 'bg-slate-900/50 border-slate-800'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* The 3 ATS Core Tabs */}
            <div className="flex items-center gap-1.5 sm:gap-2 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-950/70 border border-slate-300/40 dark:border-slate-800/80 w-fit flex-wrap">
              <button
                onClick={() => setActiveTab('vacancies')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'vacancies'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:white'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Vacancies & Roles</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/20 text-white font-semibold">
                  {vacancies.filter((v) => v.status === 'Open').length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('interviewees')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'interviewees'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Interviewees</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  {applicants.filter((a) => a.status === 'Interviewing').length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:white'
                }`}
              >
                <History className="w-3.5 h-3.5 text-emerald-400" />
                <span>History & Onboarding</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  {closedVacancies.length + newEmployees.length}
                </span>
              </button>
            </div>

            {/* Create Vacancy Button - Placed in tab section, only shown on Vacancies & Roles tab */}
            {activeTab === 'vacancies' && (
              <button
                type="button"
                onClick={() => handleOpenCreateVacancy()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition cursor-pointer self-start sm:self-auto shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create Vacancy</span>
              </button>
            )}
          </div>

          {/* Search & Department Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={
                  activeTab === 'vacancies'
                    ? 'Search vacancies by role, title, department, skills, or requester...'
                    : activeTab === 'interviewees'
                    ? 'Search interviewees by candidate name, role, department, or vacancy...'
                    : 'Search closed roles, occupied staff names, or new hires...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border outline-none transition ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    : 'bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500'
                }`}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                <Filter className="w-3.5 h-3.5" />
                <span>Dept:</span>
              </div>
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className={`px-3 py-2 rounded-xl text-xs border outline-none transition ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900'
                    : 'bg-slate-950 border-slate-800 text-slate-200'
                }`}
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {activeTab === 'interviewees' && (
                <>
                  <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Vacancy:</span>
                  </div>
                  <select
                    value={selectedVacancyFilter}
                    onChange={(e) => setSelectedVacancyFilter(e.target.value)}
                    className={`px-3 py-2 rounded-xl text-xs border outline-none transition max-w-[160px] truncate ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-slate-950 border-slate-800 text-slate-200'
                    }`}
                  >
                    <option value="All">All Vacancies</option>
                    {vacancies.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {activeTab === 'vacancies' && (
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className={`px-3 py-2 rounded-xl text-xs border outline-none transition ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-800 text-slate-200'
                  }`}
                >
                  <option value="All">All Statuses</option>
                  <option value="Open">Open Only</option>
                  <option value="Closed">Closed Only</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Modal Main Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* ========================================================================= */}
          {/* TAB 1: VACANCIES & ROLE REQUISITIONS */}
          {/* ========================================================================= */}
          {activeTab === 'vacancies' && (
            <div className="space-y-4">
              {filteredVacancies.length === 0 ? (
                <div
                  className={`p-12 text-center rounded-3xl border border-dashed ${
                    isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-950/40 border-slate-800'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-3">
                    <Briefcase className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-sm">No Vacancies Found</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    No vacancy requisitions match your search and filter criteria. Create a new vacancy to start accepting and benchmarking candidates.
                  </p>
                  <button
                    onClick={() => handleOpenCreateVacancy()}
                    className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Vacancy Requisition</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredVacancies.map((vac) => {
                    const metrics = getVacancyHeadcountMetrics(vac);
                    const isClosed = vac.status === 'Closed' || vac.status === 'Filled' || metrics.remaining === 0;
                    const applicantsForVac = applicants.filter(
                      (a) =>
                        a.vacancyId === vac.id ||
                        (a.appliedDepartment.toLowerCase() === vac.department.toLowerCase() &&
                          a.appliedRole.toLowerCase() === vac.role.toLowerCase())
                    );
                    const isExpanded = expandedVacancyId === vac.id;
                    const selectedApplicantForVac = applicants.find(
                      (a) =>
                        a.id === selectedApplicantId &&
                        (a.vacancyId === vac.id ||
                          (a.appliedDepartment.toLowerCase() === vac.department.toLowerCase() &&
                            a.appliedRole.toLowerCase() === vac.role.toLowerCase()))
                    );
                    const selectedAts = selectedApplicantForVac
                      ? calculateATSScore(selectedApplicantForVac, dbDepartments, vac)
                      : null;

                    // Extract role details from Departments tab
                    const targetDept = dbDepartments.find(
                      (d) => (d.name || '').trim().toLowerCase() === vac.department.trim().toLowerCase()
                    );
                    const deptRole = (targetDept?.roles || []).find(
                      (r) => (r.title || '').trim().toLowerCase() === vac.role.trim().toLowerCase()
                    );
                    const dutiesInfo = getStaffRoleDutiesInfo({ department: vac.department, role: vac.role });
                    const roleSummaryFromDept =
                      (deptRole?.summary && deptRole.summary.trim()) ||
                      (deptRole?.jobDescription && deptRole.jobDescription.trim()) ||
                      vac.description ||
                      'Standard operational deliverables, mission scope, and core competencies defined for this role.';

                    const roleDutiesList =
                      (deptRole?.items && deptRole.items.length > 0)
                        ? deptRole.items
                        : (dutiesInfo.items && dutiesInfo.items.length > 0)
                        ? dutiesInfo.items
                        : [];

                    // Evaluate vacancy ATS skills against the candidate (ticks vs crosses)
                    const requiredSkillsList =
                      (vac.requiredSkills && vac.requiredSkills.length > 0)
                        ? vac.requiredSkills
                        : (selectedAts ? [...selectedAts.matchedKeywords, ...selectedAts.missingKeywords] : []);

                    const candidateSkillsLower = (selectedApplicantForVac?.skills || []).map((s) => s.trim().toLowerCase());
                    const candidateMatchedKwsLower = (selectedAts?.matchedKeywords || []).map((k) => k.trim().toLowerCase());
                    const cvTextLower = (selectedApplicantForVac?.cvText || '').toLowerCase();

                    const evaluatedSkills = requiredSkillsList.map((skill) => {
                      const sLower = skill.trim().toLowerCase();
                      const hasSkill =
                        candidateMatchedKwsLower.some((k) => k === sLower || k.includes(sLower) || sLower.includes(k)) ||
                        candidateSkillsLower.some((k) => k === sLower || k.includes(sLower) || sLower.includes(k)) ||
                        (cvTextLower.length > 0 && cvTextLower.includes(sLower));
                      return { skill, hasSkill };
                    });
                    const matchedSkillsCount = evaluatedSkills.filter((e) => e.hasSkill).length;
                    const isDropdownOpen = openVacancyDropdownIds.includes(vac.id);

                    return (
                      <div
                        key={vac.id}
                        className={`w-full rounded-2xl border transition-all overflow-hidden ${
                          isLight
                            ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
                            : 'bg-slate-950/80 border-slate-800 shadow-md hover:border-slate-700'
                        }`}
                      >
                        {/* ========================================================================= */}
                        {/* DROPDOWN FORM HEADER (Compact, clickable accordion banner) */}
                        {/* ========================================================================= */}
                        <div
                          onClick={() => toggleVacancyDropdown(vac.id)}
                          className={`p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                            isDropdownOpen
                              ? isLight
                                ? 'bg-slate-50/90 border-b border-slate-200'
                                : 'bg-slate-900/90 border-b border-slate-800'
                              : isLight
                              ? 'hover:bg-slate-50/70'
                              : 'hover:bg-slate-900/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                                isDropdownOpen
                                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                                  : isLight
                                  ? 'bg-slate-100 text-slate-500'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              <ChevronDown
                                className={`w-4 h-4 transition-transform duration-200 ${
                                  isDropdownOpen ? 'rotate-180' : ''
                                }`}
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-snug truncate">
                                  {vac.title}
                                </h4>
                                <span className="px-2 py-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 shrink-0">
                                  #{vac.id.slice(-4).toUpperCase()}
                                </span>
                                {isClosed ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>CLOSED</span>
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                    <span>OPEN</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                                <span>{vac.department}</span>
                                <span>•</span>
                                <span className="font-mono text-[11px] text-slate-400">
                                  {vac.employmentType || 'Full-time'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right side of Dropdown Header: Headcount info, Applicants count & Quick actions */}
                          <div
                            className="flex items-center gap-2.5 shrink-0 flex-wrap justify-between md:justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* # Candidates display */}
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                              <FileText className="w-3.5 h-3.5 text-blue-500" />
                              <span>{applicantsForVac.length} Candidate{applicantsForVac.length === 1 ? '' : 's'}</span>
                            </div>

                            {/* Open Applicant Analysis Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (isDropdownOpen && isExpanded) {
                                  setExpandedVacancyId(null);
                                  setSelectedApplicantId(null);
                                } else {
                                  if (!openVacancyDropdownIds.includes(vac.id)) {
                                    setOpenVacancyDropdownIds((prev) => [...prev, vac.id]);
                                  }
                                  setExpandedVacancyId(vac.id);
                                  if (applicantsForVac.length > 0) {
                                    setSelectedApplicantId(applicantsForVac[0].id);
                                  }
                                }
                              }}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                                isDropdownOpen && isExpanded
                                  ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                              }`}
                              title="Open applicant roster and analyze candidate ATS scores"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>{isDropdownOpen && isExpanded ? 'Close Applicant Analysis' : 'Open Applicant Analysis'}</span>
                            </button>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenCreateVacancy(vac)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 border border-indigo-200/80 dark:border-indigo-800/80 transition cursor-pointer shadow-xs"
                                title="View requisition details, edit parameters, or adjust headcount to re-open"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                                <span>View & Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteVacancy(vac.id)}
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                title="Delete Requisition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* ========================================================================= */}
                        {/* DROPDOWN BODY: CONNECTED LEFT SIDE (37.5%) & RIGHT SIDE (62.5%) */}
                        {/* ========================================================================= */}
                        {isDropdownOpen && (
                          <div className="grid grid-cols-1 lg:grid-cols-[3fr_5fr] divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
                            {/* ========================================================================= */}
                            {/* 1. LEFT PANE (37.5% Width): Vacancy Description & Applicant Roster */}
                            {/* ========================================================================= */}
                            <div className="p-4 sm:p-5 flex flex-col justify-between gap-4">
                              <div className="space-y-3.5">
                                {/* Role Headcount Capacity Bar (No Fulfilled text) */}
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                      <Users className="w-3.5 h-3.5 text-blue-500" />
                                      <span>Headcount Progress:</span>
                                    </span>
                                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                      {metrics.filled} / {vac.targetHeadcount} Hired
                                      {metrics.remaining > 0 && (
                                        <span className="ml-1 text-blue-500 font-semibold">
                                          ({metrics.remaining} open)
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
                                    <div
                                      className="h-full bg-emerald-500 transition-all duration-500"
                                      style={{ width: `${metrics.percentFilled}%` }}
                                      title={`${metrics.filled} Hired`}
                                    />
                                    <div
                                      className="h-full bg-indigo-500 transition-all duration-500"
                                      style={{ width: `${metrics.percentInterview}%` }}
                                      title={`${metrics.inInterview} in Interview`}
                                    />
                                  </div>
                                </div>

                                {/* Under Capacity: Applicant Roster OR Vacancy Description */}
                                {isExpanded ? (
                                  <div className="space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                                        <span>Applicants ({applicantsForVac.length})</span>
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        Click to inspect →
                                      </span>
                                    </div>

                                    {applicantsForVac.length === 0 ? (
                                      <div className="p-5 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                                        <Users className="w-6 h-6 text-slate-400 mx-auto mb-1.5 opacity-50" />
                                        <div className="text-xs font-semibold text-slate-400">
                                          No Applicants Yet
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                          Add a candidate to this vacancy to start screening.
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
                                        {applicantsForVac.map((app) => {
                                          const ats = calculateATSScore(app, dbDepartments, vac);
                                          const isSelected = selectedApplicantId === app.id;
                                          const isInterviewing = app.status === 'Interviewing';
                                          const isHired = app.status === 'Hired';

                                          return (
                                            <div
                                              key={app.id}
                                              onClick={() => setSelectedApplicantId(app.id)}
                                              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                                                isSelected
                                                  ? 'bg-indigo-50/90 dark:bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                                                  : isLight
                                                  ? 'bg-slate-50/80 hover:bg-slate-100/90 border-slate-200'
                                                  : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800'
                                              }`}
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0 shadow-xs">
                                                    {app.name
                                                      .split(' ')
                                                      .map((n) => n[0])
                                                      .join('')
                                                      .slice(0, 2)
                                                      .toUpperCase()}
                                                  </div>
                                                  <div>
                                                    <h6 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                                                      {app.name}
                                                    </h6>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                      {app.experienceYears ?? 0} yrs exp
                                                    </div>
                                                  </div>
                                                </div>

                                                {/* Percentage of Match Badge */}
                                                <div
                                                  className={`px-2 py-0.5 rounded-lg border text-center shrink-0 ${ats.color}`}
                                                >
                                                  <div className="font-mono font-extrabold text-[11px] leading-tight">
                                                    {ats.overallPercentage}%
                                                  </div>
                                                  <div className="text-[7.5px] font-bold tracking-tight uppercase leading-none">
                                                    Match
                                                  </div>
                                                </div>
                                              </div>

                                              <div className="mt-2 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between text-[10px]">
                                                <div className="flex items-center gap-1.5">
                                                  {isInterviewing ? (
                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                                      Interview
                                                    </span>
                                                  ) : isHired ? (
                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                      Enrolled
                                                    </span>
                                                  ) : (
                                                    <span className="text-slate-400 font-mono">
                                                      {app.education ? app.education.split(' ')[0] : 'Degree'}
                                                    </span>
                                                  )}
                                                </div>

                                                <span className="text-indigo-500 font-semibold hover:underline">
                                                  {isSelected ? 'Inspecting' : 'Inspect →'}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  /* Vacancy Description: Target Dept, Dept Head, Exp, Education, Salary */
                                  <div className="space-y-3 pt-1 text-[11px]">
                                    <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
                                      <div>
                                        <span className="text-slate-400 block font-mono text-[10px]">TARGET DEPT:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                                          {vac.department}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block font-mono text-[10px]">DEPT HEAD:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block" title={vac.requestedBy || 'Department Head'}>
                                          {vac.requestedBy || 'Department Head'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block font-mono text-[10px]">EXP REQUIRED:</span>
                                        <span className="font-medium text-slate-700 dark:text-slate-200">
                                          {vac.experienceRequired}+ Years
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block font-mono text-[10px]">MIN EDUCATION:</span>
                                        <span className="font-medium text-slate-700 dark:text-slate-200 truncate block" title={vac.minEducationalLevel}>
                                          {vac.minEducationalLevel || 'Degree'}
                                        </span>
                                      </div>
                                      <div className="col-span-2 pt-1 border-t border-slate-200/40 dark:border-slate-800/40">
                                        <span className="text-slate-400 block font-mono text-[10px]">SALARY RANGE:</span>
                                        <span className="font-medium text-slate-700 dark:text-slate-200 font-mono">
                                          {vac.salaryRange
                                            ? `${currencySymbol}${vac.salaryRange.min.toLocaleString()} - ${currencySymbol}${vac.salaryRange.max.toLocaleString()}`
                                            : 'Standard'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Left Pane Bottom Actions */}
                              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedVacancyId(null);
                                        setSelectedApplicantId(null);
                                      }}
                                      className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                                    >
                                      <ArrowLeft className="w-3.5 h-3.5" />
                                      <span>Back to Description</span>
                                    </button>
                                  ) : (
                                    <>
                                      {!isClosed && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenAddApplicantForVacancy(vac)}
                                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                          <span>Add Applicant</span>
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* ========================================================================= */}
                            {/* 2. RIGHT PANE (62.5% Width): Job Summary & Candidate Deep Analysis */}
                            {/* ========================================================================= */}
                            <div className="p-4 sm:p-5 flex flex-col justify-between gap-4 bg-slate-50/40 dark:bg-slate-900/20">
                              <div>
                                {/* Adapting Header: "Describing: [Candidate Name]" OR "Describing: [Role]" */}
                                <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-10 h-10 rounded-2xl font-bold flex items-center justify-center text-xs shrink-0 shadow-xs ${
                                        selectedApplicantForVac
                                          ? 'bg-gradient-to-tr from-indigo-600 to-blue-500 text-white'
                                          : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                      }`}
                                    >
                                      {selectedApplicantForVac ? (
                                        selectedApplicantForVac.name
                                          .split(' ')
                                          .map((n) => n[0])
                                          .join('')
                                          .slice(0, 2)
                                          .toUpperCase()
                                      ) : (
                                        <Briefcase className="w-5 h-5" />
                                      )}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                                          Describing: {selectedApplicantForVac ? selectedApplicantForVac.name : vac.role}
                                        </h4>
                                        {selectedApplicantForVac ? (
                                          <>
                                            {selectedApplicantForVac.status === 'Interviewing' && (
                                              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                                IN INTERVIEW
                                              </span>
                                            )}
                                            {selectedApplicantForVac.status === 'Hired' && (
                                              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                ENROLLED
                                              </span>
                                            )}
                                          </>
                                        ) : isClosed ? (
                                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                            CLOSED
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                            OPEN
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                                        {selectedApplicantForVac ? (
                                          <>
                                            <span>{selectedApplicantForVac.email}</span>
                                            {selectedApplicantForVac.phone && <span>• {selectedApplicantForVac.phone}</span>}
                                            <span>• Applied: {selectedApplicantForVac.appliedDate}</span>
                                          </>
                                        ) : (
                                          <>
                                            <span>{vac.department}</span>
                                            <span>•</span>
                                            <span>{vac.employmentType || 'Full-time'}</span>
                                            <span>•</span>
                                            <span className="font-mono">Req #{vac.id.slice(-4).toUpperCase()}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {selectedApplicantForVac && selectedAts ? (
                                    <div className="flex items-center gap-2">
                                      <div
                                        className={`px-3 py-1.5 rounded-xl border flex flex-col items-center justify-center shrink-0 ${selectedAts.color}`}
                                      >
                                        <div className="flex items-center gap-1 font-mono font-extrabold text-xs">
                                          <Sparkles className="w-3.5 h-3.5" />
                                          <span>{selectedAts.overallPercentage}% Match</span>
                                        </div>
                                        <span className="text-[8px] font-bold tracking-tight uppercase">
                                          {selectedAts.grade}
                                        </span>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => setSelectedApplicantId(null)}
                                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                                        title="Clear selection & view role summary"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                                      {applicantsForVac.length} Applicant{applicantsForVac.length === 1 ? '' : 's'}
                                    </span>
                                  )}
                                </div>

                                {/* Body Content: Candidate Analysis OR Role Description with Job Summary */}
                                {selectedApplicantForVac && selectedAts ? (
                                  /* Applicant Deep Analysis Display */
                                  <div className="space-y-4 mt-3.5">
                                    {/* Qualifications & Score Breakdown */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                        <span className="text-[10px] font-mono text-slate-400 block">EXPERIENCE:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                          {selectedApplicantForVac.experienceYears ?? 0} Yrs ({selectedAts.experienceScore}/35)
                                        </span>
                                      </div>
                                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                        <span className="text-[10px] font-mono text-slate-400 block">EDUCATION:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                                          {selectedApplicantForVac.education || 'Degree'} ({selectedAts.educationScore}/25)
                                        </span>
                                      </div>
                                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                        <span className="text-[10px] font-mono text-slate-400 block">EXPECTED SALARY:</span>
                                        <span className="font-bold text-emerald-500 font-mono">
                                          {selectedApplicantForVac.expectedSalary
                                            ? `${currencySymbol}${selectedApplicantForVac.expectedSalary.toLocaleString()}`
                                            : 'Negotiable'}
                                        </span>
                                      </div>
                                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                        <span className="text-[10px] font-mono text-slate-400 block">KEYWORDS MATCH:</span>
                                        <span className="font-bold text-blue-500">
                                          {selectedAts.keywordScore} / 40 Pts
                                        </span>
                                      </div>
                                    </div>

                                    {/* ATS Skills Marked with Tick (✓) if candidate has it, and Cross (✗) if not */}
                                    <div className="mt-3 space-y-2">
                                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 uppercase">
                                        <span>ATS Skills Match:</span>
                                        <span className="text-slate-500 font-mono">
                                          {matchedSkillsCount} of {evaluatedSkills.length} Skills Matched
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 scrollbar-thin">
                                        {evaluatedSkills.length > 0 ? (
                                          evaluatedSkills.map((item, idx) => (
                                            <span
                                              key={idx}
                                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 border shrink-0 whitespace-nowrap transition ${
                                                item.hasSkill
                                                  ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/30'
                                                  : 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/30'
                                              }`}
                                            >
                                              {item.hasSkill ? (
                                                <span className="font-bold text-emerald-500">✓</span>
                                              ) : (
                                                <span className="font-bold text-rose-500">✗</span>
                                              )}
                                              <span>{item.skill}</span>
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-[11px] text-slate-400 italic">No ATS screening skills configured for this role.</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* ATS Summary */}
                                    <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                      <span className="font-bold text-blue-500 mr-1.5">ATS Assessment:</span>
                                      {selectedAts.summary}
                                    </div>
                                  </div>
                                ) : (
                                  /* Default Content: Vacancy Role Description with Job Summary from Departments Tab */
                                  <div className="space-y-3.5 mt-3.5">
                                    {/* Job Summary from Departments Tab */}
                                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-xs leading-relaxed">
                                      <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 mb-1.5">
                                        <FileText className="w-4 h-4 text-indigo-500" />
                                        <span>Job Summary</span>
                                      </div>
                                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                        {roleSummaryFromDept}
                                      </p>
                                    </div>

                                    {/* ATS Required Screening Skills - Single Line with Horizontal Scroller */}
                                    {vac.requiredSkills && vac.requiredSkills.length > 0 && (
                                      <div className="space-y-1.5 pt-1">
                                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">
                                          Required ATS Screening Skills:
                                        </span>
                                        <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 scrollbar-thin">
                                          {vac.requiredSkills.map((s, idx) => (
                                            <span
                                              key={idx}
                                              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0 whitespace-nowrap"
                                            >
                                              {s}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {isExpanded && applicantsForVac.length > 0 && (
                                      <div className="p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/40 dark:border-indigo-800/40 flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
                                        <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                                        <span>Click on any applicant from the roster on the left to inspect their ATS correlation, matched skills, and invite them for interview.</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Right Pane Bottom Actions */}
                              {selectedApplicantForVac && selectedAts ? (
                                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => setViewingCvApplicant(selectedApplicantForVac)}
                                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                                  >
                                    <FileText className="w-4 h-4 text-blue-400" />
                                    <span>View Full CV / Resume</span>
                                  </button>

                                  <div className="flex items-center gap-2">
                                    {selectedApplicantForVac.status === 'Interviewing' ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedVacancyFilter(vac.id);
                                          setActiveTab('interviewees');
                                        }}
                                        className="px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-500/30 transition cursor-pointer"
                                      >
                                        <Sparkles className="w-4 h-4" />
                                        <span>In Interview (View Tab)</span>
                                      </button>
                                    ) : selectedApplicantForVac.status === 'Hired' ? (
                                      <span className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
                                        <Check className="w-4 h-4" />
                                        <span>Enrolled as Staff</span>
                                      </span>
                                    ) : metrics.isMaxReached ? (
                                      <button
                                        type="button"
                                        disabled
                                        className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed border border-slate-300 dark:border-slate-700"
                                        title="Headcount limit reached on this vacancy."
                                      >
                                        <Lock className="w-4 h-4" />
                                        <span>Headcount Full</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleInviteToInterview(selectedApplicantForVac, vac)}
                                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition cursor-pointer"
                                      >
                                        <Sparkles className="w-4 h-4 text-indigo-200" />
                                        <span>Invite for Interview</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: INTERVIEWEES & LIVE INTERVIEW EVALUATION PIPELINE */}
          {/* ========================================================================= */}
          {activeTab === 'interviewees' && (
            <div className="space-y-4">
              {/* Interviewees Banner */}
              <div
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isLight ? 'bg-indigo-50/60 border-indigo-200' : 'bg-indigo-950/20 border-indigo-900/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-500 flex items-center justify-center font-bold">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      Candidate Interview Queue & Live Evaluation Worksheets
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Review invited candidates awaiting interview. Use the live question worksheet to score competencies, print official offer letters, or push approved candidates directly as staff.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="px-3 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 text-xs font-mono font-bold">
                    {filteredInterviewees.length} Interviewee{filteredInterviewees.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {filteredInterviewees.length === 0 ? (
                <div
                  className={`p-12 text-center rounded-3xl border border-dashed ${
                    isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-950/40 border-slate-800'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-sm">No Candidates in Interview Queue</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Screen candidate applications in the "Vacancies & Roles" tab and click "Invite for Interview" on any matching candidate to begin their interview evaluation here.
                  </p>
                  <button
                    onClick={() => setActiveTab('vacancies')}
                    className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>Go to Vacancies & Roles</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredInterviewees.map((candidate) => {
                    const linkedVac =
                      vacancies.find((v) => v.id === candidate.vacancyId) ||
                      vacancies.find(
                        (v) =>
                          v.department.toLowerCase() === candidate.appliedDepartment.toLowerCase() &&
                          v.role.toLowerCase() === candidate.appliedRole.toLowerCase()
                      );
                    const ats = calculateATSScore(candidate, dbDepartments, linkedVac);
                    const questions = candidate.interviewQuestions || getOrGenerateInterviewQuestions(candidate, linkedVac);
                    const passedCount = questions.filter((q) => q.status === 'pass').length;
                    const failedCount = questions.filter((q) => q.status === 'fail').length;

                    return (
                      <div
                        key={candidate.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-4 ${
                          isLight
                            ? 'bg-white border-slate-200 shadow-sm'
                            : 'bg-slate-950/80 border-slate-800 shadow-md'
                        }`}
                      >
                        {/* Interviewee Header */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-bold flex items-center justify-center text-sm shadow shrink-0">
                              {candidate.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                                  {candidate.name}
                                </h4>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                  AWAITING INTERVIEW
                                </span>
                                {candidate.offerLetterPrinted && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                    <FileCheck className="w-3 h-3" />
                                    <span>OFFER LETTER PRINTED</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                                <span className="font-medium text-blue-600 dark:text-blue-400">
                                  {candidate.appliedRole}
                                </span>
                                <span>•</span>
                                <span>{candidate.appliedDepartment}</span>
                                {linkedVac && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-indigo-400">
                                      Req #{linkedVac.id.slice(-4).toUpperCase()}: {linkedVac.title}
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                                <span>{candidate.email}</span>
                                {candidate.phone && <span>• {candidate.phone}</span>}
                                {candidate.interviewDate && <span>• Invited: {candidate.interviewDate}</span>}
                              </div>
                            </div>
                          </div>

                          {/* ATS Correlation Pill */}
                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <div
                              className={`px-3 py-1.5 rounded-xl border flex flex-col items-center justify-center shrink-0 ${ats.color}`}
                            >
                              <div className="flex items-center gap-1 font-mono font-extrabold text-xs">
                                <Sparkles className="w-3 h-3" />
                                <span>{ats.overallPercentage}% Match</span>
                              </div>
                              <span className="text-[9px] font-bold tracking-tight uppercase">
                                {ats.grade}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Candidate Fast Profile Overview */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-[11px]">
                          <div>
                            <span className="text-slate-400 block font-mono text-[10px]">EXPERIENCE:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {candidate.experienceYears ?? 0} Years
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-mono text-[10px]">EDUCATION:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block">
                              {candidate.education || 'Degree'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-mono text-[10px]">EXPECTED SALARY:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {candidate.expectedSalary
                                ? `${currencySymbol}${candidate.expectedSalary.toLocaleString()}/mo`
                                : 'Negotiable'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-mono text-[10px]">HEADCOUNT STATUS:</span>
                            <span className="font-semibold text-indigo-400">
                              1 Seat Reserved
                            </span>
                          </div>
                        </div>

                        {/* ========================================================================= */}
                        {/* DYNAMIC INTERVIEW PREP QUESTION WORKSHEET */}
                        {/* ========================================================================= */}
                        <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <h5 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                                <CheckSquare className="w-4 h-4 text-indigo-400" />
                                <span>Live Interview Prep Worksheet ({questions.length} Questions)</span>
                              </h5>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Tick Pass or Fail on each competency question to assist the interview panel. Results save automatically.
                              </p>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] font-mono">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                                {passedCount} Pass
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30 font-semibold">
                                {failedCount} Fail
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-400 font-semibold">
                                {questions.length - passedCount - failedCount} Pending
                              </span>
                            </div>
                          </div>

                          {/* Questions List */}
                          <div className="space-y-2.5">
                            {questions.map((q, qIndex) => {
                              const isPass = q.status === 'pass';
                              const isFail = q.status === 'fail';

                              return (
                                <div
                                  key={q.id}
                                  className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center">
                                          {qIndex + 1}
                                        </span>
                                        {q.category && (
                                          <span className="px-2 py-0.2 rounded text-[9px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                                            {q.category}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                        {q.question}
                                      </p>
                                    </div>

                                    {/* Pass / Fail Toggle Buttons */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleToggleQuestionStatus(candidate.id, q.id, isPass ? 'pending' : 'pass')
                                        }
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                                          isPass
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-400'
                                        }`}
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Pass</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleToggleQuestionStatus(candidate.id, q.id, isFail ? 'pending' : 'fail')
                                        }
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                                          isFail
                                            ? 'bg-rose-600 text-white shadow-sm'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-500/20 hover:text-rose-400'
                                        }`}
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                        <span>Fail</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Notes field */}
                                  <input
                                    type="text"
                                    placeholder="Optional interviewer notes for this question..."
                                    value={q.notes || ''}
                                    onChange={(e) => handleUpdateQuestionNotes(candidate.id, q.id, e.target.value)}
                                    className={`w-full px-2.5 py-1 text-[11px] rounded-lg border outline-none ${
                                      isLight
                                        ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-400'
                                        : 'bg-slate-900 border-slate-800 text-slate-200 focus:border-indigo-500'
                                    }`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Interviewee Action Footer */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setViewingCvApplicant(candidate)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-400" />
                              <span>View CV</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setOfferLetterConfirmApplicant(candidate)}
                              className="px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                              title="Print official employment offer letter"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print Offer Letter</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCancelOnboarding(candidate)}
                              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                              title="Cancel candidate onboarding and release 1 headcount seat on this vacancy"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Cancel Onboarding</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEnrollment(candidate)}
                              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition cursor-pointer"
                              title="Permanently enroll candidate as official staff"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Push as Staff</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: HISTORY & ONBOARDING (CLOSED ROLES & NEW APPOINTMENTS) */}
          {/* ========================================================================= */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              {/* SECTION A: CLOSED & OCCUPIED REQUISITIONS ARCHIVE */}
              <div className="space-y-3">
                <div
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isLight ? 'bg-emerald-50/60 border-emerald-200' : 'bg-emerald-950/20 border-emerald-900/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold">
                      <History className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        Closed Roles & Vacancy Occupancy History
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Track fulfilled vacancies that have reached 100% headcount. View the closed role and the exact staff members employed to occupy the position.
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold self-start sm:self-auto">
                    {closedVacancies.length} Closed Role{closedVacancies.length === 1 ? '' : 's'}
                  </span>
                </div>

                {closedVacancies.length === 0 ? (
                  <div
                    className={`p-8 text-center rounded-2xl border border-dashed ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-950/40 border-slate-800'
                    }`}
                  >
                    <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                    <h4 className="font-semibold text-xs text-slate-400">No Closed Roles Recorded Yet</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      When a vacancy's headcount is filled through "Push as Staff", the closed role and the appointed staff will be catalogued here for full hiring governance.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {closedVacancies.map((vac) => {
                      return (
                        <div
                          key={vac.id}
                          className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 ${
                            isLight
                              ? 'bg-white border-slate-200'
                              : 'bg-slate-950/80 border-slate-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                                  {vac.title}
                                </h4>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  CLOSED / FULFILLED
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {vac.role} • {vac.department}
                              </div>
                            </div>

                            <button
                              onClick={() => handleToggleVacancyStatus(vac)}
                              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition"
                              title="Re-open vacancy if additional capacity is required"
                            >
                              Re-open Role
                            </button>
                          </div>

                          {/* 100% Progress Bar */}
                          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Occupancy Status:</span>
                              </span>
                              <span className="font-mono text-xs font-bold text-emerald-500">
                                {vac.filledCount || vac.targetHeadcount} / {vac.targetHeadcount} Seats (100% Occupied)
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 w-full" />
                            </div>
                          </div>

                          {/* Occupied By Staff Details Box */}
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 space-y-2">
                            <div className="text-[11px] font-mono text-slate-400 uppercase font-semibold flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Staff Employed to Occupy Vacancy:</span>
                            </div>

                            {vac.hiredStaffDetails && vac.hiredStaffDetails.length > 0 ? (
                              <div className="space-y-1.5">
                                {vac.hiredStaffDetails.map((det, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between text-xs bg-white dark:bg-slate-950 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                                        #{i + 1}
                                      </span>
                                      <div>
                                        <div className="font-bold text-slate-800 dark:text-white">
                                          {det.name}
                                        </div>
                                        <div className="text-[10px] font-mono text-slate-400">
                                          ID: {det.staffId} • Role: {det.role}
                                        </div>
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-mono text-emerald-500 font-semibold">
                                      Appointed: {det.hiredDate}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : vac.hiredStaffNames && vac.hiredStaffNames.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {vac.hiredStaffNames.map((name, i) => (
                                  <span
                                    key={i}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>{name}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400 italic">
                                Position closed by management.
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-1">
                            <span>Req: {vac.requestedBy || 'Department Head'}</span>
                            {vac.closedDate && <span>Closed: {vac.closedDate}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION B: ACTIVE ONBOARDING & NEW EMPLOYEES (PAST 90 DAYS) */}
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span>Active Onboarding & Recent Appointments (Past 90 Days)</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Showing {filteredNewEmployees.length} staff member{filteredNewEmployees.length === 1 ? '' : 's'} appointed within the past 3 months.
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveTab('vacancies')}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>View Vacancies & Pipeline</span>
                  </button>
                </div>

                {filteredNewEmployees.length === 0 ? (
                  <div
                    className={`p-10 text-center rounded-2xl border border-dashed ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-950/40 border-slate-800'
                    }`}
                  >
                    <Users className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                    <h4 className="font-semibold text-xs text-slate-400">No Recent Staff in Past 90 Days</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      No active staff were appointed within the last 90 days matching this filter.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead
                        className={`text-[11px] font-mono uppercase tracking-wider ${
                          isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-950 text-slate-400'
                        }`}
                      >
                        <tr>
                          <th className="p-3">Staff ID</th>
                          <th className="p-3">Employee Name</th>
                          <th className="p-3">Department & Role</th>
                          <th className="p-3">Join Date & Tenure</th>
                          <th className="p-3">Pay Grade & Salary</th>
                          <th className="p-3">Shift Roster</th>
                          <th className="p-3 text-right">Quick Documentation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {filteredNewEmployees.map((staff) => (
                          <tr
                            key={staff.id}
                            className={`transition ${isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/40'}`}
                          >
                            <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                              {staff.employeeId}
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900 dark:text-white">{staff.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{staff.email || 'No email registered'}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">{staff.role}</div>
                              <div className="text-[11px] text-slate-400">{staff.department}</div>
                            </td>
                            <td className="p-3 font-mono">
                              <div className="font-semibold text-slate-900 dark:text-white">{staff.joinDate || 'N/A'}</div>
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                                {getTenureText(staff.joinDate)}
                              </div>
                            </td>
                            <td className="p-3 font-mono">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold text-[11px] border border-purple-200/60 dark:border-purple-800/60">
                                  {deriveStaffPayGrade(staff, configuredPayGrades)}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {currencySymbol}{staff.estimatedMonthlySalary ? Number(staff.estimatedMonthlySalary).toLocaleString() : '3,000'}/mo
                              </div>
                            </td>
                            <td className="p-3 font-mono">
                              <span className="px-2 py-0.5 rounded-lg text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {staff.shiftSchedule || 'Morning'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {onOpenConfirmationLetter && (
                                  <button
                                    onClick={() => onOpenConfirmationLetter(staff)}
                                    className="px-2.5 py-1 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[11px] font-semibold flex items-center gap-1 transition"
                                    title="Generate Official Employment Confirmation Letter"
                                  >
                                    <FileCheck className="w-3.5 h-3.5" />
                                    <span>Letter</span>
                                  </button>
                                )}

                                {onOpenJobDescription && (
                                  <button
                                    onClick={() => onOpenJobDescription(staff)}
                                    className="px-2.5 py-1 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/30 text-[11px] font-semibold flex items-center gap-1 transition"
                                    title="Generate Job Description (JD)"
                                  >
                                    <Briefcase className="w-3.5 h-3.5" />
                                    <span>JD</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-MODAL 1: ATS DEEP DIVE & RESUME / CV INSPECTION MODAL */}
      {/* ========================================================================= */}
      {inspectingApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div
            className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            {/* ATS Header */}
            {(() => {
              const matchedVac =
                vacancies.find((v) => v.id === inspectingApplicant.vacancyId) ||
                vacancies.find(
                  (v) =>
                    v.department.toLowerCase() === inspectingApplicant.appliedDepartment.toLowerCase() &&
                    v.role.toLowerCase() === inspectingApplicant.appliedRole.toLowerCase() &&
                    v.status === 'Open'
                );

              const atsResult = calculateATSScore(inspectingApplicant, dbDepartments, matchedVac);

              return (
                <>
                  <div
                    className={`p-4 sm:p-5 border-b flex items-center justify-between gap-4 ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-md shrink-0">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base">{inspectingApplicant.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold border ${atsResult.color}`}>
                            {atsResult.overallPercentage}% {atsResult.grade}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          ATS Evaluation for <strong className="text-blue-400">{inspectingApplicant.appliedRole}</strong> in{' '}
                          <strong className="text-slate-300">{inspectingApplicant.appliedDepartment}</strong>
                          {(inspectingApplicant.vacancyTitle || matchedVac) && (
                            <span className="ml-2 text-indigo-400 font-mono text-[11px]">
                              • Requisition: {inspectingApplicant.vacancyTitle || matchedVac?.title}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {inspectingApplicant.status !== 'Hired' && (
                        <button
                          onClick={() => {
                            setInspectingApplicant(null);
                            handleOpenEnrollment(inspectingApplicant);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Push as Staff</span>
                        </button>
                      )}
                      <button
                        onClick={() => setInspectingApplicant(null)}
                        className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* ATS Scoring Matrix & CV Preview */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Candidate Educational & Professional Profile */}
                    <div
                      className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-mono text-slate-400 uppercase">Educational Level & Degree:</div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            {inspectingApplicant.educationalLevel || inspectingApplicant.education || "Bachelor's Degree"}
                          </div>
                        </div>
                      </div>

                      {inspectingApplicant.courseOfStudy && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-[10px] font-mono text-slate-400 uppercase">Course of Study:</div>
                            <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                              {inspectingApplicant.courseOfStudy}
                            </div>
                          </div>
                        </div>
                      )}

                      {inspectingApplicant.schoolGrade && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                            <Award className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-[10px] font-mono text-slate-400 uppercase">School Grade / Honours:</div>
                            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {inspectingApplicant.schoolGrade}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Score Breakdown Gauges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                        <div className="text-[10px] font-mono text-slate-400 uppercase">Overall Correlation:</div>
                        <div className="text-xl font-bold font-mono text-blue-500 mt-0.5">{atsResult.overallPercentage}%</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{atsResult.grade}</div>
                      </div>

                      <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                        <div className="text-[10px] font-mono text-slate-400 uppercase">Keyword & Skills:</div>
                        <div className="text-xl font-bold font-mono text-emerald-500 mt-0.5">{atsResult.keywordScore}%</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{atsResult.matchedKeywords.length} Matched</div>
                      </div>

                      <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                        <div className="text-[10px] font-mono text-slate-400 uppercase">Experience Match:</div>
                        <div className="text-xl font-bold font-mono text-teal-500 mt-0.5">{atsResult.experienceScore}%</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{inspectingApplicant.experienceYears} Years Background</div>
                      </div>

                      <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                        <div className="text-[10px] font-mono text-slate-400 uppercase">Education Rating:</div>
                        <div className="text-xl font-bold font-mono text-indigo-500 mt-0.5">{atsResult.educationScore}%</div>
                        <div className="text-[10px] text-slate-500 font-semibold truncate">{inspectingApplicant.education || 'Degree'}</div>
                      </div>
                    </div>

                    {/* Matched Competencies vs Missing Keywords */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={`p-4 rounded-2xl border ${isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/40'}`}>
                        <h4 className="font-bold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Matched Role Keywords & Competencies</span>
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {atsResult.matchedKeywords.map((kw, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                            >
                              ✓ {kw}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className={`p-4 rounded-2xl border ${isLight ? 'bg-amber-50/50 border-amber-200' : 'bg-amber-950/20 border-amber-800/40'}`}>
                        <h4 className="font-bold text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                          <AlertCircle className="w-4 h-4" />
                          <span>Recommended Growth & Additional Skills</span>
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {atsResult.missingKeywords.length > 0 ? (
                            atsResult.missingKeywords.map((kw, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                              >
                                • {kw}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">All core competencies fulfilled!</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Role Duty-by-Duty Alignment Breakdown */}
                    {atsResult.dutyBreakdown.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4 text-blue-500" />
                          <span>Department Job Description Deliverable Alignment</span>
                        </h4>
                        <div className="space-y-1.5">
                          {atsResult.dutyBreakdown.map((d, idx) => (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                              }`}
                            >
                              <span className="text-slate-700 dark:text-slate-300 flex-1">{d.duty}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                                  d.matched
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {d.score}% Coverage
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resume / CV Text Preview */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-indigo-400" />
                          <span>Submitted Candidate Resume / CV Content</span>
                        </h4>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(inspectingApplicant.resumeText);
                            showToast('Resume text copied to clipboard.');
                          }}
                          className="text-[11px] font-mono text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy CV</span>
                        </button>
                      </div>

                      <div
                        className={`p-4 rounded-2xl border font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        {inspectingApplicant.resumeText || 'No resume content submitted.'}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 2: "PUSH AS STAFF" (ENROLLMENT & DOCUMENTATION PROMPT) */}
      {/* ========================================================================= */}
      {enrollingApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div
            className={`w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            <div
              className={`p-5 border-b flex items-center justify-between gap-3 ${
                isLight ? 'bg-emerald-50/70 border-slate-200' : 'bg-emerald-950/30 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-md">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">Enroll Applicant as Staff Member</h3>
                  <p className="text-xs text-slate-400">
                    Promote candidate into active Staff Directory & configure contract details.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEnrollingApplicant(null)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmEnrollment} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Employee ID
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={enrollmentForm.employeeId}
                      onChange={(e) => setEnrollmentForm({ ...enrollmentForm, employeeId: e.target.value })}
                      placeholder="e.g. 001, EMP-101, or N/A"
                      className={`w-full pl-3 pr-20 py-2 rounded-xl text-xs font-mono font-bold border outline-none ${
                        !isEmployeeIdUnique(enrollmentForm.employeeId || '', staffList).isUnique
                          ? 'border-red-500 text-red-500'
                          : isLight
                          ? 'bg-white border-slate-300 text-blue-600'
                          : 'bg-slate-950 border-slate-800 text-blue-400'
                      }`}
                    />
                    <div className="absolute right-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEnrollmentForm({ ...enrollmentForm, employeeId: '' })}
                        title="Clear Employee ID (defaults to N/A)"
                        className="px-2 py-0.5 text-[11px] font-bold rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                    </div>
                  </div>
                  {!isEmployeeIdUnique(enrollmentForm.employeeId || '', staffList).isUnique ? (
                    <p className="text-[10px] text-red-500 mt-1 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>ID already taken by {isEmployeeIdUnique(enrollmentForm.employeeId || '', staffList).conflictingStaff?.name} (IDs must be unique except for N/A).</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Empty ID defaults to <strong>N/A</strong>.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={enrollmentForm.name}
                    onChange={(e) => setEnrollmentForm({ ...enrollmentForm, name: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Department *
                  </label>
                  <select
                    value={enrollmentForm.department}
                    onChange={(e) => {
                      const newDept = e.target.value;
                      const deptCode = getDepartmentCode(newDept);
                      const newEmpId = generateStaffId(deptCode, staffList);
                      setEnrollmentForm({
                        ...enrollmentForm,
                        department: newDept,
                        employeeId: newEmpId,
                      });
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    {departments.filter((d) => d !== 'All').map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Role / Job Designation *
                  </label>
                  <input
                    type="text"
                    required
                    value={enrollmentForm.role}
                    onChange={(e) => setEnrollmentForm({ ...enrollmentForm, role: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={enrollmentForm.email}
                    onChange={(e) => setEnrollmentForm({ ...enrollmentForm, email: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={enrollmentForm.phone}
                    onChange={(e) => setEnrollmentForm({ ...enrollmentForm, phone: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Date of Birth (DOB)
                  </label>
                  <input
                    type="date"
                    value={enrollmentForm.dob}
                    onChange={(e) => setEnrollmentForm({ ...enrollmentForm, dob: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Appointment Effective Date
                  </label>
                  <input
                    type="date"
                    required
                    value={enrollmentForm.joinDate}
                    onChange={(e) => setEnrollmentForm({ ...enrollmentForm, joinDate: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Residential Home Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 14 Crescent Avenue, Victoria Island, Lagos"
                    value={enrollmentForm.homeAddress}
                    onChange={(e) => setEnrollmentForm({ ...enrollmentForm, homeAddress: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Pay Frequency *
                  </label>
                  <select
                    value={enrollmentForm.payFrequency}
                    onChange={(e) => setEnrollmentForm({ ...enrollmentForm, payFrequency: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none font-semibold ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Bi-Weekly">Bi-Weekly</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Monthly Salary ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    value={enrollmentForm.estimatedMonthlySalary}
                    onChange={(e) => {
                      const newSalary = Number(e.target.value) || 0;
                      const autoGrade = derivePayGradeFromSalary(newSalary, configuredPayGrades);
                      setEnrollmentForm({
                        ...enrollmentForm,
                        estimatedMonthlySalary: newSalary,
                        payGrade: autoGrade,
                      });
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-mono uppercase text-slate-400">
                      Pay Grade Classification
                    </label>
                    <span className="text-[10px] text-purple-500 font-bold uppercase tracking-wider">
                      Dynamic Tier
                    </span>
                  </div>
                  <select
                    value={enrollmentForm.payGrade || derivePayGradeFromSalary(Number(enrollmentForm.estimatedMonthlySalary) || 0, configuredPayGrades)}
                    onChange={(e) => {
                      const selectedGrade = e.target.value;
                      const matchedTier = configuredPayGrades.find((pg) => pg.name === selectedGrade);
                      const currentSalary = Number(enrollmentForm.estimatedMonthlySalary) || 0;
                      let updatedSalary = currentSalary;
                      if (matchedTier && (currentSalary < matchedTier.minSalary || currentSalary > matchedTier.maxSalary)) {
                        updatedSalary = matchedTier.minSalary;
                      }
                      setEnrollmentForm({
                        ...enrollmentForm,
                        payGrade: selectedGrade,
                        estimatedMonthlySalary: updatedSalary,
                      });
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none font-semibold ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    {configuredPayGrades.map((grade) => (
                      <option key={grade.id} value={grade.name}>
                        {grade.name} ({currencySymbol}{grade.minSalary.toLocaleString()} - {currencySymbol}{grade.maxSalary.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Working Shift Schedule
                  </label>
                  <select
                    value={enrollmentForm.shiftSchedule}
                    onChange={(e) => setEnrollmentForm({ ...enrollmentForm, shiftSchedule: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    {settings?.shifts && settings.shifts.length > 0 ? (
                      settings.shifts.map((s) => (
                        <option key={s.id || s.name} value={s.name}>
                          {s.name} {s.startTime !== 'N/A' && s.startTime !== 'Auto' ? `(${s.startTime} - ${s.endTime})` : ''}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Morning Shift">Morning Shift (08:00 - 17:00)</option>
                        <option value="Afternoon Shift">Afternoon Shift (14:00 - 22:00)</option>
                        <option value="Night Shift">Night Shift (22:00 - 06:00)</option>
                      </>
                    )}
                    <option value="Flexible">Flexible / Hybrid</option>
                    <option value="N/A">N/A (No Fixed Shift)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Disbursement Bank Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chase, Zenith, Barclays"
                    value={enrollmentForm.bankName}
                    onChange={(e) => setEnrollmentForm({ ...enrollmentForm, bankName: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Bank Account / IBAN Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0123456789 / US98CHAS..."
                    value={enrollmentForm.accountNumber}
                    onChange={(e) => setEnrollmentForm({ ...enrollmentForm, accountNumber: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                {/* Guarantor Details Section */}
                <div className="sm:col-span-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Guarantor / Reference Information
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Guarantor Full Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dr. Robert Adeleke"
                        value={enrollmentForm.guarantorName}
                        onChange={(e) => setEnrollmentForm({ ...enrollmentForm, guarantorName: e.target.value })}
                        className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                          isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Guarantor Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="+1 (555) 987-6543"
                        value={enrollmentForm.guarantorPhone}
                        onChange={(e) => setEnrollmentForm({ ...enrollmentForm, guarantorPhone: e.target.value })}
                        className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                          isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Relationship with Employee
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Parent, Mentor, Former Employer, Clergy"
                        value={enrollmentForm.guarantorRelationship}
                        onChange={(e) => setEnrollmentForm({ ...enrollmentForm, guarantorRelationship: e.target.value })}
                        className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                          isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Guarantor Residential Address
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 22 Broad Street, Lagos"
                        value={enrollmentForm.guarantorAddress}
                        onChange={(e) => setEnrollmentForm({ ...enrollmentForm, guarantorAddress: e.target.value })}
                        className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                          isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEnrollingApplicant(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Complete Enrollment & Promote to Staff</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 3: ADD APPLICANT FORM */}
      {/* ========================================================================= */}
      {isAddApplicantOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div
            className={`w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            <div
              className={`p-5 border-b flex items-center justify-between gap-3 ${
                isLight ? 'bg-blue-50/70 border-slate-200' : 'bg-blue-950/30 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">Add Candidate to Applicant Pipeline</h3>
                  <p className="text-xs text-slate-400">
                    Upload candidate CV or fill details to evaluate ATS correlation and Key KPI duty alignment.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearApplicantForm}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    isLight
                      ? 'border-slate-300 hover:bg-slate-200 text-slate-600'
                      : 'border-slate-700 hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Clear all inputs in this form"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Entries</span>
                </button>

                <button
                  onClick={() => setIsAddApplicantOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveNewApplicant} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* AI Resume Upload & Extraction Box */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  isLight ? 'bg-indigo-50/60 border-indigo-200/80' : 'bg-indigo-950/20 border-indigo-800/40'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      Smart AI Resume & CV Auto-Extraction
                    </span>
                  </div>
                  {isParsingResume && (
                    <span className="text-[11px] font-mono text-indigo-500 font-semibold flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing CV with Rheiva AI...</span>
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                  Upload candidate CV (PDF, DOCX, DOC, or TXT). Rheiva AI will automatically extract candidate name, contact, educational level, course of study, grade, skills, and full summary.
                </p>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleResumeFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                    isLight
                      ? 'border-indigo-300 bg-white/80 hover:bg-white hover:border-indigo-400'
                      : 'border-indigo-700/60 bg-slate-950/40 hover:bg-slate-950 hover:border-indigo-500'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleResumeFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                      <FileUp className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'Click or Drag & Drop Resume File here'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Accepts PDF, DOCX, DOC, TXT (Auto-fills form below)
                    </div>
                  </div>
                </div>
              </div>

              {/* Datalist for common courses */}
              <datalist id="common-courses-list">
                {COMMON_COURSES_OF_STUDY.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>

              {/* Selected Vacancy Requisition Context Card (Modular ATS) */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Target Vacancy Requisition:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddApplicantOpen(false);
                      setIsSelectVacancyModalOpen(true);
                    }}
                    className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Change Vacancy</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {(() => {
                  const vac =
                    vacancies.find((v) => v.id === applicantFormData.vacancyId) ||
                    vacancies.find(
                      (v) =>
                        v.status === 'Open' &&
                        v.role.toLowerCase() === (applicantFormData.appliedRole || '').toLowerCase()
                    );

                  if (vac) {
                    const remaining = Math.max(0, vac.targetHeadcount - (vac.filledCount || 0));
                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <span>{vac.title}</span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                                {remaining} Seat{remaining !== 1 ? 's' : ''} Remaining
                              </span>
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {vac.department} • <strong className="text-indigo-600 dark:text-indigo-400">{vac.role}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center justify-between flex-wrap gap-2 pt-1.5 border-t border-indigo-200/50 dark:border-indigo-800/50 font-mono">
                          <span>
                            Target: <strong className="text-indigo-600 dark:text-indigo-400">{vac.targetHeadcount} Headcount</strong> ({vac.filledCount || 0} Filled)
                          </span>
                          <span>
                            Benchmark: <strong>{vac.experienceRequired}+ Yrs Exp</strong> • <strong>{vac.minEducationalLevel}</strong>
                          </span>
                          <span>
                            Pay Grade: <strong>{vac.salaryRange?.payGrade || 'Standard'}</strong> ({currencySymbol}{vac.salaryRange?.min?.toLocaleString()} - {currencySymbol}{vac.salaryRange?.max?.toLocaleString()})
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Tracking for <strong>{applicantFormData.appliedRole || 'Company Role'}</strong> ({applicantFormData.appliedDepartment})
                    </div>
                  );
                })()}
              </div>

              {/* Candidate Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Candidate Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. David Morrison"
                    value={applicantFormData.name || ''}
                    onChange={(e) => setApplicantFormData({ ...applicantFormData, name: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="candidate@example.com"
                    value={applicantFormData.email || ''}
                    onChange={(e) => setApplicantFormData({ ...applicantFormData, email: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={applicantFormData.phone || ''}
                    onChange={(e) => setApplicantFormData({ ...applicantFormData, phone: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Educational Level (Alphabetical) *
                  </label>
                  <select
                    value={applicantFormData.educationalLevel}
                    onChange={(e) =>
                      setApplicantFormData({ ...applicantFormData, educationalLevel: e.target.value })
                    }
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    {EDUCATIONAL_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Course / Field of Study
                  </label>
                  <input
                    type="text"
                    list="common-courses-list"
                    placeholder="e.g. Computer Science, Accounting..."
                    value={applicantFormData.courseOfStudy || ''}
                    onChange={(e) =>
                      setApplicantFormData({ ...applicantFormData, courseOfStudy: e.target.value })
                    }
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    School Grade / Honours Rating
                  </label>
                  <select
                    value={applicantFormData.schoolGrade}
                    onChange={(e) =>
                      setApplicantFormData({ ...applicantFormData, schoolGrade: e.target.value })
                    }
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    {SCHOOL_GRADES.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Years of Relevant Experience
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    value={applicantFormData.experienceYears || 0}
                    onChange={(e) =>
                      setApplicantFormData({ ...applicantFormData, experienceYears: Number(e.target.value) || 0 })
                    }
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Expected Monthly Salary ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="3500"
                    value={applicantFormData.expectedSalary || 3500}
                    onChange={(e) =>
                      setApplicantFormData({ ...applicantFormData, expectedSalary: Number(e.target.value) || 0 })
                    }
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Core Skills (Comma Separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. React, TypeScript, Node.js, SQL, Process Optimization"
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Candidate CV / Resume Text (for ATS Correlation)
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Paste candidate resume summary, work experience, and achievements..."
                    value={applicantFormData.resumeText || ''}
                    onChange={(e) => setApplicantFormData({ ...applicantFormData, resumeText: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none resize-y ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleClearApplicantForm}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Entries</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddApplicantOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/30 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Save Candidate & Run ATS Scoring</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 4: CREATE / EDIT VACANCY REQUISITION MODAL */}
      {/* ========================================================================= */}
      {isCreateVacancyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div
            className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            {/* Modal Header */}
            <div
              className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-500 flex items-center justify-center font-bold">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    {editingVacancy ? 'Edit Vacancy Requisition' : 'Create New Vacancy Requisition'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Define hiring headcount and role benchmark criteria to power standard ATS matching
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateVacancyOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveVacancy} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Requisition Title */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Requisition / Vacancy Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Frontend Engineer - Core Platform"
                    value={vacancyFormData.title || ''}
                    onChange={(e) => setVacancyFormData({ ...vacancyFormData, title: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                {/* Department Dropdown */}
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Department *
                  </label>
                  <select
                    value={vacancyFormData.department}
                    onChange={(e) => handleVacancyDeptChange(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    {departments.filter((d) => d !== 'All').map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-mono uppercase text-slate-400">
                      Standard Company Role *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomVacancyRole(!isCustomVacancyRole);
                        if (!isCustomVacancyRole) {
                          setCustomVacancyRoleInput('');
                        }
                      }}
                      className="text-[10px] font-mono text-indigo-500 hover:underline cursor-pointer"
                    >
                      {isCustomVacancyRole ? '← Select existing' : '+ Custom role'}
                    </button>
                  </div>

                  {!isCustomVacancyRole ? (
                    <select
                      value={vacancyFormData.role}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomVacancyRole(true);
                          setCustomVacancyRoleInput('');
                        } else {
                          handleVacancyRoleSelect(e.target.value);
                        }
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs border outline-none font-semibold ${
                        isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      {availableRolesForVacancyDept.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                      <option value="__custom__">+ Enter Custom Role...</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="e.g. Lead Devops Specialist"
                      value={customVacancyRoleInput}
                      onChange={(e) => {
                        setCustomVacancyRoleInput(e.target.value);
                        setVacancyFormData({ ...vacancyFormData, role: e.target.value });
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${
                        isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                      }`}
                    />
                  )}
                </div>

                {/* Target Number of Vacancies (Headcount) */}
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Number of Vacancies (Headcount Target) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={vacancyFormData.targetHeadcount || 1}
                    onChange={(e) =>
                      setVacancyFormData({
                        ...vacancyFormData,
                        targetHeadcount: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border outline-none ${
                      isLight ? 'bg-white border-slate-300 text-blue-600' : 'bg-slate-950 border-slate-800 text-blue-400'
                    }`}
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Role automatically closes after this many staff members are employed.
                  </p>
                </div>

                {/* Employment Type */}
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Employment Type
                  </label>
                  <select
                    value={vacancyFormData.employmentType || 'Full-time'}
                    onChange={(e) =>
                      setVacancyFormData({ ...vacancyFormData, employmentType: e.target.value as any })
                    }
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>

                {/* Minimum Experience */}
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Required Experience (Years)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={vacancyFormData.experienceRequired || 0}
                    onChange={(e) =>
                      setVacancyFormData({ ...vacancyFormData, experienceRequired: Number(e.target.value) || 0 })
                    }
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>

                {/* Minimum Educational Level */}
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Minimum Educational Level
                  </label>
                  <select
                    value={vacancyFormData.minEducationalLevel || 'Bachelor of Science (B.Sc)'}
                    onChange={(e) =>
                      setVacancyFormData({ ...vacancyFormData, minEducationalLevel: e.target.value })
                    }
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    {EDUCATIONAL_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dynamic Pay Grade Dropdown */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-mono uppercase text-slate-400">
                      Standard Pay Grade *
                    </label>
                    {vacancyFormData.salaryRange && (
                      <span className="text-[11px] font-mono font-bold text-emerald-500">
                        Band: {currencySymbol}{vacancyFormData.salaryRange.min.toLocaleString()} – {currencySymbol}{vacancyFormData.salaryRange.max.toLocaleString()} / mo
                      </span>
                    )}
                  </div>
                  <select
                    value={vacancyFormData.salaryRange?.payGrade || effectivePayGrades[0]?.name || ''}
                    onChange={(e) => {
                      const selectedGrade = effectivePayGrades.find((pg) => pg.name === e.target.value);
                      if (selectedGrade) {
                        setVacancyFormData({
                          ...vacancyFormData,
                          salaryRange: {
                            payGrade: selectedGrade.name,
                            min: selectedGrade.minSalary,
                            max: selectedGrade.maxSalary,
                          },
                        });
                      }
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold border outline-none ${
                      isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-950 border-slate-800 text-slate-100'
                    }`}
                  >
                    {effectivePayGrades.map((grade) => (
                      <option key={grade.name} value={grade.name}>
                        {grade.name} — {grade.level ? `(${grade.level}) ` : ''}{currencySymbol}{grade.minSalary.toLocaleString()} to {currencySymbol}{grade.maxSalary.toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Salary range is dynamically bound to company pay grade tier configurations.
                  </p>
                </div>

                {/* Target Previous Job Titles (Title Keywords Repeater) */}
                <div className="sm:col-span-2 p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-mono uppercase font-bold text-indigo-700 dark:text-indigo-300">
                      Expected Previous Job Titles (Title Keywords)
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      Optional section
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                    <span>
                      <strong>Screening Specificity Notice:</strong> Adding expected previous titles instructs the ATS engine to reward exact past role titles. <em>Note: Adding more title expectancies increases screening specificity and reduces the chance of random or adjacent staff fitting into the role.</em>
                    </span>
                  </div>

                  {/* Existing Title Keywords Tags */}
                  {vacancyTitleKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {vacancyTitleKeywords.map((titleKw, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-xl text-xs font-medium bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700 flex items-center gap-1.5 shadow-xs"
                        >
                          <span>{titleKw}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTitleKeyword(idx)}
                            className="hover:text-red-500 transition cursor-pointer p-0.5"
                            title="Remove title keyword"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Input + Plus Button for adding another title */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Junior Systems Analyst, Technical Support Specialist..."
                      value={currentTitleKeywordInput}
                      onChange={(e) => setCurrentTitleKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTitleKeyword();
                        }
                      }}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs border outline-none ${
                        isLight ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleAddTitleKeyword}
                      disabled={!currentTitleKeywordInput.trim()}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1 transition shadow-sm cursor-pointer"
                      title="Add expected previous title"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Synced Role Benchmark Status Card */}
                <div className="sm:col-span-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      <span>Department Benchmark Integration</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-500 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Auto-Synced</span>
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ATS evaluation keywords and duties are pulled automatically from the role benchmark configured in the Departments tab.
                  </p>

                  {vacancyFormData.requiredSkills && vacancyFormData.requiredSkills.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {vacancyFormData.requiredSkills.slice(0, 10).map((skill, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-blue-500/10 text-blue-500 border border-blue-500/20"
                        >
                          {skill}
                        </span>
                      ))}
                      {vacancyFormData.requiredSkills.length > 10 && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-slate-500/10 text-slate-400">
                          +{vacancyFormData.requiredSkills.length - 10} more keywords
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-500 font-medium flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>No benchmark keywords detected in this role. Configure duties in the Departments tab for full ATS matching accuracy.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Bottom Controls */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateVacancyOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  <Briefcase className="w-4 h-4" />
                  <span>{editingVacancy ? 'Save Changes' : 'Publish Vacancy Requisition'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 5: STEP 1 - SELECT VACANCY REQUISITION FOR APPLICANT TRACKING */}
      {/* ========================================================================= */}
      {isSelectVacancyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div
            className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            {/* Modal Header */}
            <div
              className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-500 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                      Select Vacancy Requisition
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 text-blue-500 font-bold border border-blue-500/20">
                      Step 1 of 2
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Which open vacancy requisition are you tracking this candidate for?
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSelectVacancyModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Filter Bar */}
            <div className={`p-4 border-b ${isLight ? 'bg-slate-50/60' : 'bg-slate-950/40'}`}>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter open vacancies by role, title, or department..."
                  value={vacancySearchQuery}
                  onChange={(e) => setVacancySearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border outline-none ${
                    isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-800'
                  }`}
                />
              </div>
            </div>

            {/* Vacancies List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {(() => {
                const openVacancies = vacancies.filter((v) => v.status === 'Open');
                const filteredVacancies = openVacancies.filter((v) => {
                  if (!vacancySearchQuery.trim()) return true;
                  const q = vacancySearchQuery.toLowerCase();
                  return (
                    v.title.toLowerCase().includes(q) ||
                    v.role.toLowerCase().includes(q) ||
                    v.department.toLowerCase().includes(q) ||
                    (v.requiredSkills || []).some((s) => s.toLowerCase().includes(q))
                  );
                });

                if (openVacancies.length === 0) {
                  return (
                    <div className="p-8 text-center space-y-3">
                      <div className="w-14 h-14 rounded-3xl bg-blue-500/10 text-blue-500 mx-auto flex items-center justify-center">
                        <Briefcase className="w-7 h-7" />
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        No Open Vacancies Available
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                        All company vacancy requisitions are currently occupied or closed. Create a new vacancy requisition first to begin screening and tracking applicants.
                      </p>
                      <button
                        onClick={() => {
                          setIsSelectVacancyModalOpen(false);
                          handleOpenCreateVacancy();
                        }}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/30 cursor-pointer"
                      >
                        + Create Vacancy Requisition
                      </button>
                    </div>
                  );
                }

                if (filteredVacancies.length === 0) {
                  return (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No open vacancies match "{vacancySearchQuery}".
                    </div>
                  );
                }

                return filteredVacancies.map((vac) => {
                  const remainingSeats = Math.max(0, vac.targetHeadcount - (vac.filledCount || 0));
                  return (
                    <div
                      key={vac.id}
                      onClick={() => handleSelectVacancyForApplicant(vac)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isLight
                          ? 'bg-slate-50/80 hover:bg-blue-50/50 hover:border-blue-400/80 border-slate-200'
                          : 'bg-slate-950/60 hover:bg-blue-950/20 hover:border-blue-500/60 border-slate-800'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-500 transition">
                            {vac.title}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            {vac.department}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            {remainingSeats} of {vac.targetHeadcount} Open Seat{vac.targetHeadcount !== 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          <span>Role: <strong className="text-slate-700 dark:text-slate-300">{vac.role}</strong></span>
                          <span>•</span>
                          <span>Benchmark: <strong>{vac.experienceRequired}+ Yrs Exp</strong></span>
                          <span>•</span>
                          <span>Pay Grade: <strong className="text-emerald-500">{vac.salaryRange?.payGrade || 'Standard'}</strong></span>
                        </div>

                        {vac.titleKeywords && vac.titleKeywords.length > 0 && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                            <span className="font-mono text-[10px] uppercase font-bold text-indigo-400">Target Titles:</span>
                            <span className="text-indigo-400/90 font-medium truncate max-w-md">
                              {vac.titleKeywords.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center sm:self-center">
                        <span className="px-3.5 py-1.5 rounded-xl bg-blue-600 group-hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition">
                          <span>Select & Continue</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className={`p-4 border-t flex items-center justify-end ${isLight ? 'bg-slate-50' : 'bg-slate-950'}`}>
              <button
                type="button"
                onClick={() => setIsSelectVacancyModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 6: UNCONFIGURED ROLE WARNING MODAL */}
      {/* ========================================================================= */}
      {unconfiguredRoleWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-scaleUp ${
              isLight ? 'bg-white border-amber-200 text-slate-900' : 'bg-slate-900 border-amber-900/60 text-white'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Role Values Not Yet Configured
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                The role <strong className="text-amber-500">{unconfiguredRoleWarning.role}</strong> in department{' '}
                <strong className="text-amber-500">{unconfiguredRoleWarning.department}</strong> currently does not have duties, responsibilities, or keywords configured in the Departments tab.
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                Please configure benchmark duties and keywords for this role in the Departments tab so the ATS text extractor can perform accurate candidate correlation and match scoring.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setUnconfiguredRoleWarning(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer transition"
              >
                I Understand, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 7: CONFIRM PRINT OFFER LETTER MODAL */}
      {/* ========================================================================= */}
      {offerLetterConfirmApplicant && (() => {
        const vac = vacancies.find((v) => v.id === offerLetterConfirmApplicant.vacancyId);
        const effSalary = offerLetterConfirmApplicant.expectedSalary || vac?.salaryRange?.min || 3500;
        const payGrade = vac?.salaryRange?.payGrade || derivePayGradeFromSalary(effSalary, configuredPayGrades);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div
              className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-5 animate-scaleUp ${
                isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Print Official Offer Letter
                  </h3>
                  <p className="text-xs text-slate-400">
                    Candidate Pre-Hire Documentation & Onboarding
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                  Do you want to print an official offer letter for{' '}
                  <strong className="text-indigo-500 font-bold">{offerLetterConfirmApplicant.name}</strong>?
                </p>

                {/* Offer Letter Specification Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Designated Candidate:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{offerLetterConfirmApplicant.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Position / Designation:</span>
                    <span className="font-semibold text-blue-500">{offerLetterConfirmApplicant.appliedRole}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Department:</span>
                    <span className="text-slate-700 dark:text-slate-300">{offerLetterConfirmApplicant.appliedDepartment}</span>
                  </div>
                  {vac && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Vacancy Requisition:</span>
                      <span className="font-mono text-indigo-400">{vac.title}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Offered Monthly Salary:</span>
                    <span className="font-mono font-bold text-emerald-500">{currencySymbol}{effSalary.toLocaleString()}/month</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Assigned Pay Grade:</span>
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400 font-mono text-[11px] font-bold border border-purple-500/30">
                      {payGrade}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  The document will be generated using the corporate letterhead, logo, and terms configured in your Offer Letter Template.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOfferLetterConfirmApplicant(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer transition"
                >
                  No, Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handlePrintOfferLetter(offerLetterConfirmApplicant);
                    setOfferLetterConfirmApplicant(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Offer Letter</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* SUB-MODAL 8: CV / RESUME TEXT PREVIEW MODAL */}
      {/* ========================================================================= */}
      {viewingCvApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div
            className={`w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            <div
              className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Curriculum Vitae: {viewingCvApplicant.name}</span>
                    {viewingCvApplicant.resumeFileName && (
                      <span className="text-xs font-mono text-slate-400 font-normal">
                        ({viewingCvApplicant.resumeFileName})
                      </span>
                    )}
                  </h3>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span>{viewingCvApplicant.appliedRole}</span>
                    <span>•</span>
                    <span>{viewingCvApplicant.appliedDepartment}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingCvApplicant(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 font-sans text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-mono text-[9px]">EMAIL:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{viewingCvApplicant.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-mono text-[9px]">PHONE:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{viewingCvApplicant.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-mono text-[9px]">EDUCATION:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{viewingCvApplicant.education || 'Degree'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-mono text-[9px]">EXPERIENCE:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{viewingCvApplicant.experienceYears ?? 0} Years</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Extracted Skills:</span>
                <div className="flex flex-wrap gap-1.5">
                  {viewingCvApplicant.skills && viewingCvApplicant.skills.length > 0 ? (
                    viewingCvApplicant.skills.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 italic text-[11px]">No specific skills tagged.</span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">CV / Resume Text Content:</span>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-text max-h-[380px] overflow-y-auto">
                  {viewingCvApplicant.resumeText || 'No text extracted from resume file.'}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewingCvApplicant(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
