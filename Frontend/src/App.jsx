import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { LiveQueueBoard } from './pages/LiveQueueBoard';
import { NewTicket } from './pages/NewTicket';
import { TicketStatusTracker } from './pages/TicketStatusTracker';
import { AdminPanel } from './pages/AdminPanel';
import { StaffManagement } from './pages/StaffManagement';
import { ResetPassword } from './pages/ResetPassword';

// Simple Router wrapper to guard private routes
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#0b0f19',
        color: '#f8fafc' 
      }}>
        Loading session...
      </div>
    );
  }

  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Main Routes */}
          <Route 
            path="/" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/queue" 
            element={
              <PrivateRoute>
                <LiveQueueBoard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/new-ticket" 
            element={
              <PrivateRoute>
                <NewTicket />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/ticket/:id" 
            element={
              <PrivateRoute>
                <TicketStatusTracker />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <PrivateRoute>
                <AdminPanel />
              </PrivateRoute>
            } 
          />
          <Route
            path="/staff"
            element={
              <PrivateRoute>
                <StaffManagement />
              </PrivateRoute>
            }
          />

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
