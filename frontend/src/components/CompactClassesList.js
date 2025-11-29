import React, { useState, useMemo } from 'react';
import styles from './CompactClassesList.module.css';

const CompactClassesList = ({ 
  classes, 
  loading, 
  error, 
  onRefresh, 
  onJoinClass, 
  getClassTimeStatus, 
  formatClassTime,
  user 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState('table'); // 'grid' or 'table'

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filter and sort classes
  const filteredAndSortedClasses = useMemo(() => {
    let filtered = classes.filter(classItem => {
      const matchesSearch = !searchFilter || 
        classItem.subject?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        classItem.title?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        classItem.students?.some(student => 
          `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchFilter.toLowerCase())
        );
      
      const timeStatus = getClassTimeStatus(classItem);
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'joinable' && timeStatus.canJoin) ||
        (statusFilter === 'scheduled' && !timeStatus.canJoin) ||
        (statusFilter === 'active' && classItem.status === 'active') ||
        (statusFilter === 'today' && timeStatus.status !== 'not-today');

      return matchesSearch && matchesStatus;
    });

    // Sort classes
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.title || a.subject || '').localeCompare(b.title || b.subject || '');
        case 'students':
          return (b.studentCount || 0) - (a.studentCount || 0);
        case 'time':
          return (a.startTime || '').localeCompare(b.startTime || '');
        case 'status':
          return getClassTimeStatus(a).status.localeCompare(getClassTimeStatus(b).status);
        default:
          return 0;
      }
    });

    return filtered;
  }, [classes, searchFilter, statusFilter, sortBy, getClassTimeStatus]);

  // Pagination calculations
  const totalItems = filteredAndSortedClasses.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedClasses = filteredAndSortedClasses.slice(startIndex, startIndex + rowsPerPage);

  const renderGridView = () => (
    <div className={styles.compactGrid}>
      {filteredAndSortedClasses.map(classItem => {
        const timeStatus = getClassTimeStatus(classItem);
        const timeFormat = formatClassTime(classItem);
        
        return (
          <div key={classItem.id} className={`${styles.compactCard} ${styles[timeStatus.status]}`}>
            <div className={styles.cardHeader}>
              <h4 className={styles.cardTitle}>{classItem.title || classItem.subject}</h4>
              <span className={`${styles.statusDot} ${styles[timeStatus.status]}`}></span>
            </div>
            
            <div className={styles.cardContent}>
              <div className={styles.cardInfo}>
                <span className={styles.studentCount}>
                  <i className="fas fa-users"></i>
                  {classItem.studentCount || 0}
                </span>
                <span className={styles.classTime}>
                  <i className="fas fa-clock"></i>
                  {timeFormat.start}
                </span>
                <span className={styles.classDuration}>
                  {classItem.duration || 60}m
                </span>
              </div>
              
              <div className={styles.cardActions}>
                {timeStatus.canJoin && classItem.meetingLink ? (
                  <button 
                    className={`${styles.joinBtn} ${styles.primary}`}
                    onClick={() => onJoinClass(classItem)}
                    title="Join Meeting"
                  >
                    <i className="fas fa-video"></i>
                  </button>
                ) : (
                  <button 
                    className={`${styles.joinBtn} ${styles.disabled}`}
                    disabled
                    title={timeStatus.message}
                  >
                    <i className="fas fa-clock"></i>
                  </button>
                )}
                <button 
                  className={`${styles.detailsBtn}`}
                  title="View Details"
                >
                  <i className="fas fa-info-circle"></i>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderTableView = () => (
    <div className={styles.tableContainer}>
      <table className={styles.compactTable}>
        <thead>
          <tr>
            <th>Class</th>
            <th>Students</th>
            <th>Time</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedClasses.map(classItem => {
            const timeStatus = getClassTimeStatus(classItem);
            const timeFormat = formatClassTime(classItem);
            return (
              <tr key={classItem.id} className={styles[timeStatus.status]}>
                <td className={styles.classCell}>
                  <span className={styles.className}>{classItem.title || classItem.subject}</span>
                  <small className={styles.classSubject}>{classItem.subject}</small>
                </td>
                <td>
                  <span className={styles.studentCount}>
                    <i className="fas fa-users"></i>
                    {classItem.studentCount || 0}
                  </span>
                </td>
                <td>{timeFormat.start}</td>
                <td>{classItem.duration || 60}m</td>
                <td>
                  <span className={`${styles.statusBadge} ${styles[timeStatus.status]}`}>
                    {timeStatus.status === 'can-join' ? 'Ready' :
                     timeStatus.status === 'in-progress' ? 'Live' :
                     timeStatus.status === 'too-early' ? 'Scheduled' :
                     timeStatus.status === 'ended' ? 'Ended' :
                     timeStatus.status === 'cancelled' ? '❌ Cancelled' :
                     timeStatus.status === 'completed' ? '✅ Completed' :
                     'Not Today'}
                  </span>
                </td>
                <td className={styles.actionsCell}>
                  {timeStatus.canJoin && classItem.meetingLink ? (
                    <button 
                      className={`${styles.actionBtn} ${styles.join}`}
                      onClick={() => onJoinClass(classItem)}
                      title="Join Meeting"
                    >
                      <i className="fas fa-video"></i>
                    </button>
                  ) : (
                    <button 
                      className={`${styles.actionBtn} ${styles.disabled}`}
                      disabled
                      title={timeStatus.message}
                    >
                      <i className="fas fa-clock"></i>
                    </button>
                  )}
                  <button 
                    className={`${styles.actionBtn} ${styles.details}`}
                    title="View Details"
                  >
                    <i className="fas fa-info-circle"></i>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
              {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className={styles.paginationBtn}>Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                style={{ fontWeight: currentPage === page ? 'bold' : 'normal' }}
                onClick={() => setCurrentPage(page)}
                className={styles.paginationBtn}
              >
                {page}
              </button>
            ))}
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} className={styles.paginationBtn}>Next</button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.compactClassesContainer}>
      {/* Header with expand/collapse and controls */}
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle} onClick={() => setIsExpanded(!isExpanded)}>
          <i className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
          My Classes
          <span className={styles.countBadge}>({filteredAndSortedClasses.length})</span>
        </h3>
        
        {isExpanded && (
          <div className={styles.controls}>
            {/* Search Filter */}
            <div className={styles.searchBox}>
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder="Search classes, students..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            
            {/* Status Filter */}
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Classes</option>
              <option value="joinable">Joinable Now</option>
              <option value="today">Today's Classes</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
            </select>
            
            {/* Sort */}
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.sortSelect}
            >
              <option value="name">Sort by Name</option>
              <option value="students">Sort by Students</option>
              <option value="time">Sort by Time</option>
              <option value="status">Sort by Status</option>
            </select>
            
            {/* View Mode */}
            <div className={styles.viewToggle}>
                  <button
                className={`${styles.viewBtn} ${viewMode === 'table' ? styles.active : ''}`}
                onClick={() => setViewMode('table')}
                title="Table View"
              >
                <i className="fas fa-list"></i>
              </button>
              <button
                className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <i className="fas fa-th"></i>
              </button>
          
            </div>
            
            {/* Refresh */}
            <button onClick={onRefresh} className={styles.refreshBtn}>
              <i className="fas fa-sync-alt"></i>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Loading classes...</div>
          ) : error ? (
            <div className={styles.error}>
              <i className="fas fa-exclamation-triangle"></i>
              <span>{error}</span>
              <button onClick={onRefresh} className={styles.retryBtn}>Retry</button>
            </div>
          ) : filteredAndSortedClasses.length === 0 ? (
            <div className={styles.empty}>
              <i className="fas fa-chalkboard"></i>
              <p>No classes found matching your criteria</p>
            </div>
          ) : (
            viewMode === 'grid' ? renderGridView() : renderTableView()
          )}
        </div>
      )}
    </div>
  );
};

export default CompactClassesList;