import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Support both new accessToken and legacy token formats
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      // Debug: Log token usage
      console.log('🔑 Using token for API call:', token.substring(0, 20) + '...');
    } else {
      console.log('⚠️ No token found for API call');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken
        });

        const { accessToken } = response.data;
        localStorage.setItem('accessToken', accessToken);

        // Retry the original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API methods
export const authAPI = {
  login: (identifier, password, role) =>
    api.post('/auth/login', { identifier, password, role }),
  
  register: (userData) =>
    api.post('/auth/register', userData),
  
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  
  logout: () => api.post('/auth/logout'),
};

export const dashboardAPI = {
  getSuperAdminData: () => api.get('/dashboard/superadmin'),
  getAdminData: () => api.get('/dashboard/admin'),
  getTutorData: () => api.get('/dashboard/tutor'),
  getParentData: () => api.get('/dashboard/parent'),
  getStudentData: () => api.get('/dashboard/student'),
  
  // Enhanced dashboard endpoints
  getEnhancedTutorData: () => api.get('/dashboard-enhanced/tutor'),
  
  checkPermission: (permission) => api.get(`/dashboard/check-permission/${permission}`),
  checkResourceAccess: (resourceType, resourceId) => 
    api.get(`/dashboard/resources/${resourceType}/${resourceId}`),
  
  // Subjects endpoints
  getSubjects: () => api.get('/dashboard/admin/subjects'),
};

// Note: Main homeworkAPI declaration moved to the bottom of this file
export const userAPI = {
  getCurrentUser: () => api.get('/auth/me'),
  updateProfile: (userData) => api.put('/auth/profile', userData),
  
  // Get all users with filtering by role
  getAllUsers: (role = null, params = {}) => {
    const queryParams = { ...params };
    if (role) {
      queryParams.role = role;
    }
    return api.get('/users', { params: queryParams });
  },
  
  // Create a new user
  createUser: (userData) => api.post('/users', userData),
  
  // Update a user
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  
  // Delete a user
  deleteUser: (id) => api.delete(`/users/${id}`),
};

export const centersAPI = {
  // Get all centers with optional filtering
  getCenters: (params = {}) => api.get('/centers', { params }),
  
  // Get a specific center by ID
  getCenter: (id) => api.get(`/centers/${id}`),
  
  // Create a new center
  createCenter: (centerData) => api.post('/centers', centerData),
  
  // Update a center
  updateCenter: (id, centerData) => api.put(`/centers/${id}`, centerData),
  
  // Delete a center
  deleteCenter: (id) => api.delete(`/centers/${id}`),
  
  // Create and assign admin to center
  createAndAssignAdmin: (centerId, adminData) => 
    api.post(`/centers/${centerId}/admin`, adminData),
  
  // Change center admin
  changeAdmin: (centerId, adminId) => 
    api.put(`/centers/${centerId}/admin`, { adminId }),
  
  // Assign existing admin to center
  assignAdmin: (centerId, adminId) => 
    api.put(`/centers/${centerId}/admin`, { adminId }),
  
  // Deactivate center
  deactivateCenter: (id) => api.patch(`/centers/${id}/deactivate`),
  
  // Reactivate center
  reactivateCenter: (id) => api.patch(`/centers/${id}/activate`),
  
  // Get available admins (not assigned to any center)
  getAvailableAdmins: () => api.get('/centers/admins/available'),
  
  // Get center statistics
  getCenterStatistics: (id) => api.get(`/centers/${id}/statistics`),
};

export const usersAPI = {
  // Get all users with optional filtering
  getUsers: (params = {}) => api.get('/users', { params }),
  
  // Create a new user
  createUser: (userData) => api.post('/users', userData),
  
  // Get all admins with optional filtering by center
  getAdmins: (params = {}) => api.get('/users/admins', { params }),
  
  // Get a specific user by ID
  getUser: (id) => api.get(`/users/${id}`),
  
  // Find user by email (for bulk upload duplicate checking)
  findUserByEmail: (email) => api.get('/users', { params: { search: email, role: 'parent' } }),
  
  // Update user
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  
  // Delete user
  deleteUser: (id) => api.delete(`/users/${id}`),
  
  // Toggle user status
  toggleUserStatus: (id) => api.patch(`/users/${id}/toggle-status`),
  
  // Reassign admin to different center
  reassignAdmin: (adminId, centerId) => api.put(`/users/${adminId}/reassign`, { centerId }),
};

export const tutorsAPI = {
  // Get all tutors with pagination, search, and filtering
  getTutors: (params = {}) => api.get('/tutors', { params }),
  
  // Get a specific tutor by ID
  getTutor: (id) => api.get(`/tutors/${id}`),
  
  // Create a new tutor (with file upload support)
  createTutor: (formData) => api.post('/tutors', formData),
  
  // Update a tutor (with file upload support)
  updateTutor: (id, formData) => api.put(`/tutors/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  
  // Delete a tutor
  deleteTutor: (id) => api.delete(`/tutors/${id}`),
  
  // Bulk delete tutors
  bulkDeleteTutors: (tutorIds) => api.post('/tutors/bulk-delete', { tutorIds }),
  
  // Update tutor status
  updateTutorStatus: (id, status) => api.patch(`/tutors/${id}/status`, status),
  
  // Download tutor CV
  downloadCV: (id) => api.get(`/tutors/${id}/cv`, {
    responseType: 'blob',
  }),
};

export const homeworkAPI = {
  // Student answer management
  saveProgress: (data) => api.post('/student-answers/save-progress', data),
  submit: (data) => api.post('/student-answers/submit', data),
  getAnswers: (assignmentId) => api.get(`/student-answers/${assignmentId}`),
  updateCompletionStatus: (assignmentId) => 
    api.put(`/homework-assignments/${assignmentId}/update-status`),
    
  // Admin homework management
  getAllHomework: () => api.get('/dashboard/admin/homeworks'),
  createHomework: (formData) => api.post('/dashboard/admin/homeworks', formData),
  updateHomework: (id, formData) => api.put(`/dashboard/admin/homeworks/${id}`, formData),
  deleteHomework: (id) => api.delete(`/dashboard/admin/homeworks/${id}`),
  
  // Homework assignments
  getTutorAssignments: (params = {}) => api.get('/homework-assignments/tutor', { params }),
  getStudentAssignments: (params = {}) => api.get('/homework-assignments/student', { params }),
  assignHomework: (data) => api.post('/homework-assignments/assign', data),
  updateAssignmentStatus: (id, data) => api.put(`/homework-assignments/${id}/status`, data),
  updateAssignment: (id, data) => api.put(`/homework-assignments/${id}`, data),
  cancelAssignment: (id) => api.delete(`/homework-assignments/${id}`),
  getAssignmentFormData: (params = {}) => api.get('/homework-form/data', { params }),
  getHomeworkList: (params = {}) => api.get('/homework-assignments/homework-list', { params }),
  getAssignmentDetails: (id) => api.get(`/homework-assignments/${id}`),
  getEnrolledStudents: (params = {}) => api.get('/homework-assignments/tutor/enrolled-students', { params }),
  getExpandedAssignments: (params = {}) => api.get('/homework-assignments/admin/expanded', { params }),
  
  // Study tracking
  startStudySession: (assignmentId) => api.post(`/student-answers/${assignmentId}/start-session`),
  endStudySession: (assignmentId) => api.post(`/student-answers/${assignmentId}/end-session`),
  getStudyData: (assignmentId, params = {}) => api.get(`/student-answers/${assignmentId}/study-data`, { params }),
  updateTaskProgress: (assignmentId, data) => api.post(`/student-answers/${assignmentId}/update-task-progress`, data)
};

export const sessionParticipantsAPI = {
  // Get session participants history
  getHistory: (params = {}) => api.get('/session-participants/history', { params }),
  
  // Get active session participants
  getActive: () => api.get('/session-participants/active'),
  
  // Join a session
  joinSession: (data) => api.post('/session-participants/join', data),
  
  // End a session
  endSession: (data) => api.post('/session-participants/end', data)
};

export const studentsAPI = {
  // Create a new student
  createStudent: (studentData) => api.post('/students', studentData),
  
  // Get all students
  getStudents: (params = {}) => api.get('/students', { params }),
  
  // Get a specific student by ID
  getStudent: (id) => api.get(`/students/${id}`),
  
  // Update a student
  updateStudent: (id, studentData) => api.put(`/students/${id}`, studentData),
  
  // Delete a student
  deleteStudent: (id) => api.delete(`/students/${id}`)
};

export const parentsAPI = {
  // Create a new parent
  createParent: (parentData) => api.post('/parents', parentData),
  
  // Get all parents
  getParents: (params = {}) => api.get('/parents', { params }),
  
  // Get a specific parent by ID
  getParent: (id) => api.get(`/parents/${id}`),
  
  // Update a parent
  updateParent: (id, parentData) => api.put(`/parents/${id}`, parentData),
  
  // Delete a parent
  deleteParent: (id) => api.delete(`/parents/${id}`)
};

export default api;
