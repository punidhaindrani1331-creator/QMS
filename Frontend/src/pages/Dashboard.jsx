import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useQmsWebSocket } from '../hooks/useQmsWebSocket';
import { 
  Ticket, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  PlusCircle, 
  ArrowRight, 
  Layers,
  Wifi,
  Users,
  ShieldCheck,
  User
} from 'lucide-react';

const POLL_INTERVAL_MS = 5000; // 5 seconds

export const Dashboard = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const navigate = useNavigate();
  const intervalRef = useRef(null);
  const fetchTickets = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getTickets();
      setTickets(data);
      setLastUpdated(new Date());
      setIsLive(true);
    } catch (err) {
      console.error('Error fetching dashboard tickets:', err);
      setIsLive(false);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();

    // Real-time updates via shared WebSocket hook
    // Falls back to polling automatically on disconnect
  }, []);

  useQmsWebSocket({
    onEvent: (type) => {
      const refreshTypes = ['ticket_created', 'ticket_updated', 'settings_updated'];
      if (refreshTypes.includes(type)) fetchTickets(true);
    },
    onLiveChange: setIsLive,
    pollFn: () => fetchTickets(true),
    pollIntervalMs: POLL_INTERVAL_MS,
  });

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await api.getAllUsers();
      // Admin accounts are excluded from the staff overview table
      setUsers(data.filter(u => u.role !== 'Admin'));
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const roleColor = (role) => {
    if (role === 'Admin')  return { bg: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'rgba(239,68,68,0.2)' };
    if (role === 'Staff')  return { bg: 'rgba(99,102,241,0.12)', color: 'var(--primary)', border: 'rgba(99,102,241,0.25)' };
    return { bg: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: 'rgba(16,185,129,0.2)' };
  };

  const roleIcon = (role) => {
    if (role === 'Admin') return <ShieldCheck size={12} />;
    if (role === 'Staff') return <ShieldCheck size={12} />;
    return <User size={12} />;
  };

  useEffect(() => {
    if (user?.role === 'Admin') {
      loadUsers();
    }
  }, [user]);


  const isStaff = user?.role === 'Staff' || user?.role === 'Admin';
  const isStaffOnly = user?.role === 'Staff';
  const displayTickets = isStaff
    ? tickets
    : tickets.filter(t => t.created_by === user?.username || t.client_email === user?.email);

  const pendingCount    = displayTickets.filter(t => t.status === 'Pending').length;
  const inProgressCount = displayTickets.filter(t => t.status === 'In Progress').length;
  const completedCount  = displayTickets.filter(t => t.status === 'Completed').length;

  // Real average wait: average of all non-null estimated_wait values for pending tickets
  const pendingWithWait = displayTickets.filter(t => t.status === 'Pending' && t.queue_position != null);
  const maxWait = pendingWithWait.length > 0
    ? Math.max(...pendingWithWait.map(t => parseInt(t.estimated_wait) || 0))
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '0.5rem', paddingBottom: '2rem' }}>
      {/* Dashboard Top Header */}
      <div className="dash-header">
        <div className="dash-title">
          <h1>Welcome, {user?.username}!</h1>
          <p>
            {isStaff
              ? 'Monitoring the QMS Queue System dashboard.'
              : 'Track your tickets, view wait times, and register new queue slots.'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Live pulse indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: isLive ? 'var(--success)' : 'var(--text-muted)' }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: isLive ? 'var(--success)' : 'var(--text-muted)',
              animation: isLive ? 'pulse-live 1.5s infinite' : 'none'
            }} />
            {isLive ? 'Live' : 'Offline'}
            {lastUpdated && (
              <span style={{ color: 'var(--text-muted)' }}>
                · {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
          {user?.role !== 'Admin' && (
            <button className="btn btn-primary" onClick={() => navigate('/new-ticket')}>
              <PlusCircle size={18} />
              <span>New Ticket</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary Panel */}
      <div className="stats-grid animate-fade-in">
        <div className="stat-card" style={{ '--accent': 'var(--warning)' }}>
          <div className="stat-info">
            <span className="stat-label">Pending Tickets</span>
            <span className="stat-value">{pendingCount}</span>
          </div>
          <div className="stat-icon" style={{ '--accent-bg': 'var(--warning-bg)', '--accent': 'var(--warning)' }}>
            <Ticket />
          </div>
        </div>

        <div className="stat-card" style={{ '--accent': 'var(--info)' }}>
          <div className="stat-info">
            <span className="stat-label">In Progress</span>
            <span className="stat-value">{inProgressCount}</span>
          </div>
          <div className="stat-icon" style={{ '--accent-bg': 'var(--info-bg)', '--accent': 'var(--info)' }}>
            <Layers />
          </div>
        </div>

        <div className="stat-card" style={{ '--accent': 'var(--success)' }}>
          <div className="stat-info">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{completedCount}</span>
          </div>
          <div className="stat-icon" style={{ '--accent-bg': 'var(--success-bg)', '--accent': 'var(--success)' }}>
            <CheckCircle2 />
          </div>
        </div>

        <div className="stat-card" style={{ '--accent': 'var(--primary)' }}>
          <div className="stat-info">
            <span className="stat-label">Max Wait Time</span>
            <span className="stat-value">
              {maxWait > 0 ? `${maxWait} mins` : 'Immediate'}
            </span>
          </div>
          <div className="stat-icon" style={{ '--accent-bg': 'var(--primary-glow)', '--accent': 'var(--primary)' }}>
            <Clock />
          </div>
        </div>
      </div>

      {/* Recent Tickets Section */}
      {user?.role !== 'Admin' && (
        <div className="table-container animate-fade-in" style={{ animationDelay: '0.1s', flex: 'none', minHeight: '320px' }}>
          <div className="table-header">
            <h2>{isStaff ? 'All Live Tickets Queue' : 'My Active Queue Tickets'}</h2>
            {isStaffOnly && (
              <button className="btn btn-secondary" onClick={() => navigate('/queue')} style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', height: 'auto', gap: '0.35rem' }}>
                <span>View Full Board</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading queue status...
            </div>
          ) : displayTickets.length === 0 ? (
            <div className="empty-state">
              <Ticket />
              <h3>No tickets found</h3>
              <p>You haven't requested any service tickets yet.</p>
              <button className="btn btn-primary" onClick={() => navigate('/new-ticket')}>
                Generate First Ticket
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '400px', scrollbarGutter: 'stable' }}>
              <table className="qms-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Priority</th>
                    <th>Created By</th>
                    <th>Queue Pos.</th>
                    <th>Est. Wait</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td style={{ fontWeight: 600 }}>#{ticket.id}</td>
                      <td>
                        <div>
                          <div style={{ fontWeight: 500 }}>{ticket.title}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ticket.description}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${ticket.priority?.toLowerCase() || 'medium'}`}>
                          {ticket.priority || 'Medium'}
                        </span>
                      </td>
                      <td>{ticket.created_by}</td>
                      <td>
                        {ticket.queue_position != null
                          ? <span style={{ fontWeight: 600, color: 'var(--primary)' }}>#{ticket.queue_position}</span>
                          : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem' }}>
                          <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                          <span>{ticket.estimated_wait}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${ticket.status?.toLowerCase().replace(' ', '-')}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-icon"
                          onClick={() => navigate(`/ticket/${ticket.id}`)}
                          title="View progress tracker"
                        >
                          <ArrowRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All Staff Table */}
      {user?.role === 'Admin' && (
        <div className="table-container animate-fade-in" style={{ flex: 'none', minHeight: '280px' }}>
          <div className="table-header">
            <h2>
              <Users size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />
              All Staff
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {users.length} member{users.length !== 1 ? 's' : ''}
            </span>
          </div>

          {usersLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading staff...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="qms-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Phone Number</th>
                    <th>Dept / Branch</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                      const rc = roleColor(u.role);
                      return (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>#{u.id}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <div style={{
                                width: '30px', height: '30px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--secondary), var(--primary))',
                                color: 'white', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0
                              }}>
                                {(u.name || '?').charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: 500 }}>{u.name}</span>
                              {u.email === user?.email && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(you)</span>
                              )}
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{u.email}</td>
                          <td>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                              fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.7rem',
                              borderRadius: '50px', background: rc.bg, color: rc.color,
                              border: `1px solid ${rc.border}`,
                            }}>
                              {roleIcon(u.role)}
                              {u.role}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{u.phone_number || '-'}</td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{u.department || '-'}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Staff Actions Panel — Staff only, not Admin */}
      {isStaffOnly && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          padding: '1.5rem',
          backdropFilter: 'blur(15px)',
          marginTop: '2rem'
        }}>
          <h3 style={{ marginBottom: '0.75rem', fontFamily: 'var(--font-heading)' }}>🛠️ Staff Fast Track</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Navigate to the <strong>Queue Board</strong> to process users, assign tickets, and transition statuses.
            Email notifications are automatically sent to clients on every status change.
          </p>
          <button className="btn btn-secondary" onClick={() => navigate('/queue')}>
            <Wifi size={16} />
            <span>Open Live Queue Board</span>
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse-live {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
};

