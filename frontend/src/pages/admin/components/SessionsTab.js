import React, { useState, useEffect } from 'react';
import styles from './SessionsTab.module.css';

const SessionsTab = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    tutor: '',
    student: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...filters
      });
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/sessions?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const data = await response.json();
      setSessions(data.sessions);
      setPagination(prev => ({ ...prev, total: data.total }));
    } catch (error) {
      setError('Failed to fetch sessions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [pagination.page, pagination.limit]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when filtering
  };

  const handleSearch = () => {
    fetchSessions();
  };

  const handleClearFilters = () => {
    setFilters({
      status: '',
      dateFrom: '',
      dateTo: '',
      tutor: '',
      student: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchSessions();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'scheduled':
        return styles.statusScheduled;
      case 'in_progress':
        return styles.statusInProgress;
      case 'completed':
        return styles.statusCompleted;
      case 'cancelled':
        return styles.statusCancelled;
      case 'no_show':
        return styles.statusNoShow;
      default:
        return '';
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (loading) {
    return (
      <div className={styles.sessionsTab}>
        <div className={styles.loading}>Loading sessions...</div>
      </div>
    );
  }

  return (
    <div className={styles.sessionsTab}>
      <div className={styles.header}>
        <h2>Session Management</h2>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Total Sessions</span>
            <span className={styles.statValue}>{pagination.total}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterRow}>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            className={styles.filterInput}
            placeholder="From Date"
          />

          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            className={styles.filterInput}
            placeholder="To Date"
          />

          <input
            type="text"
            value={filters.tutor}
            onChange={(e) => handleFilterChange('tutor', e.target.value)}
            className={styles.filterInput}
            placeholder="Tutor name..."
          />

          <input
            type="text"
            value={filters.student}
            onChange={(e) => handleFilterChange('student', e.target.value)}
            className={styles.filterInput}
            placeholder="Student name..."
          />
        </div>

        <div className={styles.filterActions}>
          <button onClick={handleSearch} className={styles.searchButton}>
            Search
          </button>
          <button onClick={handleClearFilters} className={styles.clearButton}>
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {/* Sessions Table */}
      <div className={styles.tableContainer}>
        <table className={styles.sessionsTable}>
          <thead>
            <tr>
              <th>Session ID</th>
              <th>Class</th>
              <th>Tutor</th>
              <th>Student</th>
              <th>Date & Time</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Meeting Link</th>
              <th>Participants</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(session => (
              <tr key={session._id}>
                <td className={styles.sessionId}>
                  {session._id.slice(-8)}
                </td>
                <td>
                  <div className={styles.classInfo}>
                    <div className={styles.className}>{session.classId?.name || 'N/A'}</div>
                    <div className={styles.classSubject}>{session.classId?.subject || 'N/A'}</div>
                  </div>
                </td>
                <td>
                  <div className={styles.userInfo}>
                    <div className={styles.userName}>
                      {session.classId?.tutorId?.name || session.tutorId?.name || 'N/A'}
                    </div>
                    <div className={styles.userEmail}>
                      {session.classId?.tutorId?.email || session.tutorId?.email || 'N/A'}
                    </div>
                  </div>
                </td>
                <td>
                  <div className={styles.studentList}>
                    {session.classId?.students?.length > 0 ? (
                      session.classId.students.map(student => (
                        <div key={student._id} className={styles.studentItem}>
                          {student.name}
                        </div>
                      ))
                    ) : session.classId?.studentId ? (
                      <div className={styles.studentItem}>
                        {session.classId.studentId.name}
                      </div>
                    ) : session.studentId ? (
                      <div className={styles.studentItem}>
                        {session.studentId.name}
                      </div>
                    ) : (
                      <div className={styles.studentItem}>N/A</div>
                    )}
                  </div>
                </td>
                <td>
                  <div className={styles.dateTime}>
                    <div>{formatDate(session.scheduledStartTime)}</div>
                  </div>
                </td>
                <td>
                  <span className={styles.duration}>
                    {session.actualDuration || session.classId?.duration || 'N/A'} min
                  </span>
                </td>
                <td>
                  <span className={`${styles.status} ${getStatusClass(session.status)}`}>
                    {session.status.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td>
                  {session.meetingLink ? (
                    <a 
                      href={session.meetingLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={styles.meetingLink}
                    >
                      Join Meeting
                    </a>
                  ) : (
                    <span className={styles.noLink}>No Link</span>
                  )}
                </td>
                <td>
                  <div className={styles.participants}>
                    {session.participants?.length || 0} participants
                  </div>
                </td>
                <td>
                  <div className={styles.actions}>
                    <button
                      className={styles.actionButton}
                      onClick={() => window.open(`/admin/sessions/${session._id}`, '_blank')}
                    >
                      View Details
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sessions.length === 0 && !loading && (
          <div className={styles.noData}>
            No sessions found matching your criteria.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={pagination.page === 1}
            className={styles.paginationButton}
          >
            Previous
          </button>
          
          <span className={styles.paginationInfo}>
            Page {pagination.page} of {totalPages}
          </span>
          
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
            disabled={pagination.page === totalPages}
            className={styles.paginationButton}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default SessionsTab;
