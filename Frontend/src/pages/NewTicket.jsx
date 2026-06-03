import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ArrowLeft, Send, AlertCircle, Sparkles, BookOpen, Clock } from 'lucide-react';

export const NewTicket = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!title || !description) {
      setError('Please fill in both title and description fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const createdTicket = await api.createTicket({ title, description, priority });
      navigate(`/ticket/${createdTicket.id}`);
    } catch (err) {
      setError(err.message || 'Failed to register queue ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header and Back navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
        <button className="btn btn-secondary btn-icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
        </button>
        <div className="dash-title" style={{ margin: 0 }}>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Generate Queue Token</h1>
          <p style={{ margin: 0 }}>Create a new service request and join the queue line</p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '2rem',
        alignItems: 'start'
      }} className="animate-fade-in">
        {/* Form Container */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '24px',
          padding: '2.5rem',
          backdropFilter: 'blur(15px)',
          boxShadow: 'var(--shadow-xl)'
        }}>
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Service Request Title</label>
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '1.25rem' }} // override icons padding
                placeholder="e.g. Consultation, Tech Support, Billing Query"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Priority Level</label>
              <select
                className="form-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="Low">Low (General Inquiry)</option>
                <option value="Medium">Medium (Technical Issue)</option>
                <option value="High">High (Immediate Assistance Required)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label">Detailed Description</label>
              <textarea
                className="form-input"
                style={{ 
                  paddingLeft: '1.25rem', 
                  minHeight: '120px', 
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
                placeholder="Describe your issue or what support you need, so our staff can assist you effectively..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', gap: '0.75rem' }}
              disabled={isSubmitting}
            >
              <Send size={18} />
              <span>{isSubmitting ? 'Submitting Request...' : 'Submit Request'}</span>
            </button>
          </form>
        </div>

        {/* Side Panel Guide */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '1.5rem',
            backdropFilter: 'blur(15px)'
          }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', color: 'var(--primary)' }}>
              <Sparkles size={20} />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-heading)' }}>How it Works</h3>
            </div>
            <ul style={{ 
              paddingLeft: '1.25rem', 
              color: 'var(--text-secondary)', 
              fontSize: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <li>Your ticket is entered into our live database immediately.</li>
              <li>A custom queue token gets assigned to track your live position.</li>
              <li>Priority settings allow staff to address critical blockages first.</li>
              <li>Estimated wait time dynamically recalibrates based on processing capacity.</li>
            </ul>
          </div>

          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '1.5rem',
            backdropFilter: 'blur(15px)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{
              background: 'var(--primary-glow)',
              color: 'var(--primary)',
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Clock size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Avg Service Velocity</h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>~12 minutes per token</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
