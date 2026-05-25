// API Configuration
const API_URL = 'https://life-gap-fixer06.onrender.com/api';

// Check if user is logged in
function isLoggedIn() {
    const token = localStorage.getItem('token');
    return !!token;
}

// Get current user
function getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// Update navigation based on login status
function updateNavigation() {
    const loginNav = document.getElementById('loginNav');
    const registerNav = document.getElementById('registerNav');
    const dashboardNav = document.getElementById('dashboardNav');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (isLoggedIn()) {
        const user = getCurrentUser();
        if (loginNav) loginNav.style.display = 'none';
        if (registerNav) registerNav.style.display = 'none';
        if (dashboardNav) {
            dashboardNav.style.display = 'block';
            // Set dashboard link based on role
            if (user.role === 'user') {
                dashboardNav.href = 'user-dashboard.html';
                dashboardNav.textContent = 'My Dashboard';
            } else if (user.role === 'helper') {
                dashboardNav.href = 'helper-dashboard.html';
                dashboardNav.textContent = 'Helper Dashboard';
            } else if (user.role === 'admin') {
                dashboardNav.href = 'admin-dashboard.html';
                dashboardNav.textContent = 'Admin Panel';
            }
        }
        if (logoutBtn) logoutBtn.style.display = 'block';
    } else {
        if (loginNav) loginNav.style.display = 'block';
        if (registerNav) registerNav.style.display = 'block';
        if (dashboardNav) dashboardNav.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Show alert message
function showAlert(message, type = 'success') {
    const alertDiv = document.getElementById('alert');
    if (alertDiv) {
        alertDiv.textContent = message;
        alertDiv.className = `alert alert-${type} show`;
        setTimeout(() => {
            alertDiv.classList.remove('show');
        }, 5000);
    } else {
        alert(message);
    }
}

// Login function
async function login(email, password) {
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            showAlert('Login successful!', 'success');
            
            // Redirect based on role
            setTimeout(() => {
                if (data.user.role === 'user') {
                    window.location.href = 'user-dashboard.html';
                } else if (data.user.role === 'helper') {
                    window.location.href = 'helper-dashboard.html';
                } else if (data.user.role === 'admin') {
                    window.location.href = 'admin-dashboard.html';
                }
            }, 1000);
        } else {
            showAlert(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

// Register function
async function register(userData) {
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            showAlert('Registration successful!', 'success');
            
            setTimeout(() => {
                if (data.user.role === 'user') {
                    window.location.href = 'user-dashboard.html';
                } else if (data.user.role === 'helper') {
                    window.location.href = 'helper-dashboard.html';
                }
            }, 1000);
        } else {
            showAlert(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

// Make authenticated request
async function authFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    });
    
    if (response.status === 401) {
        logout();
        throw new Error('Session expired. Please login again.');
    }
    
    return response;
}

// Theme toggle
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
    } else if (savedTheme === 'light') {
        document.body.classList.remove('dark');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark');
    }
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (document.body.classList.contains('dark')) {
                document.body.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            } else {
                document.body.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            }
        });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateNavigation();
    initTheme();
    
    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
});
