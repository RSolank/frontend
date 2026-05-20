const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function apiFetch(path, options = {}) {
  const accessToken = localStorage.getItem('access_token');
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
    ...(options.headers || {})
  };

  let res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers
  });

  // Handle Token Refresh
  if (res.status === 401 && !path.includes('/api/auth/refresh') && !path.includes('/api/auth/login')) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Refresh-Token': refreshToken
          }
        });

        if (refreshRes.ok) {
          const tokens = await refreshRes.json();
          localStorage.setItem('access_token', tokens.access_token);
          localStorage.setItem('refresh_token', tokens.refresh_token);

          // Retry original request
          headers['Authorization'] = `Bearer ${tokens.access_token}`;
          res = await fetch(`${BASE_URL}${path}`, {
            ...options,
            headers
          });
        } else {
          // Refresh failed
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return;
        }
      } catch (err) {
        console.error("Token refresh error:", err);
      }
    }
  }

  if (!res.ok) {
    let err;
    try {
      err = await res.json();
    } catch {
      err = { error: 'Request failed' };
    }
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return {};
  return res.json();
}
