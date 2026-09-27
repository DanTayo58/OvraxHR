import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Building2,
  Users,
  Star,
  LifeBuoy,
  Database,
  Search,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  LogOut,
  RefreshCw,
  Eye,
  Key,
  ShieldCheck,
  Check,
  X,
  Send,
  MessageSquare,
  FileSpreadsheet,
  FolderArchive,
  BarChart3,
  Sliders,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Sparkles,
  ExternalLink,
  Save,
  LayoutDashboard,
} from 'lucide-react';
import { User, PlatformReview, SupportTicket, StaffMember, ProjectFile } from '../types';
import { RheivatechLogo } from './RheivatechLogo';
import {
  loadAllCompanyUsers,
  saveAllCompanyUsers,
  CompanyUserAccount,
  updateCompanyUser,
  deleteCompanyUser,
  deleteCompany,
} from '../utils/userManagement';
import {
  loadAllPlatformReviews,
  deletePlatformReview,
  addReviewReply,
  deleteReviewReply,
  loadAllSupportTickets,
  updateSupportTicketStatus,
  deleteSupportTicket,
  markTicketOpenedBySupport,
  addTicketMessage,
} from '../utils/reviewsAndTickets';
import {
  STORAGE_KEYS,
  loadCompanyData,
  saveCompanyData,
  normalizeCompanyId,
  normalizeCompanyKey,
} from '../utils/companyStorage';
import { generateFullDatabaseArchiveZip } from '../utils/backupRestore';
import { getCentralCompanyLogo } from '../utils/logoStorage';
import { ExportPasswordModal } from './ExportPasswordModal';
import { AdminUserAccountsTab } from './AdminUserAccountsTab';
import { AdminVouchersTab } from './AdminVouchersTab';
import { AdminCrewTab } from './AdminCrewTab';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { loadAllVouchers } from '../utils/vouchers';
import { loadInternalDepartments } from '../utils/internalCrewManagement';
import { Gift, Globe, Shield } from 'lucide-react';

interface AdminPortalViewProps {
  user: User;
  onLogout: () => void;
  onOpenWebsite?: () => void;
}

type AdminTab = 'dashboard' | 'overview' | 'users' | 'vouchers' | 'reviews' | 'tickets' | 'crew' | 'system';

export const AdminPortalView: React.FC<AdminPortalViewProps> = ({ user, onLogout, onOpenWebsite }) => {
  const isSuperAdmin = !!(user.isSuperAdmin || user.role === 'SuperAdmin');
  const isInternalCrew = !!user.isInternalCrew;

  const [refreshKey, setRefreshKey] = useState(0);

  // Calculate allowed tabs based on user role and department mapping
  const allowedTabs: AdminTab[] = React.useMemo(() => {
    if (isSuperAdmin) {
      return ['dashboard', 'overview', 'users', 'vouchers', 'reviews', 'tickets', 'crew', 'system'];
    }
    if (isInternalCrew) {
      if (user.departmentId) {
        const liveDepts = loadInternalDepartments();
        const liveDept = liveDepts.find((d) => d.id === user.departmentId);
        if (liveDept && Array.isArray(liveDept.assignedTabs) && liveDept.assignedTabs.length > 0) {
          const valid = liveDept.assignedTabs.filter((t) => t !== ('companies' as any)) as AdminTab[];
          if (valid.length > 0) return valid;
        }
      }
      if (Array.isArray(user.assignedTabs) && user.assignedTabs.length > 0) {
        const valid = user.assignedTabs.filter((t) => t !== ('companies' as any)) as AdminTab[];
        return valid.length > 0 ? valid : ['dashboard'];
      }
      return ['dashboard'];
    }
    return ['dashboard'];
  }, [isSuperAdmin, isInternalCrew, user.departmentId, user.assignedTabs, refreshKey]);

  const [activeTab, setActiveTab] = useState<AdminTab>(() => allowedTabs[0] || 'dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<CompanyUserAccount[]>([]);
  const [reviews, setReviews] = useState<PlatformReview[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [vouchersCount, setVouchersCount] = useState(0);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Conversational Support Tickets States
  const [activeTicketChatId, setActiveTicketChatId] = useState<string | null>(null);
  const [ticketReplyInput, setTicketReplyInput] = useState('');

  // Platform Reviews Comments Toggle
  const [expandedReviewCommentIds, setExpandedReviewCommentIds] = useState<Set<string>>(new Set());

  // In-app Confirmation Modal for safe deletion without window.confirm blocking
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemName?: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    action: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
  });

  // Keep activeTab aligned with allowedTabs
  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [allowedTabs, activeTab]);

  // Selected company modal / details
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isExportingCompanyZip, setIsExportingCompanyZip] = useState<string | null>(null);
  const [exportModalCompany, setExportModalCompany] = useState<{ id: string; name: string } | null>(null);

  // Edit user password state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Ticket reply note state
  const [activeTicketReplyId, setActiveTicketReplyId] = useState<string | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');

  // Load all system data
  useEffect(() => {
    const loadedUsers = loadAllCompanyUsers();
    const loadedReviews = loadAllPlatformReviews();
    const loadedTickets = loadAllSupportTickets();
    const loadedVouchers = loadAllVouchers();

    setAllUsers(loadedUsers);
    setReviews(loadedReviews);
    setTickets(loadedTickets);
    setVouchersCount(loadedVouchers.length);
  }, [refreshKey]);

  // Derive unique companies from users and localStorage keys
  const companyMap = new Map<
    string,
    {
      companyName: string;
      companyId: string;
      usersCount: number;
      adminUser?: CompanyUserAccount;
      staffCount: number;
      projectsCount: number;
      createdAt?: string;
    }
  >();

  // Extract from registered users
  allUsers.forEach((u) => {
    const cName = u.company || 'Unknown Company';
    const cId = u.companyId || normalizeCompanyId(cName);
    const key = cId.toUpperCase();

    if (!companyMap.has(key)) {
      // Check stored staff & project counts
      const storedStaff = loadCompanyData<StaffMember[]>(STORAGE_KEYS.STAFF, cName, []);
      const storedProjects = loadCompanyData<ProjectFile[]>(STORAGE_KEYS.PROJECTS, cName, []);

      companyMap.set(key, {
        companyName: cName,
        companyId: cId,
        usersCount: 0,
        staffCount: Array.isArray(storedStaff) ? storedStaff.length : 0,
        projectsCount: Array.isArray(storedProjects) ? storedProjects.length : 0,
        createdAt: u.createdAt,
      });
    }

    const item = companyMap.get(key)!;
    item.usersCount += 1;
    if (u && (u.role === 'Admin' || u.isAdmin)) {
      item.adminUser = u;
    }
  });

  const companiesList = Array.from(companyMap.values());

  // Trigger notice helper
  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 3500);
  };

  // Handlers for User Management
  const handleToggleUserVerification = (u: CompanyUserAccount) => {
    const newStatus = !u.isEmailVerified;
    updateCompanyUser(u.id, { isEmailVerified: newStatus });
    setRefreshKey((k) => k + 1);
    showNotice(`Updated verification for ${u.name} to ${newStatus ? 'Verified' : 'Unverified'}`);
  };

  const handleSaveUserPassword = (userId: string) => {
    if (!newPasswordInput.trim()) return;
    updateCompanyUser(userId, { password: newPasswordInput.trim() });
    setEditingUserId(null);
    setNewPasswordInput('');
    setRefreshKey((k) => k + 1);
    showNotice('User password successfully updated.');
  };

  const handleDeleteUserAccount = (userId: string, userName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete User Account',
      message: `Are you sure you want to permanently delete user account "${userName}"? This action cannot be undone.`,
      itemName: userName,
      confirmLabel: 'Delete Permanently',
      isDestructive: true,
      action: () => {
        deleteCompanyUser(userId);
        setRefreshKey((k) => k + 1);
        showNotice(`User "${userName}" was removed.`);
      },
    });
  };

  // Handlers for Reviews
  const handleDeleteReview = (reviewId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Platform Review',
      message: 'Are you sure you want to permanently delete this customer review from public display?',
      confirmLabel: 'Delete Review',
      isDestructive: true,
      action: () => {
        deletePlatformReview(reviewId);
        setRefreshKey((k) => k + 1);
        showNotice('Review deleted successfully.');
      },
    });
  };

  // Handlers for Tickets
  const handleOpenTicketChat = (ticketId: string) => {
    markTicketOpenedBySupport(ticketId);
    setActiveTicketChatId(ticketId);
    setTickets(loadAllSupportTickets());
    setRefreshKey((k) => k + 1);
  };

  const handleSendAdminTicketReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicketChatId || !ticketReplyInput.trim()) return;
    addTicketMessage(
      activeTicketChatId,
      'support',
      user.name || 'OvraxHR Support Specialist',
      ticketReplyInput.trim()
    );
    setTicketReplyInput('');
    setTickets(loadAllSupportTickets());
    setRefreshKey((k) => k + 1);
    showNotice('Reply dispatched to organization chat.');
  };

  const toggleReviewComments = (reviewId: string) => {
    setExpandedReviewCommentIds((prev) => {
      const next = new Set(prev);
      if (next.has(reviewId)) {
        next.delete(reviewId);
      } else {
        next.add(reviewId);
      }
      return next;
    });
  };

  const handleUpdateTicketStatus = (ticketId: string, status: SupportTicket['status']) => {
    updateSupportTicketStatus(ticketId, status);
    setRefreshKey((k) => k + 1);
    showNotice(`Ticket marked as ${status}.`);
  };

  const handleSaveTicketAdminNote = (ticketId: string) => {
    updateSupportTicketStatus(ticketId, 'In Review', adminNoteInput);
    setActiveTicketReplyId(null);
    setAdminNoteInput('');
    setRefreshKey((k) => k + 1);
    showNotice('Admin response note saved to ticket.');
  };

  const handleDeleteTicket = (ticketId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Support Ticket',
      message: 'Delete this support ticket permanently from the helpdesk log?',
      confirmLabel: 'Delete Ticket',
      isDestructive: true,
      action: () => {
        deleteSupportTicket(ticketId);
        setRefreshKey((k) => k + 1);
        showNotice('Support ticket removed.');
      },
    });
  };

  // Delete entire organization
  const handleDeleteCompany = (companyId: string, companyName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Organization & Workspace',
      message: `Permanently delete organization "${companyName}"? All accounts, attendance registers, and company worksheets will be removed.`,
      itemName: `${companyName} (ID: ${companyId})`,
      confirmLabel: 'Delete Organization',
      isDestructive: true,
      action: () => {
        deleteCompany(companyId || companyName);
        if (selectedCompanyId === companyId) setSelectedCompanyId(null);
        setRefreshKey((k) => k + 1);
        showNotice(`Organization "${companyName}" and its accounts were deleted.`);
      },
    });
  };

  // Download Company Backup - Opens password encryption modal
  const handleDownloadCompanyArchive = (companyIdOrName: string) => {
    const comp = companiesList.find((c) => c.companyId === companyIdOrName || c.companyName === companyIdOrName);
    setExportModalCompany({
      id: comp?.companyId || companyIdOrName,
      name: comp?.companyName || companyIdOrName,
    });
  };

  const handleConfirmCompanyExportWithPassword = async (password: string) => {
    if (!exportModalCompany) return;
    try {
      setIsExportingCompanyZip(exportModalCompany.id);
      const { blob, fileName } = await generateFullDatabaseArchiveZip(exportModalCompany.id, password);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotice(`Encrypted full backup exported for ${exportModalCompany.name}`);
      setExportModalCompany(null);
    } catch (e: any) {
      showNotice(`Error exporting encrypted archive: ${e.message}`);
    } finally {
      setIsExportingCompanyZip(null);
    }
  };

  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState<string>('');

  const handlePostAdminReply = (reviewId: string) => {
    if (!replyMessage.trim()) return;
    const deptName = user.departmentName || 'Customer Support & Technical Team';
    addReviewReply(reviewId, {
      authorId: user.id || 'support-team',
      authorName: user.name || 'OvraxHR Help Desk Specialist',
      authorRole: deptName,
      departmentName: deptName,
      message: replyMessage.trim(),
      isOfficialSupport: true,
    });
    setReplyMessage('');
    setReplyingReviewId(null);
    setRefreshKey((k) => k + 1);
    showNotice('Official support reply published to review.');
  };

  const handleDeleteAdminReply = (reviewId: string, replyId: string) => {
    deleteReviewReply(reviewId, replyId);
    setRefreshKey((k) => k + 1);
    showNotice('Reply removed.');
  };

  // Filtered queries
  const q = searchQuery.trim().toLowerCase();

  const filteredCompanies = companiesList.filter(
    (c) =>
      c.companyName.toLowerCase().includes(q) ||
      c.companyId.toLowerCase().includes(q) ||
      (c.adminUser?.name || '').toLowerCase().includes(q) ||
      (c.adminUser?.email || '').toLowerCase().includes(q)
  );

  const filteredUsers = (allUsers || []).filter(
    (u) =>
      u &&
      ((u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.company || '').toLowerCase().includes(q) ||
        (u.companyId || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q))
  );

  const filteredReviews = reviews.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.content.toLowerCase().includes(q) ||
      r.authorName.toLowerCase().includes(q) ||
      r.companyName.toLowerCase().includes(q)
  );

  const filteredTickets = tickets.filter(
    (t) =>
      t.ticketNumber.toLowerCase().includes(q) ||
      t.authorName.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.companyName.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      (t.customSubject || '').toLowerCase().includes(q) ||
      t.message.toLowerCase().includes(q)
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex flex-col">
      {/* Top Super Admin Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-600 to-rose-600 text-white shadow-lg shadow-rose-900/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>OvraxHR Super Admin Console</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Rheivatech Engine
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-slate-400 font-mono">
                Logged in as <strong className="text-amber-400">{user.username || 'entry-rheivatech-admin'}</strong> ({user.email})
              </p>
              {isInternalCrew && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {user.departmentName} Dept &bull; {allowedTabs.length} Tabs Allowed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {onOpenWebsite && (
            <button
              type="button"
              onClick={onOpenWebsite}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Preview OvraxHR Public Landing Page & Pricing"
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>Public Website</span>
            </button>
          )}

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
            title="Refresh System Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={onLogout}
            className="p-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center justify-center transition cursor-pointer"
            title="Exit Admin Console / Log Out"
            aria-label="Exit Admin Console"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Status Notice Toast */}
      {statusNotice && (
        <div className="fixed bottom-6 right-6 z-50 p-3.5 rounded-2xl bg-emerald-950/90 text-emerald-200 border border-emerald-500/50 shadow-2xl backdrop-blur flex items-center gap-2 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Main Admin Body */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 sm:p-6 gap-6">
        {/* Left Vertical Navigation Menu */}
        <aside className="w-full md:w-64 shrink-0 space-y-2">
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            {allowedTabs.includes('dashboard') && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Staff Dashboard</span>
                </div>
              </button>
            )}

            {allowedTabs.includes('overview') && (
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <BarChart3 className="w-4 h-4" />
                  <span>Global Overview</span>
                </div>
              </button>
            )}

            {allowedTabs.includes('users') && (
              <button
                onClick={() => setActiveTab('users')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4" />
                  <span>User Accounts</span>
                </div>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-slate-950/60 text-slate-400">
                  {allUsers.length}
                </span>
              </button>
            )}

            {allowedTabs.includes('vouchers') && (
              <button
                onClick={() => setActiveTab('vouchers')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                  activeTab === 'vouchers'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Gift className="w-4 h-4" />
                  <span>Vouchers &amp; Promos</span>
                </div>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-slate-950/60 text-slate-400">
                  {vouchersCount}
                </span>
              </button>
            )}

            {allowedTabs.includes('reviews') && (
              <button
                onClick={() => setActiveTab('reviews')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                  activeTab === 'reviews'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Star className="w-4 h-4" />
                  <span>Platform Reviews</span>
                </div>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-slate-950/60 text-slate-400">
                  {reviews.length}
                </span>
              </button>
            )}

            {allowedTabs.includes('tickets') && (
              <button
                onClick={() => setActiveTab('tickets')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                  activeTab === 'tickets'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LifeBuoy className="w-4 h-4" />
                  <span>Support Tickets</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                    tickets.some((t) => t.status === 'Open' || t.unreadBySupport)
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-slate-950/60 text-slate-400'
                  }`}
                >
                  {tickets.length}
                </span>
              </button>
            )}

            {/* Crew & Departments Management Tab: Accessible to any department mapped */}
            {allowedTabs.includes('crew') && (
              <button
                onClick={() => setActiveTab('crew')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                  activeTab === 'crew'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>OvraxHR Crew &amp; Depts</span>
                </div>
              </button>
            )}

            {allowedTabs.includes('system') && (
              <button
                onClick={() => setActiveTab('system')}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                  activeTab === 'system'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4" />
                  <span>System &amp; Storage</span>
                </div>
              </button>
            )}
          </div>

          {/* Quick Helpline Info Box */}
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Phone className="w-4 h-4 text-amber-400" />
              <span>Official Helpline</span>
            </div>
            <p className="text-xs font-mono font-bold text-slate-200">+234 815 405 8015</p>
            <p className="text-[11px] text-slate-400">Rheivatech Direct Engineering Escalation</p>
          </div>
        </aside>

        {/* Right Main Content Panel */}
        <main className="flex-1 flex flex-col min-w-0 space-y-4">
          {/* Universal Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search companies, users, reviews, ticket IDs, emails, roles..."
              className="w-full pl-10 pr-10 py-3 rounded-2xl bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-100 placeholder-slate-500 text-xs font-medium outline-none transition shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Organizations</span>
                    <Building2 className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">
                    {companiesList.length}
                  </div>
                  <p className="text-[10px] text-slate-500">Organization spaces</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>User Accounts</span>
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">
                    {allUsers.length}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {allUsers.filter((u) => u.isEmailVerified).length} verified
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Platform Reviews</span>
                    <Star className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">
                    {reviews.length}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {reviews.length > 0
                      ? `${(reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1)} avg rating`
                      : 'No reviews yet'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Support Tickets</span>
                    <LifeBuoy className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">
                    {tickets.length}
                  </div>
                  <p className="text-[10px] text-rose-400">
                    {tickets.filter((t) => t.status === 'Open').length} open inquiries
                  </p>
                </div>
              </div>

              {/* Recent Inquiries and Recent Companies */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Tickets */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <LifeBuoy className="w-4 h-4 text-rose-400" />
                      <span>Pending Support Tickets</span>
                    </h3>
                    <button
                      onClick={() => setActiveTab('tickets')}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300"
                    >
                      View all ({tickets.length})
                    </button>
                  </div>
                  {tickets.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs font-mono">
                      No support tickets submitted yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {tickets.slice(0, 5).map((t) => (
                        <div
                          key={t.id}
                          className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-amber-300">{t.ticketNumber}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                t.status === 'Open'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : t.status === 'In Review'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              {t.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-200 font-semibold truncate">
                            {t.customSubject || t.category} — {t.companyName}
                          </p>
                          <p className="text-[11px] text-slate-400 line-clamp-2">{t.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Companies Summary */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-amber-400" />
                      <span>Active Organizations</span>
                    </h3>
                    <button
                      onClick={() => setActiveTab('users')}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300"
                    >
                      View accounts ({allUsers.length})
                    </button>
                  </div>
                  {companiesList.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs font-mono">
                      No companies registered yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {companiesList.slice(0, 5).map((c) => (
                        <div
                          key={c.companyId}
                          className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-100">{c.companyName}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                {c.companyId}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Admin: {c.adminUser?.name || 'Unassigned'} ({c.adminUser?.email || 'N/A'})
                            </p>
                          </div>
                          <div className="text-right text-xs font-mono text-slate-400">
                            <div>{c.staffCount} staff</div>
                            <div>{c.projectsCount} sheets</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: STAFF DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Identity & Department Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Welcome back,</span>
                      <span className="text-amber-400 font-mono">{user.username || user.name}</span>
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {user.departmentName || (isSuperAdmin ? 'Executive Root' : 'Operations Crew')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    OvraxHR Staff Workspace. You have active access to {allowedTabs.length} operation modules.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {allowedTabs.includes('tickets') && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('tickets')}
                      className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/20 transition cursor-pointer"
                    >
                      <LifeBuoy className="w-3.5 h-3.5" />
                      <span>Support Desk ({tickets.filter((t) => t.status === 'Open' || t.unreadBySupport).length} urgent)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Operational Key Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div
                  onClick={() => allowedTabs.includes('tickets') && setActiveTab('tickets')}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 cursor-pointer hover:border-rose-500/40 transition"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Open Inquiries</span>
                    <LifeBuoy className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">
                    {tickets.filter((t) => t.status === 'Open').length}
                  </div>
                  <p className="text-[10px] text-rose-400">
                    {tickets.filter((t) => t.unreadBySupport).length} unread messages
                  </p>
                </div>

                <div
                  onClick={() => allowedTabs.includes('tickets') && setActiveTab('tickets')}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 cursor-pointer hover:border-amber-500/40 transition"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>In Review Chats</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">
                    {tickets.filter((t) => t.status === 'In Review').length}
                  </div>
                  <p className="text-[10px] text-slate-500">Active customer threads</p>
                </div>

                <div
                  onClick={() => allowedTabs.includes('reviews') && setActiveTab('reviews')}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 cursor-pointer hover:border-amber-500/40 transition"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Platform Reviews</span>
                    <Star className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">
                    {reviews.length}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {reviews.filter((r) => !r.replies || r.replies.length === 0).length} awaiting replies
                  </p>
                </div>

                <div
                  onClick={() => allowedTabs.includes('users') && setActiveTab('users')}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 cursor-pointer hover:border-blue-500/40 transition"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Active Accounts</span>
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">
                    {allUsers.length}
                  </div>
                  <p className="text-[10px] text-slate-500">Across organization workspaces</p>
                </div>
              </div>

              {/* Priority Triage Queue: Real-time Live Conversations Needing Support */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <LifeBuoy className="w-4 h-4 text-rose-400" />
                    <span>Priority Support Triage Queue</span>
                  </h3>
                  {allowedTabs.includes('tickets') && (
                    <button
                      onClick={() => setActiveTab('tickets')}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300"
                    >
                      Open Support Desk Grid &rarr;
                    </button>
                  )}
                </div>

                {tickets.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs font-mono">
                    No active support conversations in queue.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {tickets.slice(0, 6).map((t) => {
                      const lastMsg = t.messages && t.messages.length > 0 ? t.messages[t.messages.length - 1] : null;
                      return (
                        <div
                          key={t.id}
                          onClick={() => {
                            if (allowedTabs.includes('tickets')) {
                              setActiveTab('tickets');
                              handleOpenTicketChat(t.id);
                            }
                          }}
                          className={`p-3.5 rounded-xl border transition flex flex-col justify-between cursor-pointer hover:border-amber-500/50 ${
                            t.unreadBySupport
                              ? 'bg-rose-950/20 border-rose-500/40'
                              : 'bg-slate-950/60 border-slate-800'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono text-[11px] font-bold text-amber-300">
                                #{t.ticketNumber}
                              </span>
                              <div className="flex items-center gap-1">
                                {t.unreadBySupport && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[9px] font-bold border border-rose-500/40 animate-pulse">
                                    New Msg
                                  </span>
                                )}
                                <span
                                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold border ${
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
                            <div>
                              <div className="font-bold text-xs text-white truncate">{t.companyName}</div>
                              <div className="text-[11px] text-slate-400 truncate">{t.customSubject || t.category}</div>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2 bg-slate-900/60 p-2 rounded-lg">
                              {lastMsg ? lastMsg.text : t.message}
                            </p>
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 pt-2 mt-2 border-t border-slate-800/60 flex items-center justify-between">
                            <span>{t.messages?.length || 1} msgs</span>
                            <span>{new Date(t.lastMessageAt || t.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: USER ACCOUNTS (SYSTEMATIC & GROUPED BY COMPANY) */}
          {activeTab === 'users' && (
            <AdminUserAccountsTab
              allUsers={allUsers}
              onRefresh={() => setRefreshKey((k) => k + 1)}
              onShowNotice={showNotice}
            />
          )}

          {/* TAB: VOUCHERS & PROMOTIONS */}
          {activeTab === 'vouchers' && (
            <AdminVouchersTab
              onShowNotice={showNotice}
            />
          )}

          {/* TAB 4: PLATFORM REVIEWS */}
          {activeTab === 'reviews' && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400" />
                    <span>Platform Reviews Moderation ({filteredReviews.length})</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Live feedback submitted by organizations and users through the Help tab.
                  </p>
                </div>
              </div>

              {filteredReviews.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 space-y-2">
                  <Star className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-400">No platform reviews yet</p>
                  <p className="text-[11px] text-slate-500">
                    When testing teams or clients submit reviews in the Help tab, they will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredReviews.map((r, idx) => (
                    <div
                      key={`${r.id}-${idx}`}
                      className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 relative group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          {getCentralCompanyLogo(r.companyId || r.companyName) || r.companyLogo ? (
                            <img
                              src={getCentralCompanyLogo(r.companyId || r.companyName) || r.companyLogo}
                              alt={r.companyName}
                              className="w-8 h-8 rounded-full object-cover border border-slate-700"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-bold text-xs">
                              {r.companyName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-slate-100">{r.authorName}</span>
                              <div className="px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 text-[10px] font-semibold border border-slate-700/80 flex items-center gap-1">
                                <Building2 className="w-2.5 h-2.5 text-indigo-400" />
                                <span>{r.companyName || 'Client Organization'}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteReview(r.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                          title="Delete Review"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Bubble */}
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1 text-amber-400">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3.5 h-3.5 ${
                                  i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                                }`}
                              />
                            ))}
                            <span className="text-xs font-mono font-bold text-amber-300 ml-1">
                              {r.rating}.0 / 5
                            </span>
                          </div>
                          {r.category && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 text-[10px] font-medium border border-slate-700">
                              {r.category}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-100">{r.title}</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{r.content}</p>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] font-mono text-slate-500">
                          <span>
                            {new Date(r.createdAt).toLocaleDateString()} at{' '}
                            {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div className="flex items-center gap-2 font-sans">
                            <span className="text-emerald-400 font-medium">👍 {r.likes || 0}</span>
                            <span className="text-rose-400 font-medium">👎 {r.dislikes || 0}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setReplyingReviewId(replyingReviewId === r.id ? null : r.id);
                                setReplyMessage('');
                              }}
                              className="px-2 py-0.5 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-bold transition cursor-pointer"
                            >
                              {replyingReviewId === r.id ? 'Cancel' : 'Reply'}
                            </button>
                          </div>
                        </div>

                        {/* Existing Official Replies Thread */}
                        {r.replies && r.replies.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-slate-800/80">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                                {r.replies.length} {r.replies.length === 1 ? 'Comment' : 'Comments'}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleReviewComments(r.id)}
                                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                              >
                                {expandedReviewCommentIds.has(r.id) ? 'Hide comments' : `Show comments (${r.replies.length})`}
                              </button>
                            </div>

                            {expandedReviewCommentIds.has(r.id) && (
                              <div className="space-y-2 pt-1">
                                {r.replies.map((reply) => (
                                  <div
                                    key={reply.id}
                                    className="p-2.5 rounded-lg bg-slate-950 border border-indigo-500/20 text-xs space-y-1"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-indigo-300 text-[11px]">{reply.authorName}</span>
                                        <div
                                          className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border flex items-center gap-1 ${
                                            reply.isOfficialSupport
                                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                              : 'bg-slate-800 text-indigo-300 border-slate-700'
                                          }`}
                                        >
                                          {reply.isOfficialSupport ? (
                                            <>
                                              <ShieldCheck className="w-2.5 h-2.5 text-amber-400" />
                                              <span>{reply.departmentName || reply.authorRole || 'Customer Support & Helpdesk'}</span>
                                            </>
                                          ) : (
                                            <>
                                              <Building2 className="w-2.5 h-2.5 text-indigo-400" />
                                              <span>{reply.companyName || reply.authorRole || r.companyName || 'Client Organization'}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-mono text-slate-500">
                                          {new Date(reply.createdAt).toLocaleDateString()}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteAdminReply(r.id, reply.id)}
                                          className="text-slate-500 hover:text-rose-400 text-[10px]"
                                          title="Delete reply"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-slate-300 text-[11px] leading-relaxed">{reply.message}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Reply input box */}
                        {replyingReviewId === r.id && (
                          <div className="pt-2 space-y-2 border-t border-slate-800">
                            <textarea
                              rows={2}
                              value={replyMessage}
                              onChange={(e) => setReplyMessage(e.target.value)}
                              placeholder="Write official Skima Help Desk reply to this organization's review..."
                              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs outline-none focus:border-indigo-500"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setReplyingReviewId(null)}
                                className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePostAdminReply(r.id)}
                                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <Send className="w-3 h-3" />
                                <span>Post Reply</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SUPPORT TICKETS (3x3 CONVERSATIONAL GRID) */}
          {activeTab === 'tickets' && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <LifeBuoy className="w-4 h-4 text-rose-400" />
                    <span>Support Desk Inquiries ({filteredTickets.length})</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Active client conversations arranged in real-time cards. Statuses are automatic; only the client can close tickets.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400">
                    {filteredTickets.filter((t) => t.unreadBySupport).length} unread messages
                  </span>
                </div>
              </div>

              {filteredTickets.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 space-y-2">
                  <LifeBuoy className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-400">No support tickets submitted</p>
                  <p className="text-[11px] text-slate-500">
                    When users send inquiries from the Direct Support Desk, they will appear here in real time.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTickets.map((t, idx) => {
                    const lastMsg = t.messages && t.messages.length > 0 ? t.messages[t.messages.length - 1] : null;
                    const messageCount = t.messages?.length || 1;

                    return (
                      <div
                        key={`${t.id}-${idx}`}
                        onClick={() => handleOpenTicketChat(t.id)}
                        className={`p-4 rounded-2xl border transition flex flex-col justify-between cursor-pointer group hover:border-amber-500/60 shadow-lg relative ${
                          t.unreadBySupport
                            ? 'bg-rose-950/20 border-rose-500/50 shadow-rose-950/20 ring-1 ring-rose-500/30'
                            : t.status === 'Open'
                            ? 'bg-slate-950/80 border-slate-800 hover:bg-slate-900/90'
                            : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/70'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-mono font-bold text-amber-400 text-xs">
                                #{t.ticketNumber}
                              </span>
                              <h4 className="font-bold text-xs text-white group-hover:text-amber-300 transition truncate max-w-[180px]">
                                {t.companyName}
                              </h4>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              {/* Status Badge (Automatic) */}
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

                              {/* Notification Badge */}
                              {t.unreadBySupport && (
                                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[9px] font-bold border border-rose-500/40 animate-pulse flex items-center gap-1">
                                  <span>🔔</span>
                                  <span>New Message</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Subject & Category */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                                {t.category}
                              </span>
                              {t.customSubject && (
                                <span className="text-xs font-semibold text-slate-200 truncate">
                                  {t.customSubject}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              By <span className="text-slate-300 font-medium">{t.authorName}</span> ({t.email})
                            </div>
                          </div>

                          {/* Message Preview Snippet */}
                          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 line-clamp-3 leading-relaxed">
                            {lastMsg ? lastMsg.text : t.message}
                          </div>
                        </div>

                        {/* Card Footer */}
                        <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
                          <div className="flex items-center gap-2 font-sans">
                            <span className="flex items-center gap-1 text-slate-400">
                              <MessageSquare className="w-3 h-3 text-amber-400" />
                              <span>{messageCount} msgs</span>
                            </span>
                            <span>•</span>
                            <span className="text-slate-500 text-[10px]">
                              {new Date(t.lastMessageAt || t.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTicket(t.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                              title="Delete Ticket"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CONVERSATION VIEWER MODAL */}
              {activeTicketChatId && (() => {
                const activeTicket = tickets.find((t) => t.id === activeTicketChatId);
                if (!activeTicket) return null;

                const messages = activeTicket.messages && activeTicket.messages.length > 0
                  ? activeTicket.messages
                  : [
                      {
                        id: `initial-${activeTicket.id}`,
                        sender: 'client' as const,
                        author: activeTicket.authorName,
                        text: activeTicket.message,
                        timestamp: activeTicket.createdAt,
                      },
                    ];

                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                      {/* Modal Header */}
                      <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-amber-400 text-xs">
                              #{activeTicket.ticketNumber}
                            </span>
                            <h3 className="font-bold text-sm text-white">{activeTicket.companyName}</h3>
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
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {activeTicket.customSubject || activeTicket.category} • Client Contact: {activeTicket.authorName} ({activeTicket.email})
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveTicketChatId(null)}
                          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Status Banner */}
                      <div className="px-5 py-2 bg-slate-950/40 border-b border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>
                          Status flow: <strong className="text-amber-300 font-mono">{activeTicket.status}</strong> (Automatic review; only the client can close)
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {messages.length} messages in thread
                        </span>
                      </div>

                      {/* Chat Messages List */}
                      <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-slate-950/20">
                        {messages.map((msg) => {
                          const isSupport = msg.sender === 'support';
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isSupport ? 'items-end' : 'items-start'}`}
                            >
                              <div className="flex items-center gap-2 mb-1 px-1">
                                <span className="text-[10px] font-bold text-slate-400">
                                  {isSupport ? `🛡️ ${msg.author} (OvraxHR Crew)` : msg.author}
                                </span>
                                <span className="text-[9px] font-mono text-slate-500">
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div
                                className={`p-3.5 rounded-2xl text-xs max-w-[85%] sm:max-w-[75%] leading-relaxed ${
                                  isSupport
                                    ? 'bg-amber-600 text-white rounded-tr-none shadow-md shadow-amber-600/10'
                                    : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                                }`}
                              >
                                {msg.text}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Reply Input Box */}
                      <form onSubmit={handleSendAdminTicketReply} className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/60">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={ticketReplyInput}
                            onChange={(e) => setTicketReplyInput(e.target.value)}
                            placeholder={`Reply to ${activeTicket.companyName} as OvraxHR Support...`}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white text-xs outline-none"
                          />
                          <button
                            type="submit"
                            disabled={!ticketReplyInput.trim()}
                            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Send</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB: INTERNAL CREW & DEPARTMENTS */}
          {activeTab === 'crew' && allowedTabs.includes('crew') && (
            <AdminCrewTab
              onShowNotice={showNotice}
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          )}

          {/* TAB 6: SYSTEM & STORAGE */}
          {activeTab === 'system' && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>Platform Engine Diagnostics & Storage Health</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time database status and platform storage telemetry.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Total Organizations</span>
                  <div className="text-xl font-bold text-slate-100 font-mono">
                    {companiesList.length} Isolated Spaces
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Helpline Gateway</span>
                  <div className="text-xl font-bold text-amber-300 font-mono">+234 815 405 8015</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Master Admin ID</span>
                  <div className="text-xl font-bold text-indigo-400 font-mono">entry-rheivatech-admin</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200">System Telemetry & Super Admin Table</h4>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 space-y-1">
                  <div>• Super Admin Account: entry-rheivatech-admin</div>
                  <div>• Master Auth Provider: Dual-table authentication (Admin Table & Organization Table)</div>
                  <div>• Session Encryption & Scope: Scoped company namespace per organization</div>
                  <div>• Official Support Desk: Active (+234 815 405 8015)</div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Export One-Time Password Encryption Modal for Super Admin */}
      <ExportPasswordModal
        isOpen={!!exportModalCompany}
        onClose={() => setExportModalCompany(null)}
        onConfirmExport={handleConfirmCompanyExportWithPassword}
        isExporting={!!isExportingCompanyZip}
        companyName={exportModalCompany?.name || 'Company Archive'}
      />

      {/* In-app Confirmation Modal for safe Deletions */}
      <ConfirmDeleteModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        itemName={confirmModal.itemName}
        confirmLabel={confirmModal.confirmLabel}
        isDestructive={confirmModal.isDestructive}
        onConfirm={() => {
          confirmModal.action();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
