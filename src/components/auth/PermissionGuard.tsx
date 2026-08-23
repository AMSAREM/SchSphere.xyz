import { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AppPermission, getRoleInfo } from '../../lib/permissions';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';

interface PermissionGuardProps {
  permission?: AppPermission;
  moduleId?: string;
  children: ReactNode;
  fallback?: ReactNode;
  onNavigateHome?: () => void;
}

export function PermissionGuard({
  permission,
  moduleId,
  children,
  fallback,
  onNavigateHome
}: PermissionGuardProps) {
  const { user, hasPermission, canAccessModule } = useAuth();

  let isAllowed = true;

  if (permission && !hasPermission(permission)) {
    isAllowed = false;
  }

  if (moduleId && !canAccessModule(moduleId)) {
    isAllowed = false;
  }

  if (isAllowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const roleInfo = getRoleInfo(user?.role);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Access Restricted</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
        Your current account role (<span className="font-semibold text-slate-700 dark:text-slate-200">{roleInfo.name}</span>) does not have sufficient permission to access this module or view.
      </p>

      <div className="flex items-center gap-3">
        {onNavigateHome && (
          <button
            onClick={onNavigateHome}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}
