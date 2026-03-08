import { createBrowserRouter, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import EntryList from "./pages/EntryList";
import ProtectedRoute from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import EntryDetail from "./pages/EntryDetail";
import Profile from "./pages/Profile";
import TeamList from "./pages/TeamList";

const router = createBrowserRouter([
  // 1. PUBLIC ROUTES
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
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
        path: "/entries",
        element: <EntryList />,
      },
      {
        path: "/entries/:id",
        element: <EntryDetail />
      },
      {
        path: "/profile",
        element: <Profile />,
      },
      {
        path: "/teams",
        element: <TeamList />,
      },
    ],
  },

  // 3. CATCH-ALL
  {
    path: "*",
    element: <Navigate to="/login" />,
  },
]);

export default router;