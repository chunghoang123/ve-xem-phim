-- ============================================================
-- Migration v2: AI Booking Assistant - new tables
-- booking_seats, bills, tickets
-- ============================================================

-- 1. booking_seats: junction table for bookings and seats
CREATE TABLE IF NOT EXISTS booking_seats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  seat_id INT NOT NULL,
  showtime_id INT NOT NULL,
  status ENUM('LOCKED', 'BOOKED', 'AVAILABLE', 'CANCELLED') DEFAULT 'LOCKED',
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE RESTRICT,
  FOREIGN KEY (showtime_id) REFERENCES showtimes(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_showtime_seat (showtime_id, seat_id)
) ENGINE=InnoDB;

-- 2. bills: payment tracking
CREATE TABLE IF NOT EXISTS bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  user_id INT NOT NULL,
  total INT NOT NULL DEFAULT 0,
  status ENUM('PENDING_PAYMENT', 'PAID', 'CANCELLED', 'EXPIRED') DEFAULT 'PENDING_PAYMENT',
  payment_method VARCHAR(50) DEFAULT NULL,
  paid_at TIMESTAMP NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_bills_status (status),
  INDEX idx_bills_user (user_id)
) ENGINE=InnoDB;

-- 3. tickets: ticket codes for scanning at cinema
CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  bill_id INT NOT NULL,
  ticket_code VARCHAR(20) NOT NULL UNIQUE,
  qr_data VARCHAR(255) NOT NULL,
  seat_id INT NOT NULL,
  status ENUM('ACTIVE', 'USED', 'CANCELLED', 'EXPIRED') DEFAULT 'ACTIVE',
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE RESTRICT,
  FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE RESTRICT,
  INDEX idx_tickets_code (ticket_code),
  INDEX idx_tickets_status (status)
) ENGINE=InnoDB;

-- 4. Add status column to bookings if not exists
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS bill_id INT DEFAULT NULL AFTER total,
  ADD COLUMN IF NOT EXISTS booking_type VARCHAR(20) DEFAULT 'manual' AFTER bill_id,
  ADD FOREIGN KEY IF NOT EXISTS (bill_id) REFERENCES bills(id) ON DELETE SET NULL;
