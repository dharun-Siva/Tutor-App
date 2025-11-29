
import React, { useState, useEffect, useRef } from 'react';
import styles from './SessionParticipantsTab.module.css';

const SessionParticipantsTab = () => {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshFlag, setRefreshFlag] = useState(false);
  const [activeTab, setActiveTab] = useState('students');
  // Filter states
  const [filterTutor, setFilterTutor] = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Prevent duplicate API calls from React.StrictMode
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const fetchParticipants = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
        const response = await fetch('/api/session-participants/history?limit=1000', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!response.ok) throw new Error('Failed to fetch session participants');
        const data = await response.json();
        setParticipants(data.data || []);
      } catch (err) {
        setError(err.message || 'Failed to load session participants');
      } finally {
        setLoading(false);
      }
    };

    if (!hasLoadedRef.current || refreshFlag) {
      hasLoadedRef.current = true;
      fetchParticipants();
    }
  }, [refreshFlag]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this session participant record?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/session-participants/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to delete record');
      setRefreshFlag(f => !f);
    } catch (err) {
      alert('Delete failed: ' + (err.message || 'Unknown error'));
    }
  };

  // Filtering logic
  const filteredParticipants = participants.filter(sp => {
    // Filter by tab type
    if (activeTab === 'students' && sp.participant_type !== 'student') return false;
    if (activeTab === 'tutors' && sp.participant_type !== 'tutor') return false;
    
    // Tutor Name
    const tutorName = (sp.meeting_class_id && sp.meeting_class_id.tutor && sp.meeting_class_id.tutor.firstName && sp.meeting_class_id.tutor.lastName)
      ? `${sp.meeting_class_id.tutor.firstName} ${sp.meeting_class_id.tutor.lastName}`.toLowerCase()
      : '';
    // Student Name
    const studentName = (sp.participant_id && sp.participant_id.firstName && sp.participant_id.lastName)
      ? `${sp.participant_id.firstName} ${sp.participant_id.lastName}`.toLowerCase()
      : '';
    // Class Title
    const classTitle = (sp.meeting_class_id && sp.meeting_class_id.title)
      ? sp.meeting_class_id.title.toLowerCase()
      : '';
    // Status
    const status = (sp.paymentStatus && typeof sp.paymentStatus === 'string')
      ? sp.paymentStatus.toLowerCase()
      : '';
    // Date (YYYY-MM-DD)
    const date = sp.date ? new Date(sp.date).toISOString().slice(0,10) : '';
    return (
      (!filterTutor || tutorName.includes(filterTutor.toLowerCase())) &&
      (!filterStudent || studentName.includes(filterStudent.toLowerCase())) &&
      (!filterClass || classTitle.includes(filterClass.toLowerCase())) &&
      (!filterStatus || status.includes(filterStatus.toLowerCase())) &&
      (!filterDate || date === filterDate)
    );
  });

  // Pagination calculations
  const totalItems = filteredParticipants.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedParticipants = filteredParticipants.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className={styles.tabContainer}>
      <div className={styles.headerRow}>
        <h2>Session Participants</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <input
            type="text"
            placeholder="Tutor Name"
            value={filterTutor}
            onChange={e => setFilterTutor(e.target.value)}
            style={{ marginRight: 8, padding: '0.3rem 0.5rem', minWidth: 110 }}
          />
          <input
            type="text"
            placeholder="Student Name"
            value={filterStudent}
            onChange={e => setFilterStudent(e.target.value)}
            style={{ marginRight: 8, padding: '0.3rem 0.5rem', minWidth: 110 }}
          />
          <input
            type="text"
            placeholder="Class"
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            style={{ marginRight: 8, padding: '0.3rem 0.5rem', minWidth: 90 }}
          />
          <input
            type="text"
            placeholder="Status"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ marginRight: 8, padding: '0.3rem 0.5rem', minWidth: 90 }}
          />
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{ marginRight: 8, padding: '0.3rem 0.5rem' }}
          />
        </div>
        <button onClick={() => setRefreshFlag(f => !f)} className={styles.refreshBtn} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      
      {/* Tab Navigation */}
      <div className={styles.tabNavigation}>
        <button 
          className={`${styles.tabButton} ${activeTab === 'students' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('students')}
        >
          Student Sessions
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'tutors' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('tutors')}
        >
          Tutor Sessions
        </button>
      </div>
      
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              {activeTab === 'students' ? (
                <>
                  <th>ID</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Tutor</th>
                  <th>Type</th>
                  <th>Joined At</th>
                  <th>Ended At</th>
                  <th>Title</th>
                  <th>Start Time</th>
                  <th>Date</th>
                </>
              ) : (
                <>
                  <th>ID</th>
                  <th>Class</th>
                  <th>Tutor</th>
                  <th>Type</th>
                  <th>Joined At</th>
                  <th>Ended At</th>
                  <th>Title</th>
                  <th>Start Time</th>
                  <th>Date</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedParticipants.map(sp => (
              <tr key={sp._id || sp.id || Math.random()}>
                {activeTab === 'students' ? (
                  <>
                    <td>{sp._id ? sp._id.slice(-8) : (sp.id ? sp.id.slice(-8) : '-')}</td>
                    <td>{sp.student ? `${sp.student.firstName} ${sp.student.lastName}` : '-'}</td>
                    <td>{sp.title || '-'}</td>
                    <td>{sp.classObj && sp.classObj.tutor ? `${sp.classObj.tutor.firstName} ${sp.classObj.tutor.lastName}` : '-'}</td>
                    <td>{sp.participant_type}</td>
                    <td>{sp.joined_at ? new Date(sp.joined_at).toLocaleString() : '-'}</td>
                    <td>{sp.ended_at ? new Date(sp.ended_at).toLocaleString() : '-'}</td>
                    <td>{sp.title || '-'}</td>
                    <td>{sp.start_time || '-'}</td>
                    <td>{sp.joined_at ? new Date(sp.joined_at).toLocaleDateString() : '-'}</td>
                  </>
                ) : (
                  <>
                    <td>{sp._id ? sp._id.slice(-8) : (sp.id ? sp.id.slice(-8) : '-')}</td>
                    <td>{sp.classObj ? sp.classObj.title : '-'}</td>
                    <td>{sp.classObj && sp.classObj.tutor ? `${sp.classObj.tutor.firstName} ${sp.classObj.tutor.lastName}` : '-'}</td>
                    <td>{sp.participant_type}</td>
                    <td>{sp.joined_at ? new Date(sp.joined_at).toLocaleString() : '-'}</td>
                    <td>{sp.ended_at ? new Date(sp.ended_at).toLocaleString() : '-'}</td>
                    <td>{sp.title || '-'}</td>
                    <td>{sp.start_time || '-'}</td>
                    <td>{sp.joined_at ? new Date(sp.joined_at).toLocaleDateString() : '-'}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filteredParticipants.length === 0 && !loading && <div className={styles.noData}>No session participants found.</div>}
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
                {[2, 3, 5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
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
    </div>
  );
};

export default SessionParticipantsTab;