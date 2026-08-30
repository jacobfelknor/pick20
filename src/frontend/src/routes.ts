export const ROUTES = {
    login: "/login",
    register: "/register",
    registerRules: "/register/rules",
    entries: "/entries",
    entryDetail: (id: string | number) => `/entries/${id}`,
    profile: "/profile",
    teams: "/teams",
    rules: "/rules",
    adminDashboard: "/admin/dashboard",
} as const;
