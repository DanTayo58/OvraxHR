import React, { useState, useMemo } from 'react';
import {
  X,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Download,
  FileSpreadsheet,
  Send,
  Search,
  Filter,
  CreditCard,
  Printer,
  ShieldCheck,
  Check,
  Edit2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { StaffMember, PayrollConfig } from '../../types';
import { StaffPayrollCalculation } from '../../utils/payrollUtils';
import { emitGlobalToast } from '../../context/ToastContext';

interface BankTransfersModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  config: PayrollConfig;
  calculations?: StaffPayrollCalculation[];
  currencySymbol?: string;
  companyName?: string;
  onOpenExportModal?: () => void;
  onMarkAsCompleted?: () => void;
  onGoToDebitAccountConfig?: () => void;
  onUpdateStaffMember?: (updated: StaffMember) => void;
}

interface TransferItem {
  staffId: string;
  employeeId: string;
  name: string;
  department: string;
  role: string;
  bankName: string;
  accountNumber: string;
  netPay: number;
  status: 'pending' | 'processing' | 'transferred' | 'missing_info';
  transactionRef?: string;
  transferredAt?: string;
}

export const BankTransfersModal: React.FC<BankTransfersModalProps> = ({
  isOpen,
  onClose,
  staffList,
  config,
  calculations = [],
  currencySymbol: customCurrencySymbol,
  companyName,
  onOpenExportModal,
  onMarkAsCompleted,
  onGoToDebitAccountConfig,
  onUpdateStaffMember,
}) => {
  const currencySymbol = customCurrencySymbol || config.currencySymbol || '$';
  const debitAccount = config.debitAccount;
  const isDebitAccountConfigured = Boolean(debitAccount?.isConfigured && debitAccount?.accountNumber);

  // Search and status filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'transferred' | 'missing_info'>('all');
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  // Quick edit staff bank modal state
  const [editingStaffBank, setEditingStaffBank] = useState<{
    staffId: string;
    name: string;
    bankName: string;
    accountNumber: string;
  } | null>(null);

  // Initialize transfer list from calculations
  const [transfers, setTransfers] = useState<TransferItem[]>(() => {
    return calculations.map((calc) => {
      const staff = staffList.find((s) => s.id === calc.staffId || s.employeeId === calc.employeeId);
      const bankName = staff?.bankName?.trim() || '';
      const accountNumber = staff?.accountNumber?.trim() || '';
      const isMissing = !bankName || !accountNumber;

      return {
        staffId: calc.staffId,
        employeeId: calc.employeeId,
        name: calc.name,
        department: calc.department,
        role: calc.role,
        bankName,
        accountNumber,
        netPay: calc.netSalary,
        status: isMissing ? 'missing_info' : 'pending',
      };
    });
  });

  // Calculate high level transfer metrics
  const metrics = useMemo(() => {
    let totalAmount = 0;
    let transferredAmount = 0;
    let pendingCount = 0;
    let transferredCount = 0;
    let missingInfoCount = 0;

    transfers.forEach((t) => {
      totalAmount += t.netPay;
      if (t.status === 'transferred') {
        transferredAmount += t.netPay;
        transferredCount++;
      } else if (t.status === 'missing_info') {
        missingInfoCount++;
      } else {
        pendingCount++;
      }
    });

    return {
      totalAmount,
      transferredAmount,
      totalCount: transfers.length,
      pendingCount,
      transferredCount,
      missingInfoCount,
    };
  }, [transfers]);

  // Filtered transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.employeeId.toLowerCase().includes(q) ||
        t.department.toLowerCase().includes(q) ||
        t.bankName.toLowerCase().includes(q) ||
        t.accountNumber.toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (statusFilter === 'all') return true;
      return t.status === statusFilter;
    });
  }, [transfers, searchTerm, statusFilter]);

  // Process all eligible transfers
  const handleProcessAllTransfers = () => {
    const eligible = transfers.filter((t) => t.status === 'pending');
    if (eligible.length === 0) {
      emitGlobalToast('No pending transfers to process. Check if staff bank details are missing.', 'info');
      return;
    }

    setIsProcessingAll(true);

    setTimeout(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let batchNum = Math.floor(1000 + Math.random() * 9000);

      setTransfers((prev) =>
        prev.map((t) => {
          if (t.status === 'pending') {
            batchNum++;
            return {
              ...t,
              status: 'transferred',
              transactionRef: `TXN-${now.getFullYear()}-${batchNum}`,
              transferredAt: timeStr,
            };
          }
          return t;
        })
      );

      setIsProcessingAll(false);
      emitGlobalToast(
        `Successfully executed bank transfers for ${eligible.length} employees (${currencySymbol}${eligible.reduce((a, b) => a + b.netPay, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})!`,
        'success'
      );
    }, 1200);
  };

  // Process individual transfer
  const handleTransferSingle = (staffId: string) => {
    const item = transfers.find((t) => t.staffId === staffId);
    if (!item || item.status === 'missing_info') {
      emitGlobalToast('Cannot transfer without complete bank details.', 'warning');
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const ref = `TXN-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    setTransfers((prev) =>
      prev.map((t) => (t.staffId === staffId ? { ...t, status: 'transferred', transactionRef: ref, transferredAt: timeStr } : t))
    );

    emitGlobalToast(`Transfer dispatched for ${item.name} (${currencySymbol}${item.netPay.toFixed(2)}) - Ref: ${ref}`, 'success');
  };

  // Save updated staff bank details
  const handleSaveStaffBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaffBank) return;

    const bName = editingStaffBank.bankName.trim();
    const aNum = editingStaffBank.accountNumber.trim();

    if (!bName || !aNum) {
      emitGlobalToast('Please fill in both Bank Name and Account Number.', 'warning');
      return;
    }

    // Update in transfers local state
    setTransfers((prev) =>
      prev.map((t) => {
        if (t.staffId === editingStaffBank.staffId) {
          return {
            ...t,
            bankName: bName,
            accountNumber: aNum,
            status: t.status === 'missing_info' ? 'pending' : t.status,
          };
        }
        return t;
      })
    );

    // Update staff in parent app state if callback provided
    const targetStaff = staffList.find((s) => s.id === editingStaffBank.staffId);
    if (targetStaff && onUpdateStaffMember) {
      onUpdateStaffMember({
        ...targetStaff,
        bankName: bName,
        accountNumber: aNum,
      });
    }

    emitGlobalToast(`Bank details updated for ${editingStaffBank.name}.`, 'success');
    setEditingStaffBank(null);
  };

  // Download Bank Transfer Schedule CSV (Standard Disbursal Batch File)
  const handleDownloadTransferScheduleCSV = () => {
    const headers = [
      'Transaction Ref',
      'Sender Account',
      'Sender Bank',
      'Beneficiary Employee ID',
      'Beneficiary Full Name',
      'Beneficiary Bank Name',
      'Beneficiary Account Number',
      'Payment Currency',
      'Transfer Amount',
      'Transfer Status',
      'Payment Narration',
    ];

    const rows = transfers.map((t) => [
      `"${t.transactionRef || 'PENDING'}"`,
      `"${debitAccount?.accountNumber || 'UNSET_DEBIT_ACCOUNT'}"`,
      `"${debitAccount?.bankName || 'EXTERNAL_DEBIT'}"`,
      `"${t.employeeId}"`,
      `"${t.name.replace(/"/g, '""')}"`,
      `"${t.bankName.replace(/"/g, '""') || 'UNSPECIFIED'}"`,
      `"${t.accountNumber || 'UNSPECIFIED'}"`,
      `"${config.currencyCode || 'USD'}"`,
      t.netPay.toFixed(2),
      `"${t.status.toUpperCase()}"`,
      `"Payroll Disbursal - ${companyName || 'Corporate'} - ${new Date().toISOString().split('T')[0]}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bank_Transfer_Instruction_Batch_${companyName || 'Corporate'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    emitGlobalToast(`Bank transfer schedule CSV generated for ${transfers.length} records.`, 'success');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Payroll Bank Transfers & Disbursals
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-bold">
                  {transfers.length} Recipients
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Direct bank salary payouts, batch transfer execution, and commercial banking payment instructions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* 1. Debit Account Bar */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">
                <CreditCard className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Funding Debit Account:
                  </span>
                  {isDebitAccountConfigured ? (
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Unset (Optional)
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 font-mono mt-0.5">
                  {isDebitAccountConfigured ? (
                    <span>
                      {debitAccount?.bankName} •••• {debitAccount?.accountNumber?.slice(-4)} ({debitAccount?.accountName || 'Clearing Account'})
                    </span>
                  ) : (
                    <span className="text-slate-400 font-sans">
                      No debit account configured. You may proceed with external disbursals or download the transfer instructions.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {onGoToDebitAccountConfig && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoToDebitAccountConfig();
                }}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition flex items-center gap-1.5 self-start md:self-auto cursor-pointer shadow-2xs"
              >
                <span>{isDebitAccountConfigured ? 'Change Debit Account' : 'Set Up Debit Account (Optional)'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. Key Metrics Gauge Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block">
                Total Net Disbursal
              </span>
              <div className="text-lg sm:text-xl font-black font-mono text-indigo-900 dark:text-white mt-0.5">
                {currencySymbol}{metrics.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-300">
                {metrics.totalCount} employees
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                Transferred / Paid
              </span>
              <div className="text-lg sm:text-xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                {currencySymbol}{metrics.transferredAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                {metrics.transferredCount} completed
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                Pending Disbursals
              </span>
              <div className="text-lg sm:text-xl font-black font-mono text-amber-800 dark:text-amber-300 mt-0.5">
                {metrics.pendingCount}
              </div>
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                Awaiting transfer
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block">
                Missing Bank Details
              </span>
              <div className="text-lg sm:text-xl font-black font-mono text-rose-800 dark:text-rose-300 mt-0.5">
                {metrics.missingInfoCount}
              </div>
              <span className="text-[10px] text-rose-600 dark:text-rose-400">
                Requires bank info
              </span>
            </div>
          </div>

          {/* 3. Toolbar: Search, Filters & Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search recipient name, ID, or bank..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none"
              />
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                All ({transfers.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'pending'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Pending ({metrics.pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('transferred')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === 'transferred'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Transferred ({metrics.transferredCount})
              </button>
              {metrics.missingInfoCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('missing_info')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    statusFilter === 'missing_info'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Missing ({metrics.missingInfoCount})
                </button>
              )}
            </div>
          </div>

          {/* 4. Staff Transfers Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Employee Recipient</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Destination Bank & Account</th>
                    <th className="py-3 px-4 text-right">Net Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        <Building2 className="w-8 h-8 mx-auto mb-1.5 opacity-30 text-indigo-500" />
                        <p className="font-semibold text-xs">No transfer records match your current filter</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransfers.map((item) => (
                      <tr key={item.staffId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        {/* Name & ID */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.employeeId}</div>
                        </td>

                        {/* Dept */}
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                          {item.department}
                        </td>

                        {/* Bank Details */}
                        <td className="py-3 px-4">
                          {item.bankName && item.accountNumber ? (
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white block">
                                {item.bankName}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                {item.accountNumber}
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setEditingStaffBank({
                                  staffId: item.staffId,
                                  name: item.name,
                                  bankName: item.bankName,
                                  accountNumber: item.accountNumber,
                                })
                              }
                              className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>+ Add Bank Details</span>
                            </button>
                          )}
                        </td>

                        {/* Net Pay */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {currencySymbol}{item.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {item.status === 'transferred' ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>Transferred</span>
                              </span>
                              {item.transactionRef && (
                                <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                                  {item.transactionRef}
                                </span>
                              )}
                            </div>
                          ) : item.status === 'missing_info' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              Missing Info
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-500" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-right">
                          {item.status === 'pending' ? (
                            <button
                              type="button"
                              onClick={() => handleTransferSingle(item.staffId)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition cursor-pointer shadow-2xs"
                            >
                              Transfer
                            </button>
                          ) : item.status === 'missing_info' ? (
                            <button
                              type="button"
                              onClick={() =>
                                setEditingStaffBank({
                                  staffId: item.staffId,
                                  name: item.name,
                                  bankName: item.bankName,
                                  accountNumber: item.accountNumber,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition cursor-pointer"
                            >
                              Edit Info
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                              Paid ✓
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Export Payroll Tabulation Button */}
            {onOpenExportModal && (
              <button
                type="button"
                onClick={onOpenExportModal}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span>Export Payroll Tabulation</span>
              </button>
            )}

            {/* Download Bank Transfer Schedule */}
            <button
              type="button"
              onClick={handleDownloadTransferScheduleCSV}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4 text-indigo-500" />
              <span>Download Bank Transfer Schedule (.CSV)</span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 flex-wrap">
            {/* Process All Transfers */}
            <button
              type="button"
              disabled={isProcessingAll || metrics.pendingCount === 0}
              onClick={handleProcessAllTransfers}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md ${
                metrics.pendingCount === 0
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
              }`}
            >
              {isProcessingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Batch...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Execute All Transfers ({metrics.pendingCount})</span>
                </>
              )}
            </button>

            {/* Mark as Completed */}
            {onMarkAsCompleted && (
              <button
                type="button"
                onClick={() => {
                  onMarkAsCompleted();
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-600/30"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark as Completed</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* QUICK MODAL: Edit Staff Bank Details */}
      {editingStaffBank && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Update Bank Details: {editingStaffBank.name}
              </h4>
              <button
                type="button"
                onClick={() => setEditingStaffBank(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStaffBank} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Destination Bank Name
                </label>
                <input
                  type="text"
                  required
                  value={editingStaffBank.bankName}
                  onChange={(e) => setEditingStaffBank({ ...editingStaffBank, bankName: e.target.value })}
                  placeholder="e.g. Chase, Bank of America, First Bank"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Account Number / IBAN
                </label>
                <input
                  type="text"
                  required
                  value={editingStaffBank.accountNumber}
                  onChange={(e) => setEditingStaffBank({ ...editingStaffBank, accountNumber: e.target.value })}
                  placeholder="e.g. 1029384756"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStaffBank(null)}
                  className="px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition cursor-pointer shadow-sm shadow-indigo-600/30"
                >
                  Save & Enable Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
