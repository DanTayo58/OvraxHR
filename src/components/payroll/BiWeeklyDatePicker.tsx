import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, AlertCircle, Info } from 'lucide-react';

const DAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface BiWeeklyDatePickerProps {
  selectedDate?: string;
  value?: string;
  selectedDayOfWeek: string; // 'Monday' | 'Tuesday' | etc.
  onChange: (date: string) => void;
  isLight?: boolean;
}

export const BiWeeklyDatePicker: React.FC<BiWeeklyDatePickerProps> = ({
  selectedDate,
  value,
  selectedDayOfWeek,
  onChange,
  isLight = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveDate = value !== undefined ? value : (selectedDate || '');
  const targetDayIndex = DAY_MAP[selectedDayOfWeek] ?? 5; // Default Friday (5)

  // Current view month & year for calendar navigation
  const initialDate = useMemo(() => {
    const d = new Date(effectiveDate);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [effectiveDate]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Auto-align effectiveDate if it doesn't match selectedDayOfWeek
  useEffect(() => {
    if (!effectiveDate) {
      const today = new Date();
      const currentDay = today.getDay();
      const diff = (targetDayIndex - currentDay + 7) % 7;
      today.setDate(today.getDate() + diff);
      const aligned = today.toISOString().split('T')[0];
      onChange(aligned);
      return;
    }

    const current = new Date(effectiveDate);
    if (!isNaN(current.getTime()) && current.getDay() !== targetDayIndex) {
      // Find nearest next matching day
      const currentDay = current.getDay();
      const diff = (targetDayIndex - currentDay + 7) % 7;
      current.setDate(current.getDate() + (diff === 0 ? 7 : diff));
      const aligned = current.toISOString().split('T')[0];
      onChange(aligned);
    }
  }, [selectedDayOfWeek, targetDayIndex]);

  // Close calendar on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isValidDayOfWeek: boolean;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month filler days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonthYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const prevMonthIndex = viewMonth === 0 ? 11 : viewMonth - 1;
      const d = new Date(prevMonthYear, prevMonthIndex, dayNum);
      const dateStr = d.toISOString().split('T')[0];
      const isValid = d.getDay() === targetDayIndex;

      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isValidDayOfWeek: isValid,
        isSelected: dateStr === effectiveDate,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const d = new Date(viewYear, viewMonth, dayNum);
      const dateStr = d.toISOString().split('T')[0];
      const isValid = d.getDay() === targetDayIndex;

      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isValidDayOfWeek: isValid,
        isSelected: dateStr === effectiveDate,
        isToday: dateStr === todayStr,
      });
    }

    // Next month filler days to complete grid (multiples of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const nextMonthIndex = viewMonth === 11 ? 0 : viewMonth + 1;
      const d = new Date(nextMonthYear, nextMonthIndex, dayNum);
      const dateStr = d.toISOString().split('T')[0];
      const isValid = d.getDay() === targetDayIndex;

      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isValidDayOfWeek: isValid,
        isSelected: dateStr === effectiveDate,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [viewYear, viewMonth, targetDayIndex, effectiveDate]);

  // Selected date formatted readable
  const formattedSelected = useMemo(() => {
    if (!effectiveDate) return 'Select date';
    const d = new Date(effectiveDate);
    if (isNaN(d.getTime())) return effectiveDate;
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [effectiveDate]);

  // Quick Select: Jump to nearest upcoming matching day
  const handleSelectUpcoming = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = (targetDayIndex - currentDay + 7) % 7;
    today.setDate(today.getDate() + (diff === 0 ? 0 : diff));
    const nextDateStr = today.toISOString().split('T')[0];
    onChange(nextDateStr);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-bold flex items-center justify-between transition cursor-pointer shadow-xs ${
          isOpen
            ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300'
            : isLight
            ? 'bg-white border-slate-300 text-slate-900 hover:border-purple-400'
            : 'bg-slate-800 border-slate-700 text-white hover:border-purple-500'
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarIcon className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          <span>{formattedSelected}</span>
        </span>
        <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 shrink-0">
          Only {selectedDayOfWeek}s
        </span>
      </button>

      {/* Calendar Popover */}
      {isOpen && (
        <div
          className={`absolute left-0 sm:right-0 sm:left-auto mt-2 w-80 p-4 rounded-2xl border shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900 shadow-purple-900/10'
              : 'bg-slate-900 border-slate-800 text-white shadow-black/80'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="font-bold text-xs flex items-center gap-1.5">
              <span>{MONTH_NAMES[viewMonth]}</span>
              <span className="font-mono text-purple-600 dark:text-purple-400">{viewYear}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Guide Banner */}
          <div className="my-2.5 p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 text-purple-500" />
            <span>
              Only <strong>{selectedDayOfWeek}s</strong> can anchor this bi-weekly roll cycle.
            </span>
          </div>

          {/* Day of Week Labels */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] font-bold text-slate-400 mb-1">
            {DAY_NAMES_SHORT.map((name, idx) => {
              const isTargetCol = idx === targetDayIndex;
              return (
                <div
                  key={name}
                  className={`py-1 rounded ${
                    isTargetCol
                      ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300 font-black'
                      : ''
                  }`}
                >
                  {name}
                </div>
              );
            })}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((d, index) => {
              if (d.isValidDayOfWeek) {
                // Enabled matching day cell
                return (
                  <button
                    key={`${d.dateStr}-${index}`}
                    type="button"
                    onClick={() => {
                      onChange(d.dateStr);
                      setIsOpen(false);
                    }}
                    className={`h-8 rounded-lg text-xs font-mono font-bold flex items-center justify-center transition cursor-pointer relative ${
                      d.isSelected
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40 ring-2 ring-purple-400'
                        : isLight
                        ? 'bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200'
                        : 'bg-purple-950/50 hover:bg-purple-900/60 text-purple-200 border border-purple-800/60'
                    }`}
                    title={`Select ${d.dateStr} (${selectedDayOfWeek})`}
                  >
                    <span>{d.dayNumber}</span>
                    {d.isToday && (
                      <span className="w-1 h-1 rounded-full bg-emerald-400 absolute bottom-1"></span>
                    )}
                  </button>
                );
              }

              // Disabled non-matching day cell
              return (
                <div
                  key={`${d.dateStr}-${index}`}
                  className={`h-8 rounded-lg text-xs font-mono flex items-center justify-center cursor-not-allowed select-none transition ${
                    d.isCurrentMonth
                      ? 'text-slate-300 dark:text-slate-700 opacity-40'
                      : 'text-slate-200 dark:text-slate-800 opacity-20'
                  }`}
                  title={`Only ${selectedDayOfWeek}s can be selected`}
                >
                  <span>{d.dayNumber}</span>
                </div>
              );
            })}
          </div>

          {/* Footer Quick Action */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSelectUpcoming}
              className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
            >
              Select Upcoming {selectedDayOfWeek}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer px-2 py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
