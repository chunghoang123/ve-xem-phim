const ChatService = require('../services/chat.service.cjs');
const ConversationModel = require('../models/conversation.model.cjs');
const { success, error } = require('../utils/helpers.cjs');

const ChatController = {
  async chat(req, res) {
    try {
      const { conversationId, message, latitude, longitude } = req.body;
      if (!message || !message.trim()) {
        return error(res, 'Vui lòng nhập tin nhắn', 400);
      }

      const userId = req.user ? req.user.userId : null;
      const convId = conversationId || `CONV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const result = await ChatService.processMessage({
        conversationId: convId,
        message: message.trim(),
        userId,
        latitude,
        longitude,
      });

      return res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      console.error('Chat error:', err);
      return error(res, 'Lỗi xử lý tin nhắn', 500);
    }
  },

  async getConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const conv = await ConversationModel.findByConversationId(conversationId);
      if (!conv) return error(res, 'Không tìm thấy hội thoại', 404);

      const state = typeof conv.state_data === 'string' ? JSON.parse(conv.state_data) : conv.state_data;

      return success(res, {
        conversationId: conv.conversation_id,
        currentStep: conv.current_step,
        status: conv.status,
        state,
      });
    } catch {
      return _error(res, 'Lỗi lấy hội thoại', 500);
    }
  },

  async resetConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const conv = await ConversationModel.findByConversationId(conversationId);
      if (!conv) return error(res, 'Không tìm thấy hội thoại', 404);

      await ConversationModel.resetToStep(conversationId, 'SELECT_MOVIE', ['userId']);
      return success(res, null, 'Đã reset hội thoại');
    } catch {
      return error(res, 'Lỗi reset _hội thoại', 500);
    }
  },
};

module.exports = ChatController;
