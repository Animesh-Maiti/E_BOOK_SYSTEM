const crypto = require('crypto');

function createRateLimiter({ windowMs, max, message = 'Too many requests, please try again later' }) {
  if (process.env.NODE_ENV === 'test') return (req, res, next) => next();
  const clients = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let entry = clients.get(key);
    if (!entry || entry.expiresAt <= now) entry = { count: 0, expiresAt: now + windowMs };
    entry.count += 1;
    clients.set(key, entry);
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.expiresAt - now) / 1000)));
      return res.status(429).json({ success: false, message });
    }
    return next();
  };
}

function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // The existing frontend uses inline scripts/styles, so keep CSP on API responses only.
  if (req.path.startsWith('/api/')) {
    res.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  }
  next();
}

function rejectMongoOperators(value) {
  if (!value || typeof value !== 'object') return false;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) return true;
    if (rejectMongoOperators(value[key])) return true;
  }
  return false;
}

function inputSecurity(req, res, next) {
  if (rejectMongoOperators(req.body) || rejectMongoOperators(req.query)) {
    return res.status(400).json({ success: false, message: 'Invalid request parameters' });
  }
  return next();
}

module.exports = {
  createRateLimiter,
  securityHeaders,
  inputSecurity,
  randomFilename: (extension) => `${crypto.randomBytes(24).toString('hex')}${extension}`,
};
