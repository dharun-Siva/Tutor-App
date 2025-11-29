import React from 'react';
import styles from '../Dashboard_Enhanced.module.css';

export default function ParentClassesTableWithPagination({ classes }) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);
  const totalItems = classes.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedClasses = classes.slice(startIndex, startIndex + rowsPerPage);

  // Helper functions (should be imported if needed)
  const getClassTimeStatus = (classItem) => {
    // ...existing logic or import from parent file...
    return { isLive: false, startingSoon: false, canJoin: false, reason: '', status: '', timeUntilClass: null };
  };
  const formatClassTime = (classItem) => {
    // ...existing logic or import from parent file...
    return { start: '', end: '', date: '' };
  };
  const handleJoinClass = (classItem) => {
    // ...existing logic or import from parent file...
  };

  return (
    <div className={styles.sessionsSection}>
      <div className={styles.sectionHeader}>
        <h4>
          <i className="fas fa-chalkboard-teacher"></i>
          Your Children's Classes ({totalItems})
        </h4>
      </div>
      <div className={styles.tableContainer}>
        <table className={styles.sessionsTable}>
          <thead>
            <tr>
              <th>Class</th>
              <th>Schedule</th>
              <th>Tutor</th>
              <th>Students</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Join Meeting</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedClasses.map(classItem => {
              const timeStatus = getClassTimeStatus(classItem);
              const classTime = formatClassTime(classItem);
              return (
                <tr key={classItem._id}>
                  <td>
                    <div className={styles.classCell}>
                      <strong>{classItem.title || 'Class'}</strong>
                      <span className={styles.className}>{classItem.subject}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.scheduleCell}>
                      <div className={styles.scheduleTime}>
                        <i className="fas fa-clock"></i>
                        {classTime.start} - {classTime.end}
                      </div>
                      <div className={styles.schedulePattern}>
                        <i className={classItem.scheduleType === 'weekly-recurring' ? 'fas fa-calendar-week' : 'fas fa-calendar'}></i>
                        {classTime.date}
                      </div>
                    </div>
                  </td>
                  <td className={styles.tutorName}>
                    {classItem.tutor ? `${classItem.tutor.firstName} ${classItem.tutor.lastName}` : 'TBD'}
                  </td>
                  <td className={styles.studentCell}>
                    <div className={styles.studentsList}>
                      <div className={styles.yourChildren}>
                        <strong>Your Children:</strong>
                        {classItem.childrenInClass.map(child => (
                          <div key={child._id} className={styles.studentName}>
                            {child.firstName} {child.lastName}
                          </div>
                        ))}
                      </div>
                      <div className={styles.totalStudents}>
                        <span className={styles.totalCount}>
                          <i className="fas fa-users"></i>
                          Total: {classItem.totalStudents || classItem.childrenInClass.length} students
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className={styles.duration}>{classItem.duration} min</td>
                  <td>
                    <span className={
                      timeStatus.isLive ? styles.statusLive : 
                      timeStatus.startingSoon ? styles.statusStartingSoon : 
                      styles.statusScheduled
                    }>
                      {timeStatus.isLive ? 'LIVE NOW' : 
                       timeStatus.startingSoon ? 'STARTING SOON' : 
                       'SCHEDULED'}
                    </span>
                  </td>
                  <td className={styles.meetingLinkCell}>
                    {timeStatus.canJoin && classItem.meetingLink ? (
                      <button 
                        onClick={() => handleJoinClass(classItem)}
                        className={styles.joinButton}
                      >
                        <i className="fas fa-video"></i>
                        Join
                      </button>
                    ) : (
                      <span className={styles.noMeeting} title={timeStatus.reason}>
                        {timeStatus.canJoin ? 'Link pending' : timeStatus.reason}
                      </span>
                    )}
                  </td>
                  <td className={styles.actionsCell}>
                    <button className={styles.actionBtn} title="View Details">
                      <i className="fas fa-eye"></i>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Pagination Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <div style={{ color: '#6c757d' }}>
            Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, totalItems)} of {totalItems} entries
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ color: '#6c757d' }}>Rows:</label>
            <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} style={{ padding: '6px 12px', fontSize: '1rem', borderRadius: 4, border: '1px solid #ccc', background: '#f8f9fa', color: '#333', cursor: 'pointer' }}>Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                style={{ fontWeight: currentPage === page ? 'bold' : 'normal', padding: '6px 12px', fontSize: '1rem', borderRadius: 4, border: '1px solid #ccc', background: currentPage === page ? '#007bff' : '#f8f9fa', color: currentPage === page ? '#fff' : '#333', cursor: 'pointer' }}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} style={{ padding: '6px 12px', fontSize: '1rem', borderRadius: 4, border: '1px solid #ccc', background: '#f8f9fa', color: '#333', cursor: 'pointer' }}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}