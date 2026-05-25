// Load dashboard statistics
async function loadStats() {
    try {
        const response = await authFetch('/admin/stats');
        const stats = await response.json();
        
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('totalHelpers').textContent = stats.totalHelpers;
        document.getElementById('totalTasks').textContent = stats.totalTasks;
        document.getElementById('pendingTasks').textContent = stats.pendingTasks;
        document.getElementById('completedTasks').textContent = stats.completedTasks;
        document.getElementById('totalReviews').textContent = stats.totalReviews;
    } catch (error) {
        console.error('Error loading stats:', error);
        showAlert('Error loading statistics', 'error');
    }
}

// Load all users
async function loadUsers() {
    try {
        const response = await authFetch('/admin/users');
        const users = await response.json();
        
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${user.full_name}</td>
                <td>${user.email}</td>
                <td>${user.phone}</td>
                <td><span class="task-status" style="background: var(--accent);">${user.role}</span></td>
                <td>${user.is_active ? 'Active' : 'Inactive'}</td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Error loading users', 'error');
    }
}

// Load all tasks
async function loadTasks() {
    try {
        const response = await authFetch('/admin/tasks');
        const tasks = await response.json();
        
        const tbody = document.getElementById('tasksTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = tasks.map(task => `
            <tr>
                <td>${task.id}</td>
                <td>${task.task_title}</td>
                <td>${task.user_name || 'N/A'}</td>
                <td>${task.helper_name || 'Not assigned'}</td>
                <td>${task.location}</td>
                <td>${task.budget_range}</td>
                <td><span class="task-status status-${task.status}">${task.status}</span></td>
                <td>${new Date(task.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading tasks:', error);
        showAlert('Error loading tasks', 'error');
    }
}

// Load all reviews
async function loadReviews() {
    try {
        const response = await authFetch('/admin/reviews');
        const reviews = await response.json();
        
        const tbody = document.getElementById('reviewsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = reviews.map(review => `
            <tr>
                <td>${review.id}</td>
                <td>${review.task_title}</td>
                <td>${review.reviewer_name}</td>
                <td>${review.reviewee_name}</td>
                <td>${'⭐'.repeat(review.rating)}</td>
                <td>${review.comment}</td>
                <td>${new Date(review.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading reviews:', error);
        showAlert('Error loading reviews', 'error');
    }
}

// Delete user
async function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        try {
            const response = await authFetch(`/admin/user/${userId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showAlert('User deleted successfully', 'success');
                loadUsers();
                loadStats();
            } else {
                const data = await response.json();
                showAlert(data.message || 'Failed to delete user', 'error');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            showAlert('Error deleting user', 'error');
        }
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    if (user.role !== 'admin') {
        if (user.role === 'user') window.location.href = 'user-dashboard.html';
        else if (user.role === 'helper') window.location.href = 'helper-dashboard.html';
    }
    
    loadStats();
    loadUsers();
    loadTasks();
    loadReviews();
});