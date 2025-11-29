
import React, { useEffect, useState, useMemo, useRef } from 'react';
import styles from './TutorBillingDashboard.module.css';

const StudentBillingDashboard = () => {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ status: '', subject: '', student: '' });
  const initialLoadDone = useRef(false);

  // Only include session participants who are students (participant_type is 'student')
  const studentParticipants = useMemo(() => {
    return participants.filter(p => {
      return (
        (p.participant_type === 'student' || p.participant_type === 'Student')
      );
    });
  }, [participants]);

  // Filtered participants (apply filters only when Apply is clicked)
  const filteredParticipants = useMemo(() => {
    return studentParticipants.filter(p => {
      if (appliedFilters.status && (p.paymentStatus !== appliedFilters.status)) return false;
      if (appliedFilters.subject) {
        const subjectName = p.classObj?.subjectName || p.classObj?.subject;
        if (subjectName !== appliedFilters.subject) return false;
      }
      if (appliedFilters.student) {
        const s = p.student;
        const studentName = s && s.firstName ? `${s.firstName} ${s.lastName}` : '';
        if (studentName !== appliedFilters.student) return false;
      }
      return true;
    });
  }, [studentParticipants, appliedFilters]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const totalItems = filteredParticipants.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedParticipants = filteredParticipants.slice(startIndex, startIndex + itemsPerPage);

  const handleApplyFilters = () => {
    setAppliedFilters({ status: filterStatus, subject: filterSubject, student: filterStudent });
  };
  const handleClearFilters = () => {
    setFilterStatus('');
    setFilterSubject('');
    setFilterStudent('');
    setAppliedFilters({ status: '', subject: '', student: '' });
  };

  const fetchParticipants = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        setLoading(false);
        return;
      }
      const response = await fetch('http://localhost:5000/api/admin-billing/student-dashboard/all?limit=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      console.log('📊 [ADMIN DASHBOARD] Response data:', data);
      if (data.success && data.data && data.data.bills && data.data.bills.length > 0) {
        console.log('📊 [ADMIN DASHBOARD] First record sample:', JSON.stringify(data.data.bills[0], null, 2));
      }
      if (data.success) {
        // Convert bills to participants format for compatibility
        const bills = data.data.bills || [];
        const convertedBills = bills.map(bill => ({
          id: bill.id,
          paymentAmount: bill.amount,
          currency: bill.currency,
          paymentStatus: bill.status,
          joined_at: bill.billing_generated_date,
          student: bill.student,
          classObj: {
            title: bill.classTitle,
            subject: bill.subject,
            subjectName: bill.subject,
            amount: bill.amount,
            currency: bill.currency
          },
          participant_type: 'student',
          due_date: bill.due_date,
          month_year: bill.month_year
        }));
        setParticipants(convertedBills);
      } else {
        setError(data.error || 'Failed to load billing data');
      }
    } catch (err) {
      setError('Failed to load billing data');
      console.error('Error fetching bills:', err);
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
    
    fetchParticipants();
  }, []);

  // Summary calculations
  const summary = useMemo(() => {
    let total = studentParticipants.length;
    let totalAmount = 0;
    let paid = 0;
    let unpaid = 0;
    let demo = 0;
    studentParticipants.forEach(p => {
      function normalizeAmount(v) {
        if (v === null || v === undefined) return 0;
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
          const n = Number(v);
          return Number.isFinite(n) ? n : 0;
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
        return 0;
      }
      const amount = normalizeAmount(p.paymentAmount);
      totalAmount += amount;
      const status = (p.paymentStatus || '').toLowerCase();
      if (status === 'paid') paid += amount;
      else if (status === 'unpaid') unpaid += amount;
      else if (status === 'democlass') demo += 1;
    });
    return {
      total,
      totalAmount,
      paid,
      unpaid,
      demo
    };
  }, [studentParticipants]);

  // CSV export handler (exports all visible rows)
  const handleExportCSV = () => {
    const headers = [
      'Student Name', 'Class Title', 'Subject', 'Date', 'Amount (Scheduled)', 'Payment Status'
    ];
    const rows = studentParticipants.map(p => [
      p.student?.firstName ? `${p.student.firstName} ${p.student.lastName}` : '',
      p.classObj?.title || '',
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
      p.paymentStatus || ''
    ]);
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(val => `"${val.replace(/"/g, '""')}"`).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_billing.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

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

  const studentOptions = useMemo(() => {
    const set = new Set();
    participants.forEach(p => {
      const s = p.student;
      if (s && s.firstName) set.add(`${s.firstName} ${s.lastName}`);
    });
    return Array.from(set);
  }, [participants]);

  return (
    <div>
      <div className={styles.topCard}>
        <span className={styles.topTitle}>Student Billing Dashboard</span>
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
              <label className={styles.filterLabel}>Student</label>
              <select className={styles.filterSelect} value={filterStudent} onChange={e => setFilterStudent(e.target.value)}>
                <option value="">All Students</option>
                {studentOptions.map(opt => (
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
          <div className={styles.summaryLabel}>TOTAL TRANSACTIONS</div>
          <div className={styles.summaryValue}>{summary.total}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>TOTAL AMOUNT</div>
          <div className={styles.summaryValue}>${summary.totalAmount.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>PAID</div>
          <div className={styles.summaryValue}>${summary.paid.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>UNPAID</div>
          <div className={styles.summaryValue}>${summary.unpaid.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>DEMO CLASSES</div>
          <div className={styles.summaryValue}>{summary.demo}</div>
        </div>
      </div>
      {loading && <div className={styles.loading}>Loading...</div>}
      {error && <div className={styles.error}>{error}</div>}
      {!loading && !error && (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Class Title</th>
                <th>Subject</th>
                <th>Billing Month</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Payment Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedParticipants.length === 0 ? (
                <tr><td colSpan="9" className={styles.loading}>No session participants found</td></tr>
              ) : (
                paginatedParticipants.map((p, idx) => {
                  // Helper to update payment status in state
                  const updateStatus = (newStatus) => {
                    setParticipants(prev => prev.map((row, i) => i === idx + startIndex ? { ...row, paymentStatus: newStatus } : row));
                  };

                  // Mark Paid handler
                  const handleMarkPaid = async () => {
                    if (!p.id) {
                      alert('No billing ID found');
                      return;
                    }
                    if (!window.confirm('Are you sure you want to mark this transaction as PAID?')) return;
                    try {
                      const token = localStorage.getItem('accessToken');
                      const billingId = p.id;
                      const res = await fetch(`http://localhost:5000/api/admin-billing/${billingId}/mark-paid`, {
                        method: 'PUT',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        }
                      });
                      const data = await res.json();
                      if (data.success) {
                        // Refresh data from server to get updated payment status
                        fetchParticipants();
                      } else {
                        alert(data.error || 'Failed to mark as paid');
                      }
                    } catch (err) {
                      console.error('Error:', err);
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
                        body: JSON.stringify({ reason: 'Voided from Student Billing dashboard' })
                      });
                      const data = await res.json();
                      if (data.success) {
                        // Refresh data from server to get updated payment status
                        fetchParticipants();
                      } else {
                        alert(data.error || 'Failed to void transaction');
                      }
                    } catch (err) {
                      console.error('Error:', err);
                      alert('Failed to void transaction: ' + err.message);
                    }
                  };
                  // ...existing code...
                  const status = (p.paymentStatus || '').toLowerCase();
                  // Only disable buttons if there's no participant ID
                  // Allow changing payment status even if already paid/void
                  const participantId = p._id || p.id;
                  const noId = !participantId;
                  
                  if (idx === 0) {
                    console.log('🔍 DEBUG Row 0:', {
                      paymentStatus: p.paymentStatus,
                      status,
                      _id: p._id,
                      id: p.id,
                      participantId,
                      noId,
                      buttonDisabled: noId,
                      fullParticipantObject: p
                    });
                  }
                  let scheduledAmount = 'N/A';
                  // Normalize amount: accept number, numeric string, Decimal-like object
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
                      // Some DB drivers return Decimal objects; try toString/valueOf
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
                      } catch (e) {
                        // fall through
                      }
                    }
                    return null;
                  }
                  const amount = normalizeAmount(rawAmount);
                  if (amount !== null && amount !== 0) {
                    scheduledAmount = `${currency} ${amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                  } else if (amount === 0) {
                    scheduledAmount = `${currency} 0.00`;
                  }
                  // Debug: log when normalization returns null but rawAmount exists
                  if (amount === null && rawAmount !== null && rawAmount !== undefined) {
                    console.log(`💰 Row ${idx}: rawAmount=${JSON.stringify(rawAmount)}, normalized=null`);
                  }
                  let duration = 'N/A';
                  if (typeof p.durationMinutes === 'number' && !isNaN(p.durationMinutes)) {
                    duration = `${p.durationMinutes} min`;
                  }
                  let statusClass = '';
                  let statusLabel = p.paymentStatus || 'N/A';
                  if (statusLabel.toLowerCase() === 'paid') statusClass = styles['badge-paid'];
                  else if (statusLabel.toLowerCase() === 'pending' || statusLabel.toLowerCase() === 'unpaid') statusClass = styles['badge-unpaid'];
                  else if (statusLabel.toLowerCase() === 'canceled') statusClass = styles['badge-canceled'];
                  else if (statusLabel.toLowerCase() === 'void') statusClass = styles['badge-void'];
                  // Format month_year from "2025-11" to "Nov-2025"
                  const formatBillingMonth = (monthYearStr) => {
                    if (!monthYearStr) return 'N/A';
                    const [year, month] = monthYearStr.split('-');
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const monthIndex = parseInt(month, 10) - 1;
                    return monthIndex >= 0 && monthIndex < 12 ? `${monthNames[monthIndex]}-${year}` : monthYearStr;
                  };

                  return (
                    <tr key={p._id || idx}>
                      <td>{p.student?.firstName ? `${p.student.firstName} ${p.student.lastName}` : 'N/A'}</td>
                      <td>{p.classObj?.title || 'N/A'}</td>
                      <td>{p.classObj?.subjectName || p.classObj?.subject || 'N/A'}</td>
                      <td>{formatBillingMonth(p.month_year)}</td>
                      <td>{p.joined_at ? new Date(p.joined_at).toLocaleDateString() : 'N/A'}</td>
                      <td>{scheduledAmount}</td>
                      <td><span className={`${styles.badge} ${statusClass}`}>{statusLabel.toUpperCase()}</span></td>
                      <td>
                        <button className={`${styles.btn} ${styles['btn-mark']}`}
                          onClick={handleMarkPaid}
                          disabled={noId}
                        >Mark Paid</button>
                        <button className={`${styles.btn} ${styles['btn-void']}`}
                          onClick={handleVoid}
                          disabled={noId}
                        >Void</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <div style={{ color: '#6c757d' }}>
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} entries
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ color: '#6c757d' }}>Rows:</label>
                <select value={itemsPerPage} onChange={e => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}>
                  {[2, 3, 5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>Previous</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    style={{ fontWeight: currentPage === page ? 'bold' : 'normal' }}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentBillingDashboard;
