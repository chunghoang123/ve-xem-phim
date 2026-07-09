const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user.controller.cjs');
const { authenticate } = require('../middleware/auth.cjs');
const authorize = require('../middleware/authorize.cjs');

router.get('/', authenticate, authorize('admin'), UserController.getAll);
router.get('/:id', authenticate, authorize('admin'), UserController.getById);
router.post('/', authenticate, authorize('admin'), UserController.create);
router.put('/:id', authenticate, authorize('admin'), UserController.update);
router.delete('/:id', authenticate, authorize('admin'), UserController.delete);

module.exports = router;
