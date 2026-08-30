import { Navigate } from "react-router-dom";
import { useState, useEffect, type ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import api, { API_ENDPOINTS } from "../api";
import { Loader } from "@mantine/core";
import { ROUTES } from "../routes";
import { STORAGE_KEYS } from "../storageKeys";

interface ProtectedRouteProps {
    children: ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
    // Start as null so we know we are "Thinking"
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

            if (!token) {
                setIsAuthorized(false);
                return;
            }

            try {
                const decoded: any = jwtDecode(token);
                const tokenExpiration = decoded.exp;
                const now = Date.now() / 1000;

                if (tokenExpiration < now) {
                    // Token expired, let's try to refresh immediately
                    await refreshToken();
                } else {
                    setIsAuthorized(true);
                }
            } catch (error) {
                console.error("Token decoding failed", error);
                setIsAuthorized(false);
            }
        };

        checkAuth();
    }, []);

    const refreshToken = async () => {
        const refresh = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        try {
            // We call the direct axios/api refresh here
            const res = await api.post(API_ENDPOINTS.auth.refresh, { refresh });
            if (res.status === 200) {
                localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.data.access);
                setIsAuthorized(true);
            } else {
                setIsAuthorized(false);
            }
        } catch (error) {
            console.error("Refresh failed", error);
            setIsAuthorized(false);
        }
    };

    // IMPORTANT: While isAuthorized is null, show nothing or a spinner.
    // This prevents the "bounce" to login while the check is happening.
    if (isAuthorized === null) {
        return <Loader color="blue" />;
    }

    return isAuthorized ? <>{children}</> : <Navigate to={ROUTES.login} />;
}

export default ProtectedRoute;