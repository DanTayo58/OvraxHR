import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  UserCheck,
  UserPlus,
  DollarSign,
  Calendar,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';

export interface TutorialStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  targetSelector?: string;
  actionHint: string;
  icon: React.ReactNode;
  category: string;
}

interface InteractiveTutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
  onOpenTrackApplicants?: () => void;
  onOpenAddStaff?: () => void;
  onOpenPayrollWorkspace?: () => void;
}

export const InteractiveTutorialOverlay: React.FC<InteractiveTutorialOverlayProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenTrackApplicants,
  onOpenAddStaff,
  onOpenPayrollWorkspace,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const steps: TutorialStep[] = [
    {
      id: 'step-track-applicants',
      title: '1. Track Applicants Pipeline (ATS)',
      subtitle: 'Candidate Tracking & 1-Click Hiring',
      description:
        'Explore the built-in Applicant Tracking System (ATS). Track job seekers across recruitment stages (Screening, Interviewed, Shortlisted, Offered), schedule interviews, evaluate candidate ratings, and enroll them directly into the active staff directory with 1 click.',
      targetSelector: '#track-applicants-btn',
      actionHint: 'Tap "Open Track Applicants" or click the Track Applicants button to explore the pipeline.',
      icon: <UserCheck className="w-5 h-5 text-blue-400" />,
      category: 'Recruitment & ATS',
    },
    {
      id: 'step-add-employee',
      title: '2. Add Direct Employee Record',
      subtitle: 'Complete Biographical & Contact Dossier',
      description:
        'Easily onboard new employees without ATS applications. Fill in vital employee credentials, employee IDs, official start dates, date of birth, home address, and upload staff profile photos.',
      targetSelector: '#add-direct-staff-btn',
      actionHint: 'Tap "Open Add Employee" to preview the personnel registration form.',
      icon: <UserPlus className="w-5 h-5 text-emerald-400" />,
      category: 'Staff Onboarding',
    },
    {
      id: 'step-dossier-guarantor',
      title: '3. Guarantor & Next of Kin Dossiers',
      subtitle: 'Institutional Security & Emergency Contacts',
      description:
        'Every staff profile includes structured guarantor/sponsor verifications and emergency Next of Kin contacts, accessible in 3-tab employee records with printable employment documents (Job Descriptions, Appointment & Confirmation letters).',
      targetSelector: '#staff-table-container',
      actionHint: 'Review staff dossiers in the Staff Directory and Staff Logs.',
      icon: <Layers className="w-5 h-5 text-purple-400" />,
      category: 'Employee Dossiers',
    },
    {
      id: 'step-payroll-workspace',
      title: '4. Full-Page Payroll Workspace',
      subtitle: 'Global Currencies, Statutory Deductions & Payslips',
      description:
        'Access the dedicated full-page Payroll Workspace right beside Track Applicants. Select from 50+ global currencies, configure automated Tax (PAYE) and Pension withholdings, add performance bonuses, export CSV bank disbursal sheets, and generate 1-click printable payslips.',
      targetSelector: '#payroll-workspace-btn',
      actionHint: 'Tap "Open Payroll Workspace" to view the full compensation engine.',
      icon: <DollarSign className="w-5 h-5 text-emerald-400" />,
      category: 'Compensation Matrix',
    },
    {
      id: 'step-shifts-attendance',
      title: '5. Shifts, Attendance Matrices & Locking',
      subtitle: 'Biometric Attendance & Policy Enforcement',
      description:
        'Manage multi-shift rosters (Morning, Afternoon, Night, Rotating), audit monthly attendance worksheets with password locking, track late arrivals with customizable grace periods, and log approved leave requests seamlessly.',
      targetSelector: '#nav-attendance-tab',
      actionHint: 'Explore the Shifts & Attendance tabs in the main dashboard navigation.',
      icon: <FileSpreadsheet className="w-5 h-5 text-amber-400" />,
      category: 'Time & Attendance',
    },
    {
      id: 'step-complete',
      title: '🎉 You Are Ready to Use Skima!',
      subtitle: 'Enterprise HR & Workforce Intelligence',
      description:
        'You have completed the quick tour! You can re-open this tutorial or access the in-depth module guides anytime by clicking the System Guide (Help) button in the top navigation bar.',
      actionHint: 'Click "Finish Tutorial" to start managing your workforce.',
      icon: <Sparkles className="w-5 h-5 text-amber-300" />,
      category: 'Tour Complete',
    },
  ];

  const currentStep = steps[currentStepIndex];

  // Auto-scroll or highlight target element
  useEffect(() => {
    if (!isOpen) return;
    if (currentStep.targetSelector) {
      const el = document.querySelector(currentStep.targetSelector);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-blue-500', 'ring-offset-2', 'ring-offset-slate-900');
        return () => {
          el.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-2', 'ring-offset-slate-900');
        };
      }
    }
  }, [currentStepIndex, isOpen, currentStep.targetSelector]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleActionClick = () => {
    if (currentStep.id === 'step-track-applicants') {
      onOpenTrackApplicants?.();
    } else if (currentStep.id === 'step-add-employee') {
      onOpenAddStaff?.();
    } else if (currentStep.id === 'step-payroll-workspace') {
      onOpenPayrollWorkspace?.();
    } else if (currentStep.id === 'step-shifts-attendance') {
      onNavigateTab?.('attendance');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-end sm:justify-center items-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-xs">
        {/* Floating Spotlight Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-auto w-full max-w-xl rounded-3xl bg-slate-900/95 border-2 border-blue-500/60 text-white shadow-2xl shadow-blue-950/80 p-6 space-y-4 backdrop-blur-xl relative overflow-hidden"
        >
          {/* Background Ambient Glow */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />

          {/* Header Bar with Step Counter & End Tutorial Button */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 relative z-10">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
                {currentStep.icon}
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400">
                  {currentStep.category}
                </span>
                <div className="text-xs text-slate-400 font-mono">
                  Step {currentStepIndex + 1} of {steps.length}
                </div>
              </div>
            </div>

            {/* Omnipresent End Tutorial Button */}
            <button
              id="end-tutorial-btn"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 hover:border-red-500 cursor-pointer shadow-sm"
              title="End Guided Tutorial Anytime"
            >
              <X className="w-3.5 h-3.5" />
              <span>End Tutorial</span>
            </button>
          </div>

          {/* Step Body */}
          <div className="space-y-2 relative z-10">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {currentStep.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {currentStep.description}
            </p>

            {/* Interactive Action Button for relevant steps */}
            {currentStep.id === 'step-track-applicants' && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleActionClick}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Open Track Applicants (ATS)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {currentStep.id === 'step-add-employee' && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleActionClick}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Open Add Direct Employee Form</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {currentStep.id === 'step-payroll-workspace' && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleActionClick}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Open Full-Page Payroll Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-blue-300 font-mono flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{currentStep.actionHint}</span>
            </div>
          </div>

          {/* Footer Controls: Dots, Prev, Next */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800 relative z-10">
            {/* Step Dots */}
            <div className="flex items-center gap-1.5">
              {steps.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === currentStepIndex
                      ? 'w-6 bg-blue-500'
                      : idx < currentStepIndex
                      ? 'w-2 bg-blue-700'
                      : 'w-2 bg-slate-700'
                  }`}
                  title={`Jump to ${s.title}`}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition cursor-pointer"
              >
                <span>{currentStepIndex === steps.length - 1 ? 'Finish Tutorial' : 'Next Step'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
