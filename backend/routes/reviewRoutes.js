const express = require('express');
const { addReview, getUserReviews } = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/add', protect, addReview);
router.get('/user/:userId', protect, getUserReviews);

module.exports = router;