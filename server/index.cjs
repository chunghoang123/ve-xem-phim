const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
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
const roleRoutes = require('./routes/role.routes.cjs');
const chatRoutes = require('./routes/chat.routes.cjs');
const adminRoutes = require('./routes/admin.routes.cjs');
const billRoutes = require('./routes/bill.routes.cjs');
const ticketRoutes = require('./routes/ticket.routes.cjs');
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
app.use('/api/roles', roleRoutes);
app.use('/api/ai/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/concessions', concessionRoutes);

// API v1 routes
app.use('/api/v1', bookingV1Routes);
app.use('/api/v1', paymentV1Routes);
app.use('/api/v1', webhookV1Routes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'CineX API is running', timestamp: new Date().toISOString() });
});

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
  console.log(`CineX API server running on http://localhost:${PORT}`);

  // Start scheduler for expired holds/payments
  const SchedulerService = require('./services/scheduler.service.cjs');
  SchedulerService.start();
});
