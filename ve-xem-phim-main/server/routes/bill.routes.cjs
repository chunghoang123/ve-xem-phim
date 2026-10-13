const express = require('express');
const router = express.Router();
const BillController = require('../controllers/bill.controller.cjs');
const { authenticate } = require('../middleware/auth.cjs');

router.get('/', authenticate, BillController.getMyBills);
router.get('/:id', authenticate, BillController.getById);

module.exports = router;
