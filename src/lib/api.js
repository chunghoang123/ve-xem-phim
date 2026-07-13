const API_BASE = '/api';
let accessToken = null;
let refreshPromise = null;

function getToken() {
  return accessToken;
}

function getAuthHeaders() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json')
    ? response.json()
    : { message: await response.text() || 'Yêu cầu thất bại' };
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    }).then(async response => {
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.message || 'Không thể làm mới đăng nhập');
      setTokens(data.data);
      return data.data.access_token || data.data.token;
    }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function request(endpoint, options = {}, retried = false) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });

  const isSessionEndpoint = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].includes(endpoint);
  if (response.status === 401 && !retried && !isSessionEndpoint) {
    try {
      await refreshAccessToken();
      return request(endpoint, options, true);
    } catch {
      clearTokens();
    }
  }

  const data = await parseResponse(response);
  if (!response.ok) {
    const apiError = new Error(data.message || 'Yêu cầu thất bại');
    apiError.status = response.status;
    apiError.data = data;
    throw apiError;
  }
  return data;
}

export const api = {
  get: endpoint => request(endpoint),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: endpoint => request(endpoint, { method: 'DELETE' }),
};

export function setTokens(authData) {
  accessToken = authData?.access_token || authData?.token || null;
  localStorage.removeItem('cinex_token');
  localStorage.removeItem('cinex_refresh_token');
}

export function clearTokens() {
  accessToken = null;
  localStorage.removeItem('cinex_token');
  localStorage.removeItem('cinex_refresh_token');
}

export function setToken(token) {
  accessToken = token || null;
  if (!token) clearTokens();
}

export function getTokenValue() {
  return getToken();
}

export function getRefreshTokenValue() {
  return null;
}
