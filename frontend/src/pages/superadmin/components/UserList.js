import React from 'react';
import { formatDate } from '../../../utils/helpers';

const UserList = ({ users }) => {
  const getRoleColor = (role) => {
    const colors = {
      superadmin: 'badge-danger',
      admin: 'badge-primary',
      tutor: 'badge-success',
      parent: 'badge-warning',
      student: 'badge-info'
    };
    return colors[role] || 'badge-secondary';
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>Recent Users</h3>
      </div>
      <div className="card-body">
        {users.length === 0 ? (
          <p className="text-muted">No users found</p>
        ) : (
          <div className="user-list">
            <div className="user-list-header">
              <div className="col-3">User</div>
              <div className="col-3">Email</div>
              <div className="col-2">Role</div>
              <div className="col-2">Created</div>
              <div className="col-2">Actions</div>
            </div>
            {users.map(user => (
              <div key={user._id} className="user-list-item">
                <div className="col-3">
                  <div className="user-info">
                    <div className="user-name">{user.fullName || user.username}</div>
                    <div className="user-username text-muted">@{user.username}</div>
                  </div>
                </div>
                <div className="col-3">
                  <span className="user-email">{user.email}</span>
                </div>
                <div className="col-2">
                  <span className={`badge ${getRoleColor(user.role)}`}>
                    {user.role.toUpperCase()}
                  </span>
                </div>
                <div className="col-2">
                  <span className="text-muted">{formatDate(user.createdAt)}</span>
                </div>
                <div className="col-2">
                  <div className="user-actions">
                    <button className="btn btn-sm btn-outline" title="View Details">
                      👁️
                    </button>
                    <button className="btn btn-sm btn-outline" title="Edit User">
                      ✏️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserList;
