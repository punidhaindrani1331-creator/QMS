import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useQmsWebSocket } from '../hooks/useQmsWebSocket';
import {
  Search,
  ArrowLeft,
  Clock,
  CheckCircle,
  Play,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  Hash,
  UserCheck
} from 'lucide-react';

const POLL_INTERVAL_MS = 15000;

export const LiveQueueBoard = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [newTicketIds, setNewTicketIds] = useState(new Set());
  const [staffUsers, setStaffUsers] = useState([]);
  const prevTicketIdsRef = useRef(new Set());
  const intervalRef = useRef(null);
  const navigate = useNavigate();

  const fetchTickets = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getTickets();

      // Detect newly arrived tickets (from email) and highlight them
      if (silent) {
        const prevIds = prevTicketIdsRef.current;
        const fresh = data.filter(t => !prevIds.has(t.id)).map(t => t.id);
        if (fresh.length > 0) {
          setNewTicketIds(prev => new Set([...prev, ...fresh]));
          setTimeout(() => {
            setNewTicketIds(prev => {
              const next = new Set(prev);
              fresh.forEach(id => next.delete(id));
              return next;
            });
          }, 4000);
        }
      }

      prevTicketIdsRef.current = new Set(data.map(t => t.id));
      setTickets(data);
      setLastUpdated(new Date());
      setIsLive(true);
    } catch (err) {
      console.error('Error fetching queue tickets:', err);
      setIsLive(false);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    api.getStaffUsers().then(setStaffUsers);
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


  const handleAssign = async (id, assignedTo) => {
    try {
      const updated = await api.assignTicket(id, assignedTo);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, assigned_to: updated.assigned_to } : t));
    } catch (err) {
      alert(err.message || 'Failed to assign ticket');
    }
  };

  const handleStatusChange = async (id, nextStatus) => {
    try {
      await api.updateTicketStatus(id, nextStatus);
      fetchTickets(true);
    } catch (err) {
      alert(err.message || 'Failed to update ticket status');
    }
  };

  const isStaff = user?.role === 'Staff' || user?.role === 'Admin';
  const isStaffOnly = user?.role === 'Staff';
  const displayTickets = isStaff
    ? tickets
    : tickets.filter(t => t.created_by === user?.username || t.client_email === user?.email);

  const filteredTickets = displayTickets.filter((ticket) => {
    const matchesStatus = statusFilter === 'All' || ticket.status === statusFilter;
    const matchesSearch =
      (ticket.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (ticket.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (ticket.created_by || '').toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-icon" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
        </button>
        <div className="dash-title" style={{ margin: 0, flex: 1 }}>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Live Queue Board</h1>
          <p style={{ margin: 0 }}>Monitor active, processing, and serviced queue tokens</p>
        </div>

        {/* Live indicator */}
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
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="input-container" style={{ flex: 1, minWidth: '240px' }}>
          <Search />
          <input
            type="text"
            className="form-input"
            placeholder="Search tickets by title, token or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <SlidersHorizontal size={16} style={{ color: 'var(--text-secondary)' }} />
          <select
            className="form-select"
            style={{ width: '160px', padding: '0.85rem' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => fetchTickets(false)}
          style={{ display: 'flex', gap: '0.5rem', height: '48px', alignItems: 'center' }}
        >
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Board */}
      <div className="table-container animate-fade-in" style={{ flex: 1, minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Retrieving live queue tokens...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="empty-state">
            <Search />
            <h3>No results matching filters</h3>
            <p>Try adjusting your search terms or filter selections.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <table className="qms-table">
              <thead>
                <tr>
                  <th>Token ID</th>
                  <th>Title &amp; Description</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>User / Creator</th>
                  <th><Hash size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Queue Pos.</th>
                  <th>Est. Wait</th>
                  <th>Time Registered</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    style={{
                      transition: 'background 0.6s ease',
                      background: newTicketIds.has(ticket.id)
                        ? 'rgba(99, 179, 237, 0.12)'
                        : undefined,
                    }}
                  >
                    <td style={{ fontWeight: 700 }}>#{ticket.id}</td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600 }}>{ticket.title}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.15rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ticket.description}
                        </div>
                        {newTicketIds.has(ticket.id) && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--info)', fontWeight: 700, marginTop: '0.2rem', display: 'block' }}>
                            ✉ New via Email
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                        {ticket.category || '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${ticket.priority?.toLowerCase() || 'medium'}`}>
                        {ticket.priority || 'Medium'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--secondary), var(--primary))',
                          color: 'white', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold'
                        }}>
                          {(ticket.created_by || '?').charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '0.9rem' }}>{ticket.created_by}</span>
                      </div>
                    </td>
                    <td>
                      {ticket.queue_position != null
                        ? <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>#{ticket.queue_position}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem' }}>
                        <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>{ticket.estimated_wait || '—'}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${ticket.status?.toLowerCase().replace(' ', '-')}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-icon"
                          onClick={() => navigate(`/ticket/${ticket.id}`)}
                          title="View Tracker"
                        >
                          <Eye size={14} />
                        </button>

                        {isStaff && ticket.status === 'Pending' && (
                          <button
                            className="btn btn-primary btn-icon"
                            style={{ background: 'var(--info)', boxShadow: 'none' }}
                            onClick={() => handleStatusChange(ticket.id, 'In Progress')}
                            title="Start Processing"
                          >
                            <Play size={14} style={{ color: 'white' }} />
                          </button>
                        )}

                        {isStaff && ticket.status === 'In Progress' && (
                          <button
                            className="btn btn-primary btn-icon"
                            style={{ background: 'var(--success)', boxShadow: 'none' }}
                            onClick={() => handleStatusChange(ticket.id, 'Completed')}
                            title="Mark Completed"
                          >
                            <CheckCircle size={14} style={{ color: 'white' }} />
                          </button>
                        )}

                        {isStaff && staffUsers.length > 0 && (
                          <select
                            className="form-select"
                            style={{ width: '120px', padding: '0.35rem 0.5rem', fontSize: '0.78rem' }}
                            value={ticket.assigned_to || ''}
                            onChange={(e) => handleAssign(ticket.id, e.target.value)}
                            title="Assign to staff"
                          >
                            <option value="">Unassigned</option>
                            {staffUsers.map(s => (
                              <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
