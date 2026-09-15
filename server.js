require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const connectDB = require('./src/config/db');

// Connect to DB
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// Serve public static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/books', require('./src/routes/bookRoutes'));
// Seed routes (dev): categories and roles
app.use('/api/books', require('./src/routes/seedCategories'));
app.use('/api/seed', require('./src/routes/seedRoles'));

// Fallback to index if route not found (optional)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'API route not found' });
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
