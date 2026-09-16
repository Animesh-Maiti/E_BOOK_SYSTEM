const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

module.exports = { normalizeEmail, validatePassword, isValidEmail };
