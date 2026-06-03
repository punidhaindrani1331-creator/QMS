import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Search, 
  Filter, 
  ArrowLeft, 
  Clock, 
  CheckCircle, 
  Play, 
  Eye,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';

export const TicketQueue = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const navigate = useNavigate();

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await api.getTickets();
      setTickets(data);
    } catch (err) {
      console.error('Error fetching queue board tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleStatusChange = async (id, nextStatus) => {
    try {
      await api.updateTicketStatus(id, nextStatus);
      // Refresh local view
      fetchTickets();
    } catch (err) {
      alert(err.message || 'Failed to update ticket status');
    }
  };

  const isStaff = user?.role === 'Staff' || user?.username === 'admin';
  const displayTickets = isStaff 
    ? tickets 
    : tickets.filter(t => t.created_by === user?.username);

  // Filter & Search Logic
  const filteredTickets = displayTickets.filter((ticket) => {
    const matchesStatus = statusFilter === 'All' || ticket.status === statusFilter;
    const matchesSearch = 
      ticket.title.toLowerCase().includes(search.toLowerCase()) || 
      ticket.description.toLowerCase().includes(search.toLowerCase()) || 
      ticket.created_by.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div>
      {/* Header and Back navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button className="btn btn-secondary btn-icon" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
        </button>
        <div className="dash-title" style={{ margin: 0 }}>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Live Queue Board</h1>
          <p style={{ margin: 0 }}>Monitor active, processing, and serviced queue tokens</p>
        </div>
      </div>

      {/* Filter and Search Bar controls */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Search */}
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

        {/* Status Dropdown Filter */}
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

        {/* Sync Button */}
        <button className="btn btn-secondary" onClick={fetchTickets} style={{ display: 'flex', gap: '0.5rem', height: '48px', alignItems: 'center' }}>
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Board View */}
      <div className="table-container animate-fade-in">
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
          <div style={{ overflowX: 'auto' }}>
            <table className="qms-table">
              <thead>
                <tr>
                  <th>Token ID</th>
                  <th>Title & Description</th>
                  <th>Priority</th>
                  <th>User / Creator</th>
                  <th>Time Registered</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td style={{ fontWeight: 700 }}>#{ticket.id}</td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600 }}>{ticket.title}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.15rem', maxWidth: '320px' }}>
                          {ticket.description}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${ticket.priority?.toLowerCase() || 'medium'}`}>
                        {ticket.priority || 'Medium'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--secondary), var(--primary))',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}>
                          {ticket.created_by.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '0.9rem' }}>{ticket.created_by}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <span className={`badge ${ticket.status?.toLowerCase().replace(' ', '-')}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        {/* View Tracker */}
                        <button 
                          className="btn btn-secondary btn-icon"
                          onClick={() => navigate(`/ticket/${ticket.id}`)}
                          title="View Tracker"
                        >
                          <Eye size={14} />
                        </button>

                        {/* Admin Action triggers */}
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
                      </div>
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
