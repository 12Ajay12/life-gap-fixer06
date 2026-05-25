// Load active tasks for helpers
async function loadActiveTasks() {
    try {
        const response = await authFetch('/tasks/active');
        const tasks = await response.json();
        
        const tasksContainer = document.getElementById('activeTasksList');
        if (!tasksContainer) return;
        
        if (tasks.length === 0) {
            tasksContainer.innerHTML = '<div class="task-card"><p style="text-align: center;">No active tasks available.</p></div>';
            return;
        }
        
        tasksContainer.innerHTML = tasks.map(task => `
            <div class="task-card">
                <span class="task-status status-${task.status}">${task.status.toUpperCase()}</span>
                <h3>${task.task_title}</h3>
                <p><strong>Posted by:</strong> ${task.user_name}</p>
                <p><strong>Contact:</strong> ${task.user_phone}</p>
                <p><strong>Category:</strong> ${task.task_category}</p>
                <p><strong>Location:</strong> ${task.location}</p>
                <p><strong>Budget:</strong> ${task.budget_range}</p>
                <p><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>
                <p><strong>Description:</strong> ${task.task_description.substring(0, 100)}${task.task_description.length > 100 ? '...' : ''}</p>
                ${task.status === 'pending' ? `<button class="btn btn-primary" onclick="acceptTask(${task.id})">Accept Task</button>` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading tasks:', error);
        showAlert('Error loading tasks', 'error');
    }
}

// Load helper's accepted tasks
async function loadMyTasks() {
    try {
        const response = await authFetch('/tasks/helper-tasks');
        const tasks = await response.json();
        
        const tasksContainer = document.getElementById('myTasksList');
        if (!tasksContainer) return;
        
        if (tasks.length === 0) {
            tasksContainer.innerHTML = '<div class="task-card"><p style="text-align: center;">No tasks assigned yet.</p></div>';
            return;
        }
        
        tasksContainer.innerHTML = tasks.map(task => `
            <div class="task-card">
                <span class="task-status status-${task.status}">${task.status.toUpperCase()}</span>
                <h3>${task.task_title}</h3>
                <p><strong>User:</strong> ${task.user_name}</p>
                <p><strong>Location:</strong> ${task.location}</p>
                <p><strong>Budget:</strong> ${task.budget_range}</p>
                <p><strong>Description:</strong> ${task.task_description.substring(0, 100)}</p>
                <div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${task.status === 'accepted' ? `<button class="btn btn-warning" onclick="updateTaskStatus(${task.id}, 'in_progress')">Start Work</button>` : ''}
                    ${task.status === 'in_progress' ? `<button class="btn btn-success" onclick="updateTaskStatus(${task.id}, 'completed')">Mark Complete</button>` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading my tasks:', error);
        showAlert('Error loading my tasks', 'error');
    }
}

// Accept task
async function acceptTask(taskId) {
    try {
        const response = await authFetch(`/tasks/accept/${taskId}`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showAlert('Task accepted successfully!', 'success');
            loadActiveTasks();
            loadMyTasks();
        } else {
            const data = await response.json();
            showAlert(data.message || 'Failed to accept task', 'error');
        }
    } catch (error) {
        console.error('Error accepting task:', error);
        showAlert('Error accepting task', 'error');
    }
}

// Update task status
async function updateTaskStatus(taskId, status) {
    try {
        const response = await authFetch(`/tasks/status/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showAlert(`Task marked as ${status.replace('_', ' ')}!`, 'success');
            loadMyTasks();
            loadActiveTasks();
        } else {
            const data = await response.json();
            showAlert(data.message || 'Failed to update status', 'error');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showAlert('Error updating status', 'error');
    }
}

// Load helper profile
async function loadHelperProfile() {
    try {
        const response = await authFetch('/auth/profile');
        const user = await response.json();
        
        const profileInfo = document.getElementById('profileInfo');
        if (profileInfo && user.helper_profile) {
            profileInfo.innerHTML = `
                <p><strong>Name:</strong> ${user.full_name}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Phone:</strong> ${user.phone}</p>
                <p><strong>Location:</strong> ${user.helper_profile.location}</p>
                <p><strong>Skills:</strong> ${user.helper_profile.skills}</p>
                <p><strong>Hourly Rate:</strong> $${user.helper_profile.hourly_rate}</p>
                <p><strong>Rating:</strong> ⭐ ${user.helper_profile.rating || 'No ratings yet'}</p>
            `;
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    if (user.role !== 'helper') {
        if (user.role === 'user') window.location.href = 'user-dashboard.html';
        else if (user.role === 'admin') window.location.href = 'admin-dashboard.html';
    }
    
    loadHelperProfile();
    loadActiveTasks();
    loadMyTasks();
});