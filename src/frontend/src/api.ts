import axios, { type AxiosInstance, type InternalAxiosRequestConfig, AxiosError } from "axios";

const DEV_URL = "http://localhost:8000";

// Use the environment variable, or fall back to dev if it's undefined
const BASE_URL = import.meta.env.VITE_API_BASE_URL || DEV_URL;

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
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refresh");

        // We use standard axios here to avoid an infinite loop 
        // back to this interceptor if the refresh call itself fails
        const response = await axios.post<RefreshResponse>(
          `${BASE_URL}/api/auth/token/refresh/`,
          { refresh: refreshToken }
        );

        const { access } = response.data;
        localStorage.setItem("access", access);

        // Update the failed request and try again
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        // If the refresh token is also dead, log them out
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;