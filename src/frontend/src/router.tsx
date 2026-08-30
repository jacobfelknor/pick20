import { createBrowserRouter, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import EntryList from "./pages/EntryList";
import ProtectedRoute from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import EntryDetail from "./pages/EntryDetail";
import Profile from "./pages/Profile";
import TeamList from "./pages/TeamList";
import Rules from "./pages/Rules";
import AdminDashboard from "./pages/AdminDashboard";
import { ROUTES } from "./routes";

const router = createBrowserRouter([
  // 1. PUBLIC ROUTES
  {
    path: ROUTES.login,
    element: <Login />,
  },
  {
    path: ROUTES.register,
    element: <Register />,
  },
  {
    path: ROUTES.registerRules,
    element: <Rules />
  },

  // 2. PROTECTED ROUTES
  {
    element: (
      <ProtectedRoute>
        {/* The AppLayout is where the child routes will render */}
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: ROUTES.entries,
        element: <EntryList />,
      },
      {
        path: ROUTES.entryDetail(":id"),
        element: <EntryDetail />
      },
      {
        path: ROUTES.profile,
        element: <Profile />,
      },
      {
        path: ROUTES.teams,
        element: <TeamList />,
      },
      {
        path: ROUTES.rules,
        element: <Rules />,
      },
      {
        path: ROUTES.adminDashboard,
        element: <AdminDashboard />,
      },
    ],
  },

  // 3. CATCH-ALL
  {
    path: "*",
    element: <Navigate to={ROUTES.login} />,
  },
]);

export default router;