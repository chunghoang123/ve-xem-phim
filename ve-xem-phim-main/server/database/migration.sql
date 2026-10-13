-- ============================================================
-- Migration: Add screens table, enhance showtimes, add constraints
-- ============================================================

-- 1. Screens table
CREATE TABLE IF NOT EXISTS screens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cinema_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  capacity INT NOT NULL DEFAULT 0,
  format VARCHAR(20) NOT NULL DEFAULT '2D',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cinema_id) REFERENCES cinemas(id) ON DELETE CASCADE,
  UNIQUE KEY uk_screen_cinema_name (cinema_id, name)
) ENGINE=InnoDB;

-- 2. Enhance showtimes table
ALTER TABLE showtimes
  ADD COLUMN IF NOT EXISTS screen_id INT DEFAULT NULL AFTER cinema_id,
  ADD COLUMN IF NOT EXISTS start_time DATETIME DEFAULT NULL AFTER time,
  ADD COLUMN IF NOT EXISTS end_time DATETIME DEFAULT NULL AFTER start_time,
  ADD COLUMN IF NOT EXISTS format VARCHAR(20) DEFAULT '2D' AFTER end_time,
  ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'Phụ đề' AFTER format,
  ADD COLUMN IF NOT EXISTS price INT DEFAULT 0 AFTER language,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'AVAILABLE' AFTER price,
  ADD INDEX idx_showtimes_screen (screen_id),
  ADD FOREIGN KEY IF NOT EXISTS (screen_id) REFERENCES screens(id) ON DELETE SET NULL;

-- 3. Unique constraints
ALTER TABLE cinemas
  ADD CONSTRAINT IF NOT EXISTS uk_cinema_unique UNIQUE (brand, name, address);

ALTER TABLE showtimes
  ADD CONSTRAINT IF NOT EXISTS uk_showtime_unique UNIQUE (movie_id, cinema_id, screen_id, start_time);
