import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Ticket, 
  PlusCircle, 
  LogOut, 
  Wifi, 
  WifiOff, 
  User,
  Users,
  ShieldAlert
} from 'lucide-react';

export const Layout = ({ children }) => {
  const { user, logout, backendOnline } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'Admin';
  const isStaff = user?.role === 'Staff' || isAdmin;
  const isStaffOnly = user?.role === 'Staff';

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    // Staff-only: see the live queue board
    ...(isStaffOnly ? [{ label: 'Queue Board', path: '/queue', icon: Ticket }] : []),
    // Customer-only: view their own tickets and create new ones
    { label: 'My Tickets', path: '/queue', icon: Ticket, hide: isStaff },
    { label: 'Create Ticket', path: '/new-ticket', icon: PlusCircle, hide: isStaff },
    // Admin-only pages
    ...(isAdmin ? [
      { label: 'Admin Panel', path: '/admin', icon: ShieldAlert },
      { label: 'Staff Management', path: '/staff', icon: Users },
    ] : []),
  ].filter(item => !item.hide);

  return (
    <div className="app-container">
      {/* Background Ambience particles */}
      <div className="glowing-bg"></div>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">
            <Ticket size={22} />
          </div>
          <span className="logo-text">QMS Hub</span>
        </div>

        <nav style={{ flex: 1 }}>
          <ul className="nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <button
                    onClick={() => navigate(item.path)}
                    className={`btn-secondary nav-item ${isActive ? 'active' : ''}`}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: 'transparent',
                    }}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {/* Health indicator */}
          <div className={`live-sync ${backendOnline ? 'online' : 'offline'}`}>
            <span className="pulse-dot"></span>
            <span>{backendOnline ? 'FastAPI Live' : 'Demo Mode (Mock)'}</span>
            {backendOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          </div>

          {/* User profile */}
          {user && (
            <div className="user-profile">
              <div className="avatar">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <span className="username">{user.username}</span>
                <span className="user-role">{user.role || 'Client'}</span>
              </div>
            </div>
          )}

          {/* Log out */}
          <button 
            onClick={handleLogout} 
            className="btn btn-secondary" 
            style={{ width: '100%', gap: '0.75rem', justifyContent: 'center' }}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Body */}
      <main className="app-content animate-fade-in">
        {children}
      </main>
    </div>
  );
};
