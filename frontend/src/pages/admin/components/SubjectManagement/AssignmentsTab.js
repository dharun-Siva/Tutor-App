import React, { useState, useEffect, useRef } from 'react';
import api from '../../../../utils/api';
import { getErrorMessage } from '../../../../utils/helpers';
import styles from './SubjectManagement.module.css';

const AssignmentsTab = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('assignedDate');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Prevent duplicate API calls
  const abortControllerRef = useRef(null);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    // Only load on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      loadAssignments();
    }

    return () => {
      // Cleanup: abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    // Load when pagination or sorting changes
    loadAssignments();
  }, [currentPage, itemsPerPage, sortField, sortDirection]);

  // allow overrides: { page, limit, sortField, sortDirection }
  const loadAssignments = async (overrides = {}) => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      const page = overrides.page || currentPage;
      const limit = overrides.limit || itemsPerPage;
      const sf = overrides.sortField || sortField;
      const sd = overrides.sortDirection || sortDirection;
      const response = await api.get('/homework-assignments/admin/expanded', {
        params: { page, limit, sortField: sf, sortDirection: sd },
        signal: abortControllerRef.current.signal
      });
      setAssignments(response.data.assignments || []);
      setTotalItems(response.data.pagination?.total || 0);
      setError(null);
    } catch (err) {
      // Don't log error if request was aborted or canceled
      if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
        console.error('Error loading assignments:', err);
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    const direction = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(direction);
  };


  // For server-side pagination, just display fetched assignments
  const filteredAssignments = assignments.filter(assignment =>
    assignment.centerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.className?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.subjectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.tutorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAssignments = assignments;

  const getStatusBadge = (status) => {
    const statusClasses = {
      'incomplete': styles.statusIncomplete,
      'complete': styles.statusComplete,
      'progress': styles.statusProgress
    };

    return (
      <span className={`${styles.statusBadge} ${statusClasses[status] || styles.statusIncomplete}`}>
        {status || 'incomplete'}
      </span>
    );
  };

  if (loading && assignments.length === 0) {
    return (
      <div className={styles.tableContainer}>
        <div className={styles.emptyState}>
          <div className={styles.loadingSpinner}></div>
          <div className={styles.emptyMessage}>Loading assignments...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="alert alert-danger mb-3">
          <strong>Error:</strong> {error}
          <button className="btn btn-sm btn-outline ms-3" onClick={loadAssignments}>
            Retry
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success mb-3">
          <strong>Success:</strong> {successMessage}
        </div>
      )}

      <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>Assignment Management</h3>
          <div className={styles.tableActions}>
            <input
              type="text"
              placeholder="Search assignments..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        {paginatedAssignments.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📝</div>
            <div className={styles.emptyMessage}>
              {searchTerm ? 'No assignments found matching your search' : 'No assignments added yet'}
            </div>
            <div className={styles.emptySubtext}>
              {searchTerm ? 'Try adjusting your search terms' : 'Assignments will be displayed here once data is fetched'}
            </div>
          </div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th onClick={() => handleSort('class_name')}>
                    CLASS {sortField === 'class_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('student_name')}>
                    STUDENT {sortField === 'student_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('grade_name')}>
                    GRADE {sortField === 'grade_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('subject_name')}>
                    SUBJECT {sortField === 'subject_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('topic_name')}>
                    TOPIC {sortField === 'topic_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('subtopic_name')}>
                    SUBTOPIC {sortField === 'subtopic_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('homework_name')}>
                    HOMEWORK {sortField === 'homework_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('status')}>
                    STATUS {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('start_date')}>
                    START DATE {sortField === 'start_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('due_date')}>
                    DUE DATE {sortField === 'due_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssignments.map((assignment) => (
                  <tr key={`${assignment.assignment_id}-${assignment.student_id}`}>
                    <td>{assignment.class_name}</td>
                    <td>{assignment.student_name}</td>
                    <td>{assignment.grade_name}</td>
                    <td>{assignment.subject_name}</td>
                    <td>{assignment.topic_name}</td>
                    <td>{assignment.subtopic_name}</td>
                    <td>{assignment.homework_name}</td>
                    <td>{getStatusBadge(assignment.status)}</td>
                    <td>{assignment.start_date ? new Date(assignment.start_date).toLocaleDateString() : '-'}</td>
                    <td>{assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : '-'}</td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button
                          className={styles.viewButton}
                          onClick={() => {/* TODO: Implement view assignment details */}}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <div className={styles.paginationInfo}>
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} entries
                </div>
                <div className={styles.paginationControls}>
                  <button
                    className={styles.paginationButton}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      className={`${styles.paginationButton} ${currentPage === page ? styles.active : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    className={styles.paginationButton}
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.5rem 1.5rem' }}>
              <label style={{ alignSelf: 'center', color: '#6c757d' }}>Rows:</label>
              <select value={itemsPerPage} onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setItemsPerPage(n);
                setCurrentPage(1);
                loadAssignments({ page: 1, limit: n });
              }}>
                {[5,10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AssignmentsTab;