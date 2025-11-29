import api from './api';

export const homeworkAPI = {
  getAssignmentFormData: (params = {}) => {
    console.log('Making API call with params:', params);
    return api.get('/homework-form/data', { params });
  },

  getTutorClasses: () => {
    console.log('Fetching tutor classes');
    return api.get('/classes/my-classes');
  },

  getTutorAssignments: (params = {}) => {
    console.log('🔄 Fetching expanded tutor assignments with params:', params);
    return api.get('/homework-assignments/tutor/expanded', { params })
      .then(response => {
        console.log('✅ Tutor assignments response:', response);
        return response;
      })
      .catch(error => {
        console.error('❌ Error fetching tutor assignments:', error);
        throw error;
      });
  },

  assignHomework: (data) => {
    return api.post('/homework-assignments/assign', data);
  },
};