import axios, { type AxiosInstance, type InternalAxiosRequestConfig, AxiosError } from "axios";

const DEV_URL = "http://localhost:8000";
// if you want to debug frontend against prod db
// const DEV_URL = "https://pick20.jacobfelknor.com";

// Use the environment variable, or fall back to dev if it's undefined
const BASE_URL = import.meta.env.VITE_API_BASE_URL || DEV_URL;

export const logOutUser = () => {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
}

if (import.meta.env.DEV) {
  console.log("🛠️ API running in Development Mode:", BASE_URL);
} else {
  console.log("🚀 API running in Production Mode");
}
interface RefreshResponse {
  access: string;
}

// 2. Create the instance
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
});

// 3. Request Interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("access");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// 4. Response Interceptor (The Refresh Logic)
// Define your endpoints clearly to avoid substring matching issues
const LOGIN_URL = "/api/auth/token/";
const REFRESH_URL = "/api/auth/token/refresh/";

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const url = originalRequest.url || "";

    // 1. Logic for REFRESH FAILURES (The Loop Killer)
    // If the call that failed WAS the refresh attempt, the session is dead.
    if (url.includes(REFRESH_URL)) {
      logOutUser();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    // 2. Logic for LOGIN FAILURES
    // If this is the initial login, don't refresh or redirect.
    // Just pass the error back so the UI can show "Invalid credentials".
    if (url === LOGIN_URL) {
      return Promise.reject(error);
    }

    // 3. Logic for EXPIRED ACCESS TOKENS (Standard 401)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refresh");
        if (!refreshToken) throw new Error("No refresh token available");

        // Use standard axios to avoid interceptor loops
        const response = await axios.post<RefreshResponse>(
          `${BASE_URL}${REFRESH_URL}`,
          { refresh: refreshToken }
        );

        const { access } = response.data;
        localStorage.setItem("access", access);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access}`;
        }

        return api(originalRequest);
      } catch (refreshError) {
        // This catch block is actually a backup now, 
        // as the "REFRESH_URL" check at the top handles most cases.
        logOutUser();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;