import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  X, 
  HelpCircle 
} from 'lucide-react';
import { cn } from '../lib/utils';

export type NotificationType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: NotificationType;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface NotificationContextType {
  showToast: (message: string, type?: NotificationType) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (val: boolean) => void }) | null>(null);

  const showToast = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const triggerConfirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        ...options,
        resolve
      });
    });
  }, []);

  const handleConfirm = () => {
    if (confirmState) {
      if (confirmState.onConfirm) {
        confirmState.onConfirm();
      }
      confirmState.resolve(true);
      setConfirmState(null);
    }
  };

  const handleCancel = () => {
    if (confirmState) {
      if (confirmState.onCancel) {
        confirmState.onCancel();
      }
      confirmState.resolve(false);
      setConfirmState(null);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showToast, confirm: triggerConfirm }}>
      {children}

      {/* Modern Floating Toasts Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={cn(
                "w-full pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md",
                toast.type === 'success' && "bg-emerald-500/95 border-emerald-400 text-white shadow-emerald-500/10",
                toast.type === 'error' && "bg-rose-500/95 border-rose-400 text-white shadow-rose-500/10",
                toast.type === 'info' && "bg-slate-900/95 border-slate-850 text-white shadow-slate-950/20"
              )}
            >
              <div className="shrink-0 mt-0.5">
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                {toast.type === 'error' && <AlertTriangle className="w-5 h-5" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold leading-relaxed">{toast.message}</p>
              </div>
              <button 
                onClick={() => removeToast(toast.id)}
                className="shrink-0 opacity-75 hover:opacity-100 transition-opacity p-0.5 hover:bg-white/10 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modern Confirmation Portal Modal */}
      <AnimatePresence>
        {confirmState && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancel}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Dialog Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
              role="dialog"
              aria-modal="true"
            >
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-600">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase">
                      {confirmState.title}
                    </h3>
                    <p className="text-sm font-medium text-slate-500 leading-relaxed font-sans">
                      {confirmState.message}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all text-xs font-bold rounded-xl border border-slate-200 cursor-pointer text-center"
                  >
                    {confirmState.cancelLabel || 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100 transition-all text-xs font-bold rounded-xl cursor-pointer text-center"
                  >
                    {confirmState.confirmLabel || 'Confirm Action'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
