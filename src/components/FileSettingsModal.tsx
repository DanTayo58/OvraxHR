import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ProjectFile, AppSettings } from '../types';
import {
  X,
  FileSpreadsheet,
  Clock,
  Sliders,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Lock,
  Unlock,
  Building,
  Calendar,
  Layers,
} from 'lucide-react';

interface FileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectFile;
  onSaveFileSettings: (updatedProject: ProjectFile) => void;
  isLight?: boolean;
  settings?: AppSettings;
}

export const FileSettingsModal: React.FC<FileSettingsModalProps> = ({
  isOpen,
  onClose,
  project,
  onSaveFileSettings,
  isLight = false,
  settings,
}) => {
  const [fileName, setFileName] = useState(project.name);
  const [resumptionTime, setResumptionTime] = useState(
    project.fileResumptionTime || settings?.resumptionTime || '08:00'
  );
  const [closingTime, setClosingTime] = useState(
    project.fileClosingTime || settings?.closingTime || '17:00'
  );
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState<number>(
    project.fileGracePeriodMinutes || settings?.gracePeriodMinutes || 15
  );

  // Extra Custom Columns (separated from mandatory system columns)
  const [extraColumns, setExtraColumns] = useState<string[]>(
    project.fileExtraColumns || project.customColumns || ['Shift Type', 'Supervisor Notes']
  );

  const [isLocked, setIsLocked] = useState(project.isLocked || false);
  const [lockPassword, setLockPassword] = useState(project.lockPassword || '');

  if (!isOpen) return null;

  const activeShifts = settings?.shifts || [
    {
      id: 'shift-dynamic-default',
      name: 'Dynamic Shift',
      startTime: 'Auto',
      endTime: 'Auto',
      gracePeriodMinutes: gracePeriodMinutes,
      isDefault: true,
    },
    {
      id: 'shift-1',
      name: 'Morning Shift',
      startTime: '08:00',
      endTime: '17:00',
      gracePeriodMinutes: 15,
    },
  ];

  const handleAddExtraColumn = () => {
    setExtraColumns([...extraColumns, `Supervisor Note ${extraColumns.length + 1}`]);
  };

  const handleUpdateExtraColumn = (idx: number, val: string) => {
    const updated = [...extraColumns];
    updated[idx] = val;
    setExtraColumns(updated);
  };

  const handleRemoveExtraColumn = (idx: number) => {
    setExtraColumns(extraColumns.filter((_, i) => i !== idx));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const formattedName = fileName.trim()
      ? fileName.endsWith('.csv')
        ? fileName
        : `${fileName}.csv`
      : project.name;

    const updatedProject: ProjectFile = {
      ...project,
      name: formattedName,
      fileResumptionTime: resumptionTime,
      fileClosingTime: closingTime,
      fileGracePeriodMinutes: gracePeriodMinutes,
      fileExtraColumns: extraColumns.filter((c) => c.trim() !== ''),
      customColumns: extraColumns.filter((c) => c.trim() !== ''),
      isLocked,
      lockPassword: isLocked ? lockPassword : '',
      updatedAt: new Date().toISOString(),
    };

    onSaveFileSettings(updatedProject);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className={`relative w-full max-w-2xl max-h-[90vh] rounded-3xl border shadow-2xl overflow-y-auto p-6 md:p-8 space-y-6 ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-slate-900 border-slate-800 text-white'
          }`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between pb-4 border-b ${
              isLight ? 'border-slate-200' : 'border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl border ${
                  isLight
                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                    : 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                }`}
              >
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3
                  className={`font-bold text-lg ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  Worksheet Properties & Dynamic Shift Policy
                </h3>
                <p
                  className={`text-xs font-mono ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Configuring settings exclusively for:{' '}
                  <span className="text-blue-500 font-bold">{project.name}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* File Name */}
            <div>
              <label
                className={`block text-xs font-semibold uppercase tracking-wider mb-1 font-mono ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                Worksheet File Name
              </label>
              <input
                type="text"
                required
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border font-mono text-xs outline-none focus:border-blue-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-slate-800 border-slate-700 text-white'
                }`}
              />
            </div>

            {/* Configured Multi-Shift Policy Overview */}
            <div
              className={`space-y-3 pt-4 border-t ${
                isLight ? 'border-slate-200' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <label
                  className={`text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-1.5 ${
                    isLight ? 'text-slate-700' : 'text-slate-300'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  Active System Shift Policies ({activeShifts.length} Shift Schemes Configured)
                </label>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/10 text-teal-600 dark:text-teal-300 border border-teal-500/30 uppercase">
                  Dynamic Roster Active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeShifts.map((sh) => (
                  <div
                    key={sh.id}
                    className={`p-3 rounded-2xl border text-xs font-mono space-y-1 ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-800'
                        : 'bg-slate-950 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {sh.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {sh.gracePeriodMinutes}m Grace
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Hours: {sh.startTime} - {sh.endTime}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Extra Custom Columns (Notes, Jottings, Supervisor Comments) */}
            <div
              className={`space-y-3 pt-4 border-t ${
                isLight ? 'border-slate-200' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <label
                    className={`block text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-1.5 ${
                      isLight ? 'text-slate-700' : 'text-slate-300'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 text-blue-500" />
                    Extra Custom Columns ({extraColumns.length} Custom Fields)
                  </label>
                  <p
                    className={`text-[11px] leading-relaxed mt-1 ${
                      isLight ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    System mandatory columns (<strong className={isLight ? 'text-slate-900' : 'text-white'}>Full Name, ID, Department, Check-In, Check-Out, Leave/Off Log</strong>) are maintained automatically. Any extra custom columns below are designed for <strong>notes, supervisor comments, jottings, and custom remarks</strong>.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {extraColumns.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExtraColumns([])}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/30 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Remove all extra custom columns"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddExtraColumn}
                    className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-600 dark:text-blue-300 text-xs font-bold border border-blue-500/40 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Column
                  </button>
                </div>
              </div>

              {extraColumns.length === 0 ? (
                <div
                  className={`p-4 rounded-xl border text-center text-xs font-mono ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-500'
                      : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                >
                  No extra custom columns configured. Only system mandatory columns will be rendered.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-40 overflow-y-auto p-1">
                  {extraColumns.map((col, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-mono w-5 ${
                          isLight ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={col}
                        onChange={(e) => handleUpdateExtraColumn(idx, e.target.value)}
                        placeholder="e.g. Supervisor Notes / Jottings"
                        className={`flex-1 px-3 py-1.5 rounded-lg border text-xs font-mono outline-none focus:border-blue-500 ${
                          isLight
                            ? 'bg-slate-50 border-slate-300 text-slate-900'
                            : 'bg-slate-800 border-slate-700 text-white'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraColumn(idx)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isLight
                            ? 'bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 border-slate-200'
                            : 'bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 border-slate-700'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* File Security / Lock Toggle */}
            <div
              className={`space-y-3 pt-4 border-t ${
                isLight ? 'border-slate-200' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <label
                    className={`block text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-1.5 ${
                      isLight ? 'text-slate-700' : 'text-slate-300'
                    }`}
                  >
                    {isLocked ? (
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    File Access Protection Lock
                  </label>
                  <p
                    className={`text-[11px] ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Require password verification before opening or viewing this file's contents.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLocked(!isLocked)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                    isLocked
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40'
                      : isLight
                      ? 'bg-slate-100 text-slate-600 border border-slate-300'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isLocked ? 'Protected (Locked)' : 'Unlocked'}
                </button>
              </div>

              {isLocked && (
                <div>
                  <label
                    className={`block text-[11px] font-mono mb-1 ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Set File Access Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter file lock password..."
                    value={lockPassword}
                    onChange={(e) => setLockPassword(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none focus:border-amber-500 ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900'
                        : 'bg-slate-800 border-slate-700 text-white'
                    }`}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div
              className={`pt-4 flex items-center justify-end gap-3 border-t ${
                isLight ? 'border-slate-200' : 'border-slate-800'
              }`}
            >
              <button
                type="button"
                onClick={onClose}
                className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save File Configurations</span>
              </button>
            </div>
          </form>

          {/* Modal for Save Preset Name Input */}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

