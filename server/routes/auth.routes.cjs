const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller.cjs');
const { authenticate } = require('../middleware/auth.cjs');

// Email OTP (legacy)
router.post('/send-otp', AuthController.sendOtp);
router.post('/verify-otp', AuthController.verifyOtp);

// Standard email/password registration
router.post('/register', AuthController.register);

// Firebase Auth (Google / Facebook / Phone)
router.post('/firebase-login', AuthController.firebaseLogin);

// Social login (Google / Facebook) - legacy
router.post('/social-login', AuthController.socialLogin);

// Login (email/phone + password)
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);

// Profile
router.get('/me', authenticate, AuthController.me);
router.put('/profile', authenticate, AuthController.updateProfile);
router.put('/change-password', authenticate, AuthController.changePassword);

module.exports = router;
