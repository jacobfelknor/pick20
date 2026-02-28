import { createBrowserRouter, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Entries from "./pages/Entries";
import ProtectedRoute from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";

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
        element: <Entries />,
      },
      {
        path: "/profile",
        element: <div style={{ padding: '20px' }}>Skel User Profile Page</div>,
      },
      {
        path: "/settings",
        element: <div style={{ padding: '20px' }}>Skel User Settings Page</div>,
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