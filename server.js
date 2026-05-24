const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'life_gap_fixer',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = db.promise();

// Test database connection
async function testConnection() {
    try {
        const connection = await promisePool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
    }
}
testConnection();

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
    try {
        const { full_name, email, password, phone, role, location, skills, hourly_rate, availability } = req.body;
        
        console.log('Registration attempt for:', email);
        
        // Check if user exists
        const [existing] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert user with status 'Active'
        const [result] = await promisePool.query(
            'INSERT INTO users (full_name, email, password, phone, role, status) VALUES (?, ?, ?, ?, ?, ?)',
            [full_name, email, hashedPassword, phone, role || 'user', 'Active']
        );
        
        console.log('User created with ID:', result.insertId);
        
        // If helper, add helper profile
        if (role === 'helper') {
            try {
                await promisePool.query(
                    'INSERT INTO helper_profiles (user_id, location, skills, hourly_rate, availability) VALUES (?, ?, ?, ?, ?)',
                    [result.insertId, location, skills, hourly_rate, availability]
                );
                console.log('Helper profile created');
            } catch (err) {
                console.log('Note: helper_profiles table not found, skipping');
            }
        }
        
        // Generate token
        const token = jwt.sign(
            { id: result.insertId, email, role: role || 'user' },
            process.env.JWT_SECRET || 'secretkey',
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            success: true,
            token,
            user: { 
                id: result.insertId, 
                full_name, 
                email, 
                role: role || 'user',
                phone 
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('Login attempt for:', email);
        
        const [users] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        const user = users[0];
        
        console.log('User found:', user.full_name, 'Status:', user.status);
        
        // Check if account is active
        if (user.status !== 'Active') {
            console.log('Account not active. Status:', user.status);
            return res.status(401).json({ message: 'Your account is not active. Please contact support.' });
        }
        
        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            console.log('Invalid password for:', email);
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secretkey',
            { expiresIn: '7d' }
        );
        
        console.log('Login successful for:', email);
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                phone: user.phone
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Get user profile
app.get('/api/auth/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'No token provided' });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        const [users] = await promisePool.query(
            'SELECT id, full_name, email, phone, role, created_at, status FROM users WHERE id = ?',
            [decoded.id]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json(users[0]);
    } catch (error) {
        console.error('Profile error:', error);
        res.status(401).json({ message: 'Invalid token' });
    }
});

// ============ TASK ENDPOINTS ============

// Create Task
app.post('/api/tasks/create', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        const { task_title, task_category, location, budget_range, deadline, urgency, task_description } = req.body;
        
        // Get user email from database
        const [users] = await promisePool.query('SELECT email FROM users WHERE id = ?', [decoded.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const user_email = users[0].email;
        
        const [result] = await promisePool.query(
            `INSERT INTO tasks (task_title, task_category, location, budget_range, deadline, urgency, task_description, user_email, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [task_title, task_category, location, budget_range, deadline, urgency, task_description, user_email]
        );
        
        res.status(201).json({ success: true, taskId: result.insertId });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Get User's Tasks (by email)
app.get('/api/tasks/my-tasks', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        
        // Get user email and id
        const [users] = await promisePool.query('SELECT email, id FROM users WHERE id = ?', [decoded.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const user_email = users[0].email;
        
        const [tasks] = await promisePool.query(
            `SELECT t.*, u.full_name as helper_name, u.id as helper_id, u.email as helper_email
             FROM tasks t 
             LEFT JOIN users u ON t.helper_email = u.email 
             WHERE t.user_email = ? 
             ORDER BY t.created_at DESC`,
            [user_email]
        );
        
        res.json(tasks);
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get All Active Tasks (for helpers)
app.get('/api/tasks/active', async (req, res) => {
    try {
        const [tasks] = await promisePool.query(
            `SELECT t.*, u.full_name as user_name, u.phone as user_phone
             FROM tasks t
             JOIN users u ON t.user_email = u.email
             WHERE t.status = 'pending'
             ORDER BY t.created_at DESC`
        );
        
        res.json(tasks);
    } catch (error) {
        console.error('Get active tasks error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Accept Task (Helper)
app.post('/api/tasks/accept/:taskId', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        const { taskId } = req.params;
        
        // Get helper email
        const [helpers] = await promisePool.query('SELECT email FROM users WHERE id = ? AND role = "helper"', [decoded.id]);
        if (helpers.length === 0) {
            return res.status(403).json({ message: 'Only helpers can accept tasks' });
        }
        
        const helper_email = helpers[0].email;
        
        // Check if task is still pending
        const [task] = await promisePool.query('SELECT * FROM tasks WHERE id = ? AND status = "pending"', [taskId]);
        if (task.length === 0) {
            return res.status(404).json({ message: 'Task not found or already accepted' });
        }
        
        await promisePool.query(
            'UPDATE tasks SET helper_email = ?, status = "accepted" WHERE id = ?',
            [helper_email, taskId]
        );
        
        res.json({ success: true, message: 'Task accepted successfully' });
    } catch (error) {
        console.error('Accept task error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update Task Status (Start Work)
app.put('/api/tasks/status/:taskId', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        const { taskId } = req.params;
        const { status } = req.body;
        
        // Get helper email
        const [helpers] = await promisePool.query('SELECT email FROM users WHERE id = ?', [decoded.id]);
        if (helpers.length === 0) {
            return res.status(404).json({ message: 'Helper not found' });
        }
        
        const helper_email = helpers[0].email;
        
        // Verify task belongs to this helper
        const [task] = await promisePool.query(
            'SELECT * FROM tasks WHERE id = ? AND helper_email = ?',
            [taskId, helper_email]
        );
        
        if (task.length === 0) {
            return res.status(404).json({ message: 'Task not found or not assigned to you' });
        }
        
        await promisePool.query('UPDATE tasks SET status = ? WHERE id = ?', [status, taskId]);
        
        console.log(`Task ${taskId} status updated to: ${status}`);
        res.json({ success: true, message: 'Task status updated' });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Helper's Tasks
app.get('/api/tasks/helper-tasks', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        
        // Get helper email
        const [helpers] = await promisePool.query('SELECT email FROM users WHERE id = ?', [decoded.id]);
        if (helpers.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const helper_email = helpers[0].email;
        
        const [tasks] = await promisePool.query(
            `SELECT t.*, u.full_name as user_name, u.phone as user_phone
             FROM tasks t
             JOIN users u ON t.user_email = u.email
             WHERE t.helper_email = ?
             ORDER BY t.created_at DESC`,
            [helper_email]
        );
        
        res.json(tasks);
    } catch (error) {
        console.error('Get helper tasks error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Complete Task (Helper marks as completed) - SIMPLIFIED WORKING VERSION
app.put('/api/tasks/complete/:taskId', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        const { taskId } = req.params;
        
        console.log('========== COMPLETE TASK REQUEST ==========');
        console.log('Task ID:', taskId);
        console.log('Helper ID:', decoded.id);
        
        // Get helper email
        const [helpers] = await promisePool.query('SELECT email FROM users WHERE id = ?', [decoded.id]);
        if (helpers.length === 0) {
            return res.status(404).json({ message: 'Helper not found' });
        }
        
        const helper_email = helpers[0].email;
        console.log('Helper email:', helper_email);
        
        // Check if task exists and is assigned to this helper
        const [task] = await promisePool.query(
            'SELECT * FROM tasks WHERE id = ? AND helper_email = ?',
            [taskId, helper_email]
        );
        
        if (task.length === 0) {
            return res.status(404).json({ message: 'Task not found or not assigned to you' });
        }
        
        console.log('Current task status:', task[0].status);
        console.log('Task title:', task[0].task_title);
        
        // Update task as completed - NO STATUS CHECK
        await promisePool.query(
            'UPDATE tasks SET status = "completed", completion_date = CURDATE() WHERE id = ?',
            [taskId]
        );
        
        console.log('✅ Task completed successfully:', taskId);
        res.json({ success: true, message: 'Task marked as completed!' });
        
    } catch (error) {
        console.error('Complete task error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Delete Task
app.delete('/api/tasks/:taskId', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        const { taskId } = req.params;
        
        // Get user email
        const [users] = await promisePool.query('SELECT email FROM users WHERE id = ?', [decoded.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const user_email = users[0].email;
        
        await promisePool.query('DELETE FROM tasks WHERE id = ? AND user_email = ?', [taskId, user_email]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============ REVIEW ENDPOINTS ============

// Add Review
app.post('/api/reviews/add', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        const { taskId, revieweeId, rating, comment } = req.body;
        
        console.log('Review submission:', { taskId, revieweeId, rating, comment, reviewerId: decoded.id });
        
        // Validate required fields
        if (!taskId || !revieweeId || !rating || !comment) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        // Check if task exists and is completed
        const [task] = await promisePool.query(
            'SELECT * FROM tasks WHERE id = ? AND status = "completed"', 
            [taskId]
        );
        
        if (task.length === 0) {
            return res.status(400).json({ message: 'Task not found or not completed' });
        }
        
        // Check if already reviewed
        const [existing] = await promisePool.query(
            'SELECT * FROM reviews WHERE task_id = ?', 
            [taskId]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ message: 'You have already reviewed this task' });
        }
        
        // Insert review
        await promisePool.query(
            'INSERT INTO reviews (task_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
            [taskId, decoded.id, revieweeId, rating, comment]
        );
        
        // Update helper's average rating
        const [reviews] = await promisePool.query(
            'SELECT AVG(rating) as avg_rating, COUNT(*) as total FROM reviews WHERE reviewee_id = ?',
            [revieweeId]
        );
        
        await promisePool.query(
            'UPDATE helper_profiles SET rating = ?, total_reviews = ? WHERE user_id = ?',
            [reviews[0].avg_rating || 0, reviews[0].total, revieweeId]
        );
        
        console.log('Review added successfully');
        res.json({ success: true, message: 'Review submitted successfully!' });
    } catch (error) {
        console.error('Add review error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Get Reviews for Helper
app.get('/api/reviews/helper/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const [reviews] = await promisePool.query(
            `SELECT r.*, t.task_title, u.full_name as reviewer_name 
             FROM reviews r
             JOIN tasks t ON r.task_id = t.id
             JOIN users u ON r.reviewer_id = u.id
             WHERE r.reviewee_id = ?
             ORDER BY r.created_at DESC`,
            [userId]
        );
        
        res.json(reviews);
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============ ADMIN ENDPOINTS ============

// Get Dashboard Stats
app.get('/api/admin/stats', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        if (decoded.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
        
        const [totalUsers] = await promisePool.query('SELECT COUNT(*) as count FROM users WHERE role = "user"');
        const [totalHelpers] = await promisePool.query('SELECT COUNT(*) as count FROM users WHERE role = "helper"');
        const [totalTasks] = await promisePool.query('SELECT COUNT(*) as count FROM tasks');
        const [pendingTasks] = await promisePool.query('SELECT COUNT(*) as count FROM tasks WHERE status = "pending"');
        const [completedTasks] = await promisePool.query('SELECT COUNT(*) as count FROM tasks WHERE status = "completed"');
        const [totalReviews] = await promisePool.query('SELECT COUNT(*) as count FROM reviews');
        
        res.json({
            totalUsers: totalUsers[0].count,
            totalHelpers: totalHelpers[0].count,
            totalTasks: totalTasks[0].count,
            pendingTasks: pendingTasks[0].count,
            completedTasks: completedTasks[0].count,
            totalReviews: totalReviews[0].count
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get All Users
app.get('/api/admin/users', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        if (decoded.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
        
        const [users] = await promisePool.query(
            'SELECT id, full_name, email, phone, role, status, created_at FROM users WHERE role != "admin" ORDER BY created_at DESC'
        );
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get All Helpers
app.get('/api/admin/helpers', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        if (decoded.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
        
        const [helpers] = await promisePool.query(
            `SELECT u.id, u.full_name, u.email, u.phone, u.created_at,
                    hp.location, hp.skills, hp.hourly_rate, hp.rating
             FROM users u
             LEFT JOIN helper_profiles hp ON u.id = hp.user_id
             WHERE u.role = "helper"
             ORDER BY u.created_at DESC`
        );
        res.json(helpers);
    } catch (error) {
        console.error('Get helpers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get All Tasks
app.get('/api/admin/tasks', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        if (decoded.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
        
        const [tasks] = await promisePool.query(
            `SELECT t.*, 
                    u1.full_name as user_name, 
                    u2.full_name as helper_name
             FROM tasks t
             LEFT JOIN users u1 ON t.user_email = u1.email
             LEFT JOIN users u2 ON t.helper_email = u2.email
             ORDER BY t.created_at DESC`
        );
        res.json(tasks);
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get All Reviews
app.get('/api/admin/reviews', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        if (decoded.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
        
        const [reviews] = await promisePool.query(
            `SELECT r.*, 
                    t.task_title,
                    u1.full_name as reviewer_name, 
                    u2.full_name as reviewee_name
             FROM reviews r
             JOIN tasks t ON r.task_id = t.id
             JOIN users u1 ON r.reviewer_id = u1.id
             JOIN users u2 ON r.reviewee_id = u2.id
             ORDER BY r.created_at DESC`
        );
        res.json(reviews);
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete User
app.delete('/api/admin/user/:userId', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        if (decoded.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
        
        const { userId } = req.params;
        
        const [user] = await promisePool.query('SELECT role FROM users WHERE id = ?', [userId]);
        if (user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user[0].role === 'admin') {
            return res.status(403).json({ message: 'Cannot delete admin' });
        }
        
        await promisePool.query('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update User Profile - FIXED VERSION
app.put('/api/auth/update-profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        const { full_name, email, phone, password } = req.body;
        
        console.log('Updating profile for user ID:', decoded.id);
        console.log('Update data:', { full_name, email, phone, password: password ? '***' : 'not changed' });
        
        // Check if email already exists for another user
        if (email) {
            const [existing] = await promisePool.query(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, decoded.id]
            );
            if (existing.length > 0) {
                return res.status(400).json({ success: false, message: 'Email already exists for another user' });
            }
        }
        
        // Build update query
        let updateQuery = 'UPDATE users SET full_name = ?, email = ?, phone = ?';
        let params = [full_name, email, phone || ''];
        
        // If password is provided and not empty, hash and update it
        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateQuery += ', password = ?';
            params.push(hashedPassword);
        }
        
        updateQuery += ' WHERE id = ?';
        params.push(decoded.id);
        
        await promisePool.query(updateQuery, params);
        
        console.log('Profile updated successfully for user:', decoded.id);
        res.json({ success: true, message: 'Profile updated successfully' });
        
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// Test endpoint
app.get('/', (req, res) => {
    res.json({ message: 'Life Gap Fixer API is running!' });
});

const PORT = process.env.PORT || 5000;
// Export for Vercel (add this at the end)
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}