import React from 'react';

const ClassList = ({ classes }) => {
  return (
    <div className="class-list">
      <div className="card">
        <div className="card-header">
          <h3>My Classes ({classes.length})</h3>
          <button className="btn btn-primary btn-sm">
            📚 Create New Class
          </button>
        </div>
        <div className="card-body">
          {classes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📚</div>
              <h3>No Classes Assigned</h3>
              <p className="text-muted">You haven't been assigned to any classes yet.</p>
            </div>
          ) : (
            <div className="classes-grid">
              {classes.map(cls => (
                <div key={cls._id} className="class-card">
                  <div className="class-header">
                    <h4 className="class-name">{cls.name}</h4>
                    <span className="class-subject badge badge-primary">{cls.subject}</span>
                  </div>
                  <div className="class-info">
                    <div className="info-item">
                      <span className="info-label">Schedule:</span>
                      <span className="info-value">{cls.schedule || 'TBD'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Students:</span>
                      <span className="info-value">25 enrolled</span>
                    </div>
                  </div>
                  <div className="class-actions">
                    <button className="btn btn-sm btn-primary">
                      👁️ View Class
                    </button>
                    <button className="btn btn-sm btn-outline">
                      📝 Assignments
                    </button>
                    <button className="btn btn-sm btn-outline">
                      📊 Grades
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassList;
