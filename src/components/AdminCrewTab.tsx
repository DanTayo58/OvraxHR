import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Building,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Shield,
  Layers,
  Key,
  Info,
  UserCheck,
  Lock,
  ArrowRight,
} from 'lucide-react';
import {
  RheivaDepartment,
  InternalCrewAccount,
  AdminTabKey,
  ALL_ADMIN_TAB_DEFINITIONS,
  CREW_USERNAME_PREFIX,
  loadInternalDepartments,
  loadInternalCrewAccounts,
  createInternalDepartment,
  updateInternalDepartment,
  deleteInternalDepartment,
  createInternalCrewAccount,
  updateInternalCrewAccount,
  deleteInternalCrewAccount,
  formatCrewUsername,
} from '../utils/internalCrewManagement';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface AdminCrewTabProps {
  onShowNotice: (msg: string) => void;
  onRefresh?: () => void;
}

export const AdminCrewTab: React.FC<AdminCrewTabProps> = ({ onShowNotice, onRefresh }) => {
  const [departments, setDepartments] = useState<RheivaDepartment[]>([]);
  const [crewAccounts, setCrewAccounts] = useState<InternalCrewAccount[]>([]);
  const [selectedSubTab, setSelectedSubTab] = useState<'departments' | 'accounts'>('departments');

  // Department modal state
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptDescription, setDeptDescription] = useState('');
  const [selectedTabs, setSelectedTabs] = useState<AdminTabKey[]>(['dashboard']);
  const [deptError, setDeptError] = useState<string | null>(null);

  // Crew account modal state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountUsernameSuffix, setAccountUsernameSuffix] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('password123');
  const [accountDeptId, setAccountDeptId] = useState('');
  const [accountRoleTitle, setAccountRoleTitle] = useState('Support Specialist');
  const [accountError, setAccountError] = useState<string | null>(null);

  // In-app Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'department' | 'crew_account';
    id: string;
    name: string;
  } | null>(null);

  const loadData = () => {
    const depts = loadInternalDepartments();
    const accounts = loadInternalCrewAccounts();
    setDepartments(depts);
    setCrewAccounts(accounts);
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('ovraxhr_crew_updated', handleUpdate);
    return () => window.removeEventListener('ovraxhr_crew_updated', handleUpdate);
  }, []);

  // Department Handlers
  const handleOpenNewDept = () => {
    setEditingDeptId(null);
    setDeptName('');
    setDeptDescription('');
    setSelectedTabs(['dashboard']);
    setDeptError(null);
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDept = (dept: RheivaDepartment) => {
    setEditingDeptId(dept.id);
    setDeptName(dept.name);
    setDeptDescription(dept.description);
    setSelectedTabs(dept.assignedTabs);
    setDeptError(null);
    setIsDeptModalOpen(true);
  };

  const handleSaveDept = (e: React.FormEvent) => {
    e.preventDefault();
    setDeptError(null);

    if (!deptName.trim()) {
      setDeptError('Department name is required.');
      return;
    }

    if (selectedTabs.length === 0) {
      setDeptError('Please assign at least one tab to this department.');
      return;
    }

    if (editingDeptId) {
      updateInternalDepartment(editingDeptId, {
        name: deptName.trim(),
        description: deptDescription.trim(),
        assignedTabs: selectedTabs,
      });
      onShowNotice(`Department "${deptName.trim()}" updated successfully.`);
    } else {
      const res = createInternalDepartment({
        name: deptName.trim(),
        description: deptDescription.trim(),
        assignedTabs: selectedTabs,
      });
      if (!res.success) {
        setDeptError(res.error || 'Failed to create department.');
        return;
      }
      onShowNotice(`Department "${deptName.trim()}" created.`);
    }

    setIsDeptModalOpen(false);
    loadData();
    if (onRefresh) onRefresh();
  };

  // Account Handlers
  const handleOpenNewAccount = () => {
    setEditingAccountId(null);
    setAccountName('');
    setAccountUsernameSuffix('');
    setAccountEmail('');
    setAccountPassword('password123');
    setAccountDeptId(departments[0]?.id || '');
    setAccountRoleTitle('Support Specialist');
    setAccountError(null);
    setIsAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc: InternalCrewAccount) => {
    setEditingAccountId(acc.id);
    setAccountName(acc.name);
    const suffix = acc.username.startsWith(CREW_USERNAME_PREFIX)
      ? acc.username.slice(CREW_USERNAME_PREFIX.length)
      : acc.username;
    setAccountUsernameSuffix(suffix);
    setAccountEmail(acc.email);
    setAccountPassword(acc.password || '');
    setAccountDeptId(acc.departmentId);
    setAccountRoleTitle(acc.roleTitle);
    setAccountError(null);
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);

    if (!accountName.trim()) {
      setAccountError('Full name is required.');
      return;
    }
    if (!accountUsernameSuffix.trim()) {
      setAccountError('Username suffix is required.');
      return;
    }
    if (!accountEmail.trim() || !accountEmail.includes('@')) {
      setAccountError('Valid email is required.');
      return;
    }
    if (!accountDeptId) {
      setAccountError('Please select a department.');
      return;
    }

    if (editingAccountId) {
      updateInternalCrewAccount(editingAccountId, {
        name: accountName.trim(),
        email: accountEmail.trim().toLowerCase(),
        password: accountPassword.trim() || undefined,
        departmentId: accountDeptId,
        roleTitle: accountRoleTitle.trim(),
      });
      onShowNotice(`Internal crew account "${accountName.trim()}" updated.`);
    } else {
      const res = createInternalCrewAccount({
        name: accountName.trim(),
        rawUsername: accountUsernameSuffix.trim(),
        email: accountEmail.trim().toLowerCase(),
        password: accountPassword.trim() || 'password123',
        departmentId: accountDeptId,
        roleTitle: accountRoleTitle.trim(),
      });

      if (!res.success) {
        setAccountError(res.error || 'Failed to create internal crew account.');
        return;
      }
      onShowNotice(`Internal crew account created: ${res.account?.username}`);
    }

    setIsAccountModalOpen(false);
    loadData();
    if (onRefresh) onRefresh();
  };

  // Perform permanent deletion through in-app modal
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'department') {
      deleteInternalDepartment(deleteTarget.id);
      onShowNotice(`Department "${deleteTarget.name}" was deleted.`);
    } else if (deleteTarget.type === 'crew_account') {
      deleteInternalCrewAccount(deleteTarget.id);
      onShowNotice(`Crew account "${deleteTarget.name}" was deleted.`);
    }

    setDeleteTarget(null);
    loadData();
    if (onRefresh) onRefresh();
  };

  const toggleTabSelection = (tabKey: AdminTabKey) => {
    setSelectedTabs((prev) =>
      prev.includes(tabKey) ? prev.filter((t) => t !== tabKey) : [...prev, tabKey]
    );
  };

  return (
    <div className="space-y-6">
      {/* SuperAdmin Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900 border border-amber-500/30 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">OvraxHR Internal Operations & Departments</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Create internal support and operations departments, map which console tabs each department can access, and add staff accounts starting with <code className="text-amber-300 font-mono font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">entry-rheivatech-</code> to keep them strictly separated from client accounts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedSubTab === 'departments' ? (
              <button
                type="button"
                onClick={handleOpenNewDept}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Department</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenNewAccount}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Crew Account</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setSelectedSubTab('departments')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              selectedSubTab === 'departments'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Departments ({departments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedSubTab('accounts')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              selectedSubTab === 'accounts'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff Crew Accounts ({crewAccounts.length})</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: DEPARTMENTS VIEW */}
      {selectedSubTab === 'departments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {departments.map((dept) => {
              const membersCount = crewAccounts.filter((a) => a.departmentId === dept.id).length;

              return (
                <div
                  key={dept.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-4 relative group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{dept.name}</h3>
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-mono">
                          {membersCount} {membersCount === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{dept.description || 'No description provided.'}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditDept(dept)}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        title="Edit Department"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            type: 'department',
                            id: dept.id,
                            name: dept.name,
                          })
                        }
                        className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                        title="Delete Department"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Assigned Tabs Tags */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>Accessible Console Tabs ({dept.assignedTabs.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {dept.assignedTabs.map((tabKey) => {
                        const def = ALL_ADMIN_TAB_DEFINITIONS.find((t) => t.id === tabKey);
                        return (
                          <span
                            key={tabKey}
                            className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-medium flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>{def ? def.label : tabKey}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: STAFF CREW ACCOUNTS VIEW */}
      {selectedSubTab === 'accounts' && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Separated Internal Support & Staff Accounts ({crewAccounts.length})</span>
              </h3>
              <p className="text-xs text-slate-400">
                All login usernames start with <strong className="text-amber-300 font-mono">{CREW_USERNAME_PREFIX}</strong>. When querying login details, the authentication engine isolates them from regular client accounts.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-800 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                  <th className="pb-3 font-bold">Crew Member / Full Name</th>
                  <th className="pb-3 font-bold">System Login Username</th>
                  <th className="pb-3 font-bold">Department</th>
                  <th className="pb-3 font-bold">Assigned Tabs</th>
                  <th className="pb-3 font-bold">Status</th>
                  <th className="pb-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {crewAccounts.map((acc) => {
                  const dept = departments.find((d) => d.id === acc.departmentId);
                  const assignedCount = dept ? dept.assignedTabs.length : 0;

                  return (
                    <tr key={acc.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 pr-4">
                        <div className="font-bold text-slate-100 text-xs">{acc.name}</div>
                        <div className="text-slate-400 text-[11px] font-mono">{acc.email}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                          {acc.username}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="text-slate-200 font-medium">{acc.departmentName}</div>
                        <div className="text-slate-400 text-[11px]">{acc.roleTitle}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono">
                          {assignedCount} tabs allowed
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditAccount(acc)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Edit Crew Account"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'crew_account',
                                id: acc.id,
                                name: `${acc.name} (${acc.username})`,
                              })
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                            title="Delete Account"
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
        </div>
      )}

      {/* MODAL 1: CREATE / EDIT DEPARTMENT */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingDeptId ? 'Edit Department' : 'Create Internal Department'}
                </h3>
                <p className="text-xs text-slate-400">
                  Select which console tabs staff members in this department will be authorized to access.
                </p>
              </div>
            </div>

            {deptError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                {deptError}
              </div>
            )}

            <form onSubmit={handleSaveDept} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Department Name</label>
                <input
                  type="text"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Customer Support & Resolution"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Description</label>
                <textarea
                  rows={2}
                  value={deptDescription}
                  onChange={(e) => setDeptDescription(e.target.value)}
                  placeholder="Briefly explain the responsibilities of this crew department..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Map Existing Tabs */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Map Applicable Console Tabs</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {selectedTabs.length} selected
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  When users from this department sign in, only the checked tabs below will appear in their navigation bar.
                </p>

                <div className="grid grid-cols-1 gap-2 pt-1">
                  {ALL_ADMIN_TAB_DEFINITIONS.map((tab) => {
                    const isChecked = selectedTabs.includes(tab.id);
                    return (
                      <label
                        key={tab.id}
                        className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                          isChecked
                            ? 'bg-amber-500/10 border-amber-500/40 text-slate-100'
                            : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleTabSelection(tab.id)}
                          className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-white">{tab.label}</div>
                          <div className="text-[11px] text-slate-400">{tab.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-lg shadow-amber-500/20"
                >
                  {editingDeptId ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE / EDIT CREW ACCOUNT */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingAccountId ? 'Edit Crew Account' : 'Add Internal Staff / Crew Account'}
                </h3>
                <p className="text-xs text-slate-400">
                  Separated from client organizations. Login username is prefixed automatically.
                </p>
              </div>
            </div>

            {accountError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                {accountError}
              </div>
            )}

            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Staff Full Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. Jessica Chen"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              {/* Enforced Username Prefix */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>System Login Username</span>
                  <span className="text-[10px] text-amber-400 font-mono font-bold">Mandatory Prefix</span>
                </label>
                <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 focus-within:border-amber-500 overflow-hidden">
                  <span className="px-3 py-2.5 bg-slate-900 border-r border-slate-800 text-amber-400 font-mono text-xs font-bold select-none shrink-0">
                    {CREW_USERNAME_PREFIX}
                  </span>
                  <input
                    type="text"
                    disabled={!!editingAccountId}
                    value={accountUsernameSuffix}
                    onChange={(e) => setAccountUsernameSuffix(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                    placeholder="username"
                    className="w-full px-3 py-2.5 bg-transparent text-white font-mono text-xs focus:outline-none disabled:opacity-50"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Full login ID: <span className="font-mono text-amber-300 font-bold">{formatCrewUsername(accountUsernameSuffix || 'username')}</span>
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Corporate Email</label>
                <input
                  type="email"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  placeholder="e.g. jessica.support@rheivatech.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Assigned Department</label>
                <select
                  value={accountDeptId}
                  onChange={(e) => setAccountDeptId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                  required
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.assignedTabs.length} tabs mapped)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Role / Position Title</label>
                <input
                  type="text"
                  value={accountRoleTitle}
                  onChange={(e) => setAccountRoleTitle(e.target.value)}
                  placeholder="e.g. Senior Support Agent"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Password</label>
                <input
                  type="text"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  placeholder="Enter login password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-lg shadow-amber-500/20"
                >
                  {editingAccountId ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === 'department' ? 'Delete Department' : 'Delete Crew Account'}
        message={
          deleteTarget?.type === 'department'
            ? `Are you sure you want to permanently delete department "${deleteTarget?.name}"? Staff accounts belonging to this department will need reassignment.`
            : `Are you sure you want to permanently delete internal crew account "${deleteTarget?.name}"? They will no longer be able to log in.`
        }
        itemName={deleteTarget?.name}
        confirmLabel="Confirm Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
