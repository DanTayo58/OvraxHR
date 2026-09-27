import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StaffMember } from '../types';
import {
  Bell,
  Cake,
  Calendar,
  Sparkles,
  Copy,
  Check,
  X,
  Mail,
  ChevronRight,
  ArrowLeft,
  CircleAlert,
  Wallet,
  Clock,
  CheckCheck,
  Gift,
  ExternalLink,
  FileQuestion,
  AlertTriangle,
} from 'lucide-react';
import { emitGlobalToast } from '../context/ToastContext';
import {
  loadCompanyPayrollConfig,
  getActiveFrequenciesOnDate,
  getNextRollDateForFrequency,
  parseLocalDate,
  formatLocalDate,
} from '../utils/payrollUtils';
import { loadCompanyQueries } from '../utils/staffUtils';

export interface AppNotification {
  id: string;
  type: 'payroll' | 'birthday' | 'query';
  title: string;
  summary: string;
  fullMessage: string;
  dateStr: string; // e.g. '2026-09-08'
  relativeLabel: string; // e.g. 'Today', 'Tomorrow', 'In 3 days'
  priority: 'urgent' | 'high' | 'normal';
  staff?: StaffMember;
  payrollFrequency?: string;
  queryId?: string;
  queryDeadlineAt?: string;
  queryHoursRemaining?: number;
  queryStatus?: 'pending' | 'closed';
  actions?: Array<{
    label: string;
    action: () => void;
    icon?: string;
  }>;
}

interface NotificationBellProps {
  staffList: StaffMember[];
  isLight?: boolean;
  className?: string;
  companyName?: string;
  onNavigateToPayroll?: () => void;
  onNavigateToWelfare?: () => void;
  onOpenStaffQuery?: (staffId: string, queryId?: string) => void;
}

const READ_NOTIFS_STORAGE_KEY = 'skima_read_notification_ids';

export const NotificationBell: React.FC<NotificationBellProps> = ({
  staffList = [],
  isLight = false,
  className = '',
  companyName,
  onNavigateToPayroll,
  onNavigateToWelfare,
  onOpenStaffQuery,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'payroll' | 'birthday' | 'query'>('all');
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Local storage for read notification IDs
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(READ_NOTIFS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const popoverRef = useRef<HTMLDivElement>(null);

  // Save read IDs
  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(READ_NOTIFS_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save read notifications', e);
      }
      return next;
    });
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    const combined = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(combined);
    try {
      localStorage.setItem(READ_NOTIFS_STORAGE_KEY, JSON.stringify(combined));
    } catch (e) {
      console.error('Failed to save read notifications', e);
    }
    emitGlobalToast('All notifications marked as read', 'success');
  };

  const markAsUnread = (id: string) => {
    setReadIds((prev) => {
      const next = prev.filter((i) => i !== id);
      try {
        localStorage.setItem(READ_NOTIFS_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save read notifications', e);
      }
      return next;
    });
  };

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectedNotificationId(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Load Payroll Configuration to calculate roll dates
  const payrollConfig = useMemo(() => {
    return loadCompanyPayrollConfig(companyName);
  }, [companyName, isOpen]);

  // Generate All Real Notifications (Birthdays + Payroll Run Dates)
  const notifications: AppNotification[] = useMemo(() => {
    const notifs: AppNotification[] = [];
    const now = new Date();
    const todayStr = formatLocalDate(now);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // ==========================================
    // 1. PAYROLL RUN NOTIFICATIONS
    // ==========================================
    const rollRules = payrollConfig.rollRules;

    // Check if payroll runs TODAY
    const dueToday = getActiveFrequenciesOnDate(todayStr, rollRules);
    if (dueToday.length > 0) {
      const freqLabels = dueToday.join(' & ');
      notifs.push({
        id: `payroll-due-today-${todayStr}`,
        type: 'payroll',
        title: `💰 Payroll Due Today: ${freqLabels} Run`,
        summary: `The scheduled ${freqLabels} payroll is due for execution and disbursement today.`,
        fullMessage: `Corporate payroll configuration designates today (${dayNames[now.getDay()]}, ${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}) as the scheduled roll date for ${freqLabels} payroll. Please review attendance days, deductions, bonuses, and process disbursements in the Payroll Workspace.`,
        dateStr: todayStr,
        relativeLabel: 'Today',
        priority: 'urgent',
        payrollFrequency: freqLabels,
      });
    }

    // Check upcoming payroll runs: ONLY 5 days before the next payroll
    const allFrequencies: Array<'Weekly' | 'Bi-Weekly' | 'Monthly'> = ['Weekly', 'Bi-Weekly', 'Monthly'];
    allFrequencies.forEach((freq) => {
      // If not already due today, see when next roll is
      if (!dueToday.includes(freq)) {
        const nextRollDate = getNextRollDateForFrequency(freq, now, rollRules);
        if (nextRollDate) {
          const rollD = parseLocalDate(nextRollDate);
          const diffMs = rollD.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

          // User explicit request: notification for payroll comes 5 days before the next payroll
          if (diffDays === 5) {
            notifs.push({
              id: `payroll-upcoming-5days-${freq}-${nextRollDate}`,
              type: 'payroll',
              title: `🗓️ Upcoming Payroll: ${freq} Cycle in 5 Days`,
              summary: `${freq} payroll run is scheduled in 5 days (${nextRollDate}).`,
              fullMessage: `Notice: The corporate ${freq} payroll cycle is scheduled for execution in 5 days on ${nextRollDate}. Please verify attendance records, pending leave approvals, overtime adjustments, and corporate deductions before the roll date.`,
              dateStr: nextRollDate,
              relativeLabel: 'In 5 days',
              priority: 'high',
              payrollFrequency: freq,
            });
          }
        }
      }
    });

    // ==========================================
    // 2. BIRTHDAY NOTIFICATIONS
    // ==========================================
    const activeStaff = (staffList || []).filter((s) => s.status !== 'Exited');
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayMidnight = new Date(currentYear, currentMonth, now.getDate()).getTime();

    activeStaff.forEach((st) => {
      if (!st.dob || !st.dob.trim()) return;

      const parts = st.dob.split(/[-/]/);
      let bYear: number | null = null;
      let bMonth: number;
      let bDay: number;

      if (parts.length === 3) {
        if (parts[0].length === 4) {
          bYear = parseInt(parts[0], 10);
          bMonth = parseInt(parts[1], 10) - 1;
          bDay = parseInt(parts[2], 10);
        } else {
          bDay = parseInt(parts[0], 10);
          bMonth = parseInt(parts[1], 10) - 1;
          bYear = parseInt(parts[2], 10);
        }
      } else {
        const parsedD = new Date(st.dob);
        if (isNaN(parsedD.getTime())) return;
        bYear = parsedD.getFullYear();
        bMonth = parsedD.getMonth();
        bDay = parsedD.getDate();
      }

      if (isNaN(bMonth) || isNaN(bDay) || bMonth < 0 || bMonth > 11 || bDay < 1 || bDay > 31) return;

      let nextBday = new Date(currentYear, bMonth, bDay);
      if (nextBday.getTime() < todayMidnight) {
        nextBday = new Date(currentYear + 1, bMonth, bDay);
      }

      const diffDays = Math.round((nextBday.getTime() - todayMidnight) / (1000 * 60 * 60 * 24));
      const turningAge = bYear ? nextBday.getFullYear() - bYear : null;
      const bDateStr = `${monthNames[bMonth]} ${bDay}`;

      // Show birthdays on the day of the birthday
      if (diffDays === 0) {
        notifs.push({
          id: `birthday-today-${st.id}-${currentYear}`,
          type: 'birthday',
          title: `🎂 Staff Birthday Today: ${st.name}`,
          summary: `${st.name} (${st.role || 'Staff'}) is celebrating their birthday today!`,
          fullMessage: `Today is ${st.name}'s birthday (${bDateStr}${turningAge ? `, turning ${turningAge} years old` : ''})! Take a moment to share a warm celebration greeting or grant them their birthday welfare voucher.`,
          dateStr: todayStr,
          relativeLabel: 'Today',
          priority: 'urgent',
          staff: st,
        });
      }
    });

    // 3. STAFF DISCIPLINARY QUERIES NOTIFICATIONS
    try {
      const companyQueries = loadCompanyQueries(companyName);
      const nowMs = Date.now();

      companyQueries.forEach((query) => {
        const staff = staffList.find((s) => s.id === query.staffId || s.employeeId === query.staffId);
        const deadlineMs = new Date(query.deadlineAt).getTime();
        const diffHours = (deadlineMs - nowMs) / (1000 * 60 * 60);

        if (query.status === 'pending') {
          // Awaiting response notification
          const roundedHours = Math.max(0, Math.ceil(diffHours));
          const isUrgentLastHour = diffHours <= 1 && diffHours > 0;
          const isPastDeadline = diffHours <= 0;

          if (isPastDeadline) {
            // Expired/Ready for closure notification
            notifs.push({
              id: `query-expired-${query.id}`,
              type: 'query',
              title: `⚠️ Action Required: "${query.title}" Deadline Passed`,
              summary: `Query for ${query.staffName} has elapsed. It will now be marked as closed upon your review.`,
              fullMessage: `The ${query.deadlineHours}-hour window for "${query.title}" (Staff: ${query.staffName}) has concluded. As per HR workflow, please review the uploaded response (if any) and proceed with the next disciplinary action: Fines, Suspension, Warning (max 3/year), Exit, or Pardon.`,
              dateStr: query.deadlineAt ? query.deadlineAt.split('T')[0] : todayStr,
              relativeLabel: 'Past Due',
              priority: 'urgent',
              staff,
              queryId: query.id,
              queryDeadlineAt: query.deadlineAt,
              queryHoursRemaining: 0,
              queryStatus: query.status,
            });
          } else if (isUrgentLastHour) {
            // 1-hour before deadline urgent notification
            notifs.push({
              id: `query-last-hour-${query.id}`,
              type: 'query',
              title: `🚨 1 Hour Remaining: "${query.title}"`,
              summary: `Query for ${query.staffName} ends in less than 1 hour. Action required soon.`,
              fullMessage: `Final reminder: The disciplinary query "${query.title}" issued to ${query.staffName} (${query.department}) is concluding in less than 1 hour. Once expired, you will be prompted to select the next action (Fine, Suspension, Official Warning, Exit, or Pardon).`,
              dateStr: todayStr,
              relativeLabel: 'In 1 hr',
              priority: 'urgent',
              staff,
              queryId: query.id,
              queryDeadlineAt: query.deadlineAt,
              queryHoursRemaining: 1,
              queryStatus: query.status,
            });
          } else {
            // General awaiting response notification
            notifs.push({
              id: `query-awaiting-${query.id}`,
              type: 'query',
              title: `"${query.title}" is now awaiting response in ${roundedHours}hrs`,
              summary: `Disciplinary query for ${query.staffName}. Deadline in ${roundedHours} hours.`,
              fullMessage: `"${query.title}" is now awaiting response in ${roundedHours}hrs. It will be marked as closed after ${query.deadlineHours} hours and you will be asked for the next action (fines, suspension, warning, exit, or pardon). Warnings are strictly capped at 3 per staff member per calendar year.`,
              dateStr: query.issuedAt ? query.issuedAt.split('T')[0] : todayStr,
              relativeLabel: `${roundedHours}h left`,
              priority: roundedHours <= 12 ? 'urgent' : 'high',
              staff,
              queryId: query.id,
              queryDeadlineAt: query.deadlineAt,
              queryHoursRemaining: roundedHours,
              queryStatus: query.status,
            });
          }
        }
      });
    } catch (e) {
      console.error('Error generating query notifications:', e);
    }

    // Sort: Urgent/Today first, then by priority, then chronological
    return notifs.sort((a, b) => {
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
      if (a.priority === 'high' && b.priority === 'normal') return -1;
      if (b.priority === 'high' && a.priority === 'normal') return 1;
      return a.dateStr.localeCompare(b.dateStr);
    });
  }, [payrollConfig, staffList]);

  // Compute unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readIds.includes(n.id)).length;
  }, [notifications, readIds]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const isRead = readIds.includes(n.id);
      if (activeFilter === 'unread') return !isRead;
      if (activeFilter === 'query') return n.type === 'query';
      if (activeFilter === 'payroll') return n.type === 'payroll';
      if (activeFilter === 'birthday') return n.type === 'birthday';
      return true;
    });
  }, [notifications, activeFilter, readIds]);

  // Selected Notification for viewing full message
  const selectedNotification = useMemo(() => {
    if (!selectedNotificationId) return null;
    return notifications.find((n) => n.id === selectedNotificationId) || null;
  }, [notifications, selectedNotificationId]);

  // Handle clicking a notification item: marks it as read and opens full message
  const handleSelectNotification = (n: AppNotification) => {
    markAsRead(n.id);
    setSelectedNotificationId(n.id);
  };

  const handleCopyWish = (st: StaffMember) => {
    const wish = `🎉 Wishing a very Happy Birthday to ${st.name}! Thank you for all your hard work and dedication at our organization. Have a joyful celebration and a prosperous year ahead! 🎂✨`;
    navigator.clipboard.writeText(wish);
    setCopiedId(st.id);
    emitGlobalToast(`Copied birthday greeting for ${st.name}!`, 'success');
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={popoverRef}>
      {/* The Notification Bell Trigger */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSelectedNotificationId(null);
        }}
        className={`relative p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-blue-600 text-white border-blue-500 shadow-md ring-2 ring-blue-400/30'
            : isLight
            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/80'
        }`}
        title="Notifications (Birthdays & Payroll Schedules)"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />

        {/* Unread Badge Counter */}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-4 h-4 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Standard Notification Center Dropdown */}
      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-96 max-w-[92vw] rounded-2xl shadow-2xl border z-50 overflow-hidden flex flex-col transition-all duration-150 ${
            isLight
              ? 'bg-white border-slate-200 text-slate-800'
              : 'bg-slate-900 border-slate-800 text-slate-100 shadow-black/80'
          }`}
          style={{ maxHeight: '580px' }}
        >
          {/* HEADER */}
          <div
            className={`p-3.5 border-b flex items-center justify-between gap-2 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
            }`}
          >
            {selectedNotification ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedNotificationId(null)}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    isLight ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Back to all notifications"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold">Message Details</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold leading-tight flex items-center gap-1.5">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold border border-rose-500/20">
                        {unreadCount} unread
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-400">Payroll schedules & staff birthdays</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1">
              {!selectedNotification && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                    isLight
                      ? 'text-blue-600 hover:bg-blue-50'
                      : 'text-blue-400 hover:bg-blue-900/30'
                  }`}
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSelectedNotificationId(null);
                }}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* VIEW 1: SINGLE MESSAGE DETAIL VIEW (When clicked, opens up and is read) */}
          {selectedNotification ? (
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedNotification.type === 'payroll'
                        ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                    }`}
                  >
                    {selectedNotification.type === 'payroll' ? (
                      <Wallet className="w-5 h-5" />
                    ) : (
                      <Cake className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        selectedNotification.type === 'payroll'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      }`}
                    >
                      {selectedNotification.type === 'payroll' ? 'Payroll Alert' : 'Staff Birthday'}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-2 font-mono">
                      {selectedNotification.relativeLabel} ({selectedNotification.dateStr})
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => markAsUnread(selectedNotification.id)}
                  className={`text-[10px] font-medium transition cursor-pointer ${
                    isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Mark as unread"
                >
                  Mark unread
                </button>
              </div>

              {/* Title & Full Text */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {selectedNotification.title}
                </h4>
                <div
                  className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-700'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                  }`}
                >
                  {selectedNotification.fullMessage}
                </div>
              </div>

              {/* Contextual Actions */}
              {selectedNotification.type === 'birthday' && selectedNotification.staff && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Employee:</span>
                    <span className="font-semibold text-slate-200">
                      {selectedNotification.staff.name} ({selectedNotification.staff.employeeId || selectedNotification.staff.id})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Department & Role:</span>
                    <span className="text-slate-300">
                      {selectedNotification.staff.department} • {selectedNotification.staff.role || 'Staff'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleCopyWish(selectedNotification.staff!)}
                      className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      {copiedId === selectedNotification.staff.id ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied Greeting!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Greeting</span>
                        </>
                      )}
                    </button>

                    {selectedNotification.staff.email && (
                      <a
                        href={`mailto:${selectedNotification.staff.email}?subject=Happy%20Birthday!&body=${encodeURIComponent(
                          `Happy Birthday ${selectedNotification.staff.name}! Wishing you a fantastic celebration and a wonderful year ahead!`
                        )}`}
                        className={`p-2 rounded-xl border transition flex items-center justify-center ${
                          isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                        title="Send Birthday Email"
                      >
                        <Mail className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {selectedNotification.type === 'payroll' && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Scheduled Frequency:</span>
                    <span className="font-semibold text-amber-400 font-mono">
                      {selectedNotification.payrollFrequency || 'All Active Cycles'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Roll Date:</span>
                    <span className="text-slate-300 font-mono">{selectedNotification.dateStr}</span>
                  </div>

                  {onNavigateToPayroll && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onNavigateToPayroll();
                      }}
                      className="w-full mt-2 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Payroll Workspace</span>
                    </button>
                  )}
                </div>
              )}

              {selectedNotification.type === 'query' && (
                <div className="space-y-2.5 pt-1">
                  {selectedNotification.staff && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Target Staff:</span>
                      <span className="font-semibold text-slate-200">
                        {selectedNotification.staff.name} ({selectedNotification.staff.employeeId || selectedNotification.staff.id})
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Target Department:</span>
                    <span className="text-slate-300">
                      {selectedNotification.staff?.department || 'Operations'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Deadline:</span>
                    <span className="text-amber-400 font-mono font-bold">
                      {selectedNotification.queryDeadlineAt ? new Date(selectedNotification.queryDeadlineAt).toLocaleString() : 'Set by HR'}
                    </span>
                  </div>

                  {onOpenStaffQuery && selectedNotification.staff && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenStaffQuery(selectedNotification.staff!.id, selectedNotification.queryId);
                      }}
                      className="w-full mt-2 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      <FileQuestion className="w-3.5 h-3.5" />
                      <span>Open Query & Manage Disciplinary Actions</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* VIEW 2: REGULAR NOTIFICATIONS FEED (Tabs + List) */
            <>
              {/* Category Filter Pills */}
              <div
                className={`flex items-center gap-1 px-3 py-2 border-b overflow-x-auto text-xs ${
                  isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-slate-950/40 border-slate-800/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isLight
                      ? 'text-slate-600 hover:bg-slate-200'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('unread')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                    activeFilter === 'unread'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isLight
                      ? 'text-slate-600 hover:bg-slate-200'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span>Unread</span>
                  {unreadCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('query')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                    activeFilter === 'query'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : isLight
                      ? 'text-slate-600 hover:bg-slate-200'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <FileQuestion className="w-3 h-3" />
                  <span>Queries</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('payroll')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                    activeFilter === 'payroll'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isLight
                      ? 'text-slate-600 hover:bg-slate-200'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Wallet className="w-3 h-3" />
                  <span>Payroll</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('birthday')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                    activeFilter === 'birthday'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : isLight
                      ? 'text-slate-600 hover:bg-slate-200'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Cake className="w-3 h-3" />
                  <span>Birthdays</span>
                </button>
              </div>

              {/* Feed List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredNotifications.length === 0 ? (
                  <div className="py-12 px-6 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto text-slate-500">
                      <Bell className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-slate-300">No notifications in this view</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      You are all caught up! Scheduled payroll run days and staff birthdays will automatically alert here.
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((n) => {
                    const isRead = readIds.includes(n.id);
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleSelectNotification(n)}
                        className={`p-3.5 transition cursor-pointer flex items-start gap-3 select-none ${
                          !isRead
                            ? isLight
                              ? 'bg-blue-50/50 hover:bg-blue-50/80 font-medium'
                              : 'bg-blue-950/20 hover:bg-blue-950/40 font-medium'
                            : isLight
                            ? 'hover:bg-slate-50 opacity-80'
                            : 'hover:bg-slate-800/40 opacity-75'
                        }`}
                      >
                        {/* Type Icon */}
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            n.type === 'query'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : n.type === 'payroll'
                              ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25'
                              : 'bg-rose-500/15 text-rose-500 border border-rose-500/25'
                          }`}
                        >
                          {n.type === 'query' ? (
                            <FileQuestion className="w-4 h-4" />
                          ) : n.type === 'payroll' ? (
                            <Wallet className="w-4 h-4" />
                          ) : (
                            <Cake className="w-4 h-4" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <h5
                              className={`text-xs truncate ${
                                !isRead
                                  ? 'font-bold text-slate-900 dark:text-white'
                                  : 'font-semibold text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {n.title}
                            </h5>
                            <span
                              className={`text-[10px] shrink-0 font-mono px-1.5 py-0.5 rounded ${
                                n.relativeLabel === 'Today'
                                  ? 'bg-rose-500/15 text-rose-500 font-bold border border-rose-500/30'
                                  : 'text-slate-400'
                              }`}
                            >
                              {n.relativeLabel}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                            {n.summary}
                          </p>
                        </div>

                        {/* Unread indicator dot & chevron */}
                        <div className="flex flex-col items-center justify-center gap-1.5 shrink-0 self-center">
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-xs ring-2 ring-blue-400/20" />
                          )}
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* FOOTER */}
          <div
            className={`p-2.5 border-t text-center text-[10px] flex items-center justify-between px-3.5 ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-950/60 border-slate-800 text-slate-500'
            }`}
          >
            <span>Live Alerts: Payroll Runs & Birthdays</span>
            {selectedNotification && (
              <button
                type="button"
                onClick={() => setSelectedNotificationId(null)}
                className="text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                Back to Inbox
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
