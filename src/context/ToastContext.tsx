import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Standalone global trigger so any function/utility can fire a toast without React hook
export const emitGlobalToast = (message: string, type: ToastType = 'success', duration = 3500) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app:toast', {
        detail: { message, type, duration },
      })
    );
  }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'success', duration = 3500) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastItem = { id, message, type, duration };

    setToasts((prev) => [...prev.slice(-4), newToast]); // Keep up to 5 concurrent toasts

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  // Listen to window events from anywhere
  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type?: ToastType; duration?: number }>;
      if (customEvent.detail && customEvent.detail.message) {
        showToast(
          customEvent.detail.message,
          customEvent.detail.type || 'success',
          customEvent.detail.duration || 3500
        );
      }
    };

    window.addEventListener('app:toast', handleEvent);
    return () => window.removeEventListener('app:toast', handleEvent);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}

      {/* Floating Toast Notification Container */}
      <div
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((t) => {
          let bgClass = 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30';
          let Icon = CheckCircle2;

          if (t.type === 'error') {
            bgClass = 'bg-rose-600 text-white border-rose-500 shadow-rose-600/30';
            Icon = AlertCircle;
          } else if (t.type === 'warning') {
            bgClass = 'bg-amber-600 text-white border-amber-500 shadow-amber-600/30';
            Icon = AlertTriangle;
          } else if (t.type === 'info') {
            bgClass = 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/30';
            Icon = Info;
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-xl border text-xs font-semibold backdrop-blur-sm transition-all transform animate-in slide-in-from-bottom-3 duration-200 ${bgClass}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate break-words">{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition shrink-0 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast: emitGlobalToast,
      removeToast: () => {},
    };
  }
  return context;
};
