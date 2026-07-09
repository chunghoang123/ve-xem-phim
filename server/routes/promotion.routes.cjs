const express = require('express');
const router = express.Router();
const PromotionController = require('../controllers/promotion.controller.cjs');
const { authenticate } = require('../middleware/auth.cjs');
const authorize = require('../middleware/authorize.cjs');

router.get('/', PromotionController.getAll);
router.get('/:id', PromotionController.getById);
router.post('/', authenticate, authorize('admin', 'staff'), PromotionController.create);
router.put('/:id', authenticate, authorize('admin', 'staff'), PromotionController.update);
router.delete('/:id', authenticate, authorize('admin'), PromotionController.delete);

module.exports = router;
