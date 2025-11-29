import api from '../utils/api';

export const getAssignmentFormData = async (gradeId = null) => {
  try {
    const params = gradeId ? { gradeId } : {};
    const response = await api.get('/homework-form/data', { params });
    return response;
  } catch (error) {
    console.error('Error getting form data:', error);
    throw error;
  }
};