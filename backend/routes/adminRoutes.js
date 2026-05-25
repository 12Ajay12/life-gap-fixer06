const express = require('express');
const {
    getAllUsers,
    getAllTasks,
    getAllReviews,
    deleteUser,
    getDashboardStats
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect, checkRole('admin'));

router.get('/users', getAllUsers);
router.get('/tasks', getAllTasks);
router.get('/reviews', getAllReviews);
router.delete('/user/:userId', deleteUser);
router.get('/stats', getDashboardStats);

module.exports = router;