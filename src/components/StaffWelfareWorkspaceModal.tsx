import React, { useState, useMemo, useEffect } from 'react';
import { StaffMember } from '../types';
import {
  HeartHandshake,
  Cake,
  Calendar,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  X,
  Copy,
  Check,
  Mail,
  Users,
  Sparkles,
  Award,
  DollarSign,
  AlertCircle,
  TrendingUp,
  CreditCard,
  Receipt,
  Printer,
  ChevronRight,
  Filter,
  CheckCheck,
  Percent,
  FileText,
  Star,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { emitGlobalToast } from '../context/ToastContext';
import { loadCompanyData, saveCompanyData, STORAGE_KEYS } from '../utils/companyStorage';
import { getCompanyCurrencySymbol } from '../utils/payrollUtils';
import { SearchableStaffSelect } from './SearchableStaffSelect';

// ==========================================
// DATA STRUCTURES
// ==========================================

export interface EmployeeOfMonthAward {
  id: string;
  month: string; // e.g. "2026-09"
  year: number;
  monthIndex: number; // 0-11
  staffId: string;
  staffName: string;
  department: string;
  role: string;
  kpiScore: number;
  awardTitle: string;
  citation: string;
  cashBonus: number;
  awardedAt: string;
  awardedBy: string;
  radarScores: {
    regularity: number;
    punctuality: number;
    taskExecution: number;
    discipline: number;
    output: number;
    initiative: number;
  };
}

export interface StaffLoanRecord {
  id: string;
  staffId: string;
  staffName: string;
  department: string;
  loanTitle: string;
  principalAmount: number;
  interestRate: number; // e.g. 0% or 5%
  totalRepayable: number;
  tenureMonths: number;
  monthlyDeduction: number;
  totalRepaid: number;
  outstandingBalance: number;
  startDate: string; // YYYY-MM
  status: 'active' | 'completed' | 'pending';
  guarantorName?: string;
  notes?: string;
  appliedDate: string;
  disbursedDate?: string;
}

export interface SalaryAdvanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  department: string;
  monthlyGrossSalary: number;
  advanceAmount: number;
  maxAllowedAdvance: number;
  reason: string;
  requestDate: string;
  targetPayrollMonth: string; // e.g. "2026-09"
  status: 'pending' | 'approved' | 'disbursed' | 'deducted' | 'rejected';
  notes?: string;
  approvedBy?: string;
  disbursedAt?: string;
}

interface StaffWelfareWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  companyName?: string;
  isLight?: boolean;
  initialTab?: 'birthdays' | 'employee_of_month' | 'staff_loans' | 'salary_advances';
  dbDepartments?: string[];
}

export const StaffWelfareWorkspaceModal: React.FC<StaffWelfareWorkspaceModalProps> = ({
  isOpen,
  onClose,
  staffList = [],
  companyName,
  isLight = false,
  initialTab = 'birthdays',
  dbDepartments = [],
}) => {
  const [activeTab, setActiveTab] = useState<'birthdays' | 'employee_of_month' | 'staff_loans' | 'salary_advances'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copiedStaffId, setCopiedStaffId] = useState<string | null>(null);

  const currencySymbol = useMemo(() => getCompanyCurrencySymbol(companyName), [companyName]);

  // Sync initial tab when changed
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Reset filters on tab switch
  const handleTabSwitch = (tab: 'birthdays' | 'employee_of_month' | 'staff_loans' | 'salary_advances') => {
    setActiveTab(tab);
    setSearchQuery('');
    setCategoryFilter('all');
  };

  // ==========================================
  // TAB 1: BIRTHDAYS & CELEBRATIONS LOGIC
  // ==========================================
  const { birthdayRoster, todayBirthdaysCount, thisMonthCount } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayMidnight = new Date(currentYear, currentMonth, now.getDate()).getTime();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    let todayCount = 0;
    let mCount = 0;

    const list = (staffList || [])
      .filter((s) => s.status !== 'Exited' && s.dob && s.dob.trim())
      .map((st) => {
        const parts = st.dob!.split(/[-/]/);
        let bYear: number | null = null;
        let bMonth: number;
        let bDay: number;

        if (parts.length === 3) {
          if (parts[0].length === 4) {
            bYear = parseInt(parts[0], 10);
            bMonth = parseInt(parts[1], 10) - 1;
            bDay = parseInt(parts[2], 10);
          } else {
            bDay = parseInt(parts[0], 10);
            bMonth = parseInt(parts[1], 10) - 1;
            bYear = parseInt(parts[2], 10);
          }
        } else {
          const d = new Date(st.dob!);
          bYear = d.getFullYear();
          bMonth = d.getMonth();
          bDay = d.getDate();
        }

        if (isNaN(bMonth) || isNaN(bDay) || bMonth < 0 || bMonth > 11 || bDay < 1 || bDay > 31) {
          return null;
        }

        let nextBday = new Date(currentYear, bMonth, bDay);
        if (nextBday.getTime() < todayMidnight) {
          nextBday = new Date(currentYear + 1, bMonth, bDay);
        }

        const diffDays = Math.round((nextBday.getTime() - todayMidnight) / (1000 * 60 * 60 * 24));
        const turningAge = bYear ? nextBday.getFullYear() - bYear : null;
        const isToday = diffDays === 0;
        const isThisMonth = bMonth === currentMonth;

        if (isToday) todayCount++;
        if (isThisMonth) mCount++;

        return {
          staff: st,
          diffDays,
          turningAge,
          isToday,
          isThisMonth,
          monthName: monthNames[bMonth],
          dayOfMonth: bDay,
          formattedDate: `${monthNames[bMonth]} ${bDay}`,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.diffDays - b.diffDays);

    return {
      birthdayRoster: list,
      todayBirthdaysCount: todayCount,
      thisMonthCount: mCount,
    };
  }, [staffList]);

  const filteredBirthdays = useMemo(() => {
    return birthdayRoster.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.staff.name.toLowerCase().includes(q) ||
        (item.staff.department || '').toLowerCase().includes(q) ||
        (item.staff.role || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (categoryFilter === 'today') return item.isToday;
      if (categoryFilter === 'this_month') return item.isThisMonth;
      if (categoryFilter === 'upcoming_30') return item.diffDays <= 30;

      return true;
    });
  }, [birthdayRoster, searchQuery, categoryFilter]);

  const copyBirthdayGreeting = (staffName: string, id: string) => {
    const greeting = `🎉 Happy Birthday ${staffName}! 🎂 On behalf of the entire team, we celebrate you today and thank you for all your wonderful dedication and impact. Wishing you a year filled with success, prosperity, and joy! 🎈✨`;
    navigator.clipboard.writeText(greeting);
    setCopiedStaffId(id);
    emitGlobalToast(`Copied personalized birthday message for ${staffName}!`, 'success');
    setTimeout(() => setCopiedStaffId(null), 3000);
  };

  // ==========================================
  // TAB 2: EMPLOYEE OF THE MONTH LOGIC
  // ==========================================
  const EOM_KEY = 'skima_employee_of_month_awards_v2';
  const [eomAwards, setEomAwards] = useState<EmployeeOfMonthAward[]>(() => {
    const loaded = loadCompanyData<EmployeeOfMonthAward[]>(EOM_KEY, companyName, []);
    if (loaded && loaded.length > 0) return loaded;
    // Default seed award
    const seedStaff = staffList[0];
    if (!seedStaff) return [];
    return [
      {
        id: 'eom-seed-1',
        month: '2026-08',
        year: 2026,
        monthIndex: 7,
        staffId: seedStaff.id,
        staffName: seedStaff.name,
        department: seedStaff.department || 'Operations',
        role: seedStaff.role || 'Senior Specialist',
        kpiScore: 94,
        awardTitle: 'Exemplary Operational Excellence',
        citation: 'Demonstrated exceptional diligence, zero task slippage, and stellar cross-functional leadership throughout the month.',
        cashBonus: 250,
        awardedAt: '2026-09-01',
        awardedBy: 'HR Welfare Board',
        radarScores: {
          regularity: 98,
          punctuality: 96,
          taskExecution: 95,
          discipline: 100,
          output: 92,
          initiative: 89,
        },
      },
    ];
  });

  const saveEomAwards = (next: EmployeeOfMonthAward[]) => {
    setEomAwards(next);
    saveCompanyData(EOM_KEY, next, companyName);
  };

  const [selectedEomMonth, setSelectedEomMonth] = useState<string>('2026-09');
  const [eomDeptFilter, setEomDeptFilter] = useState<string>('all');
  const [isNominateModalOpen, setIsNominateModalOpen] = useState(false);
  const [nominateStaffId, setNominateStaffId] = useState<string>('');
  const [nominateAwardTitle, setNominateAwardTitle] = useState('Employee of the Month');
  const [nominateCitation, setNominateCitation] = useState('');
  const [nominateBonus, setNominateBonus] = useState(250);
  const [viewingCertificate, setViewingCertificate] = useState<EmployeeOfMonthAward | null>(null);

  // Active candidate ranking derived from staffList and attendance projects
  const eomCandidates = useMemo(() => {
    const list = (staffList || []).filter((s) => s.status !== 'Exited');
    const effectiveProjects: any[] = companyName
      ? loadCompanyData<any[]>(STORAGE_KEYS.PROJECTS, companyName, [])
      : [];

    const cleanStr = (s?: string) => (s || '').trim().toLowerCase();
    const cleanId = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    return list.map((staff) => {
      const baseKpi = typeof (staff as any).kpiScore === 'number' ? (staff as any).kpiScore : 0;

      // Match attendance records across worksheets
      const staffIdClean = cleanId(staff.id);
      const staffEmpIdClean = cleanId(staff.employeeId);
      const staffNameClean = cleanStr(staff.name).replace(/\s+/g, ' ');

      const staffRecords: any[] = [];
      effectiveProjects.forEach((proj) => {
        (proj.records || []).forEach((rec: any) => {
          const recEmpClean = cleanId(rec.employeeId);
          const recIdClean = cleanId(rec.id);
          const recNameClean = cleanStr(rec.employeeName).replace(/\s+/g, ' ');

          const idMatches =
            (staffEmpIdClean && recEmpClean && (staffEmpIdClean === recEmpClean || staffEmpIdClean.endsWith(recEmpClean) || recEmpClean.endsWith(staffEmpIdClean))) ||
            (staffIdClean && recEmpClean && staffIdClean === recEmpClean) ||
            (staffIdClean && recIdClean && recIdClean.includes(staffIdClean)) ||
            (staffEmpIdClean && recIdClean && recIdClean.includes(staffEmpIdClean));

          const nameMatches =
            Boolean(staffNameClean &&
            recNameClean &&
            (staffNameClean === recNameClean ||
              (staffNameClean.length > 3 && recNameClean.length > 3 && (staffNameClean.includes(recNameClean) || recNameClean.includes(staffNameClean)))));

          if (idMatches || nameMatches) {
            staffRecords.push(rec);
          }
        });
      });

      let regularity = baseKpi;
      let punctuality = baseKpi;
      if (staffRecords.length > 0) {
        const isRestOrLeave = (r: any) => {
          const st = cleanStr(r.status);
          return (
            st.includes('leave') ||
            st.includes('pre-employment') ||
            st.includes('holiday') ||
            st.includes('weekend') ||
            st.includes('day off') ||
            st.includes('excused') ||
            st === 'rest'
          );
        };
        const hasAttendanceClock = (r: any) => {
          const cIn = (r.clockIn || '').trim();
          return cIn !== '' && cIn !== '-' && cIn !== '--:--' && cIn !== '00:00';
        };
        const isPresentStatus = (r: any) => {
          const st = cleanStr(r.status);
          return st === 'present' || st === 'on duty' || st === 'in';
        };
        const isLateStatus = (r: any) => {
          const st = cleanStr(r.status);
          return st === 'late';
        };
        const isHalfDayStatus = (r: any) => {
          const st = cleanStr(r.status);
          return st === 'half day' || st === 'halfday';
        };
        const isAbsentStatus = (r: any) => {
          const st = cleanStr(r.status);
          return st === 'absent';
        };

        const scheduledDays = staffRecords.filter(
          (r) => !isRestOrLeave(r) && (isPresentStatus(r) || isLateStatus(r) || isHalfDayStatus(r) || isAbsentStatus(r) || hasAttendanceClock(r))
        );
        const attendedDays = staffRecords.filter(
          (r) => !isRestOrLeave(r) && (isPresentStatus(r) || isLateStatus(r) || isHalfDayStatus(r) || hasAttendanceClock(r))
        );
        const onTimeDays = staffRecords.filter(
          (r) => !isRestOrLeave(r) && (isPresentStatus(r) || (hasAttendanceClock(r) && !isLateStatus(r))) && !isLateStatus(r)
        );

        if (scheduledDays.length > 0) {
          regularity = Math.round((attendedDays.length / scheduledDays.length) * 100);
        } else if (attendedDays.length > 0) {
          regularity = 100;
        }

        if (attendedDays.length > 0) {
          punctuality = Math.round((onTimeDays.length / attendedDays.length) * 100);
        }
      }

      const taskExecution = baseKpi;
      const discipline = staff.status === 'Active' ? 100 : 0;
      const output = baseKpi;
      const initiative = baseKpi;

      const scoredDimensions = [regularity, punctuality, taskExecution, output, initiative].filter((s) => s > 0);
      const overall = scoredDimensions.length > 0
        ? Math.round(scoredDimensions.reduce((a, b) => a + b, 0) / scoredDimensions.length)
        : (baseKpi > 0 ? baseKpi : 0);
      return {
        staff,
        overallScore: overall,
        radarScores: {
          regularity,
          punctuality,
          taskExecution,
          discipline,
          output,
          initiative,
        },
        radarData: [
          { parameter: 'Regularity', score: regularity, fullMark: 100 },
          { parameter: 'Punctuality', score: punctuality, fullMark: 100 },
          { parameter: 'Execution', score: taskExecution, fullMark: 100 },
          { parameter: 'Discipline', score: discipline, fullMark: 100 },
          { parameter: 'Output', score: output, fullMark: 100 },
          { parameter: 'Initiative', score: initiative, fullMark: 100 },
        ],
      };
    }).sort((a, b) => b.overallScore - a.overallScore);
  }, [staffList]);

  // Filtered candidate ranking
  const filteredCandidates = useMemo(() => {
    return eomCandidates.filter((cand) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        cand.staff.name.toLowerCase().includes(q) ||
        (cand.staff.department || '').toLowerCase().includes(q) ||
        (cand.staff.role || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (eomDeptFilter !== 'all' && cand.staff.department !== eomDeptFilter) return false;
      return true;
    });
  }, [eomCandidates, searchQuery, eomDeptFilter]);

  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(() => eomCandidates[0]?.staff.id || '');
  const activeCandidate = useMemo(() => {
    return eomCandidates.find((c) => c.staff.id === selectedCandidateId) || eomCandidates[0] || null;
  }, [eomCandidates, selectedCandidateId]);

  // Existing award for the selected month
  const currentMonthAward = useMemo(() => {
    return eomAwards.find((a) => a.month === selectedEomMonth);
  }, [eomAwards, selectedEomMonth]);

  const handleCrownEmployee = () => {
    if (!nominateStaffId) {
      emitGlobalToast('Please choose a staff member to crown.', 'error');
      return;
    }
    const cand = eomCandidates.find((c) => c.staff.id === nominateStaffId);
    if (!cand) return;

    const [yStr, mStr] = selectedEomMonth.split('-');
    const newAward: EmployeeOfMonthAward = {
      id: `eom-${Date.now()}`,
      month: selectedEomMonth,
      year: parseInt(yStr, 10),
      monthIndex: parseInt(mStr, 10) - 1,
      staffId: cand.staff.id,
      staffName: cand.staff.name,
      department: cand.staff.department || 'Operations',
      role: cand.staff.role || 'Staff Member',
      kpiScore: cand.overallScore,
      awardTitle: nominateAwardTitle || 'Employee of the Month',
      citation: nominateCitation || 'Demonstrated outstanding performance, peer cooperation, and stellar KPI achievements.',
      cashBonus: Number(nominateBonus) || 0,
      awardedAt: new Date().toISOString().split('T')[0],
      awardedBy: 'Management Welfare Board',
      radarScores: cand.radarScores,
    };

    const remaining = eomAwards.filter((a) => a.month !== selectedEomMonth);
    saveEomAwards([newAward, ...remaining]);
    setIsNominateModalOpen(false);
    setViewingCertificate(newAward);
    emitGlobalToast(`🎉 ${cand.staff.name} successfully crowned Employee of the Month for ${selectedEomMonth}!`, 'success');
  };

  // ==========================================
  // TAB 3: STAFF LOANS LOGIC
  // ==========================================
  const LOANS_KEY = 'skima_staff_loans_records_v1';
  const [loans, setLoans] = useState<StaffLoanRecord[]>(() => {
    const loaded = loadCompanyData<StaffLoanRecord[]>(LOANS_KEY, companyName, []);
    if (loaded && loaded.length > 0) return loaded;
    // Default seed loans
    const st1 = staffList[0];
    const st2 = staffList[1];
    return [
      {
        id: 'loan-1',
        staffId: st1?.id || 'emp-1',
        staffName: st1?.name || 'Staff Member',
        department: st1?.department || 'Operations',
        loanTitle: 'Emergency Medical & Family Welfare',
        principalAmount: 1500,
        interestRate: 0,
        totalRepayable: 1500,
        tenureMonths: 6,
        monthlyDeduction: 250,
        totalRepaid: 750,
        outstandingBalance: 750,
        startDate: '2026-06',
        status: 'active',
        guarantorName: 'Head of Operations',
        notes: 'Approved under subsidized zero-interest staff emergency assistance policy.',
        appliedDate: '2026-05-28',
        disbursedDate: '2026-06-01',
      },
      {
        id: 'loan-2',
        staffId: st2?.id || 'emp-2',
        staffName: st2?.name || 'Staff Member 2',
        department: st2?.department || 'Engineering',
        loanTitle: 'Home Relocation Assistance',
        principalAmount: 2000,
        interestRate: 0,
        totalRepayable: 2000,
        tenureMonths: 10,
        monthlyDeduction: 200,
        totalRepaid: 2000,
        outstandingBalance: 0,
        startDate: '2025-10',
        status: 'completed',
        notes: 'Fully amortized and cleared via monthly payroll deductions.',
        appliedDate: '2025-09-15',
        disbursedDate: '2025-10-01',
      },
    ];
  });

  const saveLoans = (next: StaffLoanRecord[]) => {
    setLoans(next);
    saveCompanyData(LOANS_KEY, next, companyName);
  };

  // New Loan Form State
  const [isNewLoanModalOpen, setIsNewLoanModalOpen] = useState(false);
  const [loanStaffId, setLoanStaffId] = useState<string>(staffList[0]?.id || '');
  const [loanTitle, setLoanTitle] = useState<string>('Personal Welfare Loan');
  const [loanPrincipal, setLoanPrincipal] = useState<number>(1000);
  const [loanInterestRate, setLoanInterestRate] = useState<number>(0);
  const [loanTenure, setLoanTenure] = useState<number>(6);
  const [loanGuarantor, setLoanGuarantor] = useState<string>('');
  const [loanNotes, setLoanNotes] = useState<string>('');

  const calculatedTotalRepayable = useMemo(() => {
    const p = Number(loanPrincipal) || 0;
    const r = Number(loanInterestRate) || 0;
    return Math.round(p * (1 + r / 100));
  }, [loanPrincipal, loanInterestRate]);

  const calculatedMonthlyDeduction = useMemo(() => {
    const t = Number(loanTenure) || 1;
    return Math.round(calculatedTotalRepayable / Math.max(1, t));
  }, [calculatedTotalRepayable, loanTenure]);

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanStaffId) {
      emitGlobalToast('Please select a staff member for the loan.', 'error');
      return;
    }
    const staff = staffList.find((s) => s.id === loanStaffId);
    if (!staff) return;

    const newLoan: StaffLoanRecord = {
      id: `loan-${Date.now()}`,
      staffId: staff.id,
      staffName: staff.name,
      department: staff.department || 'General',
      loanTitle: loanTitle || 'Staff Welfare Loan',
      principalAmount: Number(loanPrincipal),
      interestRate: Number(loanInterestRate),
      totalRepayable: calculatedTotalRepayable,
      tenureMonths: Number(loanTenure),
      monthlyDeduction: calculatedMonthlyDeduction,
      totalRepaid: 0,
      outstandingBalance: calculatedTotalRepayable,
      startDate: new Date().toISOString().slice(0, 7),
      status: 'active',
      guarantorName: loanGuarantor,
      notes: loanNotes,
      appliedDate: new Date().toISOString().split('T')[0],
      disbursedDate: new Date().toISOString().split('T')[0],
    };

    saveLoans([newLoan, ...loans]);
    setIsNewLoanModalOpen(false);
    emitGlobalToast(`Loan for ${staff.name} of ${currencySymbol}${loanPrincipal.toLocaleString()} created and active!`, 'success');
  };

  const handleRecordRepayment = (loanId: string, amount: number) => {
    const next = loans.map((l) => {
      if (l.id !== loanId) return l;
      const repaid = l.totalRepaid + amount;
      const remaining = Math.max(0, l.totalRepayable - repaid);
      return {
        ...l,
        totalRepaid: repaid,
        outstandingBalance: remaining,
        status: remaining <= 0 ? ('completed' as const) : l.status,
      };
    });
    saveLoans(next);
    emitGlobalToast(`Repayment of ${currencySymbol}${amount} recorded successfully.`, 'success');
  };

  const handleDeleteLoan = (loanId: string) => {
    if (confirm('Are you sure you want to remove this loan record?')) {
      const next = loans.filter((l) => l.id !== loanId);
      saveLoans(next);
      emitGlobalToast('Loan record removed.', 'info');
    }
  };

  const filteredLoans = useMemo(() => {
    return loans.filter((l) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        l.staffName.toLowerCase().includes(q) ||
        l.department.toLowerCase().includes(q) ||
        l.loanTitle.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (categoryFilter !== 'all' && l.status !== categoryFilter) return false;
      return true;
    });
  }, [loans, searchQuery, categoryFilter]);

  // ==========================================
  // TAB 4: SALARY ADVANCES LOGIC
  // ==========================================
  const ADVANCES_KEY = 'skima_salary_advances_records_v1';
  const [advances, setAdvances] = useState<SalaryAdvanceRecord[]>(() => {
    const loaded = loadCompanyData<SalaryAdvanceRecord[]>(ADVANCES_KEY, companyName, []);
    if (loaded && loaded.length > 0) return loaded;
    const st1 = staffList[0];
    const st2 = staffList[2] || staffList[1];
    return [
      {
        id: 'adv-1',
        staffId: st1?.id || 'emp-1',
        staffName: st1?.name || 'Staff Member',
        department: st1?.department || 'Operations',
        monthlyGrossSalary: 2500,
        advanceAmount: 400,
        maxAllowedAdvance: 1250,
        reason: 'Urgent family transit & school supplies',
        requestDate: '2026-09-08',
        targetPayrollMonth: '2026-09',
        status: 'disbursed',
        notes: 'Disbursed via bank transfer. Set for deduction on September payroll.',
        approvedBy: 'Payroll Officer',
        disbursedAt: '2026-09-09',
      },
      {
        id: 'adv-2',
        staffId: st2?.id || 'emp-2',
        staffName: st2?.name || 'Staff Member 2',
        department: st2?.department || 'Finance',
        monthlyGrossSalary: 3000,
        advanceAmount: 600,
        maxAllowedAdvance: 1500,
        reason: 'Emergency dental medical care',
        requestDate: '2026-09-12',
        targetPayrollMonth: '2026-09',
        status: 'approved',
        notes: 'Awaiting cash release from welfare disbursement account.',
        approvedBy: 'HR Director',
      },
    ];
  });

  const saveAdvances = (next: SalaryAdvanceRecord[]) => {
    setAdvances(next);
    saveCompanyData(ADVANCES_KEY, next, companyName);
  };

  // New Advance Form State
  const [isNewAdvanceModalOpen, setIsNewAdvanceModalOpen] = useState(false);
  const [advanceStaffId, setAdvanceStaffId] = useState<string>(staffList[0]?.id || '');
  const [advanceAmount, setAdvanceAmount] = useState<number>(300);
  const [advanceReason, setAdvanceReason] = useState<string>('Emergency Family Expenses');
  const [advanceTargetMonth, setAdvanceTargetMonth] = useState<string>('2026-09');

  const selectedAdvanceStaff = useMemo(() => {
    return staffList.find((s) => s.id === advanceStaffId) || null;
  }, [staffList, advanceStaffId]);

  const estimatedGrossSalary = useMemo(() => {
    if (!selectedAdvanceStaff) return 2000;
    return (selectedAdvanceStaff as any).salary || 2500;
  }, [selectedAdvanceStaff]);

  const maxAllowedAdvance = useMemo(() => {
    return Math.round(estimatedGrossSalary * 0.5); // 50% limit
  }, [estimatedGrossSalary]);

  const handleCreateAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceStaffId || !selectedAdvanceStaff) {
      emitGlobalToast('Please select a valid staff member.', 'error');
      return;
    }

    if (advanceAmount > maxAllowedAdvance) {
      emitGlobalToast(
        `Warning: Requested advance (${currencySymbol}${advanceAmount}) exceeds the 50% threshold limit (${currencySymbol}${maxAllowedAdvance}). Adjusting or proceed with HR approval.`,
        'warning'
      );
    }

    const newAdv: SalaryAdvanceRecord = {
      id: `adv-${Date.now()}`,
      staffId: selectedAdvanceStaff.id,
      staffName: selectedAdvanceStaff.name,
      department: selectedAdvanceStaff.department || 'General',
      monthlyGrossSalary: estimatedGrossSalary,
      advanceAmount: Number(advanceAmount),
      maxAllowedAdvance,
      reason: advanceReason || 'Mid-month welfare salary advance',
      requestDate: new Date().toISOString().split('T')[0],
      targetPayrollMonth: advanceTargetMonth,
      status: 'pending',
      notes: `Requested for payroll deduction in ${advanceTargetMonth}.`,
    };

    saveAdvances([newAdv, ...advances]);
    setIsNewAdvanceModalOpen(false);
    emitGlobalToast(`Salary advance request of ${currencySymbol}${advanceAmount} submitted for approval.`, 'success');
  };

  const handleUpdateAdvanceStatus = (advId: string, status: SalaryAdvanceRecord['status']) => {
    const next = advances.map((a) => {
      if (a.id !== advId) return a;
      return {
        ...a,
        status,
        disbursedAt: status === 'disbursed' ? new Date().toISOString().split('T')[0] : a.disbursedAt,
      };
    });
    saveAdvances(next);
    emitGlobalToast(`Advance status updated to "${status.toUpperCase()}".`, 'success');
  };

  const handleDeleteAdvance = (advId: string) => {
    if (confirm('Are you sure you want to remove this advance record?')) {
      const next = advances.filter((a) => a.id !== advId);
      saveAdvances(next);
      emitGlobalToast('Advance record removed.', 'info');
    }
  };

  const filteredAdvances = useMemo(() => {
    return advances.filter((a) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        a.staffName.toLowerCase().includes(q) ||
        a.department.toLowerCase().includes(q) ||
        a.reason.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (categoryFilter !== 'all' && a.status !== categoryFilter) return false;
      return true;
    });
  }, [advances, searchQuery, categoryFilter]);

  // ==========================================
  // TOP STATS BAR CALCULATIONS
  // ==========================================
  const activeLoansCount = useMemo(() => loans.filter((l) => l.status === 'active').length, [loans]);
  const totalLoanBalance = useMemo(() => loans.reduce((sum, l) => sum + (l.status === 'active' ? l.outstandingBalance : 0), 0), [loans]);
  const currentMonthAdvancesCount = useMemo(() => advances.filter((a) => a.targetPayrollMonth === '2026-09').length, [advances]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div
        className={`w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        {/* HEADER BAR */}
        <div
          className={`flex items-center justify-between p-4 sm:px-6 border-b ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 text-rose-500 border border-rose-500/30">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>Staff Welfare & Corporate Care Workspace</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {companyName || 'Corporate'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Birthdays, Employee of the Month Honors, Staff Loans & Salary Advance Deductions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-500 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TOP STATS BAR */}
        <div
          className={`grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:px-6 border-b text-xs ${
            isLight ? 'bg-slate-100/50 border-slate-200' : 'bg-slate-950/40 border-slate-800/80'
          }`}
        >
          <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
              <Cake className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Birthdays This Month</div>
              <div className="text-lg font-black text-rose-500">{thisMonthCount} Staff</div>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Employee of the Month</div>
              <div className="text-sm font-black text-amber-500 truncate max-w-[140px]">
                {currentMonthAward ? currentMonthAward.staffName : 'Pending Selection'}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active Staff Loans</div>
              <div className="text-lg font-black text-blue-500">
                {activeLoansCount} ({currencySymbol}{totalLoanBalance.toLocaleString()})
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Salary Advances (Cycle)</div>
              <div className="text-lg font-black text-emerald-500">{currentMonthAdvancesCount} Requests</div>
            </div>
          </div>
        </div>

        {/* WORKSPACE NAVIGATION TABS */}
        <div
          className={`flex items-center gap-2 px-4 sm:px-6 border-b overflow-x-auto ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}
        >
          {/* TAB 1: BIRTHDAYS */}
          <button
            type="button"
            onClick={() => handleTabSwitch('birthdays')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'birthdays'
                ? 'border-rose-500 text-rose-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cake className="w-4 h-4" />
            <span>Birthdays & Celebrations</span>
            {todayBirthdaysCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                {todayBirthdaysCount} Today!
              </span>
            )}
          </button>

          {/* TAB 2: EMPLOYEE OF THE MONTH */}
          <button
            type="button"
            onClick={() => handleTabSwitch('employee_of_month')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'employee_of_month'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Employee of the Month</span>
            {eomAwards.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                {eomAwards.length}
              </span>
            )}
          </button>

          {/* TAB 3: STAFF LOANS */}
          <button
            type="button"
            onClick={() => handleTabSwitch('staff_loans')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'staff_loans'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Staff Loans</span>
            {activeLoansCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                {activeLoansCount}
              </span>
            )}
          </button>

          {/* TAB 4: SALARY ADVANCES */}
          <button
            type="button"
            onClick={() => handleTabSwitch('salary_advances')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'salary_advances'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Salary Advances</span>
            {advances.filter((a) => a.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                {advances.filter((a) => a.status === 'pending').length} Pending
              </span>
            )}
          </button>
        </div>

        {/* SEARCH & FILTER CONTROLS */}
        <div
          className={`p-3 sm:px-6 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/30 border-slate-800/60'
          }`}
        >
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'birthdays'
                  ? 'Search staff birthday roster by name or department...'
                  : activeTab === 'employee_of_month'
                  ? 'Search candidates by name, role or department...'
                  : activeTab === 'staff_loans'
                  ? 'Search staff loan records...'
                  : 'Search salary advance requests...'
              }
              className={`w-full pl-9 pr-3 py-1.5 rounded-lg border text-xs outline-none transition ${
                isLight
                  ? 'bg-white border-slate-300 focus:border-rose-500 text-slate-900'
                  : 'bg-slate-900 border-slate-700 focus:border-rose-500 text-slate-100'
              }`}
            />
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'birthdays' && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`px-3 py-1.5 rounded-lg border text-xs outline-none transition cursor-pointer ${
                  isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-200'
                }`}
              >
                <option value="all">All Birthdays ({birthdayRoster.length})</option>
                <option value="today">Today's Celebrations ({todayBirthdaysCount})</option>
                <option value="this_month">This Month ({thisMonthCount})</option>
                <option value="upcoming_30">Next 30 Days</option>
              </select>
            )}

            {activeTab === 'employee_of_month' && (
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={selectedEomMonth}
                  onChange={(e) => setSelectedEomMonth(e.target.value)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold outline-none cursor-pointer ${
                    isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setNominateStaffId(activeCandidate?.staff.id || staffList[0]?.id || '');
                    setIsNominateModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Crown Honoree</span>
                </button>
              </div>
            )}

            {activeTab === 'staff_loans' && (
              <div className="flex items-center gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={`px-3 py-1.5 rounded-lg border text-xs outline-none transition cursor-pointer ${
                    isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-200'
                  }`}
                >
                  <option value="all">All Loan Records ({loans.length})</option>
                  <option value="active">Active Amortizing</option>
                  <option value="completed">Completed / Fully Repaid</option>
                  <option value="pending">Pending Approval</option>
                </select>
                <button
                  type="button"
                  onClick={() => setIsNewLoanModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Staff Loan</span>
                </button>
              </div>
            )}

            {activeTab === 'salary_advances' && (
              <div className="flex items-center gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={`px-3 py-1.5 rounded-lg border text-xs outline-none transition cursor-pointer ${
                    isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-200'
                  }`}
                >
                  <option value="all">All Advances ({advances.length})</option>
                  <option value="pending">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="disbursed">Disbursed Funds</option>
                  <option value="deducted">Deducted from Payroll</option>
                </select>
                <button
                  type="button"
                  onClick={() => setIsNewAdvanceModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Request Advance</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* WORKSPACE MAIN BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ============================================================== */}
          {/* TAB 1 CONTENT: BIRTHDAYS & CELEBRATIONS */}
          {/* ============================================================== */}
          {activeTab === 'birthdays' && (
            <div className="space-y-6 animate-fadeIn">
              {todayBirthdaysCount > 0 && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/20 via-pink-500/20 to-purple-500/20 border border-rose-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-rose-500 text-white shadow-lg animate-bounce">
                      <Cake className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-rose-400">
                        Today's Birthday Celebrations ({todayBirthdaysCount} Staff Member{todayBirthdaysCount > 1 ? 's' : ''})
                      </h3>
                      <p className="text-xs text-slate-300">
                        Remember to extend warm greetings and ensure welfare recognition tokens are delivered!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {filteredBirthdays.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <Cake className="w-12 h-12 mx-auto text-slate-500 opacity-40" />
                  <p className="text-sm font-semibold text-slate-400">No staff birthdays matching current filters.</p>
                  <p className="text-xs text-slate-500">Ensure dates of birth (DOB) are entered in the staff profiles.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredBirthdays.map((item) => (
                    <div
                      key={item.staff.id}
                      className={`p-4 rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between ${
                        item.isToday
                          ? 'bg-gradient-to-b from-rose-500/10 to-pink-500/5 border-rose-500/40 ring-1 ring-rose-500/30'
                          : isLight
                          ? 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                          : 'bg-slate-800/60 border-slate-700/70 hover:border-slate-600'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                              <span>{item.staff.name}</span>
                              {item.isToday && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white uppercase tracking-wider animate-pulse">
                                  Today!
                                </span>
                              )}
                            </h4>
                            <p className="text-xs text-slate-400">
                              {item.staff.role} • {item.staff.department}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-mono font-bold ${
                              item.isToday
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-slate-700/50 text-slate-300'
                            }`}
                          >
                            {item.formattedDate}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {item.isToday
                              ? 'Celebrating today'
                              : item.diffDays === 1
                              ? 'Tomorrow'
                              : `In ${item.diffDays} days`}
                          </span>
                          {item.turningAge && (
                            <span className="px-2 py-0.5 rounded bg-slate-700/30 text-[11px] font-mono">
                              Turning {item.turningAge}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 mt-3 border-t border-slate-700/40 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => copyBirthdayGreeting(item.staff.name, item.staff.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          {copiedStaffId === item.staff.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Greeting</span>
                            </>
                          )}
                        </button>

                        <a
                          href={`mailto:${item.staff.email || ''}?subject=Happy%20Birthday%20from%20the%20Team!`}
                          className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition"
                          title="Send Email Greeting"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2 CONTENT: EMPLOYEE OF THE MONTH & KPI RADAR COMPARISON */}
          {/* ============================================================== */}
          {activeTab === 'employee_of_month' && (
            <div className="space-y-6 animate-fadeIn">
              {/* CURRENT HONOREE SPOTLIGHT */}
              {currentMonthAward ? (
                <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-orange-500/20 border border-amber-500/40 relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-amber-500 text-slate-950 flex items-center gap-1.5 shadow-sm">
                          <Award className="w-4 h-4" />
                          Official Honoree • {currentMonthAward.month}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                          {currentMonthAward.kpiScore}% KPI Overall
                        </span>
                        {currentMonthAward.cashBonus > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                            +{currencySymbol}{currentMonthAward.cashBonus.toLocaleString()} Welfare Bonus
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-black text-slate-100 flex items-center gap-2">
                        <span>{currentMonthAward.staffName}</span>
                        <span className="text-sm font-normal text-slate-400">({currentMonthAward.role} • {currentMonthAward.department})</span>
                      </h3>

                      <p className="text-xs text-amber-200/90 font-medium italic max-w-2xl leading-relaxed">
                        "{currentMonthAward.citation}"
                      </p>

                      <div className="text-[11px] text-slate-400 flex items-center gap-4 pt-1">
                        <span>Awarded on {currentMonthAward.awardedAt}</span>
                        <span>•</span>
                        <span>Certified by {currentMonthAward.awardedBy}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewingCertificate(currentMonthAward)}
                        className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md"
                      >
                        <Printer className="w-4 h-4" />
                        <span>View & Print Certificate</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">
                        No Employee of the Month Crowned for {selectedEomMonth}
                      </h4>
                      <p className="text-xs text-slate-400">
                        Review the top KPI candidates below, inspect radar dimensions, and crown this month's honoree.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNominateStaffId(activeCandidate?.staff.id || staffList[0]?.id || '');
                      setIsNominateModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Award className="w-4 h-4" />
                    <span>Crown Honoree</span>
                  </button>
                </div>
              )}

              {/* CANDIDATE EVALUATION & RADAR COMPARISON GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* CANDIDATE LEADERBOARD (7 COLS) */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-teal-400" />
                      <span>KPI Evaluation Leaderboard ({filteredCandidates.length} Personnel)</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">Click a staff member to view radar</span>
                  </div>

                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {filteredCandidates.map((cand, idx) => {
                      const isSelected = activeCandidate?.staff.id === cand.staff.id;
                      return (
                        <div
                          key={cand.staff.id}
                          onClick={() => setSelectedCandidateId(cand.staff.id)}
                          className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-teal-500/10 border-teal-500/50 ring-1 ring-teal-500/30'
                              : isLight
                              ? 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                              : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/70'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                idx === 0
                                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                                  : idx === 1
                                  ? 'bg-slate-300 text-slate-900'
                                  : idx === 2
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-slate-100 truncate">{cand.staff.name}</h5>
                              <p className="text-[11px] text-slate-400 truncate">
                                {cand.staff.role} • {cand.staff.department}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <div className="text-xs font-mono font-black text-teal-400">{cand.overallScore}%</div>
                              <div className="text-[9px] uppercase font-bold text-slate-500">Composite KPI</div>
                            </div>
                            <ChevronRight className={`w-4 h-4 transition ${isSelected ? 'text-teal-400 translate-x-0.5' : 'text-slate-600'}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CANDIDATE RADAR GRAPH & DIMENSIONS (5 COLS) */}
                <div className="lg:col-span-5 space-y-4">
                  {activeCandidate ? (
                    <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                            <span>{activeCandidate.staff.name}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30">
                              {activeCandidate.overallScore}% Index
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            6-Dimension KPI Evaluation Profile
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setNominateStaffId(activeCandidate.staff.id);
                            setIsNominateModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Nominate</span>
                        </button>
                      </div>

                      {/* RADAR CHART */}
                      <div className="h-56 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={activeCandidate.radarData}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis
                              dataKey="parameter"
                              stroke="#94a3b8"
                              tick={{ fill: '#e2e8f0', fontSize: 10, fontWeight: 'bold' }}
                            />
                            <PolarRadiusAxis
                              angle={30}
                              domain={[0, 100]}
                              stroke="#475569"
                              tick={{ fill: '#94a3b8', fontSize: 8 }}
                            />
                            <Radar
                              name={activeCandidate.staff.name}
                              dataKey="score"
                              stroke="#0d9488"
                              fill="#0d9488"
                              fillOpacity={0.4}
                              strokeWidth={2}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                borderColor: '#334155',
                                borderRadius: '8px',
                                fontSize: '11px',
                                color: '#fff',
                              }}
                              formatter={(val: any) => [`${val}%`, 'Score']}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* DIMENSION METRICS MINI PILLS */}
                      <div className="grid grid-cols-3 gap-2 text-center font-mono text-[10px]">
                        <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-700/60">
                          <div className="text-slate-400 text-[9px] uppercase">Regularity</div>
                          <div className="font-bold text-teal-400">{activeCandidate.radarScores.regularity}%</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-700/60">
                          <div className="text-slate-400 text-[9px] uppercase">Punctuality</div>
                          <div className="font-bold text-teal-400">{activeCandidate.radarScores.punctuality}%</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-700/60">
                          <div className="text-slate-400 text-[9px] uppercase">Execution</div>
                          <div className="font-bold text-teal-400">{activeCandidate.radarScores.taskExecution}%</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-700/60">
                          <div className="text-slate-400 text-[9px] uppercase">Discipline</div>
                          <div className="font-bold text-teal-400">{activeCandidate.radarScores.discipline}%</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-700/60">
                          <div className="text-slate-400 text-[9px] uppercase">Output</div>
                          <div className="font-bold text-teal-400">{activeCandidate.radarScores.output}%</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-700/60">
                          <div className="text-slate-400 text-[9px] uppercase">Initiative</div>
                          <div className="font-bold text-teal-400">{activeCandidate.radarScores.initiative}%</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 rounded-2xl border border-slate-700/60 text-center text-slate-500">
                      Select a staff member from the left list.
                    </div>
                  )}
                </div>
              </div>

              {/* PAST HONOREES ARCHIVE */}
              {eomAwards.length > 0 && (
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>Historical Roll of Honor ({eomAwards.length} Past Honorees)</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {eomAwards.map((aw) => (
                      <div
                        key={aw.id}
                        className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-mono font-bold text-amber-400">{aw.month}</div>
                          <div className="text-sm font-bold text-slate-100 truncate">{aw.staffName}</div>
                          <div className="text-[11px] text-slate-400 truncate">{aw.awardTitle}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewingCertificate(aw)}
                          className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="View Certificate"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3 CONTENT: STAFF LOANS */}
          {/* ============================================================== */}
          {activeTab === 'staff_loans' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Loan Principal Disbursed</div>
                  <div className="text-xl font-black text-blue-400 font-mono mt-1">
                    {currencySymbol}
                    {loans.reduce((s, l) => s + l.principalAmount, 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Outstanding Principal</div>
                  <div className="text-xl font-black text-amber-400 font-mono mt-1">
                    {currencySymbol}
                    {loans.reduce((s, l) => s + l.outstandingBalance, 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Monthly Repayments Inflow</div>
                  <div className="text-xl font-black text-emerald-400 font-mono mt-1">
                    {currencySymbol}
                    {loans
                      .filter((l) => l.status === 'active')
                      .reduce((s, l) => s + l.monthlyDeduction, 0)
                      .toLocaleString()}
                  </div>
                </div>
              </div>

              {filteredLoans.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <CreditCard className="w-12 h-12 mx-auto text-slate-500 opacity-40" />
                  <p className="text-sm font-semibold text-slate-400">No staff loan records found.</p>
                  <p className="text-xs text-slate-500">Click "New Staff Loan" above to initiate an employee loan record.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-700/80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/90 text-slate-300 uppercase tracking-wider text-[10px] font-bold border-b border-slate-700">
                      <tr>
                        <th className="p-3">Staff Member</th>
                        <th className="p-3">Loan Purpose</th>
                        <th className="p-3 font-mono">Principal / Total</th>
                        <th className="p-3 font-mono">Monthly Deduction</th>
                        <th className="p-3 font-mono">Repaid / Balance</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredLoans.map((loan) => {
                        const progressPct = Math.min(100, Math.round((loan.totalRepaid / (loan.totalRepayable || 1)) * 100));
                        return (
                          <tr key={loan.id} className="hover:bg-slate-800/40 transition">
                            <td className="p-3">
                              <div className="font-bold text-slate-100">{loan.staffName}</div>
                              <div className="text-[11px] text-slate-400">{loan.department}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-medium text-slate-200">{loan.loanTitle}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Started {loan.startDate} • {loan.tenureMonths} mos ({loan.interestRate}% interest)
                              </div>
                            </td>
                            <td className="p-3 font-mono">
                              <div className="font-bold text-slate-100">
                                {currencySymbol}{loan.totalRepayable.toLocaleString()}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Principal: {currencySymbol}{loan.principalAmount.toLocaleString()}
                              </div>
                            </td>
                            <td className="p-3 font-mono font-bold text-blue-400">
                              {currencySymbol}{loan.monthlyDeduction.toLocaleString()}/mo
                            </td>
                            <td className="p-3">
                              <div className="space-y-1 w-32">
                                <div className="flex items-center justify-between text-[10px] font-mono">
                                  <span className="text-emerald-400">{currencySymbol}{loan.totalRepaid.toLocaleString()}</span>
                                  <span className="text-slate-400">{currencySymbol}{loan.outstandingBalance.toLocaleString()} left</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 transition-all"
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                                  loan.status === 'active'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                    : loan.status === 'completed'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                }`}
                              >
                                {loan.status}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {loan.status === 'active' && (
                                  <button
                                    type="button"
                                    onClick={() => handleRecordRepayment(loan.id, loan.monthlyDeduction)}
                                    className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition cursor-pointer"
                                    title="Record 1 Monthly Repayment"
                                  >
                                    +1 Month Repaid
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLoan(loan.id)}
                                  className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                                  title="Delete loan record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4 CONTENT: SALARY ADVANCES */}
          {/* ============================================================== */}
          {activeTab === 'salary_advances' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Disbursed Advances</div>
                  <div className="text-xl font-black text-emerald-400 font-mono mt-1">
                    {currencySymbol}
                    {advances
                      .filter((a) => a.status === 'disbursed' || a.status === 'deducted')
                      .reduce((s, a) => s + a.advanceAmount, 0)
                      .toLocaleString()}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Pending Approval Requests</div>
                  <div className="text-xl font-black text-amber-400 font-mono mt-1">
                    {advances.filter((a) => a.status === 'pending').length} Staff
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Standard Policy Cap</div>
                  <div className="text-sm font-bold text-slate-300 mt-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Max 50% Gross Monthly Salary</span>
                  </div>
                </div>
              </div>

              {filteredAdvances.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <Receipt className="w-12 h-12 mx-auto text-slate-500 opacity-40" />
                  <p className="text-sm font-semibold text-slate-400">No salary advance requests found.</p>
                  <p className="text-xs text-slate-500">Staff members can request emergency mid-month salary advances here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-700/80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/90 text-slate-300 uppercase tracking-wider text-[10px] font-bold border-b border-slate-700">
                      <tr>
                        <th className="p-3">Staff Member</th>
                        <th className="p-3">Reason / Justification</th>
                        <th className="p-3 font-mono">Monthly Gross</th>
                        <th className="p-3 font-mono">Advance Amount</th>
                        <th className="p-3 font-mono">Deduction Cycle</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredAdvances.map((adv) => (
                        <tr key={adv.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3">
                            <div className="font-bold text-slate-100">{adv.staffName}</div>
                            <div className="text-[11px] text-slate-400">{adv.department}</div>
                          </td>
                          <td className="p-3 max-w-[200px]">
                            <div className="text-slate-200 truncate">{adv.reason}</div>
                            <div className="text-[10px] text-slate-400">Requested: {adv.requestDate}</div>
                          </td>
                          <td className="p-3 font-mono text-slate-300">
                            {currencySymbol}{adv.monthlyGrossSalary.toLocaleString()}
                          </td>
                          <td className="p-3 font-mono font-black text-emerald-400">
                            {currencySymbol}{adv.advanceAmount.toLocaleString()}
                            <span className="text-[10px] font-normal text-slate-400 block">
                              ({Math.round((adv.advanceAmount / adv.monthlyGrossSalary) * 100)}% of salary)
                            </span>
                          </td>
                          <td className="p-3 font-mono text-blue-400 font-bold">
                            {adv.targetPayrollMonth}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                                adv.status === 'pending'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : adv.status === 'approved'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                  : adv.status === 'disbursed'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : adv.status === 'deducted'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}
                            >
                              {adv.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {adv.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateAdvanceStatus(adv.id, 'approved')}
                                  className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition cursor-pointer"
                                >
                                  Approve
                                </button>
                              )}
                              {adv.status === 'approved' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateAdvanceStatus(adv.id, 'disbursed')}
                                  className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition cursor-pointer"
                                >
                                  Disburse Funds
                                </button>
                              )}
                              {adv.status === 'disbursed' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateAdvanceStatus(adv.id, 'deducted')}
                                  className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold transition cursor-pointer"
                                >
                                  Mark Deducted
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteAdvance(adv.id)}
                                className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                                title="Delete advance record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* FOOTER BAR */}
        <div
          className={`p-3 sm:px-6 border-t flex items-center justify-between text-xs ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-rose-500" />
            <span>Corporate Staff Welfare, Recognition & Credit System</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer"
          >
            Close Workspace
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL: CROWN EMPLOYEE OF THE MONTH */}
      {/* ========================================== */}
      {isNominateModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-amber-500/40 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2 text-amber-400">
                <Award className="w-5 h-5" />
                <span>Crown Employee of the Month</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNominateModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Evaluation Month
                </label>
                <input
                  type="month"
                  value={selectedEomMonth}
                  onChange={(e) => setSelectedEomMonth(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Select Honoree
                </label>
                <select
                  value={nominateStaffId}
                  onChange={(e) => setNominateStaffId(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-medium cursor-pointer"
                >
                  {eomCandidates.map((cand) => (
                    <option key={cand.staff.id} value={cand.staff.id}>
                      {cand.staff.name} ({cand.staff.department}) — {cand.overallScore}% KPI
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Honor Title
                </label>
                <input
                  type="text"
                  value={nominateAwardTitle}
                  onChange={(e) => setNominateAwardTitle(e.target.value)}
                  placeholder="e.g. Employee of the Month / Star Performer"
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Cash Welfare Bonus ({currencySymbol})
                </label>
                <input
                  type="number"
                  value={nominateBonus}
                  onChange={(e) => setNominateBonus(Number(e.target.value))}
                  min={0}
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Official Citation / Commendation
                </label>
                <textarea
                  value={nominateCitation}
                  onChange={(e) => setNominateCitation(e.target.value)}
                  rows={3}
                  placeholder="Describe the exceptional dedication, teamwork and excellence shown by this employee..."
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNominateModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCrownEmployee}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center gap-1.5"
              >
                <Award className="w-4 h-4" />
                <span>Confirm & Crown Honoree</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: PRINTABLE CERTIFICATE VIEW */}
      {/* ========================================== */}
      {viewingCertificate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl p-8 rounded-3xl bg-slate-950 border-2 border-amber-500/60 shadow-2xl text-slate-100 space-y-6 text-center relative overflow-hidden">
            <button
              type="button"
              onClick={() => setViewingCertificate(null)}
              className="absolute right-4 top-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-2">
              <div className="inline-flex p-3 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <Award className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-serif font-black uppercase tracking-widest text-amber-400">
                Certificate of Excellence
              </h2>
              <p className="text-xs uppercase tracking-widest font-mono text-slate-400">
                {companyName || 'Corporate Enterprise'} • Employee Recognition Award
              </p>
            </div>

            <div className="py-4 border-y border-amber-500/30 space-y-3">
              <p className="text-xs text-slate-400 italic">This distinction is proudly presented to</p>
              <h1 className="text-3xl font-bold font-serif text-slate-100 tracking-wide">
                {viewingCertificate.staffName}
              </h1>
              <p className="text-sm font-mono text-amber-300">
                {viewingCertificate.role} • {viewingCertificate.department}
              </p>
              <p className="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed pt-2">
                "{viewingCertificate.citation}"
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs font-mono pt-2">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Award Period</div>
                <div className="font-bold text-slate-300">{viewingCertificate.month}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">KPI Rating</div>
                <div className="font-bold text-teal-400">{viewingCertificate.kpiScore}% Overall</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Cash Award</div>
                <div className="font-bold text-emerald-400">
                  {currencySymbol}{viewingCertificate.cashBonus.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official Certificate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: NEW STAFF LOAN */}
      {/* ========================================== */}
      {isNewLoanModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <form
            onSubmit={handleCreateLoan}
            className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-blue-500/40 shadow-2xl text-slate-100 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2 text-blue-400">
                <CreditCard className="w-5 h-5" />
                <span>Initiate Staff Loan Facility</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewLoanModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Beneficiary Staff Member
                </label>
                <select
                  value={loanStaffId}
                  onChange={(e) => setLoanStaffId(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-medium cursor-pointer"
                  required
                >
                  {staffList.filter((s) => s.status !== 'Exited').map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Loan Purpose / Title
                </label>
                <input
                  type="text"
                  value={loanTitle}
                  onChange={(e) => setLoanTitle(e.target.value)}
                  placeholder="e.g. Emergency Medical Support / Relocation Loan"
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Principal ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    value={loanPrincipal}
                    onChange={(e) => setLoanPrincipal(Number(e.target.value))}
                    min={50}
                    step={50}
                    className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    value={loanInterestRate}
                    onChange={(e) => setLoanInterestRate(Number(e.target.value))}
                    min={0}
                    max={50}
                    className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Repayment Tenure (Months)
                </label>
                <select
                  value={loanTenure}
                  onChange={(e) => setLoanTenure(Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-mono font-bold cursor-pointer"
                >
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months</option>
                  <option value={10}>10 Months</option>
                  <option value={12}>12 Months (1 Year)</option>
                  <option value={24}>24 Months (2 Years)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between text-xs font-mono">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Monthly Payroll Deduction</div>
                  <div className="text-base font-black text-blue-400">
                    {currencySymbol}{calculatedMonthlyDeduction.toLocaleString()}/mo
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase">Total Repayable</div>
                  <div className="text-sm font-bold text-slate-200">
                    {currencySymbol}{calculatedTotalRepayable.toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Guarantor Name (Optional)
                </label>
                <input
                  type="text"
                  value={loanGuarantor}
                  onChange={(e) => setLoanGuarantor(e.target.value)}
                  placeholder="e.g. Department Supervisor / Manager"
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewLoanModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Issue & Disburse Loan</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: NEW SALARY ADVANCE REQUEST */}
      {/* ========================================== */}
      {isNewAdvanceModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <form
            onSubmit={handleCreateAdvance}
            className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-emerald-500/40 shadow-2xl text-slate-100 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold flex items-center gap-2 text-emerald-400">
                <Receipt className="w-5 h-5" />
                <span>Request Mid-Month Salary Advance</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewAdvanceModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Applicant Staff Member
                </label>
                <select
                  value={advanceStaffId}
                  onChange={(e) => setAdvanceStaffId(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-medium cursor-pointer"
                  required
                >
                  {staffList.filter((s) => s.status !== 'Exited').map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-[10px] text-slate-400 uppercase">Monthly Salary</div>
                  <div className="text-sm font-mono font-bold text-slate-200 mt-0.5">
                    {currencySymbol}{estimatedGrossSalary.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <div className="text-[10px] text-emerald-400 uppercase font-bold">50% Advance Limit</div>
                  <div className="text-sm font-mono font-black text-emerald-400 mt-0.5">
                    {currencySymbol}{maxAllowedAdvance.toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Requested Advance Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                  min={20}
                  step={10}
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-mono text-sm font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Deduction Payroll Month
                </label>
                <input
                  type="month"
                  value={advanceTargetMonth}
                  onChange={(e) => setAdvanceTargetMonth(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Urgency Reason / Notes
                </label>
                <textarea
                  value={advanceReason}
                  onChange={(e) => setAdvanceReason(e.target.value)}
                  rows={2}
                  placeholder="Explain the urgent welfare/personal emergency..."
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                  required
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewAdvanceModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Submit Advance Request</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
