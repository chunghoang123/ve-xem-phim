const crypto = require('crypto');
const pool = require('../config/database.cjs');

function generateTicketCode() {
  const prefix = 'CNX';
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  const timePart = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}${randomPart}${timePart}`;
}

const TicketModel = {
  async findByBooking(bookingId) {
    const [rows] = await pool.query(`
      SELECT t.*, s.row_label, s.seat_number, s.is_vip
      FROM tickets t
      JOIN seats s ON t.seat_id = s.id
      WHERE t.booking_id = ?
      ORDER BY s.row_label, s.seat_number
    `, [bookingId]);
    return rows;
  },

  async findByBill(billId) {
    const [rows] = await pool.query(`
      SELECT t.*, s.row_label, s.seat_number, s.is_vip
      FROM tickets t
      JOIN seats s ON t.seat_id = s.id
      WHERE t.bill_id = ?
      ORDER BY s.row_label, s.seat_number
    `, [billId]);
    return rows;
  },

  async findBySeatAndShowtime(seatId, showtimeId) {
    const [rows] = await pool.query(`
      SELECT t.* FROM tickets t
      JOIN bookings bk ON t.booking_id = bk.id
      WHERE t.seat_id = ? AND bk.showtime_id = ? AND t.status = 'ACTIVE'
    `, [seatId, showtimeId]);
    return rows[0] || null;
  },

  async create(data) {
    const db = data.connection || pool;
    const ticketCode = data.ticket_code || generateTicketCode();
    const qrData = data.qr_data || JSON.stringify({
      ticketCode,
      bookingId: data.booking_id,
      billId: data.bill_id,
      seatId: data.seat_id,
    });

    const [result] = await db.query(
      'INSERT INTO tickets (booking_id, bill_id, payment_id, ticket_code, qr_data, seat_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.booking_id, data.bill_id, data.payment_id || null, ticketCode, qrData, data.seat_id, data.status || 'ACTIVE']
    );
    return { id: result.insertId, ticket_code: ticketCode, qr_data: qrData };
  },

  async cancelByBooking(bookingId) {
    const [result] = await pool.query(
      "UPDATE tickets SET status = 'CANCELLED' WHERE booking_id = ?",
      [bookingId]
    );
    return result.affectedRows;
  },
};

module.exports = TicketModel;
