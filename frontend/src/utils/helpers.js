// Authentication utilities
export const getStoredUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('Error parsing stored user:', error);
    return null;
  }
};

export const setStoredUser = (user) => {
  localStorage.setItem('user', JSON.stringify(user));
};

export const getStoredToken = () => {
  return localStorage.getItem('accessToken');
};

export const setStoredTokens = (accessToken, refreshToken) => {
  localStorage.setItem('accessToken', accessToken);
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
};

export const clearStoredAuth = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('token'); // Clear legacy token format
  localStorage.removeItem('user');
};

export const isAuthenticated = () => {
  const token = getStoredToken() || localStorage.getItem('token'); // Support both token formats
  const user = getStoredUser();
  return !!(token && user);
};

// Role-based routing
export const getRoleBasedRoute = (role) => {
  const routes = {
    superadmin: '/superadmin/dashboard',
    admin: '/admin/dashboard',
    tutor: '/tutor/dashboard',
    parent: '/parent/dashboard',
    student: '/student/dashboard'
  };
  return routes[role] || '/login';
};

// Format utilities
export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatRelativeTime = (date) => {
  if (!date) return '';
  
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return formatDate(date);
};

export const formatMemoryUsage = (bytes) => {
  if (!bytes) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

export const formatUptime = (seconds) => {
  if (!seconds) return '0s';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// Validation utilities
export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validatePassword = (password) => {
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[@$!%*?&]/.test(password);
  
  return {
    isValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial,
    minLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial
  };
};

// Error handling utilities
export const getErrorMessage = (error) => {
  // Handle validation errors with details
  if (error.response?.data?.details && Array.isArray(error.response.data.details)) {
    return error.response.data.details.join(', ');
  }
  
  // Handle single validation error with details
  if (error.response?.data?.details && typeof error.response.data.details === 'string') {
    return error.response.data.details;
  }
  
  // Handle standard error messages
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

// Permission utilities
export const hasPermission = (userRole, requiredPermissions) => {
  if (!Array.isArray(requiredPermissions)) {
    requiredPermissions = [requiredPermissions];
  }
  
  const rolePermissions = {
    superadmin: ['*'],
    admin: ['manage_center', 'view_all_classes', 'manage_tutors', 'manage_students'],
    tutor: ['view_assigned_classes', 'manage_class_content', 'view_students'],
    parent: ['view_children_progress', 'communicate_tutors'],
    student: ['view_classes', 'submit_assignments', 'view_progress']
  };
  
  const userPermissions = rolePermissions[userRole] || [];
  
  if (userPermissions.includes('*')) return true;
  
  return requiredPermissions.every(permission => 
    userPermissions.includes(permission)
  );
};
