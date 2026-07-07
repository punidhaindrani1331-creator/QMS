import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Ticket, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // No token in URL — show an error immediately
  if (!token) {
    return (
      <div className="auth-wrapper">
        <div className="glowing-bg"></div>
        <div className="auth-card animate-fade-in" style={{ textAlign: 'center' }}>
          <AlertCircle size={40} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
          <h2 style={{ marginBottom: '0.75rem' }}>Invalid Reset Link</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            This link is missing a reset token. Please request a new password reset.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex' }}>
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Reset failed. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="glowing-bg"></div>
      <div className="auth-card animate-fade-in">
        {/* Header */}
        <div className="auth-header">
          <div className="logo-icon" style={{ margin: '0 auto 1.25rem auto' }}>
            <Ticket size={22} />
          </div>
          <h1>{success ? 'Password Updated' : 'Set New Password'}</h1>
          <p>
            {success
              ? 'Your password has been reset successfully.'
              : 'Enter and confirm your new password below.'}
          </p>
        </div>

        {success ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'var(--success-bg)', border: '1px solid var(--success-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--success)',
            }}>
              <CheckCircle2 size={28} />
            </div>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.92rem' }}>
              You can now log in with your new password.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => navigate('/login')}
            >
              Go to Login
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="alert alert-danger" role="alert">
                <AlertCircle size={15} /><span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* New Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="new-password">New Password</label>
                <div className="input-container">
                  <Lock size={16} />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
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

              {/* Confirm Password */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
                <div className="input-container">
                  <Lock size={16} />
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Re-enter your new password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                  <button
                    type="button"
                    className="eye-toggle"
                    aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                    onClick={() => setShowConfirm(p => !p)}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ width: '100%', marginBottom: '1rem' }}
              >
                {submitting ? 'Updating…' : 'Update Password'}
              </button>
            </form>

            <div style={{ textAlign: 'center' }}>
              <Link
                to="/login"
                style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 500 }}
              >
                Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
