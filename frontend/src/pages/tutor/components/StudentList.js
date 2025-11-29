import React, { useState } from 'react';
import { formatDate } from '../../../utils/helpers';

const StudentList = ({ students }) => {
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Pagination calculations
  const totalItems = students.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedStudents = students.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="student-list">
      <div className="card">
        <div className="card-header">
          <h3>My Students ({students.length})</h3>
          <div className="header-actions">
            <input
              type="text"
              placeholder="Search students..."
              className="form-control search-input"
            />
          </div>
        </div>
        <div className="card-body">
          {students.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👨‍🎓</div>
              <h3>No Students Found</h3>
              <p className="text-muted">No students are enrolled in your classes yet.</p>
            </div>
          ) : (
            <>
              <div className="students-table">
                <div className="table-header">
                  <div className="col-4">Student</div>
                  <div className="col-3">Classes</div>
                  <div className="col-2">Performance</div>
                  <div className="col-2">Last Activity</div>
                  <div className="col-1">Actions</div>
                </div>
                {paginatedStudents.map(student => (
                  <div key={student._id} className="table-row">
                    <div className="col-4">
                      <div className="student-info">
                        <div className="student-avatar">👨‍🎓</div>
                        <div className="student-details">
                          <div className="student-name">{student.fullName || student.username}</div>
                          <div className="student-email text-muted">{student.email}</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-3">
                      <div className="student-classes">
                        {student.assignments?.classes?.map(cls => (
                          <span key={cls._id} className="badge badge-info class-badge">
                            {cls.name}
                          </span>
                        )) || <span className="text-muted">No classes</span>}
                      </div>
                    </div>
                    <div className="col-2">
                      <div className="performance-indicator">
                        <div className="grade-badge badge badge-success">A</div>
                        <span className="performance-text">Excellent</span>
                      </div>
                    </div>
                    <div className="col-2">
                      <span className="text-muted">{formatDate(student.lastLogin || student.createdAt)}</span>
                    </div>
                    <div className="col-1">
                      <div className="action-buttons">
                        <button className="btn btn-sm btn-outline" title="View Profile">
                          👁️
                        </button>
                        <button className="btn btn-sm btn-outline" title="Send Message">
                          💬
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                  <div style={{ color: '#6c757d' }}>
                    Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, totalItems)} of {totalItems} entries
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ color: '#6c757d' }}>Rows:</label>
                    <select value={rowsPerPage} onChange={e => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}>
                      {[2, 5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className="btn btn-sm btn-outline">Previous</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        style={{ fontWeight: currentPage === page ? 'bold' : 'normal' }}
                        onClick={() => setCurrentPage(page)}
                        className="btn btn-sm btn-outline"
                      >
                        {page}
                      </button>
                    ))}
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} className="btn btn-sm btn-outline">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentList;
