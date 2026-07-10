const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chat.controller.cjs');
const { authenticate, optionalAuth } = require('../middleware/auth.cjs');

router.post('/', optionalAuth, ChatController.chat);
router.get('/:conversationId', authenticate, ChatController.getConversation);
router.post('/:conversationId/reset', authenticate, ChatController.resetConversation);

module.exports = router;
