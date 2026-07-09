const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/role.controller.cjs');
const { authenticate } = require('../middleware/auth.cjs');
const authorize = require('../middleware/authorize.cjs');

router.get('/', authenticate, authorize('admin'), RoleController.getAll);
router.get('/:id', authenticate, authorize('admin'), RoleController.getById);
router.post('/', authenticate, authorize('admin'), RoleController.create);
router.put('/:id', authenticate, authorize('admin'), RoleController.update);
router.delete('/:id', authenticate, authorize('admin'), RoleController.delete);

module.exports = router;
