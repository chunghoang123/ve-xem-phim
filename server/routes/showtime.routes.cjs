const express = require('express');
const router = express.Router();
const ShowtimeController = require('../controllers/showtime.controller.cjs');
const { authenticate } = require('../middleware/auth.cjs');
const authorize = require('../middleware/authorize.cjs');

router.get('/', ShowtimeController.getAll);
router.get('/search', ShowtimeController.search);
router.get('/:id', ShowtimeController.getById);
router.post('/', authenticate, authorize('admin'), ShowtimeController.create);
router.put('/:id', authenticate, authorize('admin'), ShowtimeController.update);
router.delete('/:id', authenticate, authorize('admin'), ShowtimeController.delete);

module.exports = router;
