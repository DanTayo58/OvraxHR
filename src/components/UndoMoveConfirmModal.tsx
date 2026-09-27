import React from 'react';
import { Undo2, X, ArrowRight, UserCheck, AlertTriangle } from 'lucide-react';
import { LastMoveDetails } from '../utils/undoMoveUtils';

interface UndoMoveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  moveDetails: LastMoveDetails | null;
  onConfirmUndo: () => void;
  isLight?: boolean;
  currencySymbol?: string;
}

export const UndoMoveConfirmModal: React.FC<UndoMoveConfirmModalProps> = ({
  isOpen,
  onClose,
  moveDetails,
  onConfirmUndo,
  isLight = false,
  currencySymbol = '$',
}) => {
  if (!isOpen || !moveDetails) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isLight ? 'border-slate-100 bg-amber-50/50' : 'border-slate-800 bg-amber-950/20'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Undo2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">Undo</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Revert staff departmental transfer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <div
            className={`p-3.5 rounded-xl border space-y-2.5 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-700/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-500" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {moveDetails.staffName}
                </span>
              </div>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                ID: {moveDetails.employeeId}
              </span>
            </div>

            {/* Department Move Direction */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
              <div className="flex-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
                  Current Dept
                </span>
                <span className="font-bold text-rose-500 dark:text-rose-400 block truncate">
                  {moveDetails.currentDepartment}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {moveDetails.currentRole || 'Staff Member'}
                </span>
              </div>

              <div className="flex flex-col items-center px-2">
                <ArrowRight className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                  Revert
                </span>
              </div>

              <div className="flex-1 text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
                  Restored To
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block truncate">
                  {moveDetails.destinationDepartment}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {moveDetails.revertedRole || 'Staff Member'}
                </span>
              </div>
            </div>

            {/* Salary Restoration Info if present */}
            {moveDetails.revertedSalary !== undefined && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Restored Salary Rate:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {currencySymbol}
                  {moveDetails.revertedSalary.toLocaleString()}/mo
                </span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <span>
              This will return <strong>{moveDetails.staffName}</strong> back to the{' '}
              <strong>{moveDetails.destinationDepartment}</strong> department roster immediately.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className={`px-5 py-3.5 border-t flex items-center justify-end gap-2.5 ${
            isLight ? 'border-slate-100 bg-slate-50' : 'border-slate-800 bg-slate-900/50'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmUndo();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Confirm Undo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
