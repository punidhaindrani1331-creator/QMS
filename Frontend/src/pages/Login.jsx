import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { LogIn, Mail, Lock, AlertCircle, Ticket, Eye, EyeOff, CheckCircle2, X, KeyRound } from 'lucide-react';

const validateEmail = (email) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  return null;
};

// ── Forgot Password Modal ─────────────────────────────────────────────────────
const ForgotPasswordModal = ({ onClose }) => {
  const [step, setStep] = useState('email'); // 'email' | 'sent'
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setError('');

    const validationError = validateEmail(email.trim());
    if (validationError) { setEmailError(validationError); return; }

    setSubmitting(true);
    try {
      await api.forgotPassword(email.trim());
      setStep('sent');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    /* Modal backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-pw-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: '420px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '20px',
        padding: '2rem',
        boxShadow: 'var(--shadow-xl)',
        position: 'relative',
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'transparent', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '6px', padding: '0.25rem',
            transition: 'color 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <X size={18} />
        </button>

        {step === 'email' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'var(--primary-glow)',
                border: '1px solid rgba(99,102,241,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary)',
              }}>
                <KeyRound size={20} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h2 id="forgot-pw-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  Forgot your password?
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.35rem' }}>
                  Enter your email and we'll send a reset link.
                </p>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem', fontSize: '0.88rem' }}>
                <AlertCircle size={15} /><span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="reset-email">Email Address</label>
                <div className="input-container">
                  <Mail size={16} />
                  <input
                    id="reset-email"
                    type="email"
                    className="form-input"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                {emailError && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '0.25rem', display: 'block' }}>
                    {emailError}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {submitting ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '0.75rem' }}
            >
              Back to Login
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--success)',
              }}>
                <CheckCircle2 size={22} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h2 id="forgot-pw-title" style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                  Check your inbox
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.4rem', lineHeight: 1.55 }}>
                  If <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> is registered,
                  a password reset link has been sent. The link expires in 15 minutes.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Login Page ────────────────────────────────────────────────────────────────
export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    }
  };

  return (
    <>
      <div className="auth-wrapper">
        <div className="glowing-bg"></div>
        <div className="auth-card animate-fade-in">
          {/* Header */}
          <div className="auth-header">
            <div className="logo-icon" style={{ margin: '0 auto 1.25rem auto' }}>
              <Ticket size={22} />
            </div>
            <h1>Welcome Back</h1>
            <p>Login to manage your queue tickets</p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="alert alert-danger" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" noValidate>
            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email Address</label>
              <div className="input-container">
                <Mail size={16} />
                <input
                  id="login-email"
                  type="text"
                  className="form-input"
                  placeholder="Enter your email address"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" htmlFor="login-password">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600,
                    padding: '0', lineHeight: 1,
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="input-container">
                <Lock size={16} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="eye-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(p => !p)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', gap: '0.75rem', marginTop: '0.5rem', marginBottom: '1.5rem' }}
            >
              <LogIn size={18} />
              <span>Log In</span>
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Create one</Link>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </>
  );
};
