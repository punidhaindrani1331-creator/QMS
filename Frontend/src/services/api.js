const API_URL = 'http://127.0.0.1:8000';

// Helper to get headers with optional auth token
const getHeaders = () => {
  const token = localStorage.getItem('qms_token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Simulated mock database for fallback when backend is offline
const getMockData = (key, defaultVal) => {
  const data = localStorage.getItem(`mock_${key}`);
  return data ? JSON.parse(data) : defaultVal;
};

const setMockData = (key, data) => {
  localStorage.setItem(`mock_${key}`, JSON.stringify(data));
};

// Initialize mock data if not present
if (!localStorage.getItem('mock_users')) {
  setMockData('users', [
    { id: 1, username: 'admin', email: 'admin@qms.com', role: 'Staff' },
    { id: 2, username: 'john_doe', email: 'john@example.com', role: 'Customer' },
  ]);
}

if (!localStorage.getItem('mock_tickets')) {
  setMockData('tickets', [
    {
      id: 1,
      title: 'Billing Query',
      description: 'Need clarification on the latest invoice.',
      status: 'In Progress',
      priority: 'High',
      created_by: 'john_doe',
      assigned_to: 'admin',
      created_at: new Date(Date.now() - 30 * 60000).toISOString(), // 30 mins ago
      estimated_wait: '12 mins'
    },
    {
      id: 2,
      title: 'Technical Setup',
      description: 'Setting up workspace configuration.',
      status: 'Pending',
      priority: 'Medium',
      created_by: 'john_doe',
      assigned_to: null,
      created_at: new Date(Date.now() - 5 * 60000).toISOString(), // 5 mins ago
      estimated_wait: '25 mins'
    },
    {
      id: 3,
      title: 'Account Verification',
      description: 'KYC documents need verification.',
      status: 'Completed',
      priority: 'Low',
      created_by: 'alice_smith',
      assigned_to: 'admin',
      created_at: new Date(Date.now() - 120 * 60000).toISOString(),
      estimated_wait: '0 mins'
    }
  ]);
}

export const api = {
  // Check if API is online
  async checkHealth() {
    try {
      const response = await fetch(`${API_URL}/`, { signal: AbortSignal.timeout(2000) });
      return response.ok;
    } catch {
      return false;
    }
  },

  // Auth Operations
  async login(username, password) {
    try {
      const response = await fetch(`${API_URL}/users/login`, {
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

      // Fetch real user info from /users/me
      const meRes = await fetch(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${data.access_token}` }
      });
      const meData = meRes.ok ? await meRes.json() : null;
      const loggedUser = meData
        ? { username: meData.name, email: meData.email, role: meData.role }
        : { username, email: `${username}@qms.com`, role: 'Customer' };

      localStorage.setItem('qms_user', JSON.stringify(loggedUser));
      return { ...data, user: loggedUser };
    } catch (err) {
      // Only fall back to mock on network errors, not auth failures
      if (err.message && (err.message.includes('Invalid') || err.message.includes('failed') || err.message.includes('401'))) {
        throw err;
      }
      console.warn('Backend connection failed, using mock authentication');
      const users = getMockData('users', []);
      const user = users.find(u => u.username === username);
      if (user) {
        const token = 'mock_jwt_token_' + username;
        localStorage.setItem('qms_token', token);
        localStorage.setItem('qms_user', JSON.stringify(user));
        return { access_token: token, token_type: 'bearer', user };
      }
      throw new Error(err.message || 'User not found. Try registering!');
    }
  },

  async register(username, email, password) {
    try {
      const response = await fetch(`${API_URL}/users`, {
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
      if (users.some(u => u.username === username || u.email === email)) {
        throw new Error('Username or Email already registered');
      }
      const newUser = {
        id: users.length + 1,
        username,
        email,
        role: 'user'
      };
      users.push(newUser);
      setMockData('users', users);
      return newUser;
    }
  },

  // Ticket Operations
  async getTickets() {
    try {
      const response = await fetch(`${API_URL}/tickets`, {
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error('Failed to fetch tickets');
      const data = await response.json();
      return data.map(ticket => ({
        id: ticket.id,
        title: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority || 'Medium',
        created_by: ticket.client_name,
        assigned_to: 'admin',
        created_at: ticket.created_at,
        estimated_wait: ticket.status === 'Completed' ? '0 mins' : '15 mins'
      }));
    } catch (err) {
      console.warn('Backend connection failed, fetching mock tickets');
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
        priority: ticketData.priority || 'Medium'
      };

      const response = await fetch(`${API_URL}/tickets`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to create ticket');
      const ticket = await response.json();
      return {
        id: ticket.id,
        title: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority || 'Medium',
        created_by: ticket.client_name,
        assigned_to: 'admin',
        created_at: ticket.created_at,
        estimated_wait: ticket.status === 'Completed' ? '0 mins' : '15 mins'
      };
    } catch (err) {
      console.warn('Backend connection failed, creating mock ticket');
      const tickets = getMockData('tickets', []);
      const currentUser = JSON.parse(localStorage.getItem('qms_user') || '{"username":"Guest"}');
      const newTicket = {
        id: tickets.length + 1,
        title: ticketData.title,
        description: ticketData.description,
        priority: ticketData.priority || 'Medium',
        status: 'Pending',
        created_by: currentUser.username,
        assigned_to: null,
        created_at: new Date().toISOString(),
        estimated_wait: '20 mins'
      };
      tickets.unshift(newTicket); // Add to top
      setMockData('tickets', tickets);
      return newTicket;
    }
  },

  async getTicketById(id) {
    try {
      const response = await fetch(`${API_URL}/tickets/${id}`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch ticket');
      const ticket = await response.json();
      return {
        id: ticket.id,
        title: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority || 'Medium',
        created_by: ticket.client_name,
        assigned_to: 'admin',
        created_at: ticket.created_at,
        estimated_wait: ticket.status === 'Completed' ? '0 mins' : '15 mins'
      };
    } catch (err) {
      console.warn('Backend connection failed, fetching mock ticket details');
      const tickets = getMockData('tickets', []);
      const ticket = tickets.find(t => t.id === parseInt(id));
      if (!ticket) throw new Error('Ticket not found');
      return ticket;
    }
  },

  async updateTicketStatus(id, newStatus) {
    try {
      const response = await fetch(`${API_URL}/tickets/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update ticket status');
      const ticket = await response.json();
      return {
        id: ticket.id,
        title: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority || 'Medium',
        created_by: ticket.client_name,
        assigned_to: 'admin',
        created_at: ticket.created_at,
        estimated_wait: ticket.status === 'Completed' ? '0 mins' : '15 mins'
      };
    } catch (err) {
      console.warn('Backend connection failed, updating mock ticket status');
      const tickets = getMockData('tickets', []);
      const idx = tickets.findIndex(t => t.id === parseInt(id));
      if (idx !== -1) {
        tickets[idx].status = newStatus;
        if (newStatus === 'Completed') {
          tickets[idx].estimated_wait = '0 mins';
        }
        setMockData('tickets', tickets);
        return tickets[idx];
      }
      throw new Error('Ticket not found');
    }
  }
};
