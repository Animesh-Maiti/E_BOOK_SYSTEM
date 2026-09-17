require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const connectDB = require('./src/config/db');
const { isDatabaseReady, disconnectDB } = connectDB;
const { notFound, errorHandler } = require('./src/middlewares/errorMiddleware');
const { securityHeaders, inputSecurity } = require('./src/middlewares/securityMiddleware');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters');
}

const app = express();
app.disable('x-powered-by');
const allowedOrigins = String(process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((value) => {
    try {
      const url = new URL(value.trim());
      if (!['http:', 'https:'].includes(url.protocol)
        || !url.hostname || url.username || url.password
        || url.pathname !== '/' || url.search || url.hash) return null;
      return url.origin;
    } catch (error) {
      return null;
    }
  })
  .filter(Boolean);
app.set('query parser', 'simple');
app.use(securityHeaders);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : false,
  optionsSuccessStatus: 204,
}));
app.use(express.json({ limit: '100kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '100kb', parameterLimit: 100 }));
app.use(inputSecurity);

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.get('/ready', (req, res) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({ success: false, status: 'not_ready' });
  }
  return res.json({ success: true, status: 'ready' });
});

// Serve public static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/books', require('./src/routes/bookRoutes'));
app.use('/api/categories', require('./src/routes/categoryRoutes'));
app.use('/api/bookmarks', require('./src/routes/bookmarkRoutes'));
app.use('/api/history', require('./src/routes/historyRoutes'));
app.use('/api/feedback', require('./src/routes/feedbackRoutes'));

app.use('/api', notFound);
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
let httpServer;
let shuttingDown = false;

async function startServer() {
  await connectDB();
  httpServer = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  return httpServer;
}

if (require.main === module) {
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down`);
    const timeout = setTimeout(() => {
      console.error('Shutdown timed out');
      process.exitCode = 1;
      process.exit();
    }, 10000);
    timeout.unref();

    const closeServer = httpServer
      ? new Promise(resolve => httpServer.close(resolve))
      : Promise.resolve();
    closeServer
      .then(() => disconnectDB())
      .then(() => {
        clearTimeout(timeout);
        process.exitCode = 0;
        process.exit();
      })
      .catch(() => {
        clearTimeout(timeout);
        process.exitCode = 1;
        process.exit();
      });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error.message);
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', reason => {
    const message = reason instanceof Error ? reason.message : 'Unhandled promise rejection';
    console.error('Unhandled rejection:', message);
    shutdown('unhandledRejection');
  });

  startServer().catch((error) => {
    console.error('Unable to start server:', error.message || 'startup failed');
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };
