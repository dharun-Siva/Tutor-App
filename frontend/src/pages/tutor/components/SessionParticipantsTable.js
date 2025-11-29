import React, { useState, useEffect, useMemo, useRef } from 'react';
import { sessionParticipantsAPI } from '../../../utils/api';
import { getErrorMessage } from '../../../utils/helpers';
import './SessionParticipantsTable.css';

const SessionParticipantsTable = ({ user, participants: participantsProp }) => {
  const [participants, setParticipants] = useState(participantsProp || []);
  const [loading, setLoading] = useState(!participantsProp);
  const [error, setError] = useState(null);
  const [filterSubject, setFilterSubject] = useState('');
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  
  // Ref to prevent duplicate API calls on mount
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    // Only fetch if participants are not provided as prop
    if (!participantsProp && !dataLoadedRef.current) {
      dataLoadedRef.current = true;
      fetchSessionParticipants();
    } else if (participantsProp) {
      setParticipants(participantsProp);
      setLoading(false);
    }
  }, [participantsProp]); // Depend on participantsProp

  const fetchSessionParticipants = async () => {
    try {
      setLoading(true);
      const response = await sessionParticipantsAPI.getHistory();
      if (response.data.success) {
         setParticipants(response.data.data);
        // const data = response.data.data;
        // setParticipants(data);
        // // Call parent callback if provided
        // if (onDataFetch) {
        //   onDataFetch(data);
        // }
      } else {
        setError('Failed to fetch session participants');
      }
    } catch (err) {
      console.error('Error fetching session participants:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Calculate unique subjects from participants data
  const uniqueSubjects = Array.from(new Set(participants.map(sp => sp.classObj?.subjectName || sp.classObj?.subject).filter(Boolean)));

  const filteredParticipants = useMemo(() => {
    return participants.filter(participant => {
      const subject = participant.classObj?.subjectName || participant.classObj?.subject || '';
      return !filterSubject || subject === filterSubject;
    });
  }, [participants, filterSubject]);

  // Pagination calculations
  const totalItems = filteredParticipants.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedParticipants = filteredParticipants.slice(startIndex, startIndex + rowsPerPage);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDuration = (startTime, endTime) => {
    if (!endTime) return 'Ongoing';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    if (!isNaN(diffMs) && diffMs > 0) {
      const diffSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(diffSec / 3600);
      const minutes = Math.floor((diffSec % 3600) / 60);
      const seconds = diffSec % 60;
      return [
        hours > 0 ? hours + 'h' : null,
        minutes > 0 ? minutes + 'm' : null,
        seconds > 0 ? seconds + 's' : null
      ].filter(Boolean).join(' ');
    }
    return '-';
  };

  if (loading) {
    return (
      <div className="session-participants-loading">
        <div className="loading-spinner">Loading session participants...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="session-participants-error">
        <div className="error-message">❌ {error}</div>
        <button onClick={fetchSessionParticipants} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="session-participants-container">
      <div className="filters-section">
        <div className="header-actions">
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={{ width: 140 }}>
            <option value="">All Subjects</option>
            {uniqueSubjects.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
          <button className="refresh-btn" onClick={fetchSessionParticipants} disabled={loading}>
            {loading ? (
              <div className="spinner"></div>
            ) : (
              <i className="fas fa-sync-alt"></i>
            )}
            Refresh
          </button>
        </div>
      </div>

      <div className="participants-table-container">
        {paginatedParticipants.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h4>No student participants found</h4>
            <p>
              No students have joined your sessions yet.
            </p>
          </div>
        ) : (
          <>
            <table className="participants-table">
              <thead>
                <tr>
                  <th>Tutor Name</th>
                  <th>Session Title</th>
                  <th>Subject</th>
                  <th>Date</th>
                  <th>Start Time</th>
                  <th>Join At</th>
                  <th>End At</th>
                  <th>Duration</th>
                  <th>Class Type</th>
                  <th>Hourly Rate</th>
                  <th>Amount</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedParticipants.map((participant) => {
                  let hourlyRate = 'N/A';
                  const tutor = participant.classObj?.tutor;
                  // Try both camelCase and snake_case for tutor_profile
                  const tutorProfile = tutor?.tutorProfile || tutor?.tutor_profile;
                  console.log('DEBUG tutor:', tutor);
                  console.log('DEBUG tutorProfile:', tutorProfile);
                  if (tutorProfile && typeof tutorProfile === 'object') {
                    // Try both camelCase and snake_case for hourlyRate
                    const rate = tutorProfile.hourlyRate !== undefined ? tutorProfile.hourlyRate : tutorProfile.hourly_rate;
                    console.log('DEBUG rate:', rate);
                    if (rate !== undefined && rate !== null) {
                      hourlyRate = `${participant.currency || participant.classObj?.currency || 'USD'} ${Number(rate).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                    }
                  }
                  console.log('DEBUG final hourlyRate:', hourlyRate);
                  let statusClass = '';
                  // Use SessionParticipant payment_status first, then fall back to Class paymentStatus
                  let statusLabel = participant.paymentStatus || participant.classObj?.paymentStatus || 'N/A';
                  if (statusLabel.toLowerCase() === 'paid') statusClass = 'badge-paid';
                  else if (statusLabel.toLowerCase() === 'pending' || statusLabel.toLowerCase() === 'unpaid') statusClass = 'badge-unpaid';
                  else if (statusLabel.toLowerCase() === 'canceled') statusClass = 'badge-canceled';
                  else if (statusLabel.toLowerCase() === 'void') statusClass = 'badge-void';
                  return (
                    <tr key={participant.id}>
                      <td>
                        {participant.tutorName || 'N/A'}
                      </td>
                      <td>{participant.classObj?.title || 'N/A'}</td>
                      <td>{participant.classObj?.subjectName || participant.classObj?.subject || 'N/A'}</td>
                      <td>{formatDate(participant.joined_at)}</td>
                      <td>{participant.classObj?.startTime || formatTime(participant.joined_at)}</td>
                      <td>{participant.joined_at ? formatTime(participant.joined_at) : '-'}</td>
                      <td>{participant.ended_at ? formatTime(participant.ended_at) : '-'}</td>
                      <td>{getDuration(participant.joined_at, participant.ended_at)}</td>
                      <td>{participant.classes_paymentType || 'N/A'}</td>
                      <td>{hourlyRate}</td>
                      <td>{participant.total_payable !== undefined && participant.total_payable !== null ? `${participant.currency || participant.classObj?.currency || 'USD'} ${Number(participant.total_payable).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'N/A'}</td>
                      <td><span className={`badge ${statusClass}`}>{statusLabel.toUpperCase()}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Pagination Controls - styled to match Classes tab */}
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
          </>
        )}
      </div>
    </div>
  );
};

export default SessionParticipantsTable;