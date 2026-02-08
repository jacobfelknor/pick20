import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";

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
        {/* The Outlet is where the child routes (Dashboard, etc.) will render */}
        <Outlet /> 
      </ProtectedRoute>
    ),
    children: [
      {
        path: "/",
        element: <Dashboard />,
      },
      {
        path: "/profile",
        element: <div style={{ padding: '20px' }}>Skel User Profile Page</div>,
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