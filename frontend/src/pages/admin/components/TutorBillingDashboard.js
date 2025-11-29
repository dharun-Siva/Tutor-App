import React, { useEffect, useState, useMemo, useRef } from 'react';
import styles from './TutorBillingDashboard.module.css';

const TutorBillingDashboard = () => {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const initialLoadDone = useRef(false);
  // Filter panel state
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterTutor, setFilterTutor] = useState('');
  // For Apply/Clear logic
  const [appliedFilters, setAppliedFilters] = useState({ status: '', subject: '', tutor: '' });
  // Only include session participants who are tutors (tutorName exists)
  const tutorParticipants = useMemo(() => {
    return participants.filter(p => {
      return p.participant_type === 'tutor' && p.tutorName && p.tutorName !== 'N/A';
    });
  }, [participants]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  // Filtered participants (apply filters only when Apply is clicked)
  const filteredParticipants = useMemo(() => {
    return tutorParticipants.filter(p => {
      if (appliedFilters.status && (p.paymentStatus !== appliedFilters.status)) return false;
      // Subject
      if (appliedFilters.subject) {
        const subjectName = p.classObj?.subjectName || p.classObj?.subject;
        if (subjectName !== appliedFilters.subject) return false;
      }
      // Tutor
      if (appliedFilters.tutor && (p.tutorName !== appliedFilters.tutor)) return false;
      return true;
    });
  }, [tutorParticipants, appliedFilters]);

  // Pagination calculations
  const totalItems = filteredParticipants.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedParticipants = filteredParticipants.slice(startIndex, startIndex + rowsPerPage);
  // Handlers for Apply and Clear All
  const handleApplyFilters = () => {
    setAppliedFilters({ status: filterStatus, subject: filterSubject, tutor: filterTutor });
  };
  const handleClearFilters = () => {
    setFilterStatus('');
    setFilterSubject('');
    setFilterTutor('');
    setAppliedFilters({ status: '', subject: '', tutor: '' });
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        setLoading(false);
        return;
      }
      // Fetch session participants
      const response = await fetch('http://localhost:5000/api/admin-billing/tutor-billing/all?limit=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setParticipants(Array.isArray(data.data) ? data.data : data.data?.billings || []);
      } else {
        setError(data.error || 'Failed to load tutor billing data');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load tutor billing data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Prevent running twice in Strict Mode
    if (initialLoadDone.current) {
      return;
    }
    initialLoadDone.current = true;
    
    fetchData();
  }, []);

  // Summary calculations - COUNT ONLY (not amounts)
  const summary = useMemo(() => {
    let total = tutorParticipants.length;
    let paidCount = 0;
    let unpaidCount = 0;
    let demoCount = 0;
    
    tutorParticipants.forEach(p => {
      // Check paymentStatus for paid/unpaid
      const paymentStatus = (p.paymentStatus || '').toLowerCase();
      if (paymentStatus === 'paid') {
        paidCount += 1;
      } else if (paymentStatus === 'unpaid') {
        unpaidCount += 1;
      }
      
      // Check paymentType for demo classes
      const paymentType = (p.paymentType || '').toLowerCase();
      if (paymentType === 'democlass') {
        demoCount += 1;
      }
    });
    
    return {
      total,
      paidCount,
      unpaidCount,
      demoCount
    };
  }, [tutorParticipants]);

  // Helper function to format payment type for display
  const formatPaymentType = (paymentType) => {
    if (!paymentType) return 'N/A';
    const type = paymentType.toLowerCase();
    if (type === 'democlass') return 'Demo Class';
    if (type === 'paid') return 'Paid';
    if (type === 'unpaid') return 'Unpaid Class';
    return paymentType;
  };

  // CSV export handler (exports all visible rows)
  const handleExportCSV = () => {
    const headers = [
      'Tutor Name', 'Class Title', 'Class Type', 'Subject', 'Date', 'Amount', 'Payment Type', 'Payment Status'
    ];
    const rows = tutorParticipants.map(p => {
      // Get class type
      let classType = p.classObj?.scheduleType || 'N/A';
      if (classType && classType.toLowerCase().includes('recurring')) {
        classType = 'Recurring';
      } else if (classType && classType.toLowerCase().includes('one')) {
        classType = 'One-time';
      }

      // Get payment type - use actual paymentType from Classes table (immutable class type)
      const paymentType = formatPaymentType(p.paymentType);

      return [
        p.tutorName || '',
        p.classObj?.title || '',
        classType,
        p.classObj?.subjectName || p.classObj?.subject || '',
        p.joined_at ? new Date(p.joined_at).toLocaleDateString() : '',
        (() => {
          const amount = p.paymentAmount !== undefined ? p.paymentAmount : p.classObj?.amount;
          const currency = p.currency || p.classObj?.currency || 'USD';
          if (typeof amount === 'number') {
            return `${currency} ${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
          }
          return '';
        })(),
        paymentType,
        p.paymentStatus || ''
      ];
    });
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(val => `"${val.replace(/"/g, '""')}"`).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tutor_billing.csv';
    a.click();
    URL.revokeObjectURL(url);
  };


  // Show Filters button handler
  const handleShowFilters = () => {
    setShowFilters((prev) => !prev);
  };

  // Filter options (computed from participants)
  const statusOptions = useMemo(() => {
    const set = new Set();
    participants.forEach(p => {
      if (p.paymentStatus) set.add(p.paymentStatus);
    });
    return Array.from(set);
  }, [participants]);

  const subjectOptions = useMemo(() => {
    const set = new Set();
    participants.forEach(p => {
      if (p.classObj?.subjectName) set.add(p.classObj.subjectName);
      else if (p.classObj?.subject) set.add(p.classObj.subject);
    });
    return Array.from(set);
  }, [participants]);

  const tutorOptions = useMemo(() => {
    const set = new Set();
    participants.forEach(p => {
      if (p.tutorName && p.tutorName !== 'N/A') set.add(p.tutorName);
    });
    return Array.from(set);
  }, [participants]);

  return (
    <div>
      <div className={styles.topCard}>
        <span className={styles.topTitle}>Tutor Billing Dashboard</span>
        <div className={styles.topActions}>
          <button className={`${styles.topBtn} ${styles.topBtnFilter}`} onClick={handleShowFilters}>{showFilters ? 'Hide Filters' : 'Show Filters'}</button>
          <button className={`${styles.topBtn} ${styles.topBtnExport}`} onClick={handleExportCSV}>Export CSV</button>
        </div>
      </div>

      {showFilters && (
        <div className={styles.filterPanel}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Status</label>
              <select className={styles.filterSelect} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                {statusOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Subject</label>
              <select className={styles.filterSelect} value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
                <option value="">All Subjects</option>
                {subjectOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Tutor</label>
              <select className={styles.filterSelect} value={filterTutor} onChange={e => setFilterTutor(e.target.value)}>
                <option value="">All Tutors</option>
                {tutorOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.filterActions}>
            <button className={`${styles.filterBtn} ${styles.filterBtnApply}`} onClick={handleApplyFilters}>Apply</button>
            <button className={`${styles.filterBtn} ${styles.filterBtnClear}`} onClick={handleClearFilters}>Clear All</button>
          </div>
        </div>
      )}

      <div className={styles.summaryContainer}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>TOTAL CLASSES</div>
          <div className={styles.summaryValue}>{summary.total}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>TOTAL PAID CLASSES</div>
          <div className={styles.summaryValue}>{summary.paidCount}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>TOTAL UNPAID CLASSES</div>
          <div className={styles.summaryValue}>{summary.unpaidCount}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>DEMO CLASSES</div>
          <div className={styles.summaryValue}>{summary.demoCount}</div>
        </div>
      </div>
      {loading && <div className={styles.loading}>Loading...</div>}
      {error && <div className={styles.error}>{error}</div>}
      {!loading && !error && (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tutor Name</th>
                <th>Class Title</th>
                <th>Class Type</th>
                <th>Subject</th>
                <th>Date</th>
                <th>Join At</th>
                <th>End At</th>
                <th>Amount</th>
                <th>Payment Type</th>
                <th>Payment Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedParticipants.length === 0 ? (
                <tr><td colSpan="11" className={styles.loading}>No session participants found</td></tr>
              ) : (
                paginatedParticipants.map((p, idx) => {
                                                                                                                    const updateStatus = (newStatus) => {
                                                                                                                      setParticipants(prev => prev.map(row =>
                                                                                                                        row._id === p._id ? { ...row, paymentStatus: newStatus } : row
                                                                                                                      ));
                                                                                                                    };

                                                                                                                    // Mark Paid handler
                                                                                                                    const handleMarkPaid = async () => {
                                                                                                                      if (!p._id && !p.id) {
                                                                                                                        alert('No participant ID found');
                                                                                                                        return;
                                                                                                                      }
                                                                                                                      if (!window.confirm('Are you sure you want to mark this transaction as PAID?')) return;
                                                                                                                      try {
                                                                                                                        const token = localStorage.getItem('accessToken');
                                                                                                                        const participantId = p._id || p.id;
                                                                                                                        const res = await fetch(`http://localhost:5000/api/session-participants/${participantId}/mark-paid`, {
                                                                                                                          method: 'POST',
                                                                                                                          headers: {
                                                                                                                            'Authorization': `Bearer ${token}`,
                                                                                                                            'Content-Type': 'application/json'
                                                                                                                          }
                                                                                                                        });
                                                                                                                        const data = await res.json();
                                                                                                                        if (data.success) {
                                                                                                                          // Refresh data from server to get updated payment status
                                                                                                                          await fetchData();
                                                                                                                        } else {
                                                                                                                          alert(data.error || 'Failed to mark as paid');
                                                                                                                        }
                                                                                                                      } catch (err) {
                                                                                                                        alert('Failed to mark as paid: ' + err.message);
                                                                                                                      }
                                                                                                                    };

                                                                                                                    // Void handler
                                                                                                                    const handleVoid = async () => {
                                                                                                                      if (!p._id && !p.id) {
                                                                                                                        alert('No participant ID found');
                                                                                                                        return;
                                                                                                                      }
                                                                                                                      if (!window.confirm('Are you sure you want to VOID this transaction?')) return;
                                                                                                                      try {
                                                                                                                        const token = localStorage.getItem('accessToken');
                                                                                                                        const participantId = p._id || p.id;
                                                                                                                        const res = await fetch(`http://localhost:5000/api/session-participants/${participantId}/void`, {
                                                                                                                          method: 'POST',
                                                                                                                          headers: {
                                                                                                                            'Authorization': `Bearer ${token}`,
                                                                                                                            'Content-Type': 'application/json'
                                                                                                                          },
                                                                                                                          body: JSON.stringify({ reason: 'Voided from Tutor Billing dashboard' })
                                                                                                                        });
                                                                                                                        const data = await res.json();
                                                                                                                        if (data.success) {
                                                                                                                          // Refresh data from server to get updated payment status
                                                                                                                          await fetchData();
                                                                                                                        } else {
                                                                                                                          alert(data.error || 'Failed to void transaction');
                                                                                                                        }
                                                                                                                      } catch (err) {
                                                                                                                        alert('Failed to void transaction');
                                                                                                                      }
                                                                                                                    };
                                                          let hourlyRate = 'N/A';
																													const rawAmount = p.paymentAmount;
																													const currency = p.currency || 'USD';
																													function normalizeAmount(v) {
																														if (v === null || v === undefined) return null;
																														if (typeof v === 'number') return v;
																														if (typeof v === 'string') {
																															const n = Number(v);
																															return Number.isFinite(n) ? n : null;
																														}
																														if (typeof v === 'object') {
																															try {
																																if (typeof v.toString === 'function') {
																																	const s = v.toString();
																																	const n = Number(s);
																																	if (Number.isFinite(n)) return n;
																																}
																																if (v.value !== undefined) {
																																	const n = Number(v.value);
																																	if (Number.isFinite(n)) return n;
																																}
																															} catch (e) {}
																														}
																														return null;
																													}
																													const amount = normalizeAmount(rawAmount);
																													if (amount !== null && amount !== 0) {
																														hourlyRate = `${currency} ${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
																													} else if (amount === 0) {
																														hourlyRate = `${currency} 0.00`;
																													}
																													let duration = 'N/A';
																													if (typeof p.durationMinutes === 'number' && !isNaN(p.durationMinutes)) {
																														duration = `${p.durationMinutes} min`;
																													}
                                                          // Get class type (one-time or recurring)
                                                          let classType = p.classObj?.scheduleType || 'N/A';
                                                          if (classType && classType.toLowerCase().includes('recurring')) {
                                                            classType = 'Recurring';
                                                          } else if (classType && classType.toLowerCase().includes('one')) {
                                                            classType = 'One-time';
                                                          }

                                                          // Get payment type - use actual paymentType from Classes table (immutable class type)
                                                          const paymentType = formatPaymentType(p.paymentType);

                                                          // Payment status badge
                                                          let statusClass = '';
                                                          let statusLabel = p.paymentStatus || 'N/A';
                                                          if (statusLabel.toLowerCase() === 'paid') statusClass = styles['badge-paid'];
                                                          else if (statusLabel.toLowerCase() === 'pending' || statusLabel.toLowerCase() === 'unpaid') statusClass = styles['badge-unpaid'];
                                                          else if (statusLabel.toLowerCase() === 'canceled') statusClass = styles['badge-canceled'];
                                                          else if (statusLabel.toLowerCase() === 'void') statusClass = styles['badge-void'];
																													return (
																														<tr key={p._id || idx}>
                                                            <td>{p.tutorName || 'N/A'}</td>
                                                            <td>{p.classObj?.title || 'N/A'}</td>
                                                            <td>{classType}</td>
                                                            <td>{p.classObj?.subjectName || p.classObj?.subject || 'N/A'}</td>
                                                            <td>{p.joined_at ? new Date(p.joined_at).toLocaleDateString() : 'N/A'}</td>
                                                            <td>{p.joined_at ? new Date(p.joined_at).toLocaleString() : 'N/A'}</td>
                                                            <td>{p.ended_at ? new Date(p.ended_at).toLocaleString() : 'N/A'}</td>
                                                            <td>{hourlyRate}</td>
                                                            <td><span className={`${styles.badge} ${p.paymentType?.toLowerCase() === 'democclass' ? styles['badge-demo'] : p.paymentType?.toLowerCase() === 'paid' ? styles['badge-paid'] : styles['badge-unpaid']}`}>{paymentType}</span></td>
                                                            <td><span className={`${styles.badge} ${statusClass}`}>{statusLabel.toUpperCase()}</span></td>
                                                            <td>
                                                              <button className={`${styles.btn} ${styles['btn-mark']}`}
                                                                onClick={handleMarkPaid}
                                                                disabled={!p._id && !p.id}
                                                              >Mark Paid</button>
                                                              <button className={`${styles.btn} ${styles['btn-void']}`}
                                                                onClick={handleVoid}
                                                                disabled={!p._id && !p.id}
                                                              >Void</button>
                                                            </td>
																														</tr>
																													);
																												})																			)}
						</tbody>
					</table>
          {/* Pagination controls (Student Billing style) */}
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
      )}
		</div>
	);
};

export default TutorBillingDashboard;

