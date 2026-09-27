import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, ShieldAlert, Upload, X, AlertTriangle } from 'lucide-react';

interface RestorePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  onConfirmRestore: (password: string) => Promise<void>;
  isRestoring: boolean;
  errorMessage?: string | null;
}

export const RestorePasswordModal: React.FC<RestorePasswordModalProps> = ({
  isOpen,
  onClose,
  fileName,
  onConfirmRestore,
  isRestoring,
  errorMessage,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmed = password.trim();
    if (!trimmed) {
      setLocalError('Please enter the decryption password for this backup file.');
      return;
    }

    try {
      await onConfirmRestore(trimmed);
    } catch (err: any) {
      setLocalError(err.message || 'Decryption failed. Please verify your password.');
    }
  };

  const displayError = localError || errorMessage;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-600/20 text-teal-400 border border-teal-500/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Enter Backup Decryption Password</h3>
              <p className="text-[11px] text-slate-400 font-mono truncate max-w-[240px]">{fileName}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isRestoring}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-900/60 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
            <span>
              This backup file is encrypted with a one-time export password. Enter the password that was set when this backup was originally downloaded.
            </span>
          </div>

          {displayError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{displayError}</span>
            </div>
          )}

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Backup Password <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLocalError(null);
                }}
                placeholder="Enter the backup password"
                required
                autoFocus
                disabled={isRestoring}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-mono placeholder:text-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
            <button
              type="button"
              disabled={isRestoring}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRestoring}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-600/30 transition cursor-pointer"
            >
              {isRestoring ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Decrypting & Restoring...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Decrypt & Restore</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
