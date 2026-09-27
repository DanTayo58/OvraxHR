import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  subMessage?: string;
  itemName?: string;
  confirmLabel?: string;
  confirmButtonText?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLight?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  message,
  subMessage,
  itemName,
  confirmLabel,
  confirmButtonText,
  cancelLabel = 'Cancel',
  isDestructive = true,
  isLight = false,
  onConfirm,
  onCancel,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleCancel = onCancel || onClose || (() => {});
  const finalConfirmLabel = confirmButtonText || confirmLabel || 'Delete Permanently';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5 relative border ${
        isLight
          ? 'bg-white border-slate-200 text-slate-800'
          : 'bg-slate-900 border-slate-800 text-slate-100'
      }`}>
        {/* Close Icon */}
        <button
          type="button"
          onClick={handleCancel}
          className={`absolute top-4 right-4 p-1.5 rounded-lg transition ${
            isLight
              ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDestructive ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
            }`}
          >
            {isDestructive ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <h3 className={`text-base font-bold leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>{title}</h3>
            {itemName && (
              <p className="text-xs font-mono font-bold text-amber-500 mt-1 truncate max-w-xs">
                {itemName}
              </p>
            )}
          </div>
        </div>

        {/* Message */}
        <div className={`p-3 rounded-xl border text-xs leading-relaxed space-y-1 ${
          isLight
            ? 'bg-slate-50 border-slate-200 text-slate-600'
            : 'bg-slate-950/50 border-slate-800/80 text-slate-300'
        }`}>
          <p>{message}</p>
          {subMessage && (
            <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{subMessage}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleCancel}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg cursor-pointer ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{finalConfirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
