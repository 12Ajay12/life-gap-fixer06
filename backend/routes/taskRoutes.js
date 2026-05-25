const express = require('express');
const {
    createTask,
    getUserTasks,
    getActiveTasks,
    acceptTask,
    updateTaskStatus,
    getHelperTasks,
    deleteTask
} = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');

const router = express.Router();

router.post('/create', protect, checkRole('user'), createTask);
router.get('/my-tasks', protect, checkRole('user'), getUserTasks);
router.get('/active', protect, checkRole('helper'), getActiveTasks);
router.post('/accept/:taskId', protect, checkRole('helper'), acceptTask);
router.put('/status/:taskId', protect, updateTaskStatus);
router.get('/helper-tasks', protect, checkRole('helper'), getHelperTasks);
router.delete('/:taskId', protect, checkRole('user'), deleteTask);

module.exports = router;