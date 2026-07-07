import React, { useState, useEffect, useRef } from 'react';
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
  AlertCircle,
  Hash,
  Tag
} from 'lucide-react';

const POLL_INTERVAL_MS = 10000; // 10 seconds — more frequent since user is watching this ticket

export const TicketStatusTracker = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [staffUsers, setStaffUsers] = useState([]);
  
  // Chat messaging states
  const [messages, setMessages] = useState([]);
  const [replyContent, setReplyContent] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef(null);
  const intervalRef = useRef(null);


  const fetchTicket = async (silent = false) => {
    try {
      const data = await api.getTicketById(id);
      setTicket(data);
      setLastUpdated(new Date());
      setIsLive(true);
    } catch (err) {
      if (!silent) setError(err.message || 'Ticket not found');
      setIsLive(false);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const data = await api.getMessages(id);
      setMessages(data);
    } catch (err) {
      console.error('Error fetching ticket messages:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchTicket();
    fetchMessages();
    api.getStaffUsers().then(setStaffUsers);

    // Establish WebSocket real-time connection
    const ws = new WebSocket('ws://127.0.0.1:8000/ws');

    ws.onopen = () => {
      console.log('[TicketTracker] Connected to QMS Live WebSocket');
      setIsLive(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ticket_updated' && msg.data.id === parseInt(id)) {
          console.log('[TicketTracker] Received ticket update event');
          setTicket(msg.data);
          setLastUpdated(new Date());
        } else if (msg.type === 'message_created' && msg.data.ticket_id === parseInt(id)) {
          console.log('[TicketTracker] Received message event');
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.data.id)) return prev;
            return [...prev, msg.data];
          });
          setLastUpdated(new Date());
        } else if (msg.type === 'settings_updated') {
          fetchTicket(true);
        }
      } catch (e) {
        console.error('[TicketTracker] Error parsing WebSocket broadcast', e);
      }
    };

    ws.onclose = () => {
      console.warn('[TicketTracker] WebSocket disconnected. Falling back to HTTP polling.');
      setIsLive(false);
      intervalRef.current = setInterval(() => {
        fetchTicket(true);
        fetchMessages();
      }, POLL_INTERVAL_MS);
    };

    ws.onerror = () => {
      setIsLive(false);
    };

    return () => {
      ws.close();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id]);

  const handleAssign = async (assignedTo) => {
    try {
      const updated = await api.assignTicket(ticket.id, assignedTo);
      setTicket(updated);
    } catch (err) {
      alert(err.message || 'Failed to assign ticket');
    }
  };

  const handleStatusChange = async (nextStatus) => {
    try {
      const updated = await api.updateTicketStatus(ticket.id, nextStatus);
      setTicket(updated);
    } catch (err) {
      alert(err.message || 'Failed to update ticket status');
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setSendingReply(true);
    try {
      const newMsg = await api.createMessage(ticket.id, replyContent);
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setReplyContent('');
    } catch (err) {
      alert(err.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
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

  const isStaff = user?.role === 'Staff';

  const isPending    = ticket.status === 'Pending';
  const isInProgress = ticket.status === 'In Progress';
  const isCompleted  = ticket.status === 'Completed';

  // Progress bar width based on status
  const progressWidth = isCompleted ? '100%' : isInProgress ? '55%' : '15%';
  const progressColor = isCompleted
    ? 'var(--success)'
    : isInProgress
    ? 'var(--info)'
    : 'var(--warning)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingRight: '0.5rem' }}>
      {/* Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
        </button>
        <div className="dash-title" style={{ margin: 0, flex: 1 }}>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Ticket Status Tracker</h1>
          <p style={{ margin: 0 }}>Live position tracker for Queue Token #{ticket.id}</p>
        </div>

        {/* Live sync indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: isLive ? 'var(--success)' : 'var(--text-muted)' }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: isLive ? 'var(--success)' : 'var(--text-muted)',
            animation: isLive ? 'pulse-live 1.5s infinite' : 'none'
          }} />
          {isLive ? 'Auto-refreshing every 10s' : 'Offline'}
          {lastUpdated && (
            <span style={{ color: 'var(--text-muted)' }}>
              · {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      <div className="detail-card animate-fade-in">

        {/* Progress Bar */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            height: '6px', borderRadius: '99px',
            background: 'var(--border-color)', overflow: 'hidden', marginBottom: '1.5rem'
          }}>
            <div style={{
              height: '100%', width: progressWidth,
              background: progressColor,
              borderRadius: '99px',
              transition: 'width 0.8s ease, background 0.4s ease'
            }} />
          </div>

          {/* Step items */}
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
              {ticket.category && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '0.3rem 0.65rem', borderRadius: '6px' }}>
                  <Tag size={12} />
                  {ticket.category}
                </span>
              )}
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

          {/* Sidebar Meta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem' }}>

            {/* Queue Position */}
            <div className="meta-item">
              <span className="meta-label">Queue Position</span>
              <span className="meta-val" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {ticket.queue_position != null
                  ? <><Hash size={16} />#{ticket.queue_position}</>
                  : <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 400 }}>—</span>
                }
              </span>
            </div>

            {/* Estimated Wait */}
            <div className="meta-item">
              <span className="meta-label">Estimated Wait</span>
              <span className="meta-val" style={{ fontSize: '1.25rem', color: isCompleted ? 'var(--success)' : 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={16} />
                {ticket.estimated_wait || (isCompleted ? '0 mins' : 'Calculating...')}
              </span>
            </div>

            {/* Submitted By */}
            <div className="meta-item">
              <span className="meta-label">Submitted By</span>
              <span className="meta-val" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <User size={14} style={{ color: 'var(--text-muted)' }} />
                {ticket.created_by}
              </span>
            </div>

            {/* Date Created */}
            <div className="meta-item">
              <span className="meta-label">Date Created</span>
              <span className="meta-val" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                {new Date(ticket.created_at).toLocaleDateString()}
              </span>
            </div>

            {/* Assigned Agent */}
            <div className="meta-item">
              <span className="meta-label">Assigned Agent</span>
              {isStaff && staffUsers.length > 0 ? (
                <select
                  className="form-select"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', marginTop: '0.25rem' }}
                  value={ticket.assigned_to || ''}
                  onChange={(e) => handleAssign(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {staffUsers.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <span className="meta-val" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Shield size={14} style={{ color: 'var(--text-muted)' }} />
                  {ticket.assigned_to || 'Unassigned'}
                </span>
              )}
            </div>

            {/* Client notified badge */}
            {(isInProgress || isCompleted) && (
              <div style={{
                padding: '0.6rem 0.9rem',
                background: isCompleted ? 'var(--success-bg)' : 'var(--info-bg)',
                borderRadius: '10px',
                fontSize: '0.78rem',
                color: isCompleted ? 'var(--success)' : 'var(--info)',
                fontWeight: 600
              }}>
                ✉ Client notified by email
              </div>
            )}
          </div>
        </div>

        {/* Chat / Reply Section */}
        <div style={{
          marginTop: '2.5rem',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '2.5rem'
        }}>
          <h3 style={{
            fontSize: '1.2rem',
            fontFamily: 'var(--font-heading)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            💬 Ticket Discussion &amp; History
          </h3>

          {/* Messages Chronological Thread */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            maxHeight: '350px',
            overflowY: 'auto',
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.01)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            marginBottom: '1.5rem',
          }}>
            {messages.length === 0 ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.9rem'
              }}>
                No messages yet. Send a reply below to initiate conversation.
              </div>
            ) : (
              messages.map((msg) => {
                const isMsgStaff = msg.sender_role.toLowerCase() === 'staff' || msg.sender_role.toLowerCase() === 'admin';
                const isMsgMe = msg.sender_name === user?.username;
                
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMsgMe ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      alignSelf: isMsgMe ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '0.2rem',
                      padding: '0 0.25rem'
                    }}>
                      <span style={{ fontWeight: 600 }}>{msg.sender_name}</span>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '50px',
                        background: isMsgStaff ? 'rgba(99, 102, 241, 0.12)' : 'rgba(16, 185, 129, 0.1)',
                        color: isMsgStaff ? 'var(--primary)' : 'var(--success)',
                        border: `1px solid ${isMsgStaff ? 'rgba(99, 102, 241, 0.2)' : 'rgba(16, 185, 129, 0.15)'}`
                      }}>
                        {msg.sender_role}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        · {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{
                      padding: '0.85rem 1.25rem',
                      borderRadius: isMsgMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                      background: isMsgMe 
                        ? 'linear-gradient(135deg, var(--secondary), var(--primary))' 
                        : 'rgba(255, 255, 255, 0.03)',
                      color: isMsgMe ? 'white' : 'var(--text-color)',
                      border: isMsgMe ? 'none' : '1px solid var(--border-color)',
                      fontSize: '0.95rem',
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap',
                      boxShadow: isMsgMe ? '0 4px 15px rgba(99, 102, 241, 0.2)' : 'none'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Form */}
          <form onSubmit={handleSendReply} style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              className="form-input"
              style={{
                flex: 1,
                padding: '0.75rem 1.25rem',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                background: 'rgba(255,255,255,0.02)',
                color: '#f8fafc'
              }}
              placeholder="Type your message here..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              disabled={sendingReply}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0.75rem 1.5rem', borderRadius: '12px' }}
              disabled={sendingReply || !replyContent.trim()}
            >
              {sendingReply ? 'Sending...' : 'Reply'}
            </button>
          </form>
        </div>

        {/* Staff Command Panel */}

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
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Advance queue state · Client email notification fires automatically on each transition.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {isPending && (
                <button className="btn btn-primary" style={{ background: 'var(--info)' }} onClick={() => handleStatusChange('In Progress')}>
                  <Play size={16} />
                  <span>Mark In Progress</span>
                </button>
              )}

              {isInProgress && (
                <button className="btn btn-primary" style={{ background: 'var(--success)' }} onClick={() => handleStatusChange('Completed')}>
                  <CheckCircle size={16} />
                  <span>Mark Completed</span>
                </button>
              )}

              {isCompleted && (
                <span style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle size={16} />
                  Closed &amp; Resolved
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse-live {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
};
