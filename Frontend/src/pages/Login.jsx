import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, User, Lock, AlertCircle, Ticket, Eye, EyeOff } from 'lucide-react';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, backendOnline } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="glowing-bg"></div>

      <div className="auth-card animate-fade-in">
        <div className="auth-header">
          <div className="logo-icon" style={{ margin: '0 auto 1.5rem auto' }}>
            <Ticket size={24} />
          </div>
          <h1>Welcome Back</h1>
          <p>Login to manage your queue tickets</p>
        </div>

        {error && (
          <div className="alert alert-danger">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="input-container">
              <User />
              <input
                type="text"
                className="form-input"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label">Password</label>
            <div className="input-container">
              <Lock />
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="eye-toggle" onClick={() => setShowPassword(p => !p)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </span>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <LogIn size={18} />
            <span>Log In</span>
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Create one
          </Link>
        </div>

        {/* Demo instructions */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}>
          <strong>💡 Developer Demo Note:</strong><br />
          {!backendOnline && "Backend is currently offline. You can log in using username "}
          {!backendOnline && <code style={{fontSize:'0.75rem'}}>admin</code>}
          {!backendOnline && " or register any username to instantly log in using local mock memory."}
          {backendOnline && "Backend is online! Feel free to log in with your actual FastAPI user credentials."}
        </div>
      </div>
    </div>
  );
};
