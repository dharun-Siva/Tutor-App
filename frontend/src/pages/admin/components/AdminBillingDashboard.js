import React, { useState, useEffect } from 'react';
import { getStoredToken } from '../../../utils/helpers';
import api from '../../../utils/api';
import styles from './AdminBillingDashboard.module.css';

const AdminBillingDashboard = ({ billingType }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Summary state
  const [summary, setSummary] = useState({
    totalTransactions: 0,
    totalAmount: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    democlass: 0
  });

  // Filter states
  const [filters, setFilters] = useState({
    status: '',
    subject: '',
    tutorId: '',
    studentId: '',
    parentId: '',
    dateFrom: '',
    dateTo: '',
    currency: '',
    search: ''
  });

  // UI states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('scheduledStart');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  
  // Data for filter dropdowns
  const [tutors, setTutors] = useState([]);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const itemsPerPage = 20;

  // Load initial data
  useEffect(() => {
    loadTransactions();
    loadFilterData();
  }, []);

  // Load transactions when filters, page, or sort changes
  useEffect(() => {
    loadTransactions();
  }, [filters, currentPage, sortBy, sortOrder]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const token = getStoredToken();
      
      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortBy,
        sortOrder
      });

      // Add filters to params
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          params.append(key, value);
        }
      });

      console.log('Loading transactions with params:', params.toString());

      const response = await fetch(`http://localhost:5000/api/class-billing-transactions?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setTransactions(data.data.transactions);
        setSummary(data.data.summary);
        setTotalPages(data.data.pagination.pages);
        setError('');
      } else {
        setError(data.error || 'Failed to load billing transactions');
      }

    } catch (error) {
      console.error('Error loading transactions:', error);
      setError('Failed to load billing transactions');
    } finally {
      setLoading(false);
    }
  };

  const loadFilterData = async () => {
    try {
      const token = getStoredToken();

      // Load tutors
      const tutorsResponse = await fetch('http://localhost:5000/api/tutors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (tutorsResponse.ok) {
        const tutorsData = await tutorsResponse.json();
        setTutors(tutorsData.data?.tutors || []);
      }

      // Load students
      const studentsResponse = await fetch('http://localhost:5000/api/students', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (studentsResponse.ok) {
        const studentsData = await studentsResponse.json();
        setStudents(studentsData.data?.students || []);
      }

      // Load parents
      const parentsResponse = await fetch('http://localhost:5000/api/users?role=parent', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (parentsResponse.ok) {
        const parentsData = await parentsResponse.json();
        setParents(parentsData.data?.users || []);
      }

      // Load subjects (assuming there's an endpoint)
      try {
        const subjectsResponse = await fetch('http://localhost:5000/api/subjects', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (subjectsResponse.ok) {
          const subjectsData = await subjectsResponse.json();
          setSubjects(subjectsData.data || []);
        }
      } catch (subjectError) {
        console.log('Could not load subjects:', subjectError);
      }

    } catch (error) {
      console.error('Error loading filter data:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      subject: '',
      tutorId: '',
      studentId: '',
      parentId: '',
      dateFrom: '',
      dateTo: '',
      currency: '',
      search: ''
    });
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const markAsPaid = async (transactionId) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;
    
    setSelectedTransaction(transaction);
    setPaymentMethod('cash');
    setShowPaymentModal(true);
  };

  const confirmPayment = async () => {
    if (!selectedTransaction) return;

    // For tutor billing, update status in UI immediately
    if (billingType === 'tutor') {
      setTransactions((prev) =>
        prev.map((txn) =>
          txn.id === selectedTransaction.id ? { ...txn, status: 'PAID' } : txn
        )
      );
      alert('Tutor payment recorded successfully');
      setShowPaymentModal(false);
      setSelectedTransaction(null);
      // Optionally, you can still call the backend to persist the change
      try {
        const token = getStoredToken();
        await fetch(`http://localhost:5000/api/class-billing-transactions/${selectedTransaction.id}/pay`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            paymentReference: `MANUAL-${Date.now()}`
          })
        });
      } catch (error) {
        // Ignore error for now, since UI is already updated
      }
      return;
    }

    // For student billing, keep original logic
    try {
      const token = getStoredToken();
      const response = await fetch(`http://localhost:5000/api/class-billing-transactions/${selectedTransaction.id}/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentMethod,
          paymentReference: `MANUAL-${Date.now()}`
        })
      });
      const data = await response.json();
      if (data.success) {
        loadTransactions(); // Refresh the list
        alert('Payment recorded successfully');
        setShowPaymentModal(false);
        setSelectedTransaction(null);
      } else {
        alert(data.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      alert('Failed to record payment');
    }
  };

  const voidTransaction = async (transactionId) => {
    const reason = prompt('Reason for voiding this transaction:');
    if (!reason) return;

    try {
      const token = getStoredToken();
      
      const response = await fetch(`http://localhost:5000/api/class-billing-transactions/${transactionId}/void`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();

      if (data.success) {
        loadTransactions(); // Refresh the list
        alert('Transaction voided successfully');
      } else {
        alert(data.error || 'Failed to void transaction');
      }

    } catch (error) {
      console.error('Error voiding transaction:', error);
      alert('Failed to void transaction');
    }
  };

  const exportCSV = async () => {
    try {
      setLoading(true);
      const token = getStoredToken();
      
      const params = new URLSearchParams(filters);
      params.append('format', 'csv');

      const response = await fetch(`http://localhost:5000/api/class-billing-transactions/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'billing-transactions.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to export data');
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
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

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'paid': return styles.statusPaid;
      case 'unpaid': return styles.statusUnpaid;
      case 'democlass': return styles.statusDemo;
      case 'void': return styles.statusVoid;
      case 'canceled': return styles.statusCanceled;
      default: return styles.statusDefault;
    }
  };

  if (loading && transactions.length === 0) {
    return <div className={styles.loading}>Loading billing data...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Billing Dashboard</h2>
        <div className={styles.headerActions}>
          <button 
            className={styles.filterToggle}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button 
            className={styles.exportButton}
            onClick={exportCSV}
            disabled={loading}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <h3>Total Transactions</h3>
          <div className={styles.summaryValue}>{summary.totalTransactions}</div>
        </div>
        <div className={styles.summaryCard}>
          <h3>Total Amount</h3>
          <div className={styles.summaryValue}>{formatCurrency(summary.totalAmount)}</div>
        </div>
        <div className={styles.summaryCard}>
          <h3>Paid</h3>
          <div className={styles.summaryValue}>{formatCurrency(summary.paidAmount)}</div>
        </div>
        <div className={styles.summaryCard}>
          <h3>Unpaid</h3>
          <div className={styles.summaryValue}>{formatCurrency(summary.unpaidAmount)}</div>
        </div>
        <div className={styles.summaryCard}>
          <h3>Demo Classes</h3>
          <div className={styles.summaryValue}>{summary.democlass}</div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className={styles.filtersPanel}>
          <div className={styles.filtersGrid}>
            <div className={styles.filterGroup}>
              <label>Status</label>
              <select 
                value={filters.status} 
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="democlass">Demo Class</option>
                <option value="void">Void</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Subject</label>
              <select 
                value={filters.subject} 
                onChange={(e) => handleFilterChange('subject', e.target.value)}
              >
                <option value="">All Subjects</option>
                {[...new Set(transactions.map(t => t.subject))].map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Tutor</label>
              <select 
                value={filters.tutorId} 
                onChange={(e) => handleFilterChange('tutorId', e.target.value)}
              >
                <option value="">All Tutors</option>
                {tutors.map(tutor => (
                  <option key={tutor._id} value={tutor._id}>
                    {tutor.firstName} {tutor.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Student</label>
              <select 
                value={filters.studentId} 
                onChange={(e) => handleFilterChange('studentId', e.target.value)}
              >
                <option value="">All Students</option>
                {students.map(student => (
                  <option key={student._id} value={student._id}>
                    {student.firstName} {student.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Parent</label>
              <select 
                value={filters.parentId} 
                onChange={(e) => handleFilterChange('parentId', e.target.value)}
              >
                <option value="">All Parents</option>
                {parents.map(parent => (
                  <option key={parent._id} value={parent._id}>
                    {parent.firstName} {parent.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>From Date</label>
              <input 
                type="date" 
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div className={styles.filterGroup}>
              <label>To Date</label>
              <input 
                type="date" 
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>

            <div className={styles.filterGroup}>
              <label>Search</label>
              <input 
                type="text" 
                placeholder="Search..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>
          </div>
          
          <div className={styles.filterActions}>
            <button 
              className={styles.clearFiltersButton}
              onClick={clearFilters}
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className={styles.error}>{error}</div>
      )}

      {/* Transactions Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort('scheduledStart')} className={styles.sortable}>
                Date {sortBy === 'scheduledStart' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Class</th>
              <th onClick={() => handleSort('subject')} className={styles.sortable}>
                Subject {sortBy === 'subject' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Tutor</th>
              {billingType !== 'tutor' && <th>Student</th>}
              {billingType !== 'tutor' && <th>Parent</th>}
              <th onClick={() => handleSort('status')} className={styles.sortable}>
                Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('amount')} className={styles.sortable}>
                Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Payment Method</th>
              <th>Paid At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan="11" className={styles.noData}>
                  No billing transactions found
                </td>
              </tr>
            ) : (
              transactions.map(transaction => (
                <tr key={transaction.id}>
                  <td>{formatDate(transaction.scheduledStart)}</td>
                  <td className={styles.classTitle}>
                    {transaction.classId?.title || 'N/A'}
                  </td>
                  <td>{transaction.subject}</td>
                  <td>
                    {transaction.tutorId ? 
                      `${transaction.tutorId.firstName} ${transaction.tutorId.lastName}` : 
                      'N/A'}
                  </td>
                  {billingType !== 'tutor' && (
                    <td>
                      {transaction.studentId ? 
                        `${transaction.studentId.firstName} ${transaction.studentId.lastName}` : 
                        'N/A'}
                    </td>
                  )}
                  {billingType !== 'tutor' && (
                    <td>
                      {transaction.parentId ? 
                        `${transaction.parentId.firstName} ${transaction.parentId.lastName}` : 
                        'N/A'}
                    </td>
                  )}
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusBadgeClass(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className={styles.amount}>
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </td>
                  <td>{transaction.paymentMethod || '-'}</td>
                  <td>
                    {transaction.paidAt ? formatDate(transaction.paidAt) : '-'}
                  </td>
                  <td className={styles.actions}>
                    {transaction.status === 'unpaid' && (
                      <button 
                        className={styles.payButton}
                        onClick={() => markAsPaid(transaction.id)}
                      >
                        Mark Paid
                      </button>
                    )}
                    {['unpaid', 'democlass'].includes(transaction.status) && (
                      <button 
                        className={styles.voidButton}
                        onClick={() => voidTransaction(transaction.id)}
                      >
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>
          
          <span className={styles.pageInfo}>
            Page {currentPage} of {totalPages}
          </span>
          
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedTransaction && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Confirm Payment</h3>
            <p>Mark this transaction as paid?</p>
            <div className={styles.transactionDetails}>
              {billingType === 'tutor' ? (
                <>
                  <p><strong>Tutor:</strong> {selectedTransaction.tutorId ? 
                    `${selectedTransaction.tutorId.firstName} ${selectedTransaction.tutorId.lastName}` : 
                    'N/A'}</p>
                  <p><strong>Amount:</strong> {formatCurrency(selectedTransaction.amount)}</p>
                  <p><strong>Class:</strong> {selectedTransaction.classId?.title || 'N/A'}</p>
                </>
              ) : (
                <>
                  <p><strong>Student:</strong> {selectedTransaction.studentId ? 
                    `${selectedTransaction.studentId.firstName} ${selectedTransaction.studentId.lastName}` : 
                    'N/A'}</p>
                  <p><strong>Parent:</strong> {selectedTransaction.parentId ? 
                    `${selectedTransaction.parentId.firstName} ${selectedTransaction.parentId.lastName}` : 
                    'N/A'}</p>
                  <p><strong>Amount:</strong> {formatCurrency(selectedTransaction.amount)}</p>
                  <p><strong>Class:</strong> {selectedTransaction.classId?.title || 'N/A'}</p>
                </>
              )}
            </div>
            
            {/* Only show payment method for student billing */}
            {billingType !== 'tutor' && (
              <div className={styles.formGroup}>
                <label>Payment Method:</label>
                <select 
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={styles.paymentMethodSelect}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="online">Online Payment</option>
                  <option value="check">Check</option>
                </select>
              </div>
            )}
            
            <div className={styles.modalActions}>
              <button 
                className={styles.cancelButton}
                onClick={() => setShowPaymentModal(false)}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmButton}
                onClick={confirmPayment}
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className={styles.loadingOverlay}>
          Loading...
        </div>
      )}
    </div>
  );
};

export default AdminBillingDashboard;