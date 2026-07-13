import axios from 'axios';

const REFRESH_TOKEN_KEY = 'refreshToken';

class ApiClient {
  constructor() {
    this.accessToken = null;
    this.onUnauthorized = null;

    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
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

    return Promise.reject(error.response?.data || error);
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

  get(url, params) {
    return this.client.get(url, { params });
  }

  post(url, data) {
    return this.client.post(url, data);
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
