const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:5173');

app.set('trust proxy', 1);

app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth.routes.cjs');
const movieRoutes = require('./routes/movie.routes.cjs');
const cinemaRoutes = require('./routes/cinema.routes.cjs');
const showtimeRoutes = require('./routes/showtime.routes.cjs');
const seatRoutes = require('./routes/seat.routes.cjs');
const bookingRoutes = require('./routes/booking.routes.cjs');
const promotionRoutes = require('./routes/promotion.routes.cjs');
const userRoutes = require('./routes/user.routes.cjs');
const chatRoutes = require('./routes/chat.routes.cjs');
const adminRoutes = require('./routes/admin.routes.cjs');
const billRoutes = require('./routes/bill.routes.cjs');
const concessionRoutes = require('./routes/concession.routes.cjs');

// API v1 routes (new PayOS flow)
const bookingV1Routes = require('./routes/v1/booking.routes.cjs');
const paymentV1Routes = require('./routes/v1/payment.routes.cjs');
const webhookV1Routes = require('./routes/v1/webhook.routes.cjs');

app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/cinemas', cinemaRoutes);
app.use('/api/showtimes', showtimeRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ai/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/concessions', concessionRoutes);

// API v1 routes
app.use('/api/v1', bookingV1Routes);
app.use('/api/v1', paymentV1Routes);
app.use('/api/v1', webhookV1Routes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'CineX API is running', timestamp: new Date().toISOString() });
});

// In production, Express serves the compiled React app on the same public domain.
// This keeps API calls, auth cookies and payment return URLs on one HTTPS origin.
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`CineX server listening on port ${PORT}`);

  // Start scheduler for expired holds/payments
  const SchedulerService = require('./services/scheduler.service.cjs');
  SchedulerService.start();
});
