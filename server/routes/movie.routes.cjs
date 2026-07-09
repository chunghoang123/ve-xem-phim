const express = require('express');
const router = express.Router();
const MovieController = require('../controllers/movie.controller.cjs');
const ShowtimeController = require('../controllers/showtime.controller.cjs');
const { authenticate, optionalAuth } = require('../middleware/auth.cjs');
const authorize = require('../middleware/authorize.cjs');

router.get('/hot', optionalAuth, MovieController.getHot);
router.get('/', optionalAuth, MovieController.getAll);
router.get('/:id', optionalAuth, MovieController.getById);
router.get('/:id/showtimes', optionalAuth, ShowtimeController.getByMovieGrouped);
router.post('/', authenticate, authorize('admin', 'staff'), MovieController.create);
router.put('/:id', authenticate, authorize('admin', 'staff'), MovieController.update);
router.delete('/:id', authenticate, authorize('admin'), MovieController.delete);

module.exports = router;
