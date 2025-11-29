import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Registration from './components/Registration';
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import EnhancedDashboard from './pages/tutor/EnhancedDashboardSimple';
import TutorDashboardLegacy from './pages/tutor/Dashboard';
import ParentDashboard from './pages/parent/Dashboard_Enhanced';
import StudentDashboard from './pages/student/Dashboard';
import HomeworkPage from './pages/student/HomeworkPage';
import HomeworkQuestions from './components/HomeworkQuestions';
import StudyDetailsPage from './pages/student/StudyDetails';
import MeetingPage from './pages/MeetingPage';
import LoadingSpinner from './shared/components/LoadingSpinner';
import { isAuthenticated, getStoredUser, getRoleBasedRoute } from './utils/helpers';
import './styles/globals.css';
import MeetingApp from './components/meeting/App.jsx'

const ProtectedRoute = ({ role, children }) => {
  const [authorized, setAuthorized] = useState(null);
  const user = getStoredUser();

  useEffect(() => {
    if (!isAuthenticated()) {
      setAuthorized(false);
      return;
    }

    if (!user || user.role !== role) {
      setAuthorized(false);
      return;
    }

    setAuthorized(true);
  }, [role, user]);

  if (authorized === null) {
    return <LoadingSpinner size="lg" message="Checking authorization..." fullScreen={true} />;
  }
  
  if (!authorized) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

function App() {
  const user = getStoredUser();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registration" element={<Registration />} />
        
        <Route path="/superadmin/dashboard" element={
          <ProtectedRoute role="superadmin">
            <SuperAdminDashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/admin/dashboard" element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } />
        
        {/* Dashboard routes */}
        <Route path="/tutor/dashboard" element={
          <ProtectedRoute role="tutor">
            <EnhancedDashboard />
          </ProtectedRoute>
        } />
        
        {/* Legacy tutor dashboard for comparison */}
        <Route path="/tutor/dashboard-legacy" element={
          <ProtectedRoute role="tutor">
            <TutorDashboardLegacy />
          </ProtectedRoute>
        } />
        
        <Route path="/parent/dashboard" element={
          <ProtectedRoute role="parent">
            <ParentDashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/student/dashboard" element={
          <ProtectedRoute role="student">
            <StudentDashboard />
          </ProtectedRoute>
        } />

        <Route path="/student/homework/:assignmentId" element={
          <ProtectedRoute role="student">
            <HomeworkPage />
          </ProtectedRoute>
        } />

        <Route path="/student/review/:assignmentId" element={
          <ProtectedRoute role="student">
            <HomeworkPage />
          </ProtectedRoute>
        } />

        <Route path="/student/study-details/:homeworkId" element={
          <ProtectedRoute role="student">
            <StudyDetailsPage />
          </ProtectedRoute>
        } />

        {/* Meeting route - accessible to all authenticated users */}
        <Route path="/meeting/:meetingId" element={<MeetingPage />} />
        <Route path="/meeting/session-class" element={<MeetingPage />} />
        {/* <Route path="/meeting/:meetingId" element={<MeetingApp />} /> */}



        {/* Legacy routes for backward compatibility */}
        <Route path="/superadmin-dashboard" element={<Navigate to="/superadmin/dashboard" />} />
        <Route path="/admin-dashboard" element={<Navigate to="/admin/dashboard" />} />
        <Route path="/tutor-dashboard" element={<Navigate to="/tutor/dashboard" />} />
        <Route path="/parent-dashboard" element={<Navigate to="/parent/dashboard" />} />
        <Route path="/student-dashboard" element={<Navigate to="/student/dashboard" />} />

        {/* Default route - redirect to appropriate dashboard or login */}
        <Route path="/" element={
          isAuthenticated() && user 
            ? <Navigate to={getRoleBasedRoute(user.role)} />
            : <Navigate to="/login" />
        } />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
