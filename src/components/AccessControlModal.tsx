import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import {
  CompanyUserAccount,
  getUsersByCompany,
  loadAllCompanyUsers,
  addCompanyUser,
  updateCompanyUser,
  deleteCompanyUser,
  deleteAdminAndCompanyData,
  purgeSampleUserAccounts,
} from '../utils/userManagement';
import { purgeAllSampleAndGhostData } from '../utils/companyStorage';
import {
  X,
  Shield,
  ShieldCheck,
  UserPlus,
  Trash2,
  Edit2,
  CheckCircle2,
  Mail,
  User as UserIcon,
  KeyRound,
  Building,
  Users,
  Search,
  Check,
  AlertTriangle,
  Lock,
  AtSign,
  ArrowRightLeft,
  Crown,
  AlertOctagon,
  Sparkles,
  Briefcase,
  Wrench,
  Eye,
  CheckSquare
} from 'lucide-react';

export type AssignableRole = 'Manager' | 'Assistant' | 'Technical' | 'Viewer';

interface AccessControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  theme?: 'dark' | 'light';
}

export const AccessControlModal: React.FC<AccessControlModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  theme = 'dark',
}) => {
  const [users, setUsers] = useState<CompanyUserAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('password123');
  const [newRole, setNewRole] = useState<AssignableRole>('Manager');
  const [formError, setFormError] = useState<string | null>(null);

  // Editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<AssignableRole>('Manager');
  const [editUsername, setEditUsername] = useState<string>('');

  // Delete confirm state (for non-admin users)
  const [userToDelete, setUserToDelete] = useState<CompanyUserAccount | null>(null);

  // Transfer Admin confirm state
  const [userToTransferAdmin, setUserToTransferAdmin] = useState<CompanyUserAccount | null>(null);

  // Delete Admin & Organization modal state
  const [isDeleteAdminModalOpen, setIsDeleteAdminModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // Toast notification
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const loadCompanyUsersList = () => {
    purgeSampleUserAccounts();
    const list = getUsersByCompany(currentUser.company);
    setUsers(list);
  };

  const handlePurgeDatabase = () => {
    purgeSampleUserAccounts();
    purgeAllSampleAndGhostData(currentUser.company);
    loadCompanyUsersList();
    showToast('Database purged! All dummy sample accounts and ghosts removed. Exactly 1 Sole Admin enforced.');
  };

  useEffect(() => {
    if (isOpen) {
      loadCompanyUsersList();
      setIsAddingNew(false);
      setFormError(null);
      setEditingUserId(null);
      setUserToDelete(null);
      setUserToTransferAdmin(null);
      setIsDeleteAdminModalOpen(false);
      setDeleteConfirmationText('');
    }
  }, [isOpen, currentUser.company]);

  // Auto suggest username when email changes
  const handleEmailChange = (val: string) => {
    setNewEmail(val);
    if (!newUsername || newUsername === newEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '')) {
      const suggested = val.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
      setNewUsername(suggested);
    }
  };

  if (!isOpen) return null;

  const isLight = theme === 'light';
  const isCurrentUserAdmin = currentUser.role === 'Admin' || currentUser.isAdmin === true;

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedEmail = newEmail.trim().toLowerCase();
    const trimmedName = newName.trim();
    const cleanUsername = newUsername.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');

    if (!trimmedEmail || !trimmedName) {
      setFormError('Please enter both Full Name and Email Address.');
      return;
    }

    // Global duplicate checks across entire user store
    const allUsers = loadAllCompanyUsers();

    const existingEmail = allUsers.find((u) => (u.email || '').toLowerCase() === trimmedEmail);
    if (existingEmail) {
      setFormError(`The email "${trimmedEmail}" is already registered. The same email cannot exist more than once.`);
      return;
    }

    if (cleanUsername) {
      const existingUsername = allUsers.find(
        (u) => (u.username || '').toLowerCase() === cleanUsername
      );
      if (existingUsername) {
        setFormError(`The username "@${cleanUsername}" is already taken. The same username cannot exist more than once.`);
        return;
      }
    }

    const created = addCompanyUser({
      email: trimmedEmail,
      username: cleanUsername || trimmedEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, ''),
      name: trimmedName,
      company: currentUser.company,
      companyId: currentUser.companyId,
      role: newRole,
      isAdmin: false,
      isEmailVerified: false,
      password: newPassword.trim() || 'password',
    });

    loadCompanyUsersList();
    setIsAddingNew(false);
    setNewName('');
    setNewEmail('');
    setNewUsername('');
    setNewPassword('password123');
    setNewRole('Manager');
    showToast(`Successfully connected "${created.email}" (@${created.username || 'user'}).`);
  };

  const handleSaveEdit = (userId: string) => {
    const cleanUsername = editUsername.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    const allUsers = loadAllCompanyUsers();

    if (cleanUsername) {
      const duplicate = allUsers.find(
        (u) => u.id !== userId && (u.username || '').toLowerCase() === cleanUsername
      );
      if (duplicate) {
        showToast(`Error: Username "@${cleanUsername}" already exists. The same username cannot exist more than once.`);
        return;
      }
    }

    const updated = updateCompanyUser(userId, {
      role: editRole,
      isAdmin: false,
      username: cleanUsername || undefined,
    });

    if (updated) {
      loadCompanyUsersList();
      setEditingUserId(null);
      showToast(`Updated account settings for ${updated.email}.`);
    }
  };

  const handleExecuteTransferAdmin = () => {
    if (!userToTransferAdmin) return;
    const target = userToTransferAdmin;

    const updated = updateCompanyUser(target.id, {
      role: 'Admin',
      isAdmin: true,
    });

    if (updated) {
      loadCompanyUsersList();
      setUserToTransferAdmin(null);
      showToast(`Transferred sole Administrator role to ${target.name} (${target.email}).`);

      try {
        const savedSession = localStorage.getItem('skima_user_session');
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          if (parsed.id !== target.id) {
            const updatedSession = { ...parsed, role: 'Manager', isAdmin: false };
            localStorage.setItem('skima_user_session', JSON.stringify(updatedSession));
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDeleteUser = (userId: string, email: string) => {
    const success = deleteCompanyUser(userId);
    if (success) {
      loadCompanyUsersList();
      setUserToDelete(null);
      showToast(`Disconnected email "${email}" from ${currentUser.company}.`);
    }
  };

  const handleExecuteDeleteAdminAccount = () => {
    deleteAdminAndCompanyData(currentUser.company, currentUser.id);
    onClose();
    window.location.reload();
  };

  const getRoleBadge = (role: string) => {
    const norm = (role || '').toLowerCase();
    if (norm.includes('admin')) {
      return (
        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-sm">
          <Crown className="w-3.5 h-3.5 text-amber-400" /> Admin
        </span>
      );
    }
    if (norm.includes('manager')) {
      return (
        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-sm">
          <Briefcase className="w-3.5 h-3.5 text-emerald-400" /> Manager
        </span>
      );
    }
    if (norm.includes('assistant')) {
      return (
        <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-sm">
          <CheckSquare className="w-3.5 h-3.5 text-blue-400" /> Assistant
        </span>
      );
    }
    if (norm.includes('technical')) {
      return (
        <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-sm">
          <Wrench className="w-3.5 h-3.5 text-purple-400" /> Technical
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-lg bg-slate-700/50 text-slate-300 border border-slate-600/50 text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-sm">
        <Eye className="w-3.5 h-3.5 text-slate-400" /> Viewer
      </span>
    );
  };

  const getRoleDescription = (role: string) => {
    const norm = (role || '').toLowerCase();
    if (norm.includes('admin')) {
      return 'Master Administrator: Full access to all modules, company entity branding, database backups, and access control.';
    }
    if (norm.includes('manager')) {
      return 'Manager: Full staff management, shifts, leaves, and payroll compensation. Cannot edit company profile branding.';
    }
    if (norm.includes('assistant')) {
      return 'Assistant: Day-to-day HR operations, attendance, feeding, and shift planning. Cannot edit company info, staff salaries, suspension, re-employment, or staff exits.';
    }
    if (norm.includes('technical')) {
      return 'Technical: Manages number, database backup, security, and UI design. Restricted from viewing staff salaries or editing staff personal records.';
    }
    return 'Viewer: Read-only access to roster matrices and attendance summaries.';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className={`w-full max-w-4xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        {/* Header */}
        <div
          className={`p-6 border-b flex items-center justify-between ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/90 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-500 flex items-center justify-center border border-indigo-500/30">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Organization Access & User Roles</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-mono font-bold">
                  Admin Master Control
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Grant and govern user privileges for{' '}
                <span className="font-bold text-indigo-400">{currentUser.company}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isLight
                ? 'bg-slate-200/70 hover:bg-slate-300 border-slate-300 text-slate-600'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notification */}
        {notification && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2.5 text-xs text-emerald-400 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{notification}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Company Context & Overview Banner */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              isLight
                ? 'bg-indigo-50/60 border-indigo-100 text-indigo-950'
                : 'bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border-indigo-900/50 text-indigo-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
                  Active Organization Space
                </h4>
                <div className="text-base font-bold text-white">{currentUser.company}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-3 py-1.5 rounded-xl bg-indigo-600/10 border border-indigo-500/30 text-xs font-mono font-bold text-indigo-300">
                {users.length} Active User{users.length !== 1 ? 's' : ''}
              </div>
              <button
                type="button"
                onClick={handlePurgeDatabase}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                title="Purge legacy dummy accounts, duplicate admins, and sample data"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Purge Sample Data</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddingNew(!isAddingNew)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isAddingNew ? 'Close Form' : 'Add New User Account'}</span>
              </button>
            </div>
          </div>

          {/* Add New Email / User Section */}
          <AnimatePresence>
            {isAddingNew && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleAddUserSubmit}
                className={`p-5 rounded-2xl border space-y-4 ${
                  isLight
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-slate-800/60 border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-400">
                    <UserPlus className="w-4 h-4" />
                    Register & Authorize New Team Member
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    User can log in using either Email or Username
                  </span>
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Sarah Connor"
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none font-semibold ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
                            : 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={newEmail}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        placeholder="colleague@company.com"
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none font-semibold ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
                            : 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono flex items-center justify-between">
                      <span>Username (Unique Login ID)</span>
                      <span className="text-[10px] text-indigo-400 lowercase font-mono">e.g. sarah_c</span>
                    </label>
                    <div className="relative">
                      <AtSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                        placeholder="username"
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none font-mono font-semibold ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
                            : 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                      Initial Password
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="password"
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none font-mono ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
                            : 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                      Assigned Role & Privilege Tier
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as AssignableRole)}
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-semibold cursor-pointer ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
                          : 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500'
                      }`}
                    >
                      <option value="Manager">Manager (Staff, Shifts, Leaves & Payroll Compensation)</option>
                      <option value="Assistant">Assistant (HR Operations, Attendance, Feeding — No Salary/Company Edit)</option>
                      <option value="Technical">Technical (Database Backup, Cloud Security, UI Design — No Salary Access)</option>
                      <option value="Viewer">Viewer (Read-Only Attendance & Reports)</option>
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1 font-mono">
                      {getRoleDescription(newRole)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Authorize & Create Account</span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Search Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts by email, @username, name, or role..."
                className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl border outline-none font-sans ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-900'
                    : 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500'
                }`}
              />
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Showing <span className="font-bold text-indigo-400">{filteredUsers.length}</span> of{' '}
              {users.length}
            </div>
          </div>

          {/* Accounts List */}
          <div className="space-y-3">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-2xl border-slate-700/60 space-y-2">
                <Users className="w-8 h-8 text-slate-500 mx-auto" />
                <div className="text-xs font-bold text-slate-400">No matching accounts found</div>
                <p className="text-[11px] text-slate-500">
                  Connect new team members to allow colleagues to log in to {currentUser.company}.
                </p>
              </div>
            ) : (
              filteredUsers.map((account) => {
                const isCurrentLoggedIn =
                  account.email.toLowerCase() === currentUser.email.toLowerCase() ||
                  (account.username && currentUser.username && account.username.toLowerCase() === currentUser.username.toLowerCase());
                const isEditing = editingUserId === account.id;
                const isAdminUser = account.role === 'Admin' || account.isAdmin;

                return (
                  <div
                    key={account.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCurrentLoggedIn
                        ? isLight
                          ? 'bg-blue-50/70 border-blue-200'
                          : 'bg-blue-950/20 border-blue-800/60'
                        : isLight
                        ? 'bg-white border-slate-200 hover:border-slate-300'
                        : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* User Info */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold font-mono text-sm shrink-0">
                          {account.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-bold ${
                                isLight ? 'text-slate-900' : 'text-white'
                              }`}
                            >
                              {account.name}
                            </span>
                            {account.username && (
                              <span className="text-[11px] text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                @{account.username}
                              </span>
                            )}
                            {isCurrentLoggedIn && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[9px] font-bold uppercase tracking-wider">
                                Current Session
                              </span>
                            )}
                            {getRoleBadge(account.role)}
                            {isAdminUser && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-mono font-bold">
                                Protected • Sole Admin
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1 text-slate-300">
                              <Mail className="w-3 h-3 text-slate-500" />
                              {account.email}
                            </span>
                            {account.companyId && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300 border border-slate-700 text-[10px]">
                                ID: {account.companyId}
                              </span>
                            )}
                            {account.createdAt && (
                              <span className="text-slate-500">
                                Added {account.createdAt.split('T')[0]}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 max-w-xl">
                            {getRoleDescription(account.role)}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-400 font-mono">@</span>
                              <input
                                type="text"
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                                placeholder="username"
                                className="w-24 px-2 py-1 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white font-mono outline-none focus:border-indigo-500"
                              />
                            </div>
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value as AssignableRole)}
                              className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-indigo-500 text-white font-semibold outline-none cursor-pointer"
                            >
                              <option value="Manager">Manager</option>
                              <option value="Assistant">Assistant</option>
                              <option value="Technical">Technical</option>
                              <option value="Viewer">Viewer</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(account.id)}
                              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs cursor-pointer"
                              title="Save Changes"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingUserId(null)}
                              className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:text-white text-xs cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            {!isAdminUser && (
                              <button
                                type="button"
                                onClick={() => setUserToTransferAdmin(account)}
                                className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs flex items-center gap-1.5 transition cursor-pointer"
                                title={`Transfer sole Admin role to ${account.name}`}
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-[11px] font-semibold">Transfer Admin</span>
                              </button>
                            )}

                            {!isAdminUser && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUserId(account.id);
                                  setEditRole((['Manager', 'Assistant', 'Technical', 'Viewer'].includes(account.role) ? account.role : 'Manager') as AssignableRole);
                                  setEditUsername(account.username || '');
                                }}
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center gap-1.5 transition cursor-pointer"
                                title="Edit Role & Username"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-[11px] font-semibold">Edit</span>
                              </button>
                            )}

                            {isAdminUser ? (
                              <div
                                className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 text-xs flex items-center gap-1.5 cursor-not-allowed opacity-60"
                                title="Admin account is the root anchor of this organization"
                              >
                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-[11px] font-semibold">Sole Admin</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isCurrentLoggedIn}
                                onClick={() => setUserToDelete(account)}
                                className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition ${
                                  isCurrentLoggedIn
                                    ? 'opacity-40 cursor-not-allowed bg-slate-800 border-slate-700 text-slate-500'
                                    : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/50 cursor-pointer'
                                }`}
                                title={
                                  isCurrentLoggedIn
                                    ? 'Cannot disconnect current logged-in account'
                                    : `Disconnect ${account.email} from ${currentUser.company}`
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="text-[11px] font-semibold">Disconnect</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Danger Zone: Admin Account & Organization Deletion */}
          {isCurrentUserAdmin && (
            <div className="p-5 rounded-2xl border border-rose-900/60 bg-rose-950/20 space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider font-mono">
                <AlertOctagon className="w-4 h-4 text-rose-500" />
                <span>Admin Danger Zone • Organization Root Deletion</span>
              </div>
              <p className="text-xs text-rose-300/80 leading-relaxed">
                As the <strong>Sole Administrator</strong>, you are the pillar of every account on the system. With no admin, there is no team; with no team, there is no data. Deleting your admin account will permanently purge the entire organization space for <strong>{currentUser.company}</strong>, along with all employee records, attendance archives, departments, and connected user accounts.
              </p>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsDeleteAdminModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 hover:border-rose-700 text-xs font-bold flex items-center gap-2 shadow transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Delete My Admin Account & Organization</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`p-4 px-6 border-t flex items-center justify-between text-xs text-slate-400 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/90 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Only one active Administrator allowed per organization. You can transfer administration to any user.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>

      {/* Transfer Admin Confirmation Dialog */}
      {userToTransferAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400 font-bold text-base">
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30">
                <Crown className="w-6 h-6" />
              </div>
              <span>Transfer Sole Admin Rights?</span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs leading-relaxed space-y-2">
              <p className="font-bold">
                Are you sure you want to transfer the Organization Administrator role to{' '}
                <span className="text-white underline">{userToTransferAdmin.name}</span> ({userToTransferAdmin.email})?
              </p>
              <p className="text-[11px] text-slate-300">
                Since there can only be one Administrator per organization, your account will be designated as a Manager, and {userToTransferAdmin.name} will hold all sole administrator permissions.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToTransferAdmin(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteTransferAdmin}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/30 cursor-pointer flex items-center gap-2"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Yes, Transfer Administration</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Admin Account & Organization Confirmation Modal */}
      {isDeleteAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 text-rose-400 font-bold text-base">
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40">
                <AlertOctagon className="w-6 h-6 text-rose-400" />
              </div>
              <span>Permanently Delete Admin Account & Organization?</span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs leading-relaxed space-y-3">
              <p className="font-bold text-rose-100 text-sm">
                Warning: The admin is the pillar of the system. With no admin, there is no team. With no team, there is no data.
              </p>
              <p className="text-slate-300">
                Deleting your admin account will permanently:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                <li>Dismantle the entire organization space for <strong>{currentUser.company}</strong></li>
                <li>Disconnect and delete all {users.length} connected team accounts</li>
                <li>Permanently wipe all employee directories, monthly attendance sheets, and leaves</li>
                <li>Reset all customized templates, shifts, and department structures</li>
              </ul>
              <p className="text-[11px] font-mono text-rose-300 font-semibold pt-1">
                This action is immediate and completely irreversible.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteAdminModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                Cancel, Keep Account
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteAdminAccount}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/40 cursor-pointer flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete Everything & Exit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation (for non-admin users) */}
      {userToDelete && (
        <ConfirmDeleteModal
          isOpen={!!userToDelete}
          title="Disconnect User Account"
          message={`Are you sure you want to disconnect ${userToDelete.name} (${userToDelete.email}) from ${currentUser.company}? They will no longer be able to log in to this organization.`}
          onConfirm={() => handleDeleteUser(userToDelete.id, userToDelete.email)}
          onClose={() => setUserToDelete(null)}
          isLight={isLight}
        />
      )}
    </div>
  );
};

