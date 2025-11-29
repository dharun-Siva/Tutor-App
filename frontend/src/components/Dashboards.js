import React from 'react';

const SuperAdminDashboard = () => <div>Super Admin Dashboard: Manage all centers</div>;
const AdminDashboard = () => <div>Admin Dashboard: Manage assigned center</div>;
const TutorDashboard = () => <div>Tutor Dashboard: View assigned classes</div>;
const ParentDashboard = () => <div>Parent Dashboard: View children info</div>;
const StudentDashboard = () => <div>Student Dashboard: View own sessions</div>;

export {
  SuperAdminDashboard,
  AdminDashboard,
  TutorDashboard,
  ParentDashboard,
  StudentDashboard
};
