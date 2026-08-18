export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // send cookies automatically
  });

  // If 401 Unauthorized, attempt transparent token refresh (unless already refreshing or logging in)
  if (response.status === 401 && !url.includes('/api/v1/auth/refresh') && !url.includes('/api/v1/auth/login')) {
    try {
      const refreshRes = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (refreshRes.ok) {
        // Retry the original request
        response = await fetch(url, {
          ...options,
          headers,
          credentials: 'include',
        });
      }
    } catch {
      // Ignore refresh error and fall through to standard error handling
    }
  }

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  // Handle empty or 204 responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return {} as T;
}
