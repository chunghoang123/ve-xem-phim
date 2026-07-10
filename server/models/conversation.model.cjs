const pool = require('../config/database.cjs');

const ConversationModel = {
  async ensureTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        conversation_id VARCHAR(64) NOT NULL UNIQUE,
        user_id INT UNSIGNED NULL,
        current_step VARCHAR(50) NOT NULL DEFAULT 'SELECT_MOVIE',
        state_data JSON NULL,
        status ENUM('ACTIVE','COMPLETED','EXPIRED') DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_conv_id (conversation_id),
        INDEX idx_user_id (user_id),
        INDEX idx_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  },

  async findByConversationId(conversationId) {
    const [rows] = await pool.query(
      'SELECT * FROM ai_conversations WHERE conversation_id = ?',
      [conversationId]
    );
    return rows[0] || null;
  },

  async create(conversationId, userId) {
    const defaultState = {
      movieId: null, movieName: null,
      location: null, latitude: null, longitude: null,
      cinemaId: null, cinemaName: null,
      showDate: null,
      showtimeId: null, showtimeInfo: null,
      seatIds: [], seatCodes: [],
      holdCode: null,
      bookingCode: null,
      paymentCode: null, orderCode: null,
    };
    await pool.query(
      'INSERT INTO ai_conversations (conversation_id, user_id, current_step, state_data) VALUES (?, ?, ?, ?)',
      [conversationId, userId || null, 'SELECT_MOVIE', JSON.stringify(defaultState)]
    );
    return this.findByConversationId(conversationId);
  },

  async getOrCreate(conversationId, userId) {
    let conv = await this.findByConversationId(conversationId);
    if (!conv) {
      conv = await this.create(conversationId, userId);
    } else if (conv.status === 'EXPIRED') {
      conv = await this.create(conversationId, userId);
    }
    return conv;
  },

  async updateStep(conversationId, step, stateUpdates = {}) {
    const conv = await this.findByConversationId(conversationId);
    if (!conv) return null;

    const currentState = typeof conv.state_data === 'string' ? JSON.parse(conv.state_data) : (conv.state_data || {});
    const newState = { ...currentState, ...stateUpdates };

    await pool.query(
      'UPDATE ai_conversations SET current_step = ?, state_data = ?, updated_at = NOW() WHERE conversation_id = ?',
      [step, JSON.stringify(newState), conversationId]
    );
    return this.findByConversationId(conversationId);
  },

  async updateState(conversationId, stateUpdates) {
    const conv = await this.findByConversationId(conversationId);
    if (!conv) return null;

    const currentState = typeof conv.state_data === 'string' ? JSON.parse(conv.state_data) : (conv.state_data || {});
    const newState = { ...currentState, ...stateUpdates };

    await pool.query(
      'UPDATE ai_conversations SET state_data = ?, updated_at = NOW() WHERE conversation_id = ?',
      [JSON.stringify(newState), conversationId]
    );
    return this.findByConversationId(conversationId);
  },

  async resetToStep(conversationId, step, keepFields = []) {
    const conv = await this.findByConversationId(conversationId);
    if (!conv) return null;

    const currentState = typeof conv.state_data === 'string' ? JSON.parse(conv.state_data) : (conv.state_data || {});
    const newState = {};
    for (const field of keepFields) {
      if (currentState[field] !== undefined) newState[field] = currentState[field];
    }

    await pool.query(
      'UPDATE ai_conversations SET current_step = ?, state_data = ?, updated_at = NOW() WHERE conversation_id = ?',
      [step, JSON.stringify(newState), conversationId]
    );
    return this.findByConversationId(conversationId);
  },

  async markCompleted(conversationId) {
    await pool.query(
      "UPDATE ai_conversations SET status = 'COMPLETED', updated_at = NOW() WHERE conversation_id = ?",
      [conversationId]
    );
  },

  async expireOldConversations(minutes = 60) {
    const [result] = await pool.query(
      "UPDATE ai_conversations SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND updated_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)",
      [minutes]
    );
    return result.affectedRows;
  },
};

module.exports = ConversationModel;
