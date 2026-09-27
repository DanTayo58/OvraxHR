import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RheivatechLogo } from './RheivatechLogo';
import {
  X,
  Lock,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTutorial?: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose, onStartTutorial }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl max-h-[90vh] rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-2xl overflow-y-auto p-6 md:p-8 space-y-6 font-sans"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <RheivatechLogo size="md" showSubtext />
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white">
              Welcome to Skima Time Attendance System
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Designed for enterprise timekeeping and attendance auditing. Skima organizes attendance sheets on a dynamic monthly matrix grid with full password locking, multi-shift policy rules, and automatic completeness metrics.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-xs font-mono">
                  <Lock className="w-4 h-4" /> Password Lock Access
                </div>
                <p className="text-[11px] text-slate-400">
                  Protect files against unauthorized modification by setting a master lock password on any worksheet.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs font-mono">
                  <Layers className="w-4 h-4" /> Completeness & Compiled Ratio
                </div>
                <p className="text-[11px] text-slate-400">
                  Automatic completeness metric calculated from days in month vs logged entries.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs font-mono">
                  <RefreshCw className="w-4 h-4" /> 3-Sec Refresh & 10m Idle
                </div>
                <p className="text-[11px] text-slate-400">
                  Manual node sync with 3-second preloader and 10-minute automatic inactivity timeout logout.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs font-mono">
                  <Calendar className="w-4 h-4" /> Custom CSV Headers
                </div>
                <p className="text-[11px] text-slate-400">
                  Define exact column headers matching your WAMP/Excel imports cleanly.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
            {onStartTutorial && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartTutorial();
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Start Quick Tutorial</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-all cursor-pointer text-center"
            >
              Get Started with Skima
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
