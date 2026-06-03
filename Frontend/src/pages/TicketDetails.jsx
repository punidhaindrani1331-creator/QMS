import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  ArrowLeft, 
  Clock, 
  Calendar, 
  User, 
  Shield, 
  Play, 
  CheckCircle, 
  FileText,
  AlertCircle
} from 'lucide-react';

export const TicketDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTicket = async () => {
    try {
      const data = await api.getTicketById(id);
      setTicket(data);
    } catch (err) {
      setError(err.message || 'Ticket not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const handleStatusChange = async (nextStatus) => {
    try {
      const updated = await api.updateTicketStatus(ticket.id, nextStatus);
      setTicket(updated);
    } catch (err) {
      alert(err.message || 'Failed to update ticket status');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        Loading tracker details...
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }} className="animate-fade-in">
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} />
          <span>{error || 'Could not locate token.'}</span>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  const isStaff = user?.role === 'Staff' || user?.username === 'admin';
  
  // Status check for visual steps
  const isPending = ticket.status === 'Pending';
  const isInProgress = ticket.status === 'In Progress';
  const isCompleted = ticket.status === 'Completed';

  return (
    <div>
      {/* Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
        <button className="btn btn-secondary btn-icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
        </button>
        <div className="dash-title" style={{ margin: 0 }}>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Ticket Status Tracker</h1>
          <p style={{ margin: 0 }}>Live position tracker for Queue Token #{ticket.id}</p>
        </div>
      </div>

      <div className="detail-card animate-fade-in">
        {/* Tracker Progress Steps */}
        <div className="progress-steps">
          <div className={`step-item ${isPending || isInProgress || isCompleted ? 'completed' : ''} ${isPending ? 'active' : ''}`}>
            <div className="step-dot">1</div>
            <div>
              <div className="step-label">Submitted</div>
              <div className="step-desc">Waiting in queue line</div>
            </div>
          </div>

          <div className={`step-item ${isInProgress || isCompleted ? 'completed' : ''} ${isInProgress ? 'active' : ''}`}>
            <div className="step-dot">2</div>
            <div>
              <div className="step-label">In Progress</div>
              <div className="step-desc">Staff servicing request</div>
            </div>
          </div>

          <div className={`step-item ${isCompleted ? 'completed' : ''}`}>
            <div className="step-dot">3</div>
            <div>
              <div className="step-label">Completed</div>
              <div className="step-desc">Resolved and closed</div>
            </div>
          </div>
        </div>

        {/* Content details grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '3fr 1fr',
          gap: '3rem',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '2rem'
        }}>
          {/* Main Info */}
          <div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
              <span className={`badge ${ticket.status?.toLowerCase().replace(' ', '-')}`}>
                {ticket.status}
              </span>
              <span className={`badge ${ticket.priority?.toLowerCase() || 'medium'}`}>
                {ticket.priority || 'Medium'}
              </span>
            </div>
            
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>
              {ticket.title}
            </h2>
            
            <p style={{ 
              color: 'var(--text-secondary)', 
              lineHeight: 1.6, 
              fontSize: '1.05rem',
              whiteSpace: 'pre-wrap',
              background: 'rgba(255, 255, 255, 0.01)',
              padding: '1.5rem',
              borderRadius: '16px',
              border: '1px solid var(--border-color)'
            }}>
              {ticket.description}
            </p>
          </div>

          {/* Sidebar Meta info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem' }}>
            <div className="meta-item">
              <span className="meta-label">Estimated Wait</span>
              <span className="meta-val" style={{ fontSize: '1.25rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={16} />
                {ticket.status === 'Completed' ? '0 mins' : ticket.estimated_wait || '15 mins'}
              </span>
            </div>

            <div className="meta-item">
              <span className="meta-label">Submitted By</span>
              <span className="meta-val" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <User size={14} style={{ color: 'var(--text-muted)' }} />
                {ticket.created_by}
              </span>
            </div>

            <div className="meta-item">
              <span className="meta-label">Date Created</span>
              <span className="meta-val" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                {new Date(ticket.created_at).toLocaleDateString()}
              </span>
            </div>

            <div className="meta-item">
              <span className="meta-label">Assigned Agent</span>
              <span className="meta-val" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Shield size={14} style={{ color: 'var(--text-muted)' }} />
                {ticket.assigned_to || 'Assigning...'}
              </span>
            </div>
          </div>
        </div>

        {/* Staff controls for status handling inside detail page */}
        {isStaff && (
          <div style={{
            marginTop: '2.5rem',
            padding: '1.5rem',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Staff Command Dashboard</h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Advance queue state for this customer ticket.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {ticket.status === 'Pending' && (
                <button className="btn btn-primary" style={{ background: 'var(--info)' }} onClick={() => handleStatusChange('In Progress')}>
                  <Play size={16} />
                  <span>Mark In Progress</span>
                </button>
              )}

              {ticket.status === 'In Progress' && (
                <button className="btn btn-primary" style={{ background: 'var(--success)' }} onClick={() => handleStatusChange('Completed')}>
                  <CheckCircle size={16} />
                  <span>Mark Completed</span>
                </button>
              )}
              
              {ticket.status === 'Completed' && (
                <span style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle size={16} />
                  Closed & Resolved
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
