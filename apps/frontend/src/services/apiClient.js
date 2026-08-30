import axios from 'axios';

const REFRESH_TOKEN_KEY = 'refreshToken';

class ApiClient {
  constructor() {
    this.accessToken = null;
    this.onUnauthorized = null;

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
      const refreshToken = this.getRefreshToken();

      if (refreshToken) {
        try {
          const { data: tokens } = await axios.post(
            `${this.client.defaults.baseURL}/auth/refresh-token`,
            {
              refreshToken,
            }
          );
          this.setTokens(tokens);
          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
          return this.client(originalRequest);
        } catch {
          this.clearTokens();
          if (this.onUnauthorized) this.onUnauthorized();
        }
      } else {
        this.clearTokens();
        if (this.onUnauthorized) this.onUnauthorized();
      }
    }

    if (error.response) {
      return Promise.reject({ ...error.response.data, status: error.response.status });
    }
    return Promise.reject(error);
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
  // (see docs/FACE-ID-USAGE.md), so give them more room than the 10s default.
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
