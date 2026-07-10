const pool = require('../config/database.cjs');
const crypto = require('crypto');

function generateTicketCode() {
  const prefix = 'CNX';
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  const num = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}${rand}${num}`;
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

  async findByCode(ticketCode) {
    const [rows] = await pool.query(`
      SELECT t.*, s.row_label, s.seat_number, s.is_vip,
             bk.user_id, bk.showtime_id,
             m.title as movie_title,
             sht.date as show_date, sht.time as show_time,
             c.name as cinema_name
      FROM tickets t
      JOIN seats s ON t.seat_id = s.id
      JOIN bookings bk ON t.booking_id = bk.id
      JOIN showtimes sht ON bk.showtime_id = sht.id
      JOIN movies m ON sht.movie_id = m.id
      JOIN cinemas c ON sht.cinema_id = c.id
      WHERE t.ticket_code = ?
    `, [ticketCode]);
    return rows[0] || null;
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

  async consumeTicket(ticketCode) {
    const ticket = await this.findByCode(ticketCode);
    if (!ticket) return { success: false, message: 'Vé không tồn tại' };
    if (ticket.status === 'USED') return { success: false, message: 'Vé đã được sử dụng' };
    if (ticket.status === 'CANCELLED') return { success: false, message: 'Vé đã bị hủy' };
    if (ticket.status === 'EXPIRED') return { success: false, message: 'Vé đã hết hạn' };

    await pool.query("UPDATE tickets SET status = 'USED', used_at = NOW() WHERE ticket_code = ?", [ticketCode]);
    return { success: true, message: 'Xác nhận vé thành công', ticket };
  },

  async verifyTicket(ticketCode) {
    const ticket = await this.findByCode(ticketCode);
    if (!ticket) return { valid: false, message: 'Vé không tồn tại' };
    if (ticket.status !== 'ACTIVE') {
      return { valid: false, message: `Vé đã ${ticket.status === 'USED' ? 'sử dụng' : 'hủy'}`, ticket };
    }
    return { valid: true, message: 'Vé hợp lệ', ticket };
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
