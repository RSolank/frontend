import { useEffect } from 'react';

import { hydratePreferences } from '../../users/api/preferences';
import { refreshAuthUser } from '../state/useAuth';

// Mounted once inside <App /> (which lives inside the router). Fires the
// boot-time `/api/users/me` + `/api/metadata/constants` fetch that the
// old AuthProvider did from a useEffect.
export function AuthInit() {
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      void refreshAuthUser();
      void hydratePreferences();
    } else {
      // No token → not authenticated, but still need to flip the boot
      // loading flag off so ProtectedRoute can redirect immediately.
      void refreshAuthUser();
    }
  }, []);

  return null;
}
