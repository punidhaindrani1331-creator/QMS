import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ArrowLeft, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';

export const AdminPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();


  // Stats & Settings state variables
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [settings, setSettings] = useState({ wait_time_per_ticket: 12 });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Create staff form state
  const [form, setForm] = useState({ name: '', email: '', password: '', phone_number: '', department: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.role !== 'Admin') { navigate('/'); return; }
    loadStats();
    loadSettings();
  }, []);





  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await api.getAdminStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load admin stats', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load admin settings', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      await api.exportTicketsCSV();
    } catch (err) {
      alert(err.message || 'CSV Export failed');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSuccess('');
    setSettingsSaving(true);
    try {
      await api.updateSettings(settings);
      setSettingsSuccess('Settings updated successfully!');
      loadStats();
    } catch (err) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setSettingsSaving(false);
    }
  };


  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (!form.name || !form.email || !form.password) {
      setFormError('All fields are required');
      return;
    }
    if (form.password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      const newStaff = await api.createStaff(
        form.name,
        form.email,
        form.password,
        form.phone_number,
        form.department
      );
      setFormSuccess(`Staff account created for ${newStaff.name}`);
      setForm({ name: '', email: '', password: '', phone_number: '', department: '' });
    } catch (err) {
      setFormError(err.message || 'Failed to create staff account');
    } finally {
      setSubmitting(false);
    }
  };



  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '0.5rem', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-icon" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
        </button>
        <div className="dash-title" style={{ margin: 0, flex: 1 }}>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Admin Panel</h1>
          <p style={{ margin: 0 }}>Create staff accounts and manage all user roles.</p>
        </div>
      </div>

      {/* Create Staff Form */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: '20px', padding: '1.75rem',
        backdropFilter: 'blur(15px)'
      }}>
        <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.05rem' }}>
          <UserPlus size={18} style={{ color: 'var(--primary)' }} />
          Create Staff Account
        </h3>

        {formError && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={15} /><span>{formError}</span>
          </div>
        )}
        {formSuccess && (
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
            <CheckCircle2 size={15} /><span>{formSuccess}</span>
          </div>
        )}

        <form onSubmit={handleCreateStaff} autoComplete="off" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Full Name</label>
            <input
              className="form-input"
              style={{ paddingLeft: '1.25rem' }}
              placeholder="e.g. Sarah Johnson"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Work Email</label>
            <input
              className="form-input"
              style={{ paddingLeft: '1.25rem' }}
              placeholder="sarah@company.com"
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Temporary Password</label>
            <input
              className="form-input"
              style={{ paddingLeft: '1.25rem' }}
              placeholder="Min. 8 characters"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Phone Number</label>
            <input
              className="form-input"
              style={{ paddingLeft: '1.25rem' }}
              placeholder="e.g. +1 555-0199"
              value={form.phone_number}
              onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Department / Branch</label>
            <input
              className="form-input"
              style={{ paddingLeft: '1.25rem' }}
              placeholder="e.g. Customer Support"
              value={form.department}
              onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ height: '48px', alignSelf: 'end' }}
          >
            <UserPlus size={16} />
            {submitting ? 'Creating...' : 'Create Staff'}
          </button>
        </form>
      </div>

      {/* Stats and Settings Side-by-Side Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2rem'
      }}>
        {/* Reports / Stats Card */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: '20px', padding: '1.75rem',
          backdropFilter: 'blur(15px)', display: 'flex', flexDirection: 'column', gap: '1.25rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            📊 Queue Statistics &amp; Reports
          </h3>
          {statsLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading statistics...</div>
          ) : stats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Tickets</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{stats.tickets.total}</div>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending in Line</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)' }}>{stats.tickets.status.Pending}</div>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In Progress</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--info)' }}>{stats.tickets.status["In Progress"]}</div>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Est. Total Wait</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.2rem' }}>{stats.queue.estimated_total_wait_mins} mins</div>
                </div>
              </div>
              
              <button 
                onClick={handleExportCSV} 
                className="btn btn-secondary"
                style={{ width: '100%', padding: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: 'auto' }}
              >
                📥 Export Tickets to CSV
              </button>
            </div>
          ) : (
            <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>Failed to load stats.</div>
          )}
        </div>

        {/* System Settings Card */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: '20px', padding: '1.75rem',
          backdropFilter: 'blur(15px)'
        }}>
          <h3 style={{ margin: 0, marginBottom: '1.25rem', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            ⚙️ QMS System Settings
          </h3>
          
          {settingsLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading settings...</div>
          ) : (
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {settingsSuccess && (
                <div className="alert alert-success" style={{ margin: 0, padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  <CheckCircle2 size={14} /> <span>{settingsSuccess}</span>
                </div>
              )}
              
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.82rem' }}>Minutes Allocated Per Pending Ticket</label>
                <input
                  type="number"
                  className="form-input"
                  style={{ paddingLeft: '1rem', marginTop: '0.3rem' }}
                  value={settings.wait_time_per_ticket}
                  onChange={e => setSettings(s => ({ ...s, wait_time_per_ticket: parseInt(e.target.value) || 0 }))}
                  min="1"
                  max="120"
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                  Modifies estimated wait times in real-time for all active queues.
                </span>
              </div>
              
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem', marginTop: 'auto' }}
                disabled={settingsSaving}
              >
                {settingsSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
