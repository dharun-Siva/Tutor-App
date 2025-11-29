// API Configuration for Production
const getApiBaseUrl = () => {
  // In production, use the environment variable or a fallback
  if (process.env.NODE_ENV === 'production') {
    return process.env.REACT_APP_API_URL || window.location.origin + '/api';
  }
  
  // In development, use environment variable or localhost fallback
  return process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
};

const getBackendUrl = () => {
  // In production, use the environment variable or a fallback
  if (process.env.NODE_ENV === 'production') {
    return process.env.REACT_APP_BACKEND_URL || window.location.origin;
  }
  
  // In development, use environment variable or localhost fallback
  return process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
};

const getMeetingServerUrl = () => {
  // In production, use the environment variable or a fallback
  if (process.env.NODE_ENV === 'production') {
    return process.env.REACT_APP_MEETING_SERVER_URL || window.location.origin;
  }
  
  // In development, use environment variable or localhost fallback
  return process.env.REACT_APP_MEETING_SERVER_URL || 'http://localhost:3001';
};

export const API_ENDPOINTS = {
  BASE_URL: getApiBaseUrl(),
  BACKEND_URL: getBackendUrl(),
  MEETING_SERVER_URL: getMeetingServerUrl()
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint) => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  // If the endpoint already includes '/api', use backend URL, otherwise use API base URL
  if (cleanEndpoint.startsWith('api/')) {
    return `${getBackendUrl()}/${cleanEndpoint}`;
  }
  
  return `${getApiBaseUrl()}/${cleanEndpoint}`;
};

export default API_ENDPOINTS;