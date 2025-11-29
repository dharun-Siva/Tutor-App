import React, { useEffect, useState } from 'react';
import { usersAPI } from '../../../utils/api';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import styles from '../Dashboard.module.css';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getUsers({});
      setUsers(response.data.data || response.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading users..." />;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.usersSection}>
      <h2>Users</h2>
      {users.length === 0 ? (
        <div>No users found.</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user._id}>
                <td>{user.firstName} {user.lastName}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.isActive ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default UserManagement;
