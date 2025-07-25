const express = require('express');
const dotenv = require('dotenv');
const introRoutes = require('./api/intro/intro.routes');
const authRoutes = require('./api/auth/auth.routes');
const registerRoutes = require('./api/register/register.routes');
const requireHeaders = require('./middlewares/requireHeaders');
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(requireHeaders);
// Routes
app.use('/v1/api', requireHeaders, introRoutes);
app.use('/v1/api', requireHeaders, authRoutes);
app.use('/v1/api', requireHeaders, registerRoutes);

app.use((req, res, next) => {
  res.status(404).json({
    isSuccess: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: err.message,
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
