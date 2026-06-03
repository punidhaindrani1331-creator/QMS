import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Ticket, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  PlusCircle, 
  ArrowRight, 
  Calendar,
  Layers
} from 'lucide-react';

export const Dashboard = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const data = await api.getTickets();
        setTickets(data);
      } catch (err) {
        console.error('Error fetching dashboard tickets:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  // Filter based on roles. Admins/Staff see everything, Customers see their own.
  const isStaff = user?.role === 'Staff' || user?.username === 'admin';
  const displayTickets = isStaff 
    ? tickets 
    : tickets.filter(t => t.created_by === user?.username);

  // Compute stats
  const pendingCount = displayTickets.filter(t => t.status === 'Pending').length;
  const inProgressCount = displayTickets.filter(t => t.status === 'In Progress').length;
  const completedCount = displayTickets.filter(t => t.status === 'Completed').length;
  
  // Calculate average wait time (simulated average of 15 min per pending ticket)
  const averageWait = pendingCount * 12;

  return (
    <div>
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
        <button className="btn btn-primary" onClick={() => navigate('/new-ticket')}>
          <PlusCircle size={18} />
          <span>New Ticket</span>
        </button>
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
            <span className="stat-label">Est. Wait Time</span>
            <span className="stat-value">
              {averageWait > 0 ? `${averageWait} mins` : 'Immediate'}
            </span>
          </div>
          <div className="stat-icon" style={{ '--accent-bg': 'var(--primary-glow)', '--accent': 'var(--primary)' }}>
            <Clock />
          </div>
        </div>
      </div>

      {/* Recent Tickets Section */}
      <div className="table-container animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="table-header">
          <h2>{isStaff ? 'All Live Tickets Queue' : 'My Active Queue Tickets'}</h2>
          <button className="btn btn-secondary" onClick={() => navigate('/queue')} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            <span>View Full Board</span>
            <ArrowRight size={14} />
          </button>
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
          <div style={{ overflowX: 'auto' }}>
            <table className="qms-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Created By</th>
                  <th>Estimated Wait</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayTickets.slice(0, 5).map((ticket) => (
                  <tr key={ticket.id}>
                    <td style={{ fontWeight: 600 }}>#{ticket.id}</td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 500 }}>{ticket.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem' }}>
                        <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                        <span>{ticket.status === 'Completed' ? '0 mins' : ticket.estimated_wait || '15 mins'}</span>
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

      {/* Staff Actions Panel for quick demonstration */}
      {isStaff && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          padding: '1.5rem',
          backdropFilter: 'blur(15px)',
          marginTop: '2rem'
        }}>
          <h3 style={{ marginBottom: '0.75rem', fontFamily: 'var(--font-heading)' }}>🛠️ Admin & Staff Fast Track</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            As a staff member, you can navigate to the <strong>Queue Board</strong> to process users, assign tickets, and transition statuses.
          </p>
          <button className="btn btn-secondary" onClick={() => navigate('/queue')}>
            <span>Open Queue Board</span>
          </button>
        </div>
      )}
    </div>
  );
};
