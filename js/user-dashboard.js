const API_URL = 'http://localhost:5000/api';

// Load user tasks
async function loadUserTasks() {
    try {
        const response = await authFetch('/tasks/my-tasks');
        const tasks = await response.json();
        
        const tasksContainer = document.getElementById('tasksList');
        if (!tasksContainer) return;
        
        if (tasks.length === 0) {
            tasksContainer.innerHTML = '<div class="task-card"><p style="text-align: center;">No tasks yet. Create your first task!</p></div>';
            return;
        }
        
        tasksContainer.innerHTML = tasks.map(task => `
            <div class="task-card">
                <span class="task-status status-${task.status}">${task.status.toUpperCase()}</span>
                <h3>${task.task_title}</h3>
                <p><strong>Category:</strong> ${task.task_category}</p>
                <p><strong>Location:</strong> ${task.location}</p>
                <p><strong>Budget:</strong> ${task.budget_range}</p>
                <p><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>
                <p><strong>Description:</strong> ${task.task_description.substring(0, 100)}${task.task_description.length > 100 ? '...' : ''}</p>
                ${task.helper_name ? `<p><strong>Helper:</strong> ${task.helper_name}</p>` : ''}
                <div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${task.status === 'pending' ? `<button class="btn btn-danger btn-sm" onclick="deleteTask(${task.id})">Delete</button>` : ''}
                    ${task.status === 'completed' ? `<button class="btn btn-primary btn-sm" onclick="showReviewModal(${task.id}, ${task.helper_id})">Leave Review</button>` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading tasks:', error);
        showAlert('Error loading tasks', 'error');
    }
}

// Create new task
async function createTask(event) {
    event.preventDefault();
    
    const taskData = {
        task_title: document.getElementById('task_title').value,
        task_category: document.getElementById('task_category').value,
        location: document.getElementById('location').value,
        budget_range: document.getElementById('budget_range').value,
        deadline: document.getElementById('deadline').value,
        urgency: document.getElementById('urgency').value,
        task_description: document.getElementById('task_description').value
    };
    
    try {
        const response = await authFetch('/tasks/create', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
        
        if (response.ok) {
            showAlert('Task created successfully!', 'success');
            document.getElementById('createTaskForm').reset();
            document.getElementById('createModal').classList.remove('active');
            loadUserTasks();
        } else {
            const data = await response.json();
            showAlert(data.message || 'Failed to create task', 'error');
        }
    } catch (error) {
        console.error('Error creating task:', error);
        showAlert('Error creating task', 'error');
    }
}

// Delete task
async function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        try {
            const response = await authFetch(`/tasks/${taskId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showAlert('Task deleted successfully', 'success');
                loadUserTasks();
            } else {
                showAlert('Failed to delete task', 'error');
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            showAlert('Error deleting task', 'error');
        }
    }
}

// Show review modal
function showReviewModal(taskId, helperId) {
    const modal = document.getElementById('reviewModal');
    if (modal) {
        document.getElementById('reviewTaskId').value = taskId;
        document.getElementById('reviewRevieweeId').value = helperId;
        modal.classList.add('active');
    }
}

// Submit review
async function submitReview(event) {
    event.preventDefault();
    
    const reviewData = {
        taskId: parseInt(document.getElementById('reviewTaskId').value),
        revieweeId: parseInt(document.getElementById('reviewRevieweeId').value),
        rating: parseInt(document.getElementById('rating').value),
        comment: document.getElementById('comment').value
    };
    
    try {
        const response = await authFetch('/reviews/add', {
            method: 'POST',
            body: JSON.stringify(reviewData)
        });
        
        if (response.ok) {
            showAlert('Review submitted successfully!', 'success');
            document.getElementById('reviewModal').classList.remove('active');
            document.getElementById('reviewForm').reset();
            loadUserTasks();
        } else {
            const data = await response.json();
            showAlert(data.message || 'Failed to submit review', 'error');
        }
    } catch (error) {
        console.error('Error submitting review:', error);
        showAlert('Error submitting review', 'error');
    }
}

// Load user profile
async function loadUserProfile() {
    try {
        const response = await authFetch('/auth/profile');
        const user = await response.json();
        
        const profileInfo = document.getElementById('profileInfo');
        if (profileInfo) {
            profileInfo.innerHTML = `
                <p><strong>Name:</strong> ${user.full_name}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Phone:</strong> ${user.phone}</p>
                <p><strong>Member since:</strong> ${new Date(user.created_at).toLocaleDateString()}</p>
            `;
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in and is a user
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    if (user.role !== 'user') {
        if (user.role === 'helper') window.location.href = 'helper-dashboard.html';
        else if (user.role === 'admin') window.location.href = 'admin-dashboard.html';
    }
    
    loadUserProfile();
    loadUserTasks();
    
    // Setup create task form
    const createForm = document.getElementById('createTaskForm');
    if (createForm) {
        createForm.addEventListener('submit', createTask);
    }
    
    // Setup review form
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
        reviewForm.addEventListener('submit', submitReview);
    }
    
    // Setup modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('active');
            });
        });
    });
});