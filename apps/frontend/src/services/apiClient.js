import axios from 'axios';

const REFRESH_TOKEN_KEY = 'refreshToken';

class ApiClient {
  constructor() {
    this.accessToken = null;
    this.onUnauthorized = null;
    // In-flight refresh, shared by every request that gets a 401 at the same time.
    this.refreshPromise = null;

    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || '/api',
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      if (this.accessToken) config.headers.Authorization = `Bearer ${this.accessToken}`;
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => this.handleResponseError(error)
    );
  }

  async handleResponseError(error) {
    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/');

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      try {
        const tokens = await this.refreshTokens();
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return this.client(originalRequest);
      } catch {
        this.clearTokens();
        if (this.onUnauthorized) this.onUnauthorized();
      }
    }

    if (error.response) {
      return Promise.reject({ ...error.response.data, status: error.response.status });
    }
    return Promise.reject(error);
  }

  // Refresh tokens are single-use: the backend deletes the row it just consumed
  // (auth.service.js `refresh_tokens.delete`). Pages fire several requests in parallel,
  // so when the access token expires they all 401 at once. Each one used to POST the
  // SAME refresh token — the first won, the rest got a P2025 -> 500 and logged the user
  // out even though the refresh had actually succeeded. Funnelling every caller through
  // one shared promise means the token is spent exactly once.
  refreshTokens() {
    if (this.refreshPromise) return this.refreshPromise;

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return Promise.reject(new Error('No refresh token'));

    this.refreshPromise = axios
      .post(`${this.client.defaults.baseURL}/auth/refresh-token`, { refreshToken })
      .then(({ data: tokens }) => {
        this.setTokens(tokens);
        return tokens;
      })
      .finally(() => {
        // Cleared either way: on success the next expiry needs a fresh round, on
        // failure a retry must not be handed the rejected promise forever.
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  setTokens({ accessToken, refreshToken }) {
    this.accessToken = accessToken;
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  getAccessToken() {
    return this.accessToken;
  }

  getBaseUrl() {
    return this.client.defaults.baseURL;
  }

  get(url, params) {
    return this.client.get(url, { params });
  }

  post(url, data, config) {
    return this.client.post(url, data, config);
  }

  // `Content-Type: undefined` drops the instance's default 'application/json'
  // header for this one request — axios then lets the browser set the correct
  // multipart boundary itself, which it can only do when no Content-Type is
  // pre-set. Face capture requests can take ~8-10s on a cold model load
  // (see docs/frontend/FACE-ID-USAGE.md), so give them more room than the 10s default.
  postForm(url, formData, config) {
    return this.client.post(url, formData, {
      timeout: 15000,
      ...config,
      headers: { 'Content-Type': undefined, ...config?.headers },
    });
  }

  put(url, data) {
    return this.client.put(url, data);
  }

  patch(url, data) {
    return this.client.patch(url, data);
  }

  delete(url) {
    return this.client.delete(url);
  }
}

const apiClient = new ApiClient();

export default apiClient;
