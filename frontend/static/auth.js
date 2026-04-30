/* Auth helpers — JWT-based, replaces localStorage mock */
window.RNTECH_AUTH = {
  getUser() {
    try { return JSON.parse(localStorage.getItem('rntech_user')); } catch { return null; }
  },
  setUser(user) {
    localStorage.setItem('rntech_user', JSON.stringify(user));
  },
  getToken() {
    return localStorage.getItem('rntech_token');
  },
  setToken(token) {
    localStorage.setItem('rntech_token', token);
  },
  logout() {
    localStorage.removeItem('rntech_user');
    localStorage.removeItem('rntech_token');
  },
  isLoggedIn() { return !!this.getToken(); },
  isAdmin() { const u = this.getUser(); return u && u.role === 'admin'; },
};
