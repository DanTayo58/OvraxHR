import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  BookOpen,
  MessageSquare,
  LifeBuoy,
  FileQuestion,
  Sparkles,
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Shield,
  Clock,
  Calendar,
  Users,
  Building2,
  FileSpreadsheet,
  UtensilsCrossed,
  Layers,
  Send,
  ExternalLink,
  AlertCircle,
  FolderArchive,
  FileText,
  Mail,
  Phone,
  Terminal,
  Cpu,
  Database,
  Check,
  X,
  Star,
  Plus,
  Flame,
  Award,
  ThumbsUp,
  Sliders,
  CheckCheck,
} from 'lucide-react';
import { AppSettings, User, StaffMember, ProjectFile, DepartmentInfo, LeaveRequest, PlatformReview, SupportTicket } from '../types';
import { getActiveCompanyId, getActiveSessionCompany } from '../utils/companyStorage';
import {
  loadAllPlatformReviews,
  loadAllSupportTickets,
  createSupportTicket,
  markTicketOpenedByClient,
  setTicketClosedByClient,
  addTicketMessage,
  REVIEW_CATEGORIES,
} from '../utils/reviewsAndTickets';
import { CommunityReviewsSection } from './CommunityReviewsSection';
import { emitGlobalToast } from '../context/ToastContext';

interface HelpSupportViewProps {
  user: User;
  settings?: AppSettings;
  staffList?: StaffMember[];
  projects?: ProjectFile[];
  leaves?: LeaveRequest[];
  isLight?: boolean;
  onNavigateTab?: (tab: string) => void;
  onOpenSettings?: () => void;
  onOpenAccessControl?: () => void;
}

type HelpPanelTab =
  | 'tutorial'
  | 'faq'
  | 'biometric'
  | 'shortcuts'
  | 'reviews'
  | 'support'
  | 'health';

export const HelpSupportView: React.FC<HelpSupportViewProps> = ({
  user,
  settings,
  staffList = [],
  projects = [],
  leaves = [],
  isLight = false,
  onNavigateTab,
  onOpenSettings,
  onOpenAccessControl,
}) => {
  const [activeTab, setActiveTab] = useState<HelpPanelTab>('tutorial');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Direct Support State
  const [ticketCategory, setTicketCategory] = useState('Technical Issue');
  const [customSubject, setCustomSubject] = useState('');
  const [ticketPriority, setTicketPriority] = useState('Normal');
  const [ticketEmail, setTicketEmail] = useState(user.email || '');
  const [ticketMessage, setTicketMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [ticketSuccessInfo, setTicketSuccessInfo] = useState<SupportTicket | null>(null);
  const [ticketsList, setTicketsList] = useState<SupportTicket[]>([]);
  const [reviewsCount, setReviewsCount] = useState<number>(() => loadAllSupportTickets().length);

  // Client Conversation Modal & Sort States
  const [isCreateChatModalOpen, setIsCreateChatModalOpen] = useState(false);
  const [activeConversationTicketId, setActiveConversationTicketId] = useState<string | null>(null);
  const [chatReplyText, setChatReplyText] = useState('');
  const [ticketOrder, setTicketOrder] = useState<'asc' | 'desc'>('asc');

  const companyId = getActiveCompanyId(user.companyId || user.company || settings?.companyId);
  const companyName = user.company || settings?.companyName || getActiveSessionCompany();

  // Load company tickets & reviews count
  useEffect(() => {
    setTicketsList(loadAllSupportTickets());
    setReviewsCount(loadAllPlatformReviews().length);

    const handleTicketsUpdated = () => setTicketsList(loadAllSupportTickets());
    const handleReviewsUpdated = () => setReviewsCount(loadAllPlatformReviews().length);

    window.addEventListener('skima_tickets_updated', handleTicketsUpdated);
    window.addEventListener('skima_reviews_updated', handleReviewsUpdated);
    return () => {
      window.removeEventListener('skima_tickets_updated', handleTicketsUpdated);
      window.removeEventListener('skima_reviews_updated', handleReviewsUpdated);
    };
  }, []);

  // Handle Direct Support Ticket Submit
  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketMessage.trim()) {
      emitGlobalToast('Please describe your issue or feedback.', 'warning');
      return;
    }
    if (ticketCategory === 'Other' && !customSubject.trim()) {
      emitGlobalToast('Please input your custom subject / topic.', 'warning');
      return;
    }

    setIsSubmittingTicket(true);
    const created = createSupportTicket({
      authorId: user.id || user.email || user.username,
      authorName: user.name,
      email: ticketEmail.trim(),
      companyName: companyName,
      companyId: companyId,
      category: ticketCategory,
      customSubject: ticketCategory === 'Other' ? customSubject.trim() : undefined,
      priority: ticketPriority,
      message: ticketMessage.trim(),
    });

    setTicketsList(loadAllSupportTickets());
    setIsSubmittingTicket(false);
    setIsCreateChatModalOpen(false);
    setTicketSuccessInfo(created);
    setTicketMessage('');
    setCustomSubject('');
    if (created?.id) {
      setActiveConversationTicketId(created.id);
    }
  };

  // Open ticket conversation modal & clear client unread
  const handleOpenConversation = (ticketId: string) => {
    markTicketOpenedByClient(ticketId);
    setActiveConversationTicketId(ticketId);
    setTicketsList(loadAllSupportTickets());
  };

  // Send client message in active conversation
  const handleSendClientMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversationTicketId || !chatReplyText.trim()) return;
    addTicketMessage(activeConversationTicketId, 'client', user.name || 'Client', chatReplyText.trim());
    setChatReplyText('');
    setTicketsList(loadAllSupportTickets());
  };

  // Toggle ticket close/open by client ("only the client can set the status to closed")
  const handleToggleCloseTicket = (ticketId: string, currentStatus: string) => {
    const isCurrentlyClosed = currentStatus === 'Closed';
    setTicketClosedByClient(ticketId, !isCurrentlyClosed);
    setTicketsList(loadAllSupportTickets());
  };

  // Tutorials List
  const modulesTutorial = [
    {
      id: 'mod-staff',
      title: 'Staff Directory & Workforce Management',
      icon: Users,
      badge: 'Core HR',
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      summary: 'Manage active, suspended, and exited workforce records, custom pay grades, biometric IDs, and generate official employment documents.',
      details: [
        {
          heading: 'Employee Status Pools',
          body: 'Staff members are categorized into Active, Suspended, or Exited pools. When a staff member is suspended, you can record a formal suspension reason and an end timestamp that is logged exclusively in the staff history audit trail.',
        },
        {
          heading: 'Official HR Document Generation',
          body: 'Instantly generate, customize, and export Official Job Descriptions (JDs), Confirmation Letters, and Letters of Appointment. You can preview in real-time, print directly, or export to editable Word (.doc) and PDF formats.',
        },
        {
          heading: 'Staff Log & Audit History',
          body: 'Every employee has an individual profile log capturing their full career timeline: department transfers, leave applications, disciplinary notes, attendance punches, and KPI ratings.',
        },
      ],
    },
    {
      id: 'mod-depts',
      title: 'Departments, Roles & Inter-Department Transfers',
      icon: Building2,
      badge: 'Structure',
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
      summary: 'Design your organizational hierarchy, assign Department Heads, define job roles with duty checklists, and execute tracked staff transfers.',
      details: [
        {
          heading: 'Custom Department Codes & Structure',
          body: 'Create distinct departments (e.g. Operations, Engineering, Quality Assurance, Production) with unique 3-to-4 letter codes. Assign a dedicated Head of Department and write scope descriptions.',
        },
        {
          heading: 'Role-Specific Job Descriptions',
          body: 'Build customized duty checklists for every job title. Highlight key core duties, add enumeration formats, and sync them seamlessly to the employee contract builder.',
        },
        {
          heading: 'Department Transfer Mechanism',
          body: 'Transfer employees across departments and update their job roles with effective dates and authorization references. All transfer events are automatically archived in the staff history log.',
        },
      ],
    },
    {
      id: 'mod-attendance',
      title: 'Attendance Worksheets & Biometric Processing',
      icon: FileSpreadsheet,
      badge: 'Biometrics',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      summary: 'Compile monthly matrix sheets, import raw biometric clock-in/out logs, compute shift compliance, and export verified payroll data.',
      details: [
        {
          heading: 'Excel / CSV Import Engine',
          body: 'Upload raw attendance punches exported from any biometric timeclock. Skima parses date strings, detects clock-in/out timestamps, computes total active hours, and applies grace period tolerances automatically.',
        },
        {
          heading: 'Monthly Matrix Grid & Summary Math',
          body: 'Review monthly attendance across all 31 days in a matrix grid. Skima automatically flags late arrivals, half-days, early departures, and overtime with color-coded badges and calculated totals.',
        },
        {
          heading: 'Payroll-Ready Export Formats',
          body: 'Export clean Excel worksheets, CSV files, or printable PDF attendance matrices with signature lines for payroll authorization and auditing.',
        },
      ],
    },
    {
      id: 'mod-shifts',
      title: 'Dynamic Shifts, Rotation Presets & Rosters',
      icon: Clock,
      badge: 'Scheduling',
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      summary: 'Define dynamic shift windows, save factory rotation presets, build weekly/monthly staff rosters, and synchronize with attendance scoring.',
      details: [
        {
          heading: 'Dynamic Shift Definitions',
          body: 'Create multiple shifts (e.g., Morning 08:00–17:00, Afternoon 14:00–22:00, Night 22:00–06:00) with independent grace periods and default flags.',
        },
        {
          heading: 'Shift Rotation Presets',
          body: 'Save standard shift configurations as reusable presets. Load factory rotations or single-shift presets with one click across all worksheets.',
        },
        {
          heading: 'Shift Roster Templates',
          body: 'Map staff members to specific shift rotations and save reusable shift roster templates to rapidly apply scheduling to new months.',
        },
      ],
    },
    {
      id: 'mod-leaves',
      title: 'Leaves Management, Approvals & Offs Matrix',
      icon: Calendar,
      badge: 'Compliance',
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      summary: 'Submit and track annual, sick, maternity, casual, and unpaid leaves. Attach medical documents and automatically sync approved leaves to attendance.',
      details: [
        {
          heading: 'Leave Application & Approval Workflow',
          body: 'HR managers can approve, reject, or mark leave requests as pending. Employees on approved leave are reflected as "On Leave" in attendance worksheets without penalizing late tallies.',
        },
        {
          heading: 'Document Attachments',
          body: 'Attach doctor notes, official memos, or approval letters directly to leave records for complete audit compliance.',
        },
        {
          heading: 'Leave History in Staff Dossier',
          body: 'All historical leave requests are chronologically archived in the employee\'s individual career profile and export archives.',
        },
      ],
    },
    {
      id: 'mod-feeding',
      title: 'Feeding Allowance Calculations',
      icon: UtensilsCrossed,
      badge: 'Compensation',
      color: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
      summary: 'Compute meal and feeding allowances based on active shift attendance, customizable daily rates, and department multipliers.',
      details: [
        {
          heading: 'Configurable Daily Rates & Multipliers',
          body: 'Set standard base daily feeding rates and assign department-specific overrides to match different operational or factory conditions.',
        },
        {
          heading: 'Automated Attendance Sync',
          body: 'Feeding allowances are calculated exclusively against verified active presence days, excluding absent or unapproved leave days.',
        },
      ],
    },
  ];

  // FAQ List
  const faqItems = [
    {
      q: 'How does organization data isolation work in OvraxHR?',
      a: 'Each organization has an isolated database namespace indexed by its unique Company ID. Data from one organization (staff rosters, attendance sheets, departments, user credentials) cannot be accessed or viewed by any other organization.',
    },
    {
      q: 'What formats does the biometric upload engine support?',
      a: 'Skima accepts Excel (.xlsx, .xls) and CSV (.csv) timeclock logs. The engine recognizes columns for Employee ID / Biometric ID, Date, Clock In time, Clock Out time, and Status.',
    },
    {
      q: 'How do I download the complete database with individual staff logs?',
      a: 'Go to Settings modal (or press ⚙️ Settings). In the backup section, click "Download Database (.zip)". This generates a ZIP containing all module JSONs and a dedicated staff_logs/ folder with folders for each staff member named by their Staff ID.',
    },
    {
      q: 'Can I restore a previous .zip or .json backup file?',
      a: 'Yes! In the Settings modal, click "Restore Backup" and select either your .zip folder archive or a .json backup file. Skima will validate the structure and reload all datasets into your workspace.',
    },
    {
      q: 'How do I create and customize official HR documents (JDs, letters)?',
      a: 'In the Staff Directory, click on any staff member to open their Profile Modal. Select "Generate HR Documents" to customize Job Descriptions, Confirmation Letters, or Appointment Letters, complete with company logos and signature lines.',
    },
    {
      q: 'How can our team reach direct customer support?',
      a: 'You can call our direct helpline at +234 815 405 8015 or submit an inquiry right from the "Direct Support Desk" tool on this panel.',
    },
  ];

  // Biometric format guide
  const biometricFormats = [
    {
      name: 'Standard Biometric Punch Export (Recommended)',
      cols: ['EmployeeID / UserID', 'EmployeeName', 'Date (YYYY-MM-DD)', 'ClockIn (HH:MM)', 'ClockOut (HH:MM)', 'Department'],
      desc: 'Exported from ZKTeco, Anviz, Hikvision, or Fingerprint/Face terminals.',
    },
    {
      name: 'Single Timestamp Transaction Log',
      cols: ['Staff ID', 'DateTime (YYYY-MM-DD HH:MM:SS)', 'Punch State (0=CheckIn, 1=CheckOut)'],
      desc: 'Paired automatically by Skima\'s biometric processing engine into daily attendance sessions.',
    },
    {
      name: 'Monthly Matrix Grid File',
      cols: ['Employee ID', 'Name', 'Day 1', 'Day 2', '...', 'Day 31'],
      desc: 'Standard HR summary grid with status codes (P, A, L, HD, OFF, LV).',
    },
  ];

  // Pro tips
  const proTips = [
    { title: 'Keyboard Quick Navigation', desc: 'Use Esc to close modals instantly and Tab to rapidly advance through table inputs.' },
    { title: 'Grace Period Calculation', desc: 'Configure company-wide grace period in Settings to prevent false late penalties.' },
    { title: 'Automated Roster Templates', desc: 'Save your standard 3-shift rotation as a template to apply monthly schedules in seconds.' },
    { title: 'Company Logo in HR Letters', desc: 'Upload your company logo in Settings or document editor for official branded PDF/Word exports.' },
  ];

  // Filter items based on universal search query
  const q = searchQuery.trim().toLowerCase();

  const filteredTutorials = modulesTutorial.filter(
    (m) =>
      m.title.toLowerCase().includes(q) ||
      m.summary.toLowerCase().includes(q) ||
      m.details.some((d) => d.heading.toLowerCase().includes(q) || d.body.toLowerCase().includes(q))
  );

  const filteredFaqs = faqItems.filter(
    (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
  );

  const filteredBiometrics = biometricFormats.filter(
    (b) =>
      b.name.toLowerCase().includes(q) ||
      b.desc.toLowerCase().includes(q) ||
      b.cols.some((c) => c.toLowerCase().includes(q))
  );

  return (
    <div className="space-y-6">
      {/* 1. UNIVERSAL SEARCH BAR ON TOP OF THE PANEL - STRETCHING TO END OF PAGE */}
      <div className="space-y-2">
        <div className="relative w-full">
          <Search className={`w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search across all modules, tutorials, FAQs, biometric formats, reviews, and support tools..."
            className={`w-full pl-12 pr-10 py-3.5 rounded-2xl text-xs sm:text-sm font-medium outline-none transition shadow-sm ${
              isLight
                ? 'bg-white border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 text-slate-900 placeholder-slate-400'
                : 'bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-100 placeholder-slate-500'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute right-4 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 px-1">
            <span>Filtering active view by keyword: <strong>"{searchQuery}"</strong></span>
          </div>
        )}
      </div>

      {/* 2. MAIN LAYOUT: VERTICAL PANEL NAVIGATION (LEFT) & SOPHISTICATED CONTENT VIEWER (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Vertical Navigation Menu */}
        <aside className="lg:col-span-3 space-y-3">
          <div
            className={`p-3 rounded-2xl border space-y-1 ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            <div className="px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Navigation & Tools
            </div>

            <button
              onClick={() => setActiveTab('tutorial')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                activeTab === 'tutorial'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : isLight
                  ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4" />
                <span>Modules Tutorial</span>
              </div>
              <span className="text-[10px] font-mono opacity-80">{modulesTutorial.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('faq')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                activeTab === 'faq'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : isLight
                  ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileQuestion className="w-4 h-4" />
                <span>FAQ & Knowledge</span>
              </div>
              <span className="text-[10px] font-mono opacity-80">{faqItems.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('biometric')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                activeTab === 'biometric'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : isLight
                  ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Biometric Formats</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                activeTab === 'shortcuts'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : isLight
                  ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4" />
                <span>Pro Tips & Tricks</span>
              </div>
            </button>

            <div className="my-2 border-t border-slate-800/60" />

            <button
              onClick={() => setActiveTab('reviews')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                activeTab === 'reviews'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : isLight
                  ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Star className="w-4 h-4" />
                <span>Community Reviews</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {reviewsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('support')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                activeTab === 'support'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : isLight
                  ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LifeBuoy className="w-4 h-4" />
                <span>Direct Support Desk</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>

            <button
              onClick={() => setActiveTab('health')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                activeTab === 'health'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : isLight
                  ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4" />
                <span>Workspace Health</span>
              </div>
            </button>
          </div>

          {/* Helpline Direct Card */}
          <div
            className={`p-4 rounded-2xl border space-y-2 ${
              isLight
                ? 'bg-indigo-50/70 border-indigo-200 text-slate-800'
                : 'bg-indigo-950/20 border-indigo-800/40 text-slate-100'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
              <Phone className="w-4 h-4" />
              <span>Direct HR Helpline</span>
            </div>
            <p className="text-xs font-mono font-bold text-slate-100">+234 815 405 8015</p>
            <p className="text-[11px] text-slate-400">Available for live integration support & timeclock pairing.</p>
          </div>
        </aside>

        {/* Right Main Tool Content View */}
        <main className="lg:col-span-9 min-w-0">
          {/* TAB 1: MODULES TUTORIAL */}
          {activeTab === 'tutorial' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Skima Workforce Management System Guide
                  </h3>
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Comprehensive tutorials for all HR and Biometric operational modules.
                  </p>
                </div>
              </div>

              {filteredTutorials.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">
                  No tutorials matched your search keyword.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTutorials.map((mod) => {
                    const Icon = mod.icon;
                    return (
                      <div
                        key={mod.id}
                        className={`p-5 rounded-2xl border transition shadow-sm ${
                          isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 mb-3 border-slate-800/60">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl border ${mod.color}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                {mod.title}
                              </h4>
                              <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                {mod.summary}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 self-start sm:self-auto border ${mod.color}`}
                          >
                            {mod.badge}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {mod.details.map((item, idx) => (
                            <div
                              key={idx}
                              className={`p-3.5 rounded-xl border space-y-1.5 ${
                                isLight
                                  ? 'bg-slate-50 border-slate-200/80 text-slate-700'
                                  : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                              }`}
                            >
                              <h5 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span>{item.heading}</span>
                              </h5>
                              <p className="text-[11px] leading-relaxed text-slate-400">{item.body}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FAQ */}
          {activeTab === 'faq' && (
            <div className="space-y-4">
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Frequently Asked Questions
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Answers to standard operational questions, database isolation, and document processing.
                </p>
              </div>

              {filteredFaqs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">
                  No FAQ questions matched your search query.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredFaqs.map((faq, index) => {
                    const isOpen = openFaqIndex === index;
                    return (
                      <div
                        key={index}
                        className={`rounded-2xl border transition overflow-hidden ${
                          isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                          className="w-full p-4 text-left flex items-center justify-between gap-4 cursor-pointer"
                        >
                          <span className={`text-xs sm:text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            {faq.q}
                          </span>
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4 text-indigo-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                        </button>

                        {isOpen && (
                          <div
                            className={`px-4 pb-4 pt-1 text-xs sm:text-sm leading-relaxed border-t ${
                              isLight
                                ? 'text-slate-600 border-slate-100 bg-slate-50/50'
                                : 'text-slate-300 border-slate-800/80 bg-slate-950/40'
                            }`}
                          >
                            {faq.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BIOMETRIC FORMATS */}
          {activeTab === 'biometric' && (
            <div className="space-y-4">
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Biometric Timeclock Import Specifications
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Column schemas and mapping guidelines for hardware biometric logs (ZKTeco, Anviz, Suprema, CSV/Excel).
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredBiometrics.map((spec, idx) => (
                  <div
                    key={idx}
                    className={`p-5 rounded-2xl border space-y-3 ${
                      isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <h4 className={`text-xs sm:text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {spec.name}
                      </h4>
                    </div>
                    <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{spec.desc}</p>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block mb-1.5">
                        Expected Columns / Headers:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {spec.cols.map((col, cIdx) => (
                          <span
                            key={cIdx}
                            className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: PRO TIPS */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Pro Tips & Operational Shortcuts
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Speed up your daily HR workflow with these built-in power features.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {proTips.map((tip, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border space-y-2 ${
                      isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <h4 className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {tip.title}
                      </h4>
                    </div>
                    <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      {tip.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: REVIEWS TAB */}
          {activeTab === 'reviews' && (
            <CommunityReviewsSection
              user={user}
              settings={settings}
              isLight={isLight}
              searchQuery={searchQuery}
              onOpenSettings={onOpenSettings}
            />
          )}

          {/* TAB 6: DIRECT SUPPORT DESK (3x3 GRID CONVERSATIONS) */}
          {activeTab === 'support' && (
            <div className="space-y-6">
              {/* Header with shortened span and Start New Chat button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-800">
                <div className="space-y-0.5 min-w-0">
                  <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'} flex items-center gap-2`}>
                    <LifeBuoy className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>Direct Support Desk</span>
                  </h3>
                  <span className={`text-xs block truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Connect directly with Rheivatech engineering for integrations, biometrics, and ticket resolution.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreateChatModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/20 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Start New Chat</span>
                </button>
              </div>

              {/* Channels Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div
                  className={`p-4 rounded-2xl border space-y-1 ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <Phone className="w-4 h-4" />
                    <span>Direct Helpline</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-slate-100">+234 815 405 8015</div>
                  <p className="text-[11px] text-slate-400">Direct phone & WhatsApp support</p>
                </div>

                <div
                  className={`p-4 rounded-2xl border space-y-1 ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                    <Mail className="w-4 h-4" />
                    <span>Email Support</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-slate-100">support@rheivatech.com</div>
                  <p className="text-[11px] text-slate-400">Engineering ticket response</p>
                </div>

                <div
                  className={`p-4 rounded-2xl border space-y-1 ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <Clock className="w-4 h-4" />
                    <span>SLA Response Time</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-slate-100">&lt; 15 Minutes</div>
                  <p className="text-[11px] text-slate-400">Priority enterprise support</p>
                </div>
              </div>

              {/* 3x3 Gridded Conversations */}
              {(() => {
                const currentUserId = user.id || user.email || user.username;
                const isTechSupportDesk =
                  user.isInternalCrew ||
                  user.isSuperAdmin ||
                  user.role === 'SuperAdmin' ||
                  (user.username && user.username.startsWith('entry-rheivatech-'));

                const companyTickets = ticketsList
                  .filter((t) => {
                    const matchesCompany =
                      (t.companyId && companyId && t.companyId.trim().toLowerCase() === companyId.trim().toLowerCase()) ||
                      (t.companyName && companyName && t.companyName.trim().toLowerCase() === companyName.trim().toLowerCase());

                    if (!matchesCompany) return false;

                    // PRIVACY FILTER:
                    // Support tickets are private between the client who initiated the direct message and the technical support team.
                    if (isTechSupportDesk) return true;

                    const matchesAuthor =
                      (t.authorId && currentUserId && t.authorId === currentUserId) ||
                      (t.email && user.email && t.email.trim().toLowerCase() === user.email.trim().toLowerCase()) ||
                      (t.authorName && user.name && t.authorName.trim().toLowerCase() === user.name.trim().toLowerCase());

                    return Boolean(matchesAuthor);
                  })
                  .sort((a, b) => {
                    const timeA = new Date(a.lastMessageAt || a.createdAt).getTime();
                    const timeB = new Date(b.lastMessageAt || b.createdAt).getTime();
                    return ticketOrder === 'asc' ? timeA - timeB : timeB - timeA;
                  });

                if (companyTickets.length === 0) {
                  return (
                    <div className="p-8 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">No Support Conversations Yet</h4>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                          Have a question regarding biometric integration, leave policies, or system access? Start a new chat to connect with our support desk.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsCreateChatModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-lg shadow-rose-600/20 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Start New Chat</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-300">
                          Support Conversations ({companyTickets.length})
                        </h4>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Click any card to open thread
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Order by:</span>
                        <button
                          type="button"
                          onClick={() => setTicketOrder(ticketOrder === 'asc' ? 'desc' : 'asc')}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
                        >
                          {ticketOrder === 'asc' ? 'Oldest First' : 'Newest First'}
                        </button>
                      </div>
                    </div>

                    {/* 3x3 Card Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {companyTickets.map((t) => {
                        const msgs = t.messages && t.messages.length > 0 ? t.messages : [];
                        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

                        return (
                          <div
                            key={t.id}
                            onClick={() => handleOpenConversation(t.id)}
                            className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between hover:border-rose-500/50 hover:shadow-xl group ${
                              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/90 border-slate-800'
                            }`}
                          >
                            <div className="space-y-3">
                              {/* Card Header: Ticket No, Status, and Unread Badge */}
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-mono text-xs font-bold text-slate-400 group-hover:text-rose-400 transition">
                                  #{t.ticketNumber}
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  {t.unreadByClient && (
                                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40 animate-pulse flex items-center gap-1">
                                      🔔 New Reply
                                    </span>
                                  )}
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                      t.status === 'Open'
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                        : t.status === 'In Review'
                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                        : 'bg-slate-800 text-slate-400 border-slate-700'
                                    }`}
                                  >
                                    {t.status}
                                  </span>
                                </div>
                              </div>

                              {/* Subject & Category */}
                              <div>
                                <h4 className="text-sm font-bold text-slate-100 line-clamp-1">
                                  {t.customSubject || t.category}
                                </h4>
                                <span className="text-[11px] text-slate-400 block mt-0.5">
                                  Category: <strong className="text-slate-300">{t.category}</strong>
                                </span>
                              </div>

                              {/* Latest Message Preview */}
                              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300">
                                <div className="text-[10px] font-mono text-slate-500 mb-0.5 flex items-center justify-between">
                                  <span>{lastMsg ? (lastMsg.sender === 'client' ? 'You' : 'Support Desk') : 'Initial'}</span>
                                  <span>{new Date(t.lastMessageAt || t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="line-clamp-2 leading-relaxed">
                                  {lastMsg ? lastMsg.text : t.message}
                                </p>
                              </div>
                            </div>

                            {/* Card Footer: Timestamp & Message Count */}
                            <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/60 text-[11px] text-slate-500 font-mono">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3 text-rose-400" />
                                {msgs.length || 1} {msgs.length === 1 ? 'message' : 'messages'}
                              </span>
                              <span>{new Date(t.lastMessageAt || t.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* CREATE NEW CHAT MODAL */}
              {isCreateChatModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
                  <div
                    className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden my-8 ${
                      isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
                    }`}
                  >
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          <LifeBuoy className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">Start New Support Chat</h4>
                          <p className="text-[11px] text-slate-400">
                            Dispatches a ticket to the Rheivatech engineering team.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsCreateChatModalOpen(false)}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSupportSubmit} className="p-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-300 block">Inquiry Category:</label>
                          <select
                            value={ticketCategory}
                            onChange={(e) => setTicketCategory(e.target.value)}
                            className="w-full p-2 rounded-xl text-xs font-medium outline-none border bg-slate-950 border-slate-700 text-slate-100"
                          >
                            {REVIEW_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                            <option value="Other">Other / Custom Issue</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-300 block">Priority Level:</label>
                          <select
                            value={ticketPriority}
                            onChange={(e) => setTicketPriority(e.target.value)}
                            className="w-full p-2 rounded-xl text-xs font-medium outline-none border bg-slate-950 border-slate-700 text-slate-100"
                          >
                            <option value="Normal">Normal</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>
                      </div>

                      {ticketCategory === 'Other' && (
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-amber-400 block">Subject / Topic:</label>
                          <input
                            type="text"
                            value={customSubject}
                            onChange={(e) => setCustomSubject(e.target.value)}
                            placeholder="Enter custom subject..."
                            className="w-full p-2 rounded-xl text-xs font-medium outline-none border bg-slate-950 border-amber-500/60 text-slate-100"
                            required
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300 block">Contact Email:</label>
                        <input
                          type="email"
                          value={ticketEmail}
                          onChange={(e) => setTicketEmail(e.target.value)}
                          placeholder="e.g. hr@company.com"
                          className="w-full p-2 rounded-xl text-xs font-medium outline-none border bg-slate-950 border-slate-700 text-slate-100"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300 block">Initial Message & Details:</label>
                        <textarea
                          rows={4}
                          value={ticketMessage}
                          onChange={(e) => setTicketMessage(e.target.value)}
                          placeholder="Explain the inquiry or issue..."
                          className="w-full p-2 rounded-xl text-xs font-medium outline-none border bg-slate-950 border-slate-700 text-slate-100 leading-relaxed"
                          required
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => setIsCreateChatModalOpen(false)}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingTicket}
                          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isSubmittingTicket ? 'Starting...' : 'Start Conversation'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* CONVERSATION VIEWER MODAL */}
              {activeConversationTicketId && (() => {
                const activeTicket = ticketsList.find((t) => t.id === activeConversationTicketId);
                if (!activeTicket) return null;

                const messages = activeTicket.messages && activeTicket.messages.length > 0
                  ? activeTicket.messages
                  : [
                      {
                        id: 'initial',
                        sender: 'client' as const,
                        authorName: activeTicket.authorName || 'You',
                        text: activeTicket.message,
                        timestamp: activeTicket.createdAt,
                      },
                    ];

                return (
                  <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
                    <div
                      className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden my-6 flex flex-col max-h-[85vh] ${
                        isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
                      }`}
                    >
                      {/* Modal Header */}
                      <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-rose-400">
                              #{activeTicket.ticketNumber}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                activeTicket.status === 'Open'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : activeTicket.status === 'In Review'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {activeTicket.status}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              ({activeTicket.category})
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white truncate mt-0.5">
                            {activeTicket.customSubject || activeTicket.category}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Only the client can set the status to closed */}
                          <button
                            type="button"
                            onClick={() => handleToggleCloseTicket(activeTicket.id, activeTicket.status)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer flex items-center gap-1 ${
                              activeTicket.status === 'Closed'
                                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                            }`}
                            title={activeTicket.status === 'Closed' ? 'Reopen this conversation' : 'Close and resolve this chat'}
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>{activeTicket.status === 'Closed' ? 'Reopen Chat' : 'Close Chat'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveConversationTicketId(null)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Chat Messages Body */}
                      <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-950/40">
                        {messages.map((m) => {
                          const isClient = m.sender === 'client';
                          return (
                            <div
                              key={m.id}
                              className={`flex flex-col ${isClient ? 'items-end' : 'items-start'}`}
                            >
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mb-1 px-1">
                                <span className={isClient ? 'text-indigo-300 font-bold' : 'text-rose-400 font-bold'}>
                                  {isClient ? (m.authorName || 'You') : 'Rheivatech Support'}
                                </span>
                                <span>•</span>
                                <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <div
                                className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed shadow-sm ${
                                  isClient
                                    ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 rounded-tr-none'
                                    : 'bg-slate-900 border border-slate-700/80 text-slate-200 rounded-tl-none'
                                }`}
                              >
                                {m.text}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Chat Input Footer */}
                      <form onSubmit={handleSendClientMessage} className="p-3 border-t border-slate-800 bg-slate-950/70 flex gap-2">
                        <input
                          type="text"
                          value={chatReplyText}
                          onChange={(e) => setChatReplyText(e.target.value)}
                          placeholder={activeTicket.status === 'Closed' ? 'Type to reply (will reopen conversation)...' : 'Type your message to support...'}
                          className="flex-1 p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-rose-500"
                        />
                        <button
                          type="submit"
                          disabled={!chatReplyText.trim()}
                          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send</span>
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 7: WORKSPACE HEALTH (SOPHISTICATED DEDICATED TOOL) */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              <div>
                <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'} flex items-center gap-2`}>
                  <Cpu className="w-5 h-5 text-emerald-400" />
                  <span>Workspace Environment & Health Diagnostics</span>
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Real-time system telemetry, active organization data isolation counters, and browser health.
                </p>
              </div>

              {/* Status Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div
                  className={`p-4 rounded-2xl border space-y-1 ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <span className="text-[10px] uppercase font-mono text-slate-500">Staff Records</span>
                  <div className="text-xl font-bold font-mono text-slate-100">{staffList.length} Active</div>
                </div>

                <div
                  className={`p-4 rounded-2xl border space-y-1 ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <span className="text-[10px] uppercase font-mono text-slate-500">Attendance Sheets</span>
                  <div className="text-xl font-bold font-mono text-slate-100">{projects.length} Files</div>
                </div>

                <div
                  className={`p-4 rounded-2xl border space-y-1 ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <span className="text-[10px] uppercase font-mono text-slate-500">Leave Requests</span>
                  <div className="text-xl font-bold font-mono text-slate-100">{leaves.length} Filed</div>
                </div>

                <div
                  className={`p-4 rounded-2xl border space-y-1 ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <span className="text-[10px] uppercase font-mono text-slate-500">Database Namespace</span>
                  <div className="text-xl font-bold font-mono text-indigo-400">{companyId}</div>
                </div>
              </div>

              {/* Environment Diagnostics */}
              <div
                className={`p-5 rounded-2xl border space-y-3 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-emerald-400">
                  Storage & Architecture Integrity
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-slate-500">Data Isolation:</span>
                    <div className="text-emerald-400 font-bold">100% Isolated Scoped Namespace</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-slate-500">Active Organization ID:</span>
                    <div className="text-indigo-300 font-bold">{companyName} ({companyId})</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-slate-500">Super Admin Site Gateway:</span>
                    <div className="text-amber-300 font-bold">Dual-Table Master Verification Enabled</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-slate-500">Official Helpline:</span>
                    <div className="text-slate-200 font-bold">+234 815 405 8015</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
