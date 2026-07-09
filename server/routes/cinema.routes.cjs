const express = require('express');
const router = express.Router();
const CinemaController = require('../controllers/cinema.controller.cjs');
const { authenticate } = require('../middleware/auth.cjs');
const authorize = require('../middleware/authorize.cjs');

router.get('/', CinemaController.getAll);
router.get('/locations', CinemaController.getLocations);
router.get('/nearby', CinemaController.getNearby);
router.get('/places/nearby', CinemaController.searchNearbyPlaces);
router.get('/places/:placeId', CinemaController.getPlaceDetails);
router.get('/places/photo/:photoName', CinemaController.getPlacePhotoUrl);
router.get('/:id', CinemaController.getById);
router.post('/', authenticate, authorize('admin', 'staff'), CinemaController.create);
router.put('/:id', authenticate, authorize('admin', 'staff'), CinemaController.update);
router.delete('/:id', authenticate, authorize('admin'), CinemaController.delete);

module.exports = router;
