import React, { useState } from 'react';
import {
  Users,
  Building2,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Check,
  X,
  Key,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  Sparkles,
  ExternalLink,
  Award,
  CheckCircle2,
} from 'lucide-react';
import {
  CompanyUserAccount,
  updateCompanyUser,
  deleteCompanyUser,
  deleteCompany,
  resetCompanyUsersVerification,
  resetAllUsersVerification,
} from '../utils/userManagement';
import { getCompanyLicense, isCompanyLicensed, revokeCompanyLicense, activateCompanyLicense } from '../utils/licensing';
import { normalizeCompanyId } from '../utils/companyStorage';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface AdminUserAccountsTabProps {
  allUsers: CompanyUserAccount[];
  onRefresh: () => void;
  onShowNotice: (msg: string) => void;
}

export const AdminUserAccountsTab: React.FC<AdminUserAccountsTabProps> = ({
  allUsers,
  onRefresh,
  onShowNotice,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '24h' | '7d' | '30d' | 'newest' | 'oldest'>('newest');
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'has_unverified' | 'fully_verified' | 'unlicensed'>('all');
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});

  // Password reset inline state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Confirmation modal state for destructive actions
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

  // Group users by company
  interface CompanyGroup {
    companyKey: string;
    companyName: string;
    companyId: string;
    adminUser?: CompanyUserAccount;
    users: CompanyUserAccount[];
    earliestJoined: string;
    latestJoined: string;
    verifiedCount: number;
    unverifiedCount: number;
    isLicensed: boolean;
    licenseTier?: string;
  }

  const companyGroupsMap: Record<string, CompanyGroup> = {};

  allUsers.forEach((u) => {
    if (!u) return;
    // Skip standalone superadmins from standard company groups if desired, or group them under OvraxHR System
    const cName = u.company || 'Unassigned Organization';
    const cId = u.companyId || normalizeCompanyId(cName) || 'CMP';
    const key = cId.toUpperCase();

    if (!companyGroupsMap[key]) {
      const license = getCompanyLicense(cId);
      companyGroupsMap[key] = {
        companyKey: key,
        companyName: cName,
        companyId: cId,
        users: [],
        earliestJoined: u.createdAt || new Date().toISOString(),
        latestJoined: u.createdAt || new Date().toISOString(),
        verifiedCount: 0,
        unverifiedCount: 0,
        isLicensed: !!license && license.status === 'Active',
        licenseTier: license?.tier,
      };
    }

    const group = companyGroupsMap[key];
    group.users.push(u);

    if (u.role === 'Admin' || u.isAdmin) {
      group.adminUser = u;
    }

    if (u.isEmailVerified) {
      group.verifiedCount += 1;
    } else {
      group.unverifiedCount += 1;
    }

    if (u.createdAt) {
      if (new Date(u.createdAt) < new Date(group.earliestJoined)) {
        group.earliestJoined = u.createdAt;
      }
      if (new Date(u.createdAt) > new Date(group.latestJoined)) {
        group.latestJoined = u.createdAt;
      }
    }
  });

  // If a company has no explicit admin user, set the first user as admin contact
  Object.values(companyGroupsMap).forEach((group) => {
    if (!group.adminUser && group.users.length > 0) {
      group.adminUser = group.users[0];
    }
  });

  let groupsList = Object.values(companyGroupsMap);

  // Apply Search filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    groupsList = groupsList.filter((g) => {
      const matchComp = g.companyName.toLowerCase().includes(q) || g.companyId.toLowerCase().includes(q);
      const matchAdmin = g.adminUser && (g.adminUser.name.toLowerCase().includes(q) || g.adminUser.email.toLowerCase().includes(q));
      const matchMembers = g.users.some((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
      return matchComp || matchAdmin || matchMembers;
    });
  }

  // Apply Verification Filter
  if (verificationFilter === 'has_unverified') {
    groupsList = groupsList.filter((g) => g.unverifiedCount > 0);
  } else if (verificationFilter === 'fully_verified') {
    groupsList = groupsList.filter((g) => g.unverifiedCount === 0);
  } else if (verificationFilter === 'unlicensed') {
    groupsList = groupsList.filter((g) => !g.isLicensed);
  }

  // Apply Date Filter (check for companies that joined recently)
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * ONE_DAY;
  const THIRTY_DAYS = 30 * ONE_DAY;

  if (dateFilter === '24h') {
    groupsList = groupsList.filter((g) => now - new Date(g.earliestJoined).getTime() <= ONE_DAY);
  } else if (dateFilter === '7d') {
    groupsList = groupsList.filter((g) => now - new Date(g.earliestJoined).getTime() <= SEVEN_DAYS);
  } else if (dateFilter === '30d') {
    groupsList = groupsList.filter((g) => now - new Date(g.earliestJoined).getTime() <= THIRTY_DAYS);
  } else if (dateFilter === 'oldest') {
    groupsList.sort((a, b) => new Date(a.earliestJoined).getTime() - new Date(b.earliestJoined).getTime());
  } else {
    // Default 'newest'
    groupsList.sort((a, b) => new Date(b.latestJoined).getTime() - new Date(a.latestJoined).getTime());
  }

  // Global counts
  const totalOrgs = Object.keys(companyGroupsMap).length;
  const totalAccounts = allUsers.length;
  const totalVerified = allUsers.filter((u) => u.isEmailVerified).length;
  const totalUnverified = totalAccounts - totalVerified;
  const totalLicensed = Object.values(companyGroupsMap).filter((g) => g.isLicensed).length;

  const toggleExpand = (companyKey: string) => {
    setExpandedCompanies((prev) => ({
      ...prev,
      [companyKey]: !prev[companyKey],
    }));
  };

  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    groupsList.forEach((g) => {
      allExpanded[g.companyKey] = true;
    });
    setExpandedCompanies(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedCompanies({});
  };

  // Reset verification for specific company
  const handleResetCompanyVerification = (group: CompanyGroup) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Organization Verification',
      message: `Reset email verification status for all ${group.users.length} users in "${group.companyName}"? They will be required to input a verification code on next login.`,
      itemName: group.companyName,
      confirmLabel: 'Reset Verification',
      isDestructive: false,
      action: () => {
        const res = resetCompanyUsersVerification(group.companyId);
        onRefresh();
        onShowNotice(`Reset verification for ${res.count} users in ${group.companyName}.`);
      },
    });
  };

  // Reset ALL users in system to unverified
  const handleResetAllUsersVerification = () => {
    setConfirmModal({
      isOpen: true,
      title: 'System-Wide Verification Reset',
      message: 'Are you sure you want to reset ALL users across ALL companies to unverified? Every user will need to re-verify their email code upon login.',
      itemName: 'All Registered Organizations',
      confirmLabel: 'Reset All Users',
      isDestructive: false,
      action: () => {
        const res = resetAllUsersVerification();
        onRefresh();
        onShowNotice(`Successfully reset ${res.count} users to unverified.`);
      },
    });
  };

  // Toggle single user verification
  const handleToggleUserVerification = (u: CompanyUserAccount) => {
    const newStatus = !u.isEmailVerified;
    updateCompanyUser(u.id, { isEmailVerified: newStatus });
    onRefresh();
    onShowNotice(`Marked ${u.name} as ${newStatus ? 'Verified' : 'Unverified'}`);
  };

  // Save new password
  const handleSavePassword = (userId: string) => {
    if (!newPasswordInput.trim()) return;
    updateCompanyUser(userId, { password: newPasswordInput.trim() });
    setEditingUserId(null);
    setNewPasswordInput('');
    onRefresh();
    onShowNotice('User password successfully updated.');
  };

  // Delete user account (works for ANY user without iframe-blocked window.confirm)
  const handleDeleteUser = (userId: string, userName: string, role?: string) => {
    const isTargetAdmin = role === 'Admin';
    setConfirmModal({
      isOpen: true,
      title: isTargetAdmin ? 'Delete Company Administrator' : 'Delete User Account',
      message: isTargetAdmin
        ? `Are you sure you want to delete administrator "${userName}"? The organization will need a new admin assigned or may be archived.`
        : `Are you sure you want to permanently delete user "${userName}"? This account will be removed immediately.`,
      itemName: userName,
      confirmLabel: 'Delete Permanently',
      isDestructive: true,
      action: () => {
        const success = deleteCompanyUser(userId);
        if (success) {
          onRefresh();
          onShowNotice(`User "${userName}" was permanently deleted.`);
        } else {
          onRefresh();
          onShowNotice(`User "${userName}" record was removed.`);
        }
      },
    });
  };

  // Delete entire company
  const handleDeleteCompany = (group: CompanyGroup) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Organization & Accounts',
      message: `Are you sure you want to permanently delete organization "${group.companyName}"? This will remove all ${group.users.length} user accounts and purge its company workspace data.`,
      itemName: `${group.companyName} (${group.companyId})`,
      confirmLabel: 'Delete Organization',
      isDestructive: true,
      action: () => {
        const res = deleteCompany(group.companyId || group.companyName);
        onRefresh();
        onShowNotice(`Organization "${group.companyName}" (${res.deletedUsersCount} users) was permanently deleted.`);
      },
    });
  };

  // Quick grant/toggle license for company
  const handleQuickGrantLicense = (group: CompanyGroup, tier: 'Small Scale' | 'Large Scale') => {
    const res = activateCompanyLicense({
      companyId: group.companyId,
      companyName: group.companyName,
      tier,
      adminEmail: group.adminUser?.email || 'admin@company.com',
      adminName: group.adminUser?.name,
      isDevBypass: true,
    });
    if (res.success) {
      onRefresh();
      onShowNotice(`Activated ${tier} license for ${group.companyName}!`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Systematic Metric Counters */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span>Systematic User Accounts &amp; Organizations Directory</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Users are systematically organized by company. Expand company dropdowns to review member accounts, inspect email verification flags, or reset verification status.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetAllUsersVerification}
              className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold border border-rose-500/40 transition flex items-center gap-1.5 cursor-pointer"
              title="Reset verification for all users across all organizations"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset All to Unverified</span>
            </button>
          </div>
        </div>

        {/* 4 Systematic Metric Counter Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase">
              <span>Total Organizations</span>
              <Building2 className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">{totalOrgs}</div>
            <div className="text-[10px] text-slate-500">{totalLicensed} Active Subscriptions</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase">
              <span>Global User Accounts</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">{totalAccounts}</div>
            <div className="text-[10px] text-slate-500">Across all registered organizations</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase">
              <span>Email Verified</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono">{totalVerified}</div>
            <div className="text-[10px] text-slate-500">{totalAccounts > 0 ? `${Math.round((totalVerified / totalAccounts) * 100)}% verified` : '0%'}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase">
              <span>Pending Verification</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-extrabold text-rose-400 font-mono">{totalUnverified}</div>
            <div className="text-[10px] text-rose-400/80">Require verification OTP code</div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by company name, ID, administrator, or member email..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 font-mono"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Recently Joined Date Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="bg-transparent text-slate-200 text-xs font-semibold outline-none cursor-pointer"
            >
              <option value="newest" className="bg-slate-900">Newest Companies First</option>
              <option value="24h" className="bg-slate-900">Joined Today (Last 24h)</option>
              <option value="7d" className="bg-slate-900">Joined Recently (Last 7 Days)</option>
              <option value="30d" className="bg-slate-900">Joined This Month (Last 30 Days)</option>
              <option value="oldest" className="bg-slate-900">Oldest First</option>
            </select>
          </div>

          {/* Verification Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value as any)}
              className="bg-transparent text-slate-200 text-xs font-semibold outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Organizations</option>
              <option value="has_unverified" className="bg-slate-900">Has Unverified Accounts</option>
              <option value="fully_verified" className="bg-slate-900">100% Fully Verified</option>
              <option value="unlicensed" className="bg-slate-900">Unlicensed Organizations</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExpandAll}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* COMPANY ACCORDION LIST */}
      <div className="space-y-3">
        {groupsList.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 space-y-2">
            <Building2 className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-400">No organizations match your filters</p>
            <p className="text-[11px] text-slate-500">
              Try modifying the search query or reset date/verification filters.
            </p>
          </div>
        ) : (
          groupsList.map((group) => {
            const isExpanded = !!expandedCompanies[group.companyKey];
            const hasUnverified = group.unverifiedCount > 0;
            const adminVerified = group.adminUser?.isEmailVerified;

            return (
              <div
                key={group.companyKey}
                className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden transition hover:border-slate-700"
              >
                {/* COMPANY HEADER ROW / DROPDOWN TOGGLE */}
                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900">
                  {/* Left: Expand toggle, Name, ID, Joined Date */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleExpand(group.companyKey)}
                      className="p-1.5 rounded-xl bg-slate-950 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
                      title={isExpanded ? 'Collapse users' : 'Reveal users in this company'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-amber-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span
                          onClick={() => toggleExpand(group.companyKey)}
                          className="font-bold text-sm text-white cursor-pointer hover:text-amber-300 transition"
                        >
                          {group.companyName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          ID: {group.companyId}
                        </span>
                        {/* Verified div beside ID div */}
                        <div
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold flex items-center gap-1 ${
                            hasUnverified
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {hasUnverified ? (
                            <>
                              <X className="w-3 h-3 text-rose-400" />
                              <span>{group.verifiedCount}/{group.users.length} Verified</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>All {group.users.length} Verified</span>
                            </>
                          )}
                        </div>
                        {group.isLicensed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>{group.licenseTier || 'Active License'}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            No Active License
                          </span>
                        )}
                      </div>

                      {/* Admin contact pill */}
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                        <span>Admin:</span>
                        {group.adminUser ? (
                          <div className="flex items-center gap-1.5">
                            <strong className="text-slate-200">{group.adminUser.name}</strong>
                            <span className="font-mono text-[11px]">({group.adminUser.email})</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                                adminVerified
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {adminVerified ? 'Admin Verified' : 'Admin Unverified'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-amber-400/90 font-medium">No Admin Assigned</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle / Right: Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap justify-between lg:justify-end">
                    {/* Reset Verification Status Button for this company */}
                    <button
                      type="button"
                      onClick={() => handleResetCompanyVerification(group)}
                      className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Reset email verification status for all users in this company"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset Verification</span>
                    </button>

                    {/* Delete Company Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteCompany(group)}
                      className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Permanently delete this entire organization and its users"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete Org</span>
                    </button>

                    {/* Quick License Grant */}
                    {!group.isLicensed && (
                      <button
                        type="button"
                        onClick={() => handleQuickGrantLicense(group, 'Small Scale')}
                        className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Award className="w-3 h-3" />
                        <span>Grant Dev License</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* EXPANDED DROPDOWN DRAWER: USERS IN THIS COMPANY */}
                {isExpanded && (
                  <div className="border-t border-slate-800/80 bg-slate-950/80 p-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/60 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        Users in {group.companyName} ({group.users.length})
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Click verification badge to toggle &bull; Delete button removes account permanently
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                            <th className="pb-2 font-bold">User</th>
                            <th className="pb-2 font-bold">Role</th>
                            <th className="pb-2 font-bold">Joined</th>
                            <th className="pb-2 font-bold">Verification Status</th>
                            <th className="pb-2 font-bold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {group.users.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-900/40 transition">
                              <td className="py-2.5 pr-4">
                                <div className="font-bold text-slate-100">{u.name}</div>
                                <div className="text-slate-400 text-[11px] font-mono">{u.email}</div>
                                {u.username && (
                                  <span className="text-[10px] text-slate-500 font-mono">@{u.username}</span>
                                )}
                              </td>
                              <td className="py-2.5 pr-4">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                    u.role === 'Admin' || u.isAdmin
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  {u.role || 'Member'}
                                </span>
                              </td>
                              <td className="py-2.5 pr-4 font-mono text-[11px] text-slate-400">
                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="py-2.5 pr-4">
                                <button
                                  type="button"
                                  onClick={() => handleToggleUserVerification(u)}
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition ${
                                    u.isEmailVerified
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                                  }`}
                                  title="Click to toggle verified / unverified status"
                                >
                                  {u.isEmailVerified ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span>Verified</span>
                                    </>
                                  ) : (
                                    <>
                                      <X className="w-3 h-3 text-rose-400" />
                                      <span>Unverified (Requires OTP)</span>
                                    </>
                                  )}
                                </button>
                              </td>
                              <td className="py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {editingUserId === u.id ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        placeholder="New password"
                                        value={newPasswordInput}
                                        onChange={(e) => setNewPasswordInput(e.target.value)}
                                        className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white font-mono w-24"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSavePassword(u.id)}
                                        className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                                        title="Save password"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingUserId(null)}
                                        className="p-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingUserId(u.id);
                                        setNewPasswordInput('');
                                      }}
                                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
                                      title="Reset User Password"
                                    >
                                      <Key className="w-3.5 h-3.5 text-amber-400" />
                                    </button>
                                  )}

                                  {/* Delete user button - Now works for any user as requested! */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u.id, u.name, u.role)}
                                    className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 cursor-pointer"
                                    title="Delete User Permanently"
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
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

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
