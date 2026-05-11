const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function apiFetch(path, options = {}) {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    },
    ...options
  });

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

  // 204 no content
  if (res.status === 204) return {};

  return res.json();
}

