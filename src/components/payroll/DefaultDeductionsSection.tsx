import React, { useState, useMemo, useEffect } from 'react';
import {
  Calculator,
  CheckCircle2,
  X,
  Info,
  Sliders,
  ShieldAlert,
  Lock,
  Percent,
  UserX,
  Clock,
  FileSpreadsheet,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  PayrollConfig,
  SuspensionDeductionConfig,
  AttendanceEventDeductionConfig,
  AttendanceDeductionCalculationType,
  ProjectFile,
} from '../../types';
import {
  DEFAULT_ABSENTEE_DEDUCTION_CONFIG,
  DEFAULT_LATENESS_DEDUCTION_CONFIG,
  DEFAULT_SUSPENSION_DEDUCTION_CONFIG,
  getDaysInCurrentMonth,
  parseLocalDate,
} from '../../utils/payrollUtils';
import { loadCompanyData, STORAGE_KEYS } from '../../utils/companyStorage';

interface DefaultDeductionsSectionProps {
  config: PayrollConfig;
  canEdit: boolean;
  onUpdateConfig: (updatedConfig: PayrollConfig, toastMessage?: string) => void;
  projects?: ProjectFile[];
  referenceDate?: string | Date | null;
  companyName?: string;
}

type ActiveDefaultDeduction = 'suspension' | 'absenteeism' | 'lateness' | null;

export const DefaultDeductionsSection: React.FC<DefaultDeductionsSectionProps> = ({
  config,
  canEdit,
  onUpdateConfig,
  projects: providedProjects,
  referenceDate,
  companyName,
}) => {
  const currencySymbol = config?.currencySymbol || '$';

  // 1. Live saved configs
  const suspensionConfig: SuspensionDeductionConfig =
    config?.suspensionDeductionConfig || DEFAULT_SUSPENSION_DEDUCTION_CONFIG;
  const isSuspensionEnabled = suspensionConfig.isEnabled !== false;
  const suspensionCalcType = suspensionConfig.calculationType === 'rigid' ? 'rigid' : 'daily_pay';
  const suspensionRigidAmount =
    Number(suspensionConfig.rigidDailyAmount) >= 0 ? Number(suspensionConfig.rigidDailyAmount) : 50;

  const absenteeConfig: AttendanceEventDeductionConfig =
    config?.absenteeDeductionConfig || DEFAULT_ABSENTEE_DEDUCTION_CONFIG;
  const isAbsenteeEnabled = absenteeConfig.isEnabled !== false;
  const absenteeCalcType: AttendanceDeductionCalculationType =
    absenteeConfig.calculationType || 'day_calculation';
  const absenteeUseSalaryDailyRate = absenteeConfig.useSalaryDailyRate !== false;
  const absenteeRigidDailyAmount =
    Number(absenteeConfig.rigidDailyAmount) >= 0 ? Number(absenteeConfig.rigidDailyAmount) : 50;
  const absenteePercentageRate =
    Number(absenteeConfig.percentageRate) >= 0 ? Number(absenteeConfig.percentageRate) : 3.0;
  const absenteeExactAmount =
    Number(absenteeConfig.exactAmount) >= 0 ? Number(absenteeConfig.exactAmount) : 50;

  const latenessConfig: AttendanceEventDeductionConfig =
    config?.latenessDeductionConfig || DEFAULT_LATENESS_DEDUCTION_CONFIG;
  const isLatenessEnabled = latenessConfig.isEnabled !== false;
  const latenessCalcType: AttendanceDeductionCalculationType =
    latenessConfig.calculationType || 'exact_value';
  const latenessUseSalaryDailyRate = latenessConfig.useSalaryDailyRate !== false;
  const latenessRigidDailyAmount =
    Number(latenessConfig.rigidDailyAmount) >= 0 ? Number(latenessConfig.rigidDailyAmount) : 15;
  const latenessPercentageRate =
    Number(latenessConfig.percentageRate) >= 0 ? Number(latenessConfig.percentageRate) : 1.0;
  const latenessExactAmount =
    Number(latenessConfig.exactAmount) >= 0 ? Number(latenessConfig.exactAmount) : 15;

  // 2. Active Opened Drawer State (null on initial load so policy is NOT displayed)
  const [activeDeduction, setActiveDeduction] = useState<ActiveDefaultDeduction>(null);

  // 3. Draft States for editing inside calculation policy drawer
  const [draftSuspension, setDraftSuspension] = useState<SuspensionDeductionConfig>(suspensionConfig);
  const [draftAbsentee, setDraftAbsentee] = useState<AttendanceEventDeductionConfig>(absenteeConfig);
  const [draftLateness, setDraftLateness] = useState<AttendanceEventDeductionConfig>(latenessConfig);

  // Sync draft states when saved config changes from external actions
  useEffect(() => {
    setDraftSuspension(suspensionConfig);
  }, [suspensionConfig]);

  useEffect(() => {
    setDraftAbsentee(absenteeConfig);
  }, [absenteeConfig]);

  useEffect(() => {
    setDraftLateness(latenessConfig);
  }, [latenessConfig]);

  // 4. Resolve Active Attendance Worksheet
  const allProjects = useMemo(() => {
    if (Array.isArray(providedProjects) && providedProjects.length > 0) {
      return providedProjects;
    }
    return loadCompanyData<ProjectFile[]>(STORAGE_KEYS.PROJECTS, companyName, []);
  }, [providedProjects, companyName]);

  const refDateObj = useMemo(() => parseLocalDate(referenceDate), [referenceDate]);
  const currentMonthYear = useMemo(() => {
    return `${refDateObj.getFullYear()}-${String(refDateObj.getMonth() + 1).padStart(2, '0')}`;
  }, [refDateObj]);

  const currentMonthName = useMemo(() => {
    return refDateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [refDateObj]);

  const { activeWorksheet, hasWorksheet, daysInMonth, monthAbsentCount, monthLateCount } =
    useMemo(() => {
      const matching = (allProjects || []).filter((p) => {
        if (!p || !p.monthYear) return false;
        const cleanMY = p.monthYear.trim();
        return cleanMY === currentMonthYear || cleanMY.startsWith(currentMonthYear);
      });

      const firstWorksheet = matching[0] || null;
      const days =
        firstWorksheet?.daysInMonth && firstWorksheet.daysInMonth >= 28
          ? firstWorksheet.daysInMonth
          : getDaysInCurrentMonth(refDateObj);

      let absents = 0;
      let lates = 0;

      matching.forEach((proj) => {
        (proj.records || []).forEach((r) => {
          if (r.status === 'Absent') absents += 1;
          if (r.status === 'Late') lates += 1;
        });
      });

      return {
        activeWorksheet: firstWorksheet,
        hasWorksheet: Boolean(firstWorksheet),
        daysInMonth: days,
        monthAbsentCount: absents,
        monthLateCount: lates,
      };
    }, [allProjects, currentMonthYear, refDateObj]);

  // Handler: Open a specific default deduction policy
  const handleOpenDeduction = (type: 'suspension' | 'absenteeism' | 'lateness') => {
    if (activeDeduction === type) {
      setActiveDeduction(null);
      return;
    }
    if (type === 'suspension') {
      setDraftSuspension({ ...suspensionConfig });
    } else if (type === 'absenteeism') {
      setDraftAbsentee({ ...absenteeConfig });
    } else if (type === 'lateness') {
      setDraftLateness({ ...latenessConfig });
    }
    setActiveDeduction(type);
  };

  // Handler: Close without saving
  const handleClose = () => {
    // Reset drafts to currently saved configs and close
    setDraftSuspension({ ...suspensionConfig });
    setDraftAbsentee({ ...absenteeConfig });
    setDraftLateness({ ...latenessConfig });
    setActiveDeduction(null);
  };

  // Handler: Save and close
  const handleSave = () => {
    if (!canEdit) return;

    if (activeDeduction === 'suspension') {
      const newConfig: PayrollConfig = {
        ...config,
        suspensionDeductionConfig: draftSuspension,
      };
      onUpdateConfig(
        newConfig,
        `Suspension deduction policy saved (${draftSuspension.isEnabled ? 'Active' : 'Disabled'}, ${
          draftSuspension.calculationType === 'rigid' ? 'Rigid Rate' : 'Daily Pay'
        })`
      );
    } else if (activeDeduction === 'absenteeism') {
      const newConfig: PayrollConfig = {
        ...config,
        absenteeDeductionConfig: draftAbsentee,
      };
      onUpdateConfig(
        newConfig,
        `Absenteeism deduction policy saved (${draftAbsentee.isEnabled ? 'Active' : 'Disabled'}, ${
          draftAbsentee.calculationType === 'day_calculation'
            ? 'Day Calc'
            : draftAbsentee.calculationType === 'percentage'
            ? `${draftAbsentee.percentageRate}%`
            : `${currencySymbol}${draftAbsentee.exactAmount}`
        })`
      );
    } else if (activeDeduction === 'lateness') {
      const newConfig: PayrollConfig = {
        ...config,
        latenessDeductionConfig: draftLateness,
      };
      onUpdateConfig(
        newConfig,
        `Lateness deduction policy saved (${draftLateness.isEnabled ? 'Active' : 'Disabled'}, ${
          draftLateness.calculationType === 'exact_value'
            ? `${currencySymbol}${draftLateness.exactAmount}`
            : draftLateness.calculationType === 'percentage'
            ? `${draftLateness.percentageRate}%`
            : 'Day Calc'
        })`
      );
    }

    setActiveDeduction(null);
  };

  // Quick card toggle buttons (direct update for convenience, matching corporate deduction cards)
  const handleQuickToggleSuspension = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    const newConfig: PayrollConfig = {
      ...config,
      suspensionDeductionConfig: {
        ...suspensionConfig,
        isEnabled: !isSuspensionEnabled,
      },
    };
    onUpdateConfig(
      newConfig,
      `Automatic Suspension Deduction globally ${!isSuspensionEnabled ? 'Enabled' : 'Disabled'}`
    );
  };

  const handleQuickToggleAbsentee = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    const newConfig: PayrollConfig = {
      ...config,
      absenteeDeductionConfig: {
        ...absenteeConfig,
        isEnabled: !isAbsenteeEnabled,
      },
    };
    onUpdateConfig(
      newConfig,
      `Automatic Absenteeism Deduction globally ${!isAbsenteeEnabled ? 'Enabled' : 'Disabled'}`
    );
  };

  const handleQuickToggleLateness = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    const newConfig: PayrollConfig = {
      ...config,
      latenessDeductionConfig: {
        ...latenessConfig,
        isEnabled: !isLatenessEnabled,
      },
    };
    onUpdateConfig(
      newConfig,
      `Automatic Lateness Deduction globally ${!isLatenessEnabled ? 'Enabled' : 'Disabled'}`
    );
  };

  // Summary labels for small cards
  const suspensionSummary =
    suspensionCalcType === 'daily_pay'
      ? 'Daily Pay (Salary ÷ Days)'
      : `Rigid Rate (${currencySymbol}${suspensionRigidAmount}/d)`;

  const absenteeSummary =
    absenteeCalcType === 'day_calculation'
      ? absenteeUseSalaryDailyRate
        ? 'Daily Pay (Salary ÷ Days)'
        : `Rigid Rate (${currencySymbol}${absenteeRigidDailyAmount}/d)`
      : absenteeCalcType === 'percentage'
      ? `Percentage (${absenteePercentageRate}%/d)`
      : `Exact Value (${currencySymbol}${absenteeExactAmount}/d)`;

  const latenessSummary =
    latenessCalcType === 'exact_value'
      ? `Exact Value (${currencySymbol}${latenessExactAmount}/arrival)`
      : latenessCalcType === 'percentage'
      ? `Percentage (${latenessPercentageRate}%/arrival)`
      : latenessUseSalaryDailyRate
      ? 'Daily Pay (Salary ÷ Days)'
      : `Rigid Rate (${currencySymbol}${latenessRigidDailyAmount}/d)`;

  return (
    <div
      id="default-deductions-container"
      className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Default Deductions & Automation
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold">
                Event-Triggered
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Disciplinary workforce suspensions and monthly attendance worksheet deductions.
            </p>
          </div>
        </div>

        {/* Sync badge info */}
        <div className="flex items-center gap-2">
          {hasWorksheet ? (
            <span
              className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5"
              title={`Worksheet "${activeWorksheet?.name}" active for ${currentMonthName}`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{currentMonthYear} Worksheet Active ({daysInMonth}d)</span>
            </span>
          ) : (
            <span
              className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center gap-1.5"
              title={`No attendance worksheet linked yet for ${currentMonthName}`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>No {currentMonthName} Worksheet</span>
            </span>
          )}
        </div>
      </div>

      {/* ONE-LINE DEFAULT DEDUCTIONS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Card 1: Suspension */}
        <div
          id="default-deduction-card-suspension"
          onClick={() => handleOpenDeduction('suspension')}
          className={`p-3.5 rounded-xl border transition flex flex-col justify-between cursor-pointer ${
            activeDeduction === 'suspension'
              ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-500 dark:border-amber-500 shadow-md ring-2 ring-amber-500/20'
              : isSuspensionEnabled
              ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-700'
              : 'bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/40 opacity-70 hover:opacity-100 hover:border-slate-400'
          }`}
        >
          <div>
            <div className="flex items-start justify-between gap-1.5 mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-xs text-slate-900 dark:text-white truncate" title="Automatic Suspension Deduction">
                  Suspension
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleQuickToggleSuspension}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition cursor-pointer ${
                      isSuspensionEnabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                    title="Toggle Suspension Deduction ON/OFF"
                  >
                    {isSuspensionEnabled ? 'ON' : 'OFF'}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100/80 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Disciplinary
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                Resets on Roll
              </span>
            </div>

            <div className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300 truncate" title={suspensionSummary}>
              {suspensionSummary}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono">
              Formula: (Salary ÷ Days) × x
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDeduction('suspension');
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                activeDeduction === 'suspension'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-200/70 hover:bg-amber-100 dark:bg-slate-700 dark:hover:bg-amber-950/60 text-slate-700 dark:text-slate-200 hover:text-amber-700 dark:hover:text-amber-300'
              }`}
            >
              <span>{activeDeduction === 'suspension' ? 'Close' : 'Open'}</span>
              {activeDeduction === 'suspension' ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Card 2: Absenteeism */}
        <div
          id="default-deduction-card-absenteeism"
          onClick={() => handleOpenDeduction('absenteeism')}
          className={`p-3.5 rounded-xl border transition flex flex-col justify-between cursor-pointer ${
            activeDeduction === 'absenteeism'
              ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-500 dark:border-rose-500 shadow-md ring-2 ring-rose-500/20'
              : isAbsenteeEnabled
              ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-700'
              : 'bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/40 opacity-70 hover:opacity-100 hover:border-slate-400'
          }`}
        >
          <div>
            <div className="flex items-start justify-between gap-1.5 mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <UserX className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-xs text-slate-900 dark:text-white truncate" title="Automatic Absenteeism Deduction">
                  Absenteeism
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleQuickToggleAbsentee}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition cursor-pointer ${
                      isAbsenteeEnabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                    title="Toggle Absenteeism Deduction ON/OFF"
                  >
                    {isAbsenteeEnabled ? 'ON' : 'OFF'}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-100/80 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                Attendance
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                {monthAbsentCount} absent this month
              </span>
            </div>

            <div className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300 truncate" title={absenteeSummary}>
              {absenteeSummary}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono">
              Policy: {absenteeCalcType === 'percentage' ? `${absenteePercentageRate}%/d` : absenteeCalcType === 'exact_value' ? `${currencySymbol}${absenteeExactAmount}/d` : 'Day Pay'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDeduction('absenteeism');
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                activeDeduction === 'absenteeism'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-200/70 hover:bg-rose-100 dark:bg-slate-700 dark:hover:bg-rose-950/60 text-slate-700 dark:text-slate-200 hover:text-rose-700 dark:hover:text-rose-300'
              }`}
            >
              <span>{activeDeduction === 'absenteeism' ? 'Close' : 'Open'}</span>
              {activeDeduction === 'absenteeism' ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Card 3: Lateness */}
        <div
          id="default-deduction-card-lateness"
          onClick={() => handleOpenDeduction('lateness')}
          className={`p-3.5 rounded-xl border transition flex flex-col justify-between cursor-pointer ${
            activeDeduction === 'lateness'
              ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-500 dark:border-amber-500 shadow-md ring-2 ring-amber-500/20'
              : isLatenessEnabled
              ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-700'
              : 'bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/40 opacity-70 hover:opacity-100 hover:border-slate-400'
          }`}
        >
          <div>
            <div className="flex items-start justify-between gap-1.5 mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-xs text-slate-900 dark:text-white truncate" title="Automatic Lateness Deduction">
                  Lateness
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleQuickToggleLateness}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition cursor-pointer ${
                      isLatenessEnabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                    title="Toggle Lateness Deduction ON/OFF"
                  >
                    {isLatenessEnabled ? 'ON' : 'OFF'}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100/80 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Attendance
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                {monthLateCount} late this month
              </span>
            </div>

            <div className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300 truncate" title={latenessSummary}>
              {latenessSummary}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-mono">
              Policy: {latenessCalcType === 'exact_value' ? `${currencySymbol}${latenessExactAmount}/d` : latenessCalcType === 'percentage' ? `${latenessPercentageRate}%` : 'Day Pay'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDeduction('lateness');
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                activeDeduction === 'lateness'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-200/70 hover:bg-amber-100 dark:bg-slate-700 dark:hover:bg-amber-950/60 text-slate-700 dark:text-slate-200 hover:text-amber-700 dark:hover:text-amber-300'
              }`}
            >
              <span>{activeDeduction === 'lateness' ? 'Close' : 'Open'}</span>
              {activeDeduction === 'lateness' ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CALCULATION POLICY PANEL (Only displayed when open button is clicked)     */}
      {/* ========================================================================= */}
      {activeDeduction !== null && (
        <div
          id="default-deduction-policy-panel"
          className="mt-4 p-5 rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/15 shadow-sm space-y-5 transition-all"
        >
          {/* Panel Top Header with Close and Title */}
          <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-amber-900/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  activeDeduction === 'suspension'
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    : activeDeduction === 'absenteeism'
                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                }`}
              >
                {activeDeduction === 'suspension' ? (
                  <ShieldAlert className="w-4 h-4" />
                ) : activeDeduction === 'absenteeism' ? (
                  <UserX className="w-4 h-4" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Calculation Policy: {activeDeduction === 'suspension' ? 'Suspension Deduction' : activeDeduction === 'absenteeism' ? 'Absenteeism Deduction' : 'Lateness Deduction'}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    Configuration Mode
                  </span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeDeduction === 'suspension'
                    ? 'Configure how suspended calendar days are calculated into deductions upon payroll generation.'
                    : activeDeduction === 'absenteeism'
                    ? 'Configure rate deducted per unexcused absent day recorded in the monthly attendance worksheet.'
                    : 'Configure rate deducted per late arrival occurrence recorded in the monthly attendance worksheet.'}
                </p>
              </div>
            </div>

            {/* Quick close button in header */}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
              title="Close without saving"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* DEDUCTION 1: SUSPENSION OPTIONS */}
          {activeDeduction === 'suspension' && (
            <div className="space-y-4">
              {/* Global ON / OFF Toggle in Policy Header */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Suspension Deduction Status:
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      draftSuspension.isEnabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}
                  >
                    {draftSuspension.isEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraftSuspension((prev) => ({ ...prev, isEnabled: !prev.isEnabled }))
                    }
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      draftSuspension.isEnabled
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                    }`}
                  >
                    {draftSuspension.isEnabled ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>Active on Payroll</span>
                      </>
                    ) : (
                      <>
                        <X className="w-3.5 h-3.5 text-slate-400" />
                        <span>Disabled</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* 2 Calculation Options */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Select Calculation Method:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Daily Pay */}
                  <div
                    onClick={() =>
                      canEdit &&
                      setDraftSuspension((prev) => ({ ...prev, calculationType: 'daily_pay' }))
                    }
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      draftSuspension.calculationType === 'daily_pay'
                        ? 'bg-white dark:bg-slate-800/90 border-amber-500 dark:border-amber-500 shadow-md ring-2 ring-amber-500/20'
                        : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-amber-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          1. Daily Pay Rate (Salary ÷ Month Days)
                        </span>
                        {draftSuspension.calculationType === 'daily_pay' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-mono text-[9px] font-bold">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Derives the exact daily rate dynamically from employee monthly salary divided by the calendar days of the month.
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Formula:</span>
                      <span className="font-bold text-amber-700 dark:text-amber-300">
                        (Base Salary ÷ Days of Month) × Counted Days
                      </span>
                    </div>
                  </div>

                  {/* Option 2: Rigid Daily */}
                  <div
                    onClick={() =>
                      canEdit &&
                      setDraftSuspension((prev) => ({ ...prev, calculationType: 'rigid' }))
                    }
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      draftSuspension.calculationType === 'rigid'
                        ? 'bg-white dark:bg-slate-800/90 border-amber-500 dark:border-amber-500 shadow-md ring-2 ring-amber-500/20'
                        : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-amber-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          2. Rigid Daily Deduction
                        </span>
                        {draftSuspension.calculationType === 'rigid' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-mono text-[9px] font-bold">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Applies a uniform fixed daily monetary amount deducted per calendar day of suspension.
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">Fixed Rate:</span>
                      <div
                        className="flex items-center gap-1 font-mono font-bold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-amber-600 dark:text-amber-400">{currencySymbol}</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={!canEdit}
                          value={draftSuspension.rigidDailyAmount ?? 50}
                          onChange={(e) =>
                            setDraftSuspension((prev) => ({
                              ...prev,
                              rigidDailyAmount: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-18 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                        />
                        <span className="text-slate-400">/ day</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Example Callout */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-amber-200/80 dark:border-amber-900/60 flex items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start sm:items-center gap-2">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="text-slate-600 dark:text-slate-300">
                    {draftSuspension.calculationType === 'daily_pay' ? (
                      <>
                        <strong>Formula Preview:</strong> For a staff member with a{' '}
                        <strong>{currencySymbol}3,100</strong> base salary suspended for{' '}
                        <strong>5 days</strong> in a 31-day month, deduction is{' '}
                        <strong className="font-mono text-rose-600 dark:text-rose-400">
                          {currencySymbol}100.00/day × 5 = {currencySymbol}500.00
                        </strong>.
                      </>
                    ) : (
                      <>
                        <strong>Formula Preview:</strong> For any staff member suspended for{' '}
                        <strong>5 days</strong>, deduction is{' '}
                        <strong className="font-mono text-rose-600 dark:text-rose-400">
                          {currencySymbol}{draftSuspension.rigidDailyAmount || 50}.00/day × 5 = {currencySymbol}
                          {((draftSuspension.rigidDailyAmount || 50) * 5).toLocaleString()}.00
                        </strong>.
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* DEDUCTION 2: ABSENTEEISM OPTIONS */}
          {activeDeduction === 'absenteeism' && (
            <div className="space-y-4">
              {/* Global ON / OFF Toggle in Policy Header */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Absenteeism Deduction Status:
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      draftAbsentee.isEnabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}
                  >
                    {draftAbsentee.isEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraftAbsentee((prev) => ({ ...prev, isEnabled: !prev.isEnabled }))
                    }
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      draftAbsentee.isEnabled
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                    }`}
                  >
                    {draftAbsentee.isEnabled ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>Active on Payroll</span>
                      </>
                    ) : (
                      <>
                        <X className="w-3.5 h-3.5 text-slate-400" />
                        <span>Disabled</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* 3 Calculation Options */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Select Calculation Method:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Option 1: Day Calculation */}
                  <div
                    onClick={() =>
                      canEdit &&
                      setDraftAbsentee((prev) => ({ ...prev, calculationType: 'day_calculation' }))
                    }
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      draftAbsentee.calculationType === 'day_calculation'
                        ? 'bg-white dark:bg-slate-800/90 border-rose-500 dark:border-rose-500 shadow-md ring-2 ring-rose-500/20'
                        : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-rose-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          1. Day Calculation
                        </span>
                        {draftAbsentee.calculationType === 'day_calculation' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Deducts daily salary based on month days (31, 30, 28/29) or custom fixed daily rate.
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400">Formula:</span>
                        <span className="font-bold text-rose-700 dark:text-rose-300">
                          (Base ÷ Days) × Absent Days
                        </span>
                      </div>

                      {draftAbsentee.calculationType === 'day_calculation' && (
                        <div
                          className="pt-1.5 flex items-center justify-between text-[11px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300 text-xs">
                            <input
                              type="checkbox"
                              checked={draftAbsentee.useSalaryDailyRate !== false}
                              disabled={!canEdit}
                              onChange={(e) =>
                                setDraftAbsentee((prev) => ({
                                  ...prev,
                                  useSalaryDailyRate: e.target.checked,
                                }))
                              }
                              className="rounded text-rose-600 focus:ring-rose-500"
                            />
                            <span>Use salary daily pay</span>
                          </label>

                          {draftAbsentee.useSalaryDailyRate === false && (
                            <div className="flex items-center gap-1 font-mono font-bold">
                              <span className="text-rose-600">{currencySymbol}</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                disabled={!canEdit}
                                value={draftAbsentee.rigidDailyAmount ?? 50}
                                onChange={(e) =>
                                  setDraftAbsentee((prev) => ({
                                    ...prev,
                                    rigidDailyAmount: Math.max(0, Number(e.target.value)),
                                  }))
                                }
                                className="w-16 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-mono text-slate-900 dark:text-white"
                              />
                              <span className="text-slate-400">/d</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Option 2: Percentage */}
                  <div
                    onClick={() =>
                      canEdit &&
                      setDraftAbsentee((prev) => ({ ...prev, calculationType: 'percentage' }))
                    }
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      draftAbsentee.calculationType === 'percentage'
                        ? 'bg-white dark:bg-slate-800/90 border-rose-500 dark:border-rose-500 shadow-md ring-2 ring-rose-500/20'
                        : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-rose-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Percent className="w-3.5 h-3.5 text-rose-500" />
                          2. Percentage Deduction
                        </span>
                        {draftAbsentee.calculationType === 'percentage' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Deducts a percentage of monthly base salary per unexcused absent day.
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">Rate per Day:</span>
                      <div
                        className="flex items-center gap-1 font-mono font-bold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          min="0.1"
                          max="100"
                          step="0.5"
                          disabled={!canEdit}
                          value={draftAbsentee.percentageRate ?? 3.0}
                          onChange={(e) =>
                            setDraftAbsentee((prev) => ({
                              ...prev,
                              percentageRate: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-16 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                        />
                        <span className="text-rose-600 dark:text-rose-400 font-bold">% / day</span>
                      </div>
                    </div>
                  </div>

                  {/* Option 3: Exact Value */}
                  <div
                    onClick={() =>
                      canEdit &&
                      setDraftAbsentee((prev) => ({ ...prev, calculationType: 'exact_value' }))
                    }
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      draftAbsentee.calculationType === 'exact_value'
                        ? 'bg-white dark:bg-slate-800/90 border-rose-500 dark:border-rose-500 shadow-md ring-2 ring-rose-500/20'
                        : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-rose-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5 text-rose-500" />
                          3. Exact Value Deduction
                        </span>
                        {draftAbsentee.calculationType === 'exact_value' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Deducts a fixed monetary amount per absent day regardless of individual salary.
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">Exact Value:</span>
                      <div
                        className="flex items-center gap-1 font-mono font-bold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-rose-600 dark:text-rose-400">{currencySymbol}</span>
                        <input
                          type="number"
                          min="0"
                          step="5"
                          disabled={!canEdit}
                          value={draftAbsentee.exactAmount ?? 50}
                          onChange={(e) =>
                            setDraftAbsentee((prev) => ({
                              ...prev,
                              exactAmount: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-18 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                        />
                        <span className="text-slate-400">/ day</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Example Callout */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-rose-200/80 dark:border-rose-900/60 flex items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start sm:items-center gap-2">
                  <Info className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="text-slate-600 dark:text-slate-300">
                    {draftAbsentee.calculationType === 'day_calculation' ? (
                      draftAbsentee.useSalaryDailyRate !== false ? (
                        <>
                          <strong>Formula Preview:</strong> For a staff member with a{' '}
                          <strong>{currencySymbol}3,100</strong> base salary absent for{' '}
                          <strong>2 days</strong> in a 31-day month, deduction is{' '}
                          <strong className="font-mono text-rose-600 dark:text-rose-400">
                            ({currencySymbol}3,100 ÷ 31) × 2 = {currencySymbol}200.00
                          </strong>.
                        </>
                      ) : (
                        <>
                          <strong>Formula Preview:</strong> For a staff member absent for{' '}
                          <strong>2 days</strong> at fixed daily rate, deduction is{' '}
                          <strong className="font-mono text-rose-600 dark:text-rose-400">
                            {currencySymbol}{draftAbsentee.rigidDailyAmount || 50} × 2 = {currencySymbol}
                            {((draftAbsentee.rigidDailyAmount || 50) * 2).toFixed(2)}
                          </strong>.
                        </>
                      )
                    ) : draftAbsentee.calculationType === 'percentage' ? (
                      <>
                        <strong>Formula Preview:</strong> For a staff member with a{' '}
                        <strong>{currencySymbol}3,100</strong> base salary absent for{' '}
                        <strong>2 days</strong> at {draftAbsentee.percentageRate || 3}%, deduction is{' '}
                        <strong className="font-mono text-rose-600 dark:text-rose-400">
                          ({draftAbsentee.percentageRate || 3}% of {currencySymbol}3,100) × 2 = {currencySymbol}
                          {(((3100 * (draftAbsentee.percentageRate || 3)) / 100) * 2).toFixed(2)}
                        </strong>.
                      </>
                    ) : (
                      <>
                        <strong>Formula Preview:</strong> For any staff member absent for{' '}
                        <strong>2 days</strong>, exact deduction is{' '}
                        <strong className="font-mono text-rose-600 dark:text-rose-400">
                          {currencySymbol}{draftAbsentee.exactAmount || 50} × 2 = {currencySymbol}
                          {((draftAbsentee.exactAmount || 50) * 2).toFixed(2)}
                        </strong>.
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* DEDUCTION 3: LATENESS OPTIONS */}
          {activeDeduction === 'lateness' && (
            <div className="space-y-4">
              {/* Global ON / OFF Toggle in Policy Header */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Lateness Deduction Status:
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      draftLateness.isEnabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}
                  >
                    {draftLateness.isEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraftLateness((prev) => ({ ...prev, isEnabled: !prev.isEnabled }))
                    }
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      draftLateness.isEnabled
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                    }`}
                  >
                    {draftLateness.isEnabled ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>Active on Payroll</span>
                      </>
                    ) : (
                      <>
                        <X className="w-3.5 h-3.5 text-slate-400" />
                        <span>Disabled</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* 3 Calculation Options */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Select Calculation Method:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Option 1: Day Calculation */}
                  <div
                    onClick={() =>
                      canEdit &&
                      setDraftLateness((prev) => ({ ...prev, calculationType: 'day_calculation' }))
                    }
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      draftLateness.calculationType === 'day_calculation'
                        ? 'bg-white dark:bg-slate-800/90 border-amber-500 dark:border-amber-500 shadow-md ring-2 ring-amber-500/20'
                        : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-amber-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          1. Day Calculation
                        </span>
                        {draftLateness.calculationType === 'day_calculation' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-mono text-[9px] font-bold">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Deducts a full daily rate based on month days (31, 30, 28/29) or custom fixed rate.
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400">Formula:</span>
                        <span className="font-bold text-amber-700 dark:text-amber-300">
                          (Base ÷ Days) × Late Days
                        </span>
                      </div>

                      {draftLateness.calculationType === 'day_calculation' && (
                        <div
                          className="pt-1.5 flex items-center justify-between text-[11px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300 text-xs">
                            <input
                              type="checkbox"
                              checked={draftLateness.useSalaryDailyRate !== false}
                              disabled={!canEdit}
                              onChange={(e) =>
                                setDraftLateness((prev) => ({
                                  ...prev,
                                  useSalaryDailyRate: e.target.checked,
                                }))
                              }
                              className="rounded text-amber-600 focus:ring-amber-500"
                            />
                            <span>Use salary daily pay</span>
                          </label>

                          {draftLateness.useSalaryDailyRate === false && (
                            <div className="flex items-center gap-1 font-mono font-bold">
                              <span className="text-amber-600">{currencySymbol}</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                disabled={!canEdit}
                                value={draftLateness.rigidDailyAmount ?? 15}
                                onChange={(e) =>
                                  setDraftLateness((prev) => ({
                                    ...prev,
                                    rigidDailyAmount: Math.max(0, Number(e.target.value)),
                                  }))
                                }
                                className="w-16 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-mono text-slate-900 dark:text-white"
                              />
                              <span className="text-slate-400">/d</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Option 2: Percentage */}
                  <div
                    onClick={() =>
                      canEdit &&
                      setDraftLateness((prev) => ({ ...prev, calculationType: 'percentage' }))
                    }
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      draftLateness.calculationType === 'percentage'
                        ? 'bg-white dark:bg-slate-800/90 border-amber-500 dark:border-amber-500 shadow-md ring-2 ring-amber-500/20'
                        : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-amber-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Percent className="w-3.5 h-3.5 text-amber-500" />
                          2. Percentage Deduction
                        </span>
                        {draftLateness.calculationType === 'percentage' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-mono text-[9px] font-bold">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Deducts a percentage of base monthly salary per late arrival incident.
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">Rate per Incident:</span>
                      <div
                        className="flex items-center gap-1 font-mono font-bold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          min="0.1"
                          max="100"
                          step="0.5"
                          disabled={!canEdit}
                          value={draftLateness.percentageRate ?? 1.0}
                          onChange={(e) =>
                            setDraftLateness((prev) => ({
                              ...prev,
                              percentageRate: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-16 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                        />
                        <span className="text-amber-600 dark:text-amber-400 font-bold">% / incident</span>
                      </div>
                    </div>
                  </div>

                  {/* Option 3: Exact Value */}
                  <div
                    onClick={() =>
                      canEdit &&
                      setDraftLateness((prev) => ({ ...prev, calculationType: 'exact_value' }))
                    }
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      draftLateness.calculationType === 'exact_value'
                        ? 'bg-white dark:bg-slate-800/90 border-amber-500 dark:border-amber-500 shadow-md ring-2 ring-amber-500/20'
                        : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-amber-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5 text-amber-500" />
                          3. Exact Value Deduction
                        </span>
                        {draftLateness.calculationType === 'exact_value' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-mono text-[9px] font-bold">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Deducts a fixed penalty amount per late arrival (e.g. {currencySymbol}15 per incident).
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">Exact Value:</span>
                      <div
                        className="flex items-center gap-1 font-mono font-bold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-amber-600 dark:text-amber-400">{currencySymbol}</span>
                        <input
                          type="number"
                          min="0"
                          step="5"
                          disabled={!canEdit}
                          value={draftLateness.exactAmount ?? 15}
                          onChange={(e) =>
                            setDraftLateness((prev) => ({
                              ...prev,
                              exactAmount: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-18 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                        />
                        <span className="text-slate-400">/ incident</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Example Callout */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-amber-200/80 dark:border-amber-900/60 flex items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start sm:items-center gap-2">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="text-slate-600 dark:text-slate-300">
                    {draftLateness.calculationType === 'day_calculation' ? (
                      draftLateness.useSalaryDailyRate !== false ? (
                        <>
                          <strong>Formula Preview:</strong> For a staff member with a{' '}
                          <strong>{currencySymbol}3,100</strong> base salary late for{' '}
                          <strong>3 days</strong> in a 31-day month, deduction is{' '}
                          <strong className="font-mono text-rose-600 dark:text-rose-400">
                            ({currencySymbol}3,100 ÷ 31) × 3 = {currencySymbol}300.00
                          </strong>.
                        </>
                      ) : (
                        <>
                          <strong>Formula Preview:</strong> For a staff member late for{' '}
                          <strong>3 days</strong> at fixed daily rate, deduction is{' '}
                          <strong className="font-mono text-rose-600 dark:text-rose-400">
                            {currencySymbol}{draftLateness.rigidDailyAmount || 15} × 3 = {currencySymbol}
                            {((draftLateness.rigidDailyAmount || 15) * 3).toFixed(2)}
                          </strong>.
                        </>
                      )
                    ) : draftLateness.calculationType === 'percentage' ? (
                      <>
                        <strong>Formula Preview:</strong> For a staff member with a{' '}
                        <strong>{currencySymbol}3,100</strong> base salary late for{' '}
                        <strong>3 arrivals</strong> at {draftLateness.percentageRate || 1}%, deduction is{' '}
                        <strong className="font-mono text-rose-600 dark:text-rose-400">
                          ({draftLateness.percentageRate || 1}% of {currencySymbol}3,100) × 3 = {currencySymbol}
                          {(((3100 * (draftLateness.percentageRate || 1)) / 100) * 3).toFixed(2)}
                        </strong>.
                      </>
                    ) : (
                      <>
                        <strong>Formula Preview:</strong> For any staff member late for{' '}
                        <strong>3 arrivals</strong>, exact deduction is{' '}
                        <strong className="font-mono text-rose-600 dark:text-rose-400">
                          {currencySymbol}{draftLateness.exactAmount || 15} × 3 = {currencySymbol}
                          {((draftLateness.exactAmount || 15) * 3).toFixed(2)}
                        </strong>.
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ACTION BUTTONS: CLOSE / SAVE */}
          <div className="pt-3 border-t border-amber-200/80 dark:border-amber-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Click <strong>Save</strong> to commit policy updates to payroll calculations, or <strong>Close</strong> to discard changes.
            </p>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                id="default-deduction-close-btn"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                Close (Discard)
              </button>

              {canEdit && (
                <button
                  type="button"
                  id="default-deduction-save-btn"
                  onClick={handleSave}
                  className="px-4.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/30 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Policy</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
