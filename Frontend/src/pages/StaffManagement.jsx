import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ArrowLeft, Users, ShieldCheck, User } from 'lucide-react';

export const StaffManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only Admin can access this page (Admin is the one with GET /users permission)
    if (user?.role !== 'Admin') { navigate('/'); return; }
    api.getAllUsers().then(data => {
      // Show only Staff users in this management table
      const staffUsers = data.filter(u => u.role === 'Staff');
      setUsers(staffUsers);
      setLoading(false);
    });
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const updated = await api.updateUserRole(userId, newRole);
      // After role update, re-filter to ensure Admins are never shown
      setUsers(prev =>
        prev
          .map(u => u.id === userId ? { ...u, role: updated.role } : u)
          .filter(u => u.role !== 'Admin')
      );
    } catch (err) {
      alert(err.message || 'Failed to update role');
    }
  };

  const roleBadgeStyle = (role) => {
    if (role === 'Staff') return {
      background: 'rgba(99,102,241,0.12)',
      color: 'var(--primary)',
      border: '1px solid rgba(99,102,241,0.25)',
    };
    return {
      background: 'rgba(16,185,129,0.1)',
      color: 'var(--success)',
      border: '1px solid rgba(16,185,129,0.2)',
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingRight: '0.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-icon" onClick={() => navigate('/')} aria-label="Back to Dashboard">
          <ArrowLeft size={16} />
        </button>
        <div className="dash-title" style={{ margin: 0, flex: 1 }}>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Staff Management</h1>
          <p style={{ margin: 0 }}>Manage user roles — Admin accounts are excluded from this view.</p>
        </div>
      </div>

      <div className="table-container animate-fade-in">
        <div className="table-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={16} />
            All Staff
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {loading ? '—' : `${users.length} member${users.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {loading ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading users…</span>
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <p>No users found.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="qms-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.82rem' }}>#{u.id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--secondary), var(--primary))',
                          color: 'white', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700,
                          flexShrink: 0, userSelect: 'none',
                        }}>
                          {(u.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{u.name}</span>
                          {u.email === user?.email && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1 }}>you</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{u.email}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                        fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.75rem',
                        borderRadius: '50px', whiteSpace: 'nowrap',
                        ...roleBadgeStyle(u.role),
                      }}>
                        {u.role === 'Staff' ? <ShieldCheck size={11} /> : <User size={11} />}
                        {u.role}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      {u.phone_number || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      {u.department || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
