const express = require('express');
const router = express.Router();
const PromotionController = require('../controllers/promotion.controller.cjs');
const { authenticate } = require('../middleware/auth.cjs');
const authorize = require('../middleware/authorize.cjs');

router.get('/', PromotionController.getAll);
router.get('/:id', PromotionController.getById);
router.post('/', authenticate, authorize('admin'), PromotionController.create);
router.put('/:id', authenticate, authorize('admin'), PromotionController.update);
router.delete('/:id', authenticate, authorize('admin'), PromotionController.delete);

module.exports = router;
