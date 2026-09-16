require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const connectDB = require('./src/config/db');
const { notFound, errorHandler } = require('./src/middlewares/errorMiddleware');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters');
}

// Connect to DB
connectDB();

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : false }));
app.use(express.json());

// Serve public static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', require('./src/routes/authRoutes'));
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
