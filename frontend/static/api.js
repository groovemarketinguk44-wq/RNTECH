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
    if (!res.ok) {
      // FastAPI validation errors put an array of {msg, loc, ...} in `detail`
      // instead of a plain string — stringifying that directly renders as
      // "[object Object]", so pull out readable messages instead.
      let message = 'Request failed';
      if (typeof data.detail === 'string') message = data.detail;
      else if (Array.isArray(data.detail)) message = data.detail.map(e => e.msg || JSON.stringify(e)).join('; ');
      throw new Error(message);
    }
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
    updateProfile: (firstName, lastName, instagram) => put('/auth/profile', { firstName, lastName, instagram }),
    forgotPassword: (email) => post('/auth/forgot-password', { email }),
    resetPassword: (token, password) => post('/auth/reset-password', { token, password }),
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
    removePoster: (eventId) => del('/admin/events/' + eventId + '/poster'),

    // Ticket types
    createTicketType: (data) => post('/admin/ticket-types', data),
    updateTicketType: (id, data) => put('/admin/ticket-types/' + id, data),
    deleteTicketType: (id) => del('/admin/ticket-types/' + id),

    // Event interest / waitlist
    myInterests: () => get('/events/interests/my'),
    submitInterest: (eventId, data) => post('/events/' + eventId + '/interest', data),
    adminGetInterest: (eventId) => get('/admin/interest/' + eventId),
    approveInterest: (id) => put('/admin/interest/' + id + '/approve', {}),
    inviteInterest: (id, discountPercent) => put('/admin/interest/' + id + '/invite', { discountPercent }),
    bulkInviteInterest: (interestIds, eventId, discountPercent) => post('/admin/interest/bulk-invite', { interestIds, eventId, discountPercent }),
    inviteAllAttendees: (eventId, discountPercent) => post('/admin/events/' + eventId + '/invite-attendees', { discountPercent }),
    rejectInterest: (id) => put('/admin/interest/' + id + '/reject', {}),
    deleteInterest: (id) => del('/admin/interest/' + id),

    // Checkout / payments
    createCheckoutSession: (data) => post('/checkout/session', data),
    getOrderStatus: (orderId) => get('/checkout/order/' + orderId),
    getInvite: (token) => get('/invite/' + token),

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

    // Inbox
    getInbox: () => get('/admin/inbox'),
    getMessage: (uid) => get('/admin/inbox/' + uid),
    replyMessage: (data) => post('/admin/inbox/reply', data),
    getSent: () => get('/admin/sent'),
    getSentMessage: (uid) => get('/admin/sent/' + uid),
    getJunk: () => get('/admin/junk'),
    getJunkMessage: (uid) => get('/admin/junk/' + uid),

    // Settings
    getSettings: () => get('/admin/settings'),
    saveSettings: (data) => put('/admin/settings', data),

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
    updateUser: (id, data) => put('/admin/users/' + id, data),
    deleteUser: (id) => del('/admin/users/' + id),

    // Campaigns
    getCampaigns: () => get('/admin/campaigns'),
    createCampaign: (data) => post('/admin/campaigns', data),
    updateCampaign: (id, data) => put('/admin/campaigns/' + id, data),
    deleteCampaign: (id) => del('/admin/campaigns/' + id),
    blastCampaign: (id) => post('/admin/campaigns/' + id + '/blast', {}),
  };
})();
