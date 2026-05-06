/* RNTECH API client — replaces localStorage mock */
window.RNTECH_API = (function () {
  const BASE = '/api';

  function token() { return localStorage.getItem('rntech_token'); }

  async function req(method, path, body, isForm) {
    const headers = {};
    if (token()) headers['Authorization'] = 'Bearer ' + token();
    if (body && !isForm) headers['Content-Type'] = 'application/json';

    const res = await fetch(BASE + path, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Request failed');
    return data;
  }

  const get = (p) => req('GET', p);
  const post = (p, b) => req('POST', p, b);
  const put = (p, b) => req('PUT', p, b);
  const del = (p) => req('DELETE', p);
  const postForm = (p, b) => req('POST', p, b, true);

  return {
    // Auth
    login: (email, password) => post('/auth/login', { email, password }),
    register: (firstName, lastName, email, password, instagram) => post('/auth/register', { firstName, lastName, email, password, instagram }),
    me: () => get('/auth/me'),
    changePassword: (current, newPass) => put('/auth/password', { current, new: newPass }),

    // Events
    getEvents: () => get('/events'),
    getEvent: (id) => get('/events/' + id),
    createEvent: (data) => post('/admin/events', data),
    updateEvent: (id, data) => put('/admin/events/' + id, data),
    deleteEvent: (id) => del('/admin/events/' + id),
    uploadPoster: (eventId, file) => {
      const fd = new FormData(); fd.append('file', file);
      return postForm('/admin/events/' + eventId + '/poster', fd);
    },

    // Ticket types
    createTicketType: (data) => post('/admin/ticket-types', data),
    updateTicketType: (id, data) => put('/admin/ticket-types/' + id, data),
    deleteTicketType: (id) => del('/admin/ticket-types/' + id),

    // Event interest / waitlist
    myInterests: () => get('/events/interests/my'),
    submitInterest: (eventId, data) => post('/events/' + eventId + '/interest', data),
    adminGetInterest: (eventId) => get('/admin/interest/' + eventId),
    approveInterest: (id) => put('/admin/interest/' + id + '/approve', {}),
    rejectInterest: (id) => put('/admin/interest/' + id + '/reject', {}),

    // Tickets
    issueTicket: (data) => post('/tickets', data),
    myTickets: () => get('/tickets/my'),
    adminTickets: (eventId) => get('/admin/tickets' + (eventId ? '?event_id=' + eventId : '')),
    adminIssueTicket: (data) => post('/admin/tickets', data),
    searchTickets: (q, eventId) => get('/admin/tickets/search?q=' + encodeURIComponent(q) + (eventId ? '&event_id=' + eventId : '')),
    checkinByQR: (qrCode) => post('/admin/tickets/checkin/' + encodeURIComponent(qrCode), {}),
    exportTickets: (eventId) => BASE + '/admin/tickets/export' + (eventId ? '?event_id=' + eventId : '') + '&_auth=' + (token() || ''),
    updateTicketStatus: (id, status) => put('/admin/tickets/' + id + '/status', { status }),
    deleteTicket: (id) => del('/admin/tickets/' + id),

    // Mixes
    getMixes: () => get('/mixes'),
    adminGetMixes: () => get('/admin/mixes'),
    createMix: (data) => post('/admin/mixes', data),
    updateMix: (id, data) => put('/admin/mixes/' + id, data),
    deleteMix: (id) => del('/admin/mixes/' + id),
    uploadVideo: (mixId, file) => {
      const fd = new FormData(); fd.append('file', file);
      return postForm('/admin/mixes/' + mixId + '/video', fd);
    },
    uploadCover: (mixId, file) => {
      const fd = new FormData(); fd.append('file', file);
      return postForm('/admin/mixes/' + mixId + '/cover', fd);
    },

    // Sponsors
    getSponsors: () => get('/sponsors'),
    createSponsor: (data) => post('/admin/sponsors', data),
    updateSponsor: (id, data) => put('/admin/sponsors/' + id, data),
    deleteSponsor: (id) => del('/admin/sponsors/' + id),
    uploadLogo: (spId, file) => {
      const fd = new FormData(); fd.append('file', file);
      return postForm('/admin/sponsors/' + spId + '/logo', fd);
    },

    // Contact
    submitMessage: (name, email, message) => post('/contact', { name, email, message }),
    getMessages: () => get('/admin/messages'),
    markRead: (id) => put('/admin/messages/' + id + '/read', {}),
    deleteMessage: (id) => del('/admin/messages/' + id),

    // Admin
    getStats: () => get('/admin/stats'),
    getAttendees: () => get('/admin/attendees'),
    exportAttendees: () => BASE + '/admin/attendees/export?_auth=' + (token() || ''),
    unsubscribeUser: (id) => put('/admin/users/' + id + '/unsubscribe', {}),

    // Campaigns
    getCampaigns: () => get('/admin/campaigns'),
    createCampaign: (data) => post('/admin/campaigns', data),
    updateCampaign: (id, data) => put('/admin/campaigns/' + id, data),
    deleteCampaign: (id) => del('/admin/campaigns/' + id),
    blastCampaign: (id) => post('/admin/campaigns/' + id + '/blast', {}),
  };
})();
