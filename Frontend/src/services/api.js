import { API_URL } from "../config";

const getHeaders = () => {
  const token = localStorage.getItem('qms_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const isOfflineDemoMode = () => localStorage.getItem('qms_offline_mode') === 'true';

const customFetch = async (url, options = {}) => {
  const token = localStorage.getItem('qms_token');
  
  // List of public endpoints that do not need a token
  const isPublic = url.endsWith('/') || url.endsWith('/users/login') || (url.endsWith('/users') && options.method === 'POST');
  const isProtectedTicketFlow = !isPublic && !url.endsWith('/users/me');

  if (isOfflineDemoMode() && isProtectedTicketFlow) {
    return new Response(JSON.stringify({ detail: 'Offline demo mode' }), {
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (!isPublic && !token) {
    console.warn("Prevented sending protected request without token:", url);
    return new Response(JSON.stringify({ detail: "No token present" }), {
      status: 401,
      statusText: "Unauthorized",
      headers: { "Content-Type": "application/json" }
    });
  }

  const authHeader = options.headers?.['Authorization'] || options.headers?.['authorization'];
  if (authHeader && authHeader.includes('Bearer mock_jwt_token_')) {
    console.warn("Prevented sending mock token to online backend.");
    localStorage.removeItem('qms_token');
    localStorage.removeItem('qms_user');
    window.dispatchEvent(new Event('qms_unauthorized'));
    return new Response(JSON.stringify({ detail: "Mock token rejected" }), {
      status: 401,
      statusText: "Unauthorized",
      headers: { "Content-Type": "application/json" }
    });
  }

  const response = await fetch(url, options);
  if (response.status === 401) {
    console.warn("Unauthorized request detected. Clearing invalid tokens.");
    localStorage.removeItem('qms_token');
    localStorage.removeItem('qms_user');
    window.dispatchEvent(new Event('qms_unauthorized'));
  }
  return response;
};

const getMockData = (key, defaultVal) => {
  const data = localStorage.getItem(`mock_${key}`);
  return data ? JSON.parse(data) : defaultVal;
};

const setMockData = (key, data) => {
  localStorage.setItem(`mock_${key}`, JSON.stringify(data));
};

// Shared ticket mapper — single source of truth for backend → frontend shape
const mapTicket = (ticket) => ({
  id: ticket.id,
  title: ticket.subject,
  description: ticket.description,
  status: ticket.status,
  priority: ticket.priority || 'Medium',
  category: ticket.category || null,
  created_by: ticket.client_name,
  client_email: ticket.client_email,
  assigned_to: ticket.assigned_to || null,
  created_at: ticket.created_at,
  queue_position: ticket.queue_position ?? null,
  estimated_wait: ticket.status === 'Completed'
    ? '0 mins'
    : ticket.estimated_wait != null
      ? `${ticket.estimated_wait} mins`
      : 'Calculating...',
});

if (!localStorage.getItem('mock_users')) {
  setMockData('users', [
    { id: 1, name: 'admin', email: 'admin@qms.com', role: 'Staff', phone_number: '123-456-7890', department: 'Management' },
    { id: 2, name: 'john_doe', email: 'john@example.com', role: 'Customer', phone_number: '', department: '' },
  ]);
}

if (!localStorage.getItem('mock_tickets')) {
  setMockData('tickets', [
    {
      id: 1, title: 'Billing Query', description: 'Need clarification on the latest invoice.',
      status: 'In Progress', priority: 'High', category: 'Billing',
      created_by: 'john_doe', assigned_to: 'admin',
      created_at: new Date(Date.now() - 30 * 60000).toISOString(), estimated_wait: '12 mins'
    },
    {
      id: 2, title: 'Technical Setup', description: 'Setting up workspace configuration.',
      status: 'Pending', priority: 'Medium', category: 'Request',
      created_by: 'john_doe', assigned_to: null,
      created_at: new Date(Date.now() - 5 * 60000).toISOString(), estimated_wait: '25 mins'
    },
    {
      id: 3, title: 'Account Verification', description: 'KYC documents need verification.',
      status: 'Completed', priority: 'Low', category: 'Complaint',
      created_by: 'alice_smith', assigned_to: 'admin',
      created_at: new Date(Date.now() - 120 * 60000).toISOString(), estimated_wait: '0 mins'
    }
  ]);
}

export const api = {
  async getMe() {
    const response = await customFetch(`${API_URL}/users/me`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Session invalid');
    return await response.json();
  },
  async checkHealth() {
    try {
      const response = await customFetch(`${API_URL}/`, { signal: AbortSignal.timeout(2000) });
      return response.ok;
    } catch {
      return false;
    }
  },

  async login(username, password) {
    try {
      const response = await customFetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }
      const data = await response.json();
      localStorage.setItem('qms_token', data.access_token);
      const meRes = await customFetch(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${data.access_token}` }
      });
      const meData = meRes.ok ? await meRes.json() : null;
      const loggedUser = meData
        ? { username: meData.name, email: meData.email, role: meData.role }
        : { username, email: `${username}@qms.com`, role: 'Customer' };
      localStorage.setItem('qms_user', JSON.stringify(loggedUser));
      return { ...data, user: loggedUser };
    } catch (err) {
      if (err.message && (err.message.includes('Invalid') || err.message.includes('failed') || err.message.includes('401'))) {
        throw err;
      }
      console.warn('Backend connection failed, using mock authentication');
      const users = getMockData('users', []);
      const user = users.find(u => u.name === username);
      if (user) {
        const token = 'mock_jwt_token_' + username;
        localStorage.setItem('qms_token', token);
        const mapped = { username: user.name, email: user.email, role: user.role };
        localStorage.setItem('qms_user', JSON.stringify(mapped));
        return { access_token: token, token_type: 'bearer', user: mapped };
      }
      throw new Error(err.message || 'User not found. Try registering!');
    }
  },

  async register(username, email, password) {
    try {
      const response = await customFetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: username, email, password }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }
      return await response.json();
    } catch (err) {
      if (err.message && (err.message.includes('already') || err.message.includes('failed') || err.message.includes('400'))) {
        throw err;
      }
      console.warn('Backend connection failed, using mock registration');
      const users = getMockData('users', []);
      if (users.some(u => u.name === username || u.email === email)) {
        throw new Error('Username or Email already registered');
      }
      const newUser = { id: users.length + 1, name: username, email, role: 'Customer' };
      users.push(newUser);
      setMockData('users', users);
      return newUser;
    }
  },

  async getTickets() {
    try {
      const response = await customFetch(`${API_URL}/tickets`, { headers: getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch tickets');
      return (await response.json()).map(mapTicket);
    } catch (err) {
      console.warn('Backend offline, using mock tickets');
      return getMockData('tickets', []);
    }
  },

  async createTicket(ticketData) {
    try {
      const currentUser = JSON.parse(localStorage.getItem('qms_user') || '{"username":"Guest"}');
      const payload = {
        client_name: currentUser.username || 'Guest',
        client_email: currentUser.email || `${currentUser.username || 'guest'}@qms.com`,
        subject: ticketData.title,
        description: ticketData.description,
        priority: ticketData.priority || 'Medium',
        category: ticketData.category || null,
      };
      const response = await customFetch(`${API_URL}/tickets`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to create ticket');
      return mapTicket(await response.json());
    } catch (err) {
      console.warn('Backend offline, creating mock ticket');
      const tickets = getMockData('tickets', []);
      const currentUser = JSON.parse(localStorage.getItem('qms_user') || '{"username":"Guest"}');
      const newTicket = {
        id: tickets.length + 1,
        title: ticketData.title,
        description: ticketData.description,
        priority: ticketData.priority || 'Medium',
        category: ticketData.category || null,
        status: 'Pending',
        created_by: currentUser.username,
        assigned_to: null,
        created_at: new Date().toISOString(),
        queue_position: tickets.filter(t => t.status === 'Pending').length + 1,
        estimated_wait: '20 mins',
      };
      tickets.unshift(newTicket);
      setMockData('tickets', tickets);
      return newTicket;
    }
  },

  async getTicketById(id) {
    try {
      const response = await customFetch(`${API_URL}/tickets/${id}`, { headers: getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch ticket');
      return mapTicket(await response.json());
    } catch (err) {
      console.warn('Backend offline, fetching mock ticket');
      const tickets = getMockData('tickets', []);
      const ticket = tickets.find(t => t.id === parseInt(id));
      if (!ticket) throw new Error('Ticket not found');
      return ticket;
    }
  },

  async updateTicketStatus(id, newStatus) {
    try {
      const response = await customFetch(`${API_URL}/tickets/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update ticket status');
      return mapTicket(await response.json());
    } catch (err) {
      console.warn('Backend offline, updating mock ticket');
      const tickets = getMockData('tickets', []);
      const idx = tickets.findIndex(t => t.id === parseInt(id));
      if (idx !== -1) {
        tickets[idx].status = newStatus;
        if (newStatus === 'Completed') tickets[idx].estimated_wait = '0 mins';
        setMockData('tickets', tickets);
        return tickets[idx];
      }
      throw new Error('Ticket not found');
    }
  },

  async assignTicket(id, assignedTo) {
    try {
      const response = await customFetch(`${API_URL}/tickets/${id}/assign`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ assigned_to: assignedTo }),
      });
      if (!response.ok) throw new Error('Failed to assign ticket');
      return mapTicket(await response.json());
    } catch (err) {
      console.warn('Backend offline, assigning mock ticket');
      const tickets = getMockData('tickets', []);
      const idx = tickets.findIndex(t => t.id === parseInt(id));
      if (idx !== -1) {
        tickets[idx].assigned_to = assignedTo;
        setMockData('tickets', tickets);
        return tickets[idx];
      }
      throw new Error('Ticket not found');
    }
  },

  async getStaffUsers() {
    try {
      const response = await customFetch(`${API_URL}/users`, { headers: getHeaders() });
      if (!response.ok) return [];
      const users = await response.json();
      return users.filter(u => u.role === 'Staff');
    } catch {
      return getMockData('users', []).filter(u => u.role === 'Staff');
    }
  },

  async getAllUsers() {
    try {
      const response = await customFetch(`${API_URL}/users`, { headers: getHeaders() });
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return getMockData('users', []);
    }
  },

  async createStaff(name, email, password, phone_number, department) {
    try {
      const response = await customFetch(`${API_URL}/users/staff`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, email, password, phone_number, department }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to create staff account');
      }
      return await response.json();
    } catch (err) {
      if (err.message) throw err;
      throw new Error('Failed to create staff account');
    }
  },

  async updateUserRole(userId, newRole) {
    try {
      const response = await customFetch(`${API_URL}/users/${userId}/role`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ role: newRole }),
      });
      if (!response.ok) throw new Error('Failed to update role');
      return await response.json();
    } catch (err) {
      // mock fallback
      const users = getMockData('users', []);
      const idx = users.findIndex(u => u.id === userId);
      if (idx !== -1) {
        users[idx].role = newRole;
        setMockData('users', users);
        return users[idx];
      }
      throw new Error('User not found');
    }
  },

  async getMessages(ticketId) {
    try {
      const response = await customFetch(`${API_URL}/tickets/${ticketId}/messages`, { headers: getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return await response.json();
    } catch (err) {
      console.warn('Backend offline, using mock messages');
      return getMockData(`messages_${ticketId}`, []);
    }
  },

  async createMessage(ticketId, content) {
    try {
      const response = await customFetch(`${API_URL}/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      return await response.json();
    } catch (err) {
      console.warn('Backend offline, saving mock message');
      const messages = getMockData(`messages_${ticketId}`, []);
      const currentUser = JSON.parse(localStorage.getItem('qms_user') || '{"username":"Guest","role":"Customer"}');
      const newMsg = {
        id: messages.length + 1,
        ticket_id: parseInt(ticketId),
        sender_id: 999,
        sender_name: currentUser.username,
        sender_role: currentUser.role,
        content: content,
        created_at: new Date().toISOString()
      };
      messages.push(newMsg);
      setMockData(`messages_${ticketId}`, messages);
      return newMsg;
    }
  },

  async getAdminStats() {
    try {
      const response = await customFetch(`${API_URL}/admin/reports/stats`, { headers: getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch admin stats');
      return await response.json();
    } catch (err) {
      console.warn('Backend offline, using mock stats');
      const tickets = getMockData('tickets', []);
      const users = getMockData('users', []);
      return {
        tickets: {
          total: tickets.length,
          status: {
            Pending: tickets.filter(t => t.status === 'Pending').length,
            'In Progress': tickets.filter(t => t.status === 'In Progress').length,
            Completed: tickets.filter(t => t.status === 'Completed').length,
          },
          priority: {
            Low: tickets.filter(t => t.priority === 'Low').length,
            Medium: tickets.filter(t => t.priority === 'Medium').length,
            High: tickets.filter(t => t.priority === 'High').length,
            Critical: tickets.filter(t => t.priority === 'Critical').length,
          },
          category: {
            Billing: tickets.filter(t => t.category === 'Billing').length,
            Request: tickets.filter(t => t.category === 'Request').length,
            Complaint: tickets.filter(t => t.category === 'Complaint').length,
          }
        },
        users: {
          Customer: users.filter(u => u.role === 'Customer').length,
          Staff: users.filter(u => u.role === 'Staff').length,
          Admin: users.filter(u => u.role === 'Admin').length,
        },
        queue: {
          pending_count: tickets.filter(t => t.status === 'Pending').length,
          estimated_total_wait_mins: tickets.filter(t => t.status === 'Pending').length * 12,
          wait_time_per_ticket_setting: 12
        }
      };
    }
  },

  async exportTicketsCSV() {
    try {
      const response = await customFetch(`${API_URL}/admin/reports/export`, { headers: getHeaders() });
      if (!response.ok) throw new Error('Failed to export CSV');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qms_tickets_report.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.warn('Backend offline, mock CSV export');
      console.log('Mock CSV Export of Tickets:', getMockData('tickets', []));
    }
  },

  async getSettings() {
    try {
      const response = await customFetch(`${API_URL}/admin/settings`, { headers: getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch settings');
      return await response.json();
    } catch (err) {
      return getMockData('settings', { wait_time_per_ticket: 12, default_priority: 'Medium' });
    }
  },

  async updateSettings(settings) {
    try {
      const response = await customFetch(`${API_URL}/admin/settings`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return await response.json();
    } catch (err) {
      setMockData('settings', settings);
      return settings;
    }
  },

  // ── Password Reset ────────────────────────────────────────────────────────
  async forgotPassword(email) {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Request failed. Please try again.');
    }
    return await response.json();
  },

  async resetPassword(token, newPassword) {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Reset failed. Please try again.');
    }
    return await response.json();
  },
};

