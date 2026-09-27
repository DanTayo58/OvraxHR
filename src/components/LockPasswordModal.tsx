import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Unlock, KeyRound, X, AlertCircle, ShieldCheck } from 'lucide-react';

interface LockPasswordModalProps {
  isOpen: boolean;
  mode: 'lock' | 'unlock';
  fileName: string;
  onClose: () => void;
  onConfirmLock: (password: string) => void;
  onConfirmUnlock: (password: string) => boolean; // returns true if password matches
}

export const LockPasswordModal: React.FC<LockPasswordModalProps> = ({
  isOpen,
  mode,
  fileName,
  onClose,
  onConfirmLock,
  onConfirmUnlock,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('Please enter a security password.');
      return;
    }

    if (mode === 'lock') {
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter.');
        return;
      }
      onConfirmLock(password.trim());
      handleClose();
    } else {
      const success = onConfirmUnlock(password.trim());
      if (!success) {
        setError('Incorrect unlock password. Access denied.');
      } else {
        handleClose();
      }
    }
  };

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-2xl overflow-hidden p-6 space-y-5"
        >
          {/* Modal Header */}
          <div className="flex items-start justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${
                  mode === 'lock'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {mode === 'lock' ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  {mode === 'lock' ? 'Lock & Encrypt File' : 'Unlock Access Control'}
                </h3>
                <p className="text-xs text-slate-400 font-mono truncate max-w-[220px]">
                  {fileName}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {mode === 'lock'
              ? 'Setting a password will lock this attendance file against unauthorized modifications, status updates, or deletion.'
              : 'Enter the security password assigned to this file to grant editing and unlock authorization.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                {mode === 'lock' ? 'Set Lock Password' : 'Enter Lock Password'}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-blue-500 text-white outline-none text-sm font-mono"
                  autoFocus
                />
              </div>
            </div>

            {mode === 'lock' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                  Confirm Lock Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-blue-500 text-white outline-none text-sm font-mono"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 text-white shadow-lg cursor-pointer ${
                  mode === 'lock'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{mode === 'lock' ? 'Lock File Now' : 'Authorize Unlock'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
