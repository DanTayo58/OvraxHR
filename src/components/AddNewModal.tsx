import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ProjectFile, AttendanceRecord, AppSettings } from '../types';
import { parseBiometricAttendanceFile } from '../utils/excelAttendanceParser';
import {
  X,
  FileSpreadsheet,
  Calendar,
  Users,
  Sliders,
  Plus,
  Trash2,
  CheckCircle2,
  Layers,
  Upload,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface AddNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: ProjectFile) => void;
  existingProjects?: ProjectFile[];
  settings?: AppSettings;
}

export const AddNewModal: React.FC<AddNewModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  existingProjects = [],
  settings,
}) => {
  const [fileName, setFileName] = useState('');
  const [selectedMonthYear, setSelectedMonthYear] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [error, setError] = useState<string | null>(null);
  const [importedRecords, setRecords] = useState<AttendanceRecord[]>([]);
  const [importedStaffCount, setStaffCount] = useState<number>(0);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Custom non-date columns (e.g. Full Name, Employee ID, Check-In, Check-Out)
  const [customColumns, setCustomColumns] = useState<string[]>([
    'Full Name',
    'Employee ID',
    'Check-In',
    'Check-Out',
  ]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setError(null);
    setSuccessInfo(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseBiometricAttendanceFile(buffer, file.name, selectedMonthYear);

      if (!fileName) {
        setFileName(parsed.fileName);
      }
      setRecords(parsed.records);
      setStaffCount(parsed.staffCount);
      setSuccessInfo(
        `Successfully extracted ${parsed.staffCount} staff members and ${parsed.records.length} punch records from biometric report.`
      );
    } catch (err: any) {
      console.error('File extraction error:', err);
      setError(`Failed to extract data: ${err.message || 'Unknown format'}`);
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Calculate days in selected month
  const getDaysInMonth = (monthYearStr: string) => {
    const [year, month] = monthYearStr.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(selectedMonthYear);

  const handleAddColumn = () => {
    setCustomColumns([...customColumns, `Header ${customColumns.length + 1}`]);
  };

  const handleUpdateColumn = (index: number, val: string) => {
    const updated = [...customColumns];
    updated[index] = val;
    setCustomColumns(updated);
  };

  const handleRemoveColumn = (index: number) => {
    if (customColumns.length <= 1) return;
    setCustomColumns(customColumns.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawName = fileName.trim();
    if (!rawName) {
      setError('Please enter a worksheet file name.');
      return;
    }

    const formattedName = rawName.endsWith('.csv') ? rawName : `${rawName}.csv`;

    // Check for duplicate file name
    const isDuplicate = existingProjects.some(
      (p) => p.name.toLowerCase() === formattedName.toLowerCase()
    );

    if (isDuplicate) {
      setError(
        `A file named "${formattedName}" already exists. Duplicate file names are blocked to prevent confusion.`
      );
      return;
    }

    // Check for duplicate Month-Year worksheet mapping
    const existingSameMonth = existingProjects.find(
      (p) => p.monthYear === selectedMonthYear
    );
    if (existingSameMonth) {
      setError(
        `An attendance worksheet for ${selectedMonthYear} already exists ("${existingSameMonth.name}"). Only one attendance worksheet can be mapped to each month/year to prevent conflict.`
      );
      return;
    }

    const configuredExtra =
      Array.isArray(settings?.extraColumns)
        ? settings.extraColumns
        : Array.isArray(settings?.defaultColumns)
        ? settings.defaultColumns
        : ['Shift Type', 'Supervisor Notes'];

    const newProject: ProjectFile = {
      id: `proj-${Date.now()}`,
      name: formattedName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isLocked: false,
      lockPassword: '',
      monthYear: selectedMonthYear,
      daysInMonth: daysInMonth,
      staffCount: importedStaffCount || 0,
      customColumns: customColumns,
      fileExtraColumns: configuredExtra,
      category: 'General Attendance',
      records: importedRecords,
    };

    onCreateProject(newProject);
    setFileName('');
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl max-h-[90vh] rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-2xl overflow-y-auto p-6 md:p-8 space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Create New Time Attendance File</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Skima Monthly Matrix & Header Mapping
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Upload Excel / CSV Attendance Machine Export */}
            <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-2">
              <label className="block text-xs font-semibold text-blue-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-blue-400" />
                Upload Biometric Machine File (.xlsx, .xls, .csv, .tsv)
              </label>
              <p className="text-[11px] text-slate-400">
                Upload your attendance machine exported file directly to automatically extract employee punches, clock-ins, and clock-outs.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600/30 file:text-blue-300 file:border file:border-blue-500/30 hover:file:bg-blue-600/50 cursor-pointer"
              />
              {isProcessingFile && (
                <p className="text-xs text-blue-400 font-mono flex items-center gap-1.5 pt-1">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  Parsing biometric attendance log timestamps...
                </p>
              )}
              {successInfo && (
                <p className="text-xs text-emerald-400 font-mono flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {successInfo}
                </p>
              )}
            </div>

            {/* File Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                Worksheet File Name (.csv)
              </label>
              <input
                type="text"
                required
                value={fileName}
                onChange={(e) => {
                  setFileName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. August 2026 Staff Attendance.csv"
                className="w-full px-4 py-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white outline-none focus:border-blue-500 text-sm"
              />
            </div>

            {/* Month & Year Selection + Days Count Auto Calculation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  Select Month & Year
                </label>
                <input
                  type="month"
                  required
                  value={selectedMonthYear}
                  onChange={(e) => setSelectedMonthYear(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl bg-slate-800/90 border text-white outline-none text-sm font-mono ${
                    existingProjects.some((p) => p.monthYear === selectedMonthYear)
                      ? 'border-amber-500 focus:border-amber-400'
                      : 'border-slate-700 focus:border-blue-500'
                  }`}
                />
                {existingProjects.some((p) => p.monthYear === selectedMonthYear) && (
                  <p className="text-[11px] text-amber-400 font-mono mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>A worksheet for {selectedMonthYear} already exists ({existingProjects.find((p) => p.monthYear === selectedMonthYear)?.name}).</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  Days in Selected Month
                </label>
                <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-bold font-mono text-sm flex items-center justify-between">
                  <span>{daysInMonth} Days Auto-Calculated</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Day 1 .. Day {daysInMonth}
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Excel / CSV Column Entry (Non-date headers) */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    Column Headers ({customColumns.length} Fields)
                  </label>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Staff records and timestamps will be dynamically parsed inside the workspace matrix.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 text-xs font-bold border border-blue-500/40 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Column
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                {customColumns.map((col, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-500 w-5">{idx + 1}.</span>
                    <input
                      type="text"
                      value={col}
                      onChange={(e) => handleUpdateColumn(idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-mono outline-none focus:border-blue-500"
                    />
                    {customColumns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(idx)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-800/80 text-xs text-red-300 font-mono">
                {error}
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Create Monthly File</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
