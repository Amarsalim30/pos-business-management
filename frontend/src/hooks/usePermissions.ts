import { useAuth } from '../context/AuthContext';

export function usePermissions() {
  const { user } = useAuth();

  const isOwner = user?.role === 'owner' || user?.role === 'admin';

  const hasPermission = (permissionToken: string): boolean => {
    if (!user) return false;
    if (isOwner) return true;
    if (user.effective_permissions?.includes('*')) return true;
    return user.effective_permissions?.includes(permissionToken) ?? false;
  };

  const hasAnyPermission = (tokens: string[]): boolean => {
    if (!user) return false;
    if (isOwner) return true;
    return tokens.some((t) => hasPermission(t));
  };

  const hasAllPermissions = (tokens: string[]): boolean => {
    if (!user) return false;
    if (isOwner) return true;
    return tokens.every((t) => hasPermission(t));
  };

  return {
    user,
    isOwner,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  };
}
