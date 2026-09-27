import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { RheivatechLogo } from './RheivatechLogo';
import { Cpu, ShieldCheck, Database, CheckCircle2, RefreshCw } from 'lucide-react';

interface PreloaderProps {
  onComplete: () => void;
  timedDurationMs?: number; // e.g. 3000ms for explicit refresh button mode
}

export const Preloader: React.FC<PreloaderProps> = ({ onComplete, timedDurationMs }) => {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    { label: 'Initializing Skima Infrastructure Node', icon: Cpu },
    { label: 'Authenticating Skima Time Attendance Engine', icon: ShieldCheck },
    { label: 'Syncing Local Worksheets & Lock Protocols', icon: Database },
    { label: 'Environment Ready', icon: CheckCircle2 },
  ];

  useEffect(() => {
    if (timedDurationMs) {
      // Fixed duration mode (e.g., 3 seconds)
      const intervalTime = timedDurationMs / 100;
      const timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer);
            setTimeout(() => {
              onComplete();
            }, 100);
            return 100;
          }
          return prev + 1;
        });
      }, intervalTime);

      return () => clearInterval(timer);
    } else {
      // Standard startup mode
      const timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer);
            setTimeout(() => {
              onComplete();
            }, 300);
            return 100;
          }
          const next = prev + Math.floor(Math.random() * 15) + 10;
          return next > 100 ? 100 : next;
        });
      }, 150);

      return () => clearInterval(timer);
    }
  }, [timedDurationMs, onComplete]);

  useEffect(() => {
    if (progress < 30) setStepIndex(0);
    else if (progress < 65) setStepIndex(1);
    else if (progress < 95) setStepIndex(2);
    else setStepIndex(3);
  }, [progress]);

  const CurrentIcon = steps[stepIndex].icon;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white select-none overflow-hidden font-sans"
    >
      {/* Background Animated Gradient Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/40 via-slate-950 to-black pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e3a8a0a_1px,transparent_1px),linear-gradient(to_bottom,#1e3a8a0a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Main Logo Card */}
      <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-8 p-6 rounded-3xl bg-slate-900/90 border border-blue-500/30 shadow-2xl backdrop-blur-xl shadow-blue-950/60"
        >
          <RheivatechLogo size="xl" animated showSubtext={true} />
        </motion.div>

        {/* Loading Progress Section */}
        <div className="w-full space-y-4">
          <div className="flex justify-between items-center text-xs font-mono text-blue-300">
            <span className="flex items-center gap-1.5">
              <CurrentIcon className="w-4 h-4 text-blue-400 animate-spin" />
              {steps[stepIndex].label}
            </span>
            <span className="font-bold text-white">{progress}%</span>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-400 rounded-full shadow-[0_0_12px_rgba(37,99,235,0.8)]"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeOut' }}
            />
          </div>

          {/* Rheivatech Infrastructure Badge */}
          <div className="pt-4 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 font-mono">
            <span className="flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
              3-SEC NODE REFRESH
            </span>
            <span>SKIMA v2.6</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
