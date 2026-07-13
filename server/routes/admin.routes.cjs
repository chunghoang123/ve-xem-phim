const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller.cjs');
const { authenticate } = require('../middleware/auth.cjs');
const authorize = require('../middleware/authorize.cjs');
const ScheduleSettings = require('../controllers/scheduleSettings.controller.cjs');

router.post('/sync/tmdb', authenticate, authorize('admin'), AdminController.syncTMDB);
router.get('/sync/tmdb/:tmdbId', authenticate, authorize('admin'), AdminController.fetchMovieFromTMDB);
router.get('/sync/status', authenticate, authorize('admin'), AdminController.getSyncStatus);

router.get('/tmdb/search', authenticate, authorize('admin'), AdminController.searchTMDB);
router.get('/tmdb/movie/:tmdbId', authenticate, authorize('admin'), AdminController.getTMDBMovieDetail);
router.post('/tmdb/add', authenticate, authorize('admin'), AdminController.addFromTMDB);
router.post('/movies/enrich/:id', authenticate, authorize('admin'), AdminController.enrichMovie);
router.post('/movies/enrich-all', authenticate, authorize('admin'), AdminController.enrichAllMovies);
router.get('/schedule-settings', authenticate, authorize('admin'), ScheduleSettings.get);
router.put('/schedule-settings', authenticate, authorize('admin'), ScheduleSettings.update);

module.exports = router;
