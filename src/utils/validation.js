const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SEARCH_LENGTH = 100;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validatePassword(password) {
  return typeof password === 'string'
    && password.length >= 8
    && password.length <= 128
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password);
}

function isValidEmail(email) {
  return emailPattern.test(normalizeEmail(email));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function boundedSearch(value) {
  const search = String(value || '').trim();
  return search.length > MAX_SEARCH_LENGTH ? search.slice(0, MAX_SEARCH_LENGTH) : search;
}

module.exports = { normalizeEmail, validatePassword, isValidEmail, escapeRegex, boundedSearch, MAX_SEARCH_LENGTH };
