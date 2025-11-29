import React, { useState, useEffect, useRef } from 'react';
import { getStoredToken } from '../../../utils/helpers';
import api from '../../../utils/api';
import styles from './ParentBillingView.module.css';
import StripeCheckout from '../../../components/StripeCheckout';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe - only if publishable key is provided
const stripePromise = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY 
  ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

const ParentBillingView = ({ parentId }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Stripe payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  
  // Summary state
  const [summary, setSummary] = useState({
    totalClasses: 0,
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
    childId: '',
    dateFrom: '',
    dateTo: ''
  });

  // UI states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('billing_generated_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  
  // Data for filter dropdowns
  const [children, setChildren] = useState([]);

  const itemsPerPage = 5;
  const abortControllerRef = useRef(null);
  const lastRequestRef = useRef(null);

  const payTransaction = (transaction) => {
    // Open Stripe checkout modal instead of direct API call
    setSelectedTransaction(transaction);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async (paymentResult) => {
    try {
      console.log('💳 Payment Success Handler Called:', paymentResult);
      
      const token = getStoredToken();
      
      // Call backend to confirm payment and store transaction details
      console.log('📤 Confirming payment with backend...');
      const confirmResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/payments/confirm-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentIntentId: paymentResult.stripeTransactionId || paymentResult.id,
          billingTransactionId: paymentResult.transactionId
        })
      });

      const confirmData = await confirmResponse.json();
      console.log('✅ Payment confirmation response:', confirmData);

      if (!confirmData.success) {
        throw new Error(confirmData.error || 'Failed to confirm payment');
      }

      // Payment confirmed and stored - refresh transactions
      alert(`✅ Payment processed successfully!\nAmount: ${formatCurrency(paymentResult.amount, paymentResult.currency)}\nReference: ${confirmData.stripePaymentIntentId}`);
      setShowPaymentModal(false);
      setSelectedTransaction(null);
      
      // Force refresh by clearing the cache - this ensures loadTransactions will actually fetch fresh data
      lastRequestRef.current = null;
      
      // Refresh the transaction list to show updated status
      await loadTransactions();
    } catch (err) {
      console.error('❌ Error handling payment success:', err);
      alert('Payment confirmed but there was an error storing data: ' + err.message);
      // Still refresh in case data was partially saved
      lastRequestRef.current = null;
      loadTransactions();
    }
  };

  const handlePaymentCancel = () => {
    setShowPaymentModal(false);
    setSelectedTransaction(null);
  };

  // Get current user data
  const userData = JSON.parse(localStorage.getItem('userData'));
  const currentParentId = parentId || userData?._id;

  // Load initial data and when filters, page, or sort changes
  useEffect(() => {
    if (currentParentId) {
      loadTransactions();
    }
  }, [currentParentId, filters, currentPage, sortBy, sortOrder]);

  // Extract children from loaded transactions
  useEffect(() => {
    loadChildren();
  }, [transactions]);

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

      const queryString = params.toString();
      
      // Check if this exact request was already made recently
      if (lastRequestRef.current === queryString) {
        setLoading(false);
        return;
      }
      
      lastRequestRef.current = queryString;

      console.log('Loading parent transactions with params:', queryString);

      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();

      // Use the new parent-billing endpoint that accesses class_billing table
      const response = await api.get(`/parent-billing/all?${queryString}`, {
        signal: abortControllerRef.current.signal
      });

      const data = await response.data;

      if (data.success) {
        // Map the new response format to the expected format
        setTransactions(data.data.bills || data.data.transactions || []);
        setSummary(data.data.summary || {
          totalBills: 0,
          totalAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0
        });
        setTotalPages(Math.ceil((data.data.pagination?.total || 0) / itemsPerPage));
        setError('');
      } else {
        setError(data.error || 'Failed to load billing transactions');
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Previous request was cancelled');
        return;
      }
      console.error('Error loading transactions:', error);
      setError('Failed to load billing transactions');
    } finally {
      setLoading(false);
    }
  };

  const loadChildren = async () => {
    try {
      // Extract unique children from transactions
      const uniqueChildren = new Map();
      transactions.forEach(transaction => {
        if (transaction.student && transaction.student.id) {
          const key = transaction.student.id;
          if (!uniqueChildren.has(key)) {
            uniqueChildren.set(key, {
              id: transaction.student.id,
              firstName: transaction.student.firstName || '',
              lastName: transaction.student.lastName || '',
              email: transaction.student.email || '',
              name: `${transaction.student.firstName || ''} ${transaction.student.lastName || ''}`.trim()
            });
          }
        }
      });
      
      setChildren(Array.from(uniqueChildren.values()));
    } catch (error) {
      console.error('Error extracting children from transactions:', error);
      // Don't block loading if this fails
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
      childId: '',
      dateFrom: '',
      dateTo: ''
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

  const exportCSV = async () => {
    try {
      setLoading(true);
      const token = getStoredToken();
      
      const params = new URLSearchParams(filters);
      params.append('format', 'json');

      // Use the new parent-billing endpoint
      const response = await api.get(`/parent-billing/all?${params}`);

      if (response.status === 200) {
        const data = response.data;
        
        if (data.success) {
          // Convert to CSV manually since we're using the JSON endpoint
          const csvHeaders = ['Date', 'Class', 'Subject', 'Tutor', 'Child', 'Status', 'Amount', 'Due Date', 'Payment Method', 'Action'];
          
          const csvRows = data.data.bills.map(bill => [
            new Date(bill.billing_generated_date || bill.createdAt).toLocaleDateString(),
            bill.classTitle || bill.classes?.[0]?.title || 'N/A',
            bill.subject || 'N/A',
            bill.tutor ? `${bill.tutor.firstName} ${bill.tutor.lastName}` : 'N/A',
            bill.student ? `${bill.student.firstName} ${bill.student.lastName}` : 'N/A',
            bill.status,
            formatCurrency(bill.amount, bill.currency),
            bill.due_date ? new Date(bill.due_date).toLocaleDateString() : '',
            '-'
          ]);

          const csvContent = [csvHeaders, ...csvRows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = 'my-billing-history.csv';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          alert(data.error || 'Failed to export data');
        }
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

  if (loading && transactions.length === 0) {
    return <div className={styles.loading}>Loading your billing history...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>My Billing History</h2>
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
          <h3>Total Classes</h3>
          <div className={styles.summaryValue}>{summary.totalClasses}</div>
        </div>
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
          <h3>Outstanding</h3>
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
              <label>Payment Status</label>
              <select 
                value={filters.status} 
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Payments</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="democlass">Demo Classes</option>
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
              <label>Child</label>
              <select 
                value={filters.childId} 
                onChange={(e) => handleFilterChange('childId', e.target.value)}
              >
                <option value="">All Children</option>
                {children.map(child => (
                  <option key={child._id} value={child._id}>
                    {child.firstName} {child.lastName}
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
          </div>
          
          <div className={styles.filterActions}>
            <button 
              className={styles.clearFiltersButton}
              onClick={clearFilters}
            >
              Clear Filters
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
              <th onClick={() => handleSort('billing_generated_date')} className={styles.sortable}>
                Class Date {sortBy === 'billing_generated_date' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Class Title</th>
              <th onClick={() => handleSort('subject')} className={styles.sortable}>
                Subject {sortBy === 'subject' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Tutor</th>
              <th>Child</th>
              <th onClick={() => handleSort('status')} className={styles.sortable}>
                Payment Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('amount')} className={styles.sortable}>
                Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Due Date</th>
              <th>Payment Method</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan="10" className={styles.noData}>
                  No billing history found
                </td>
              </tr>
            ) : (
              transactions.map(transaction => (
                <tr key={transaction.id}>
                  <td>{formatDate(transaction.billing_generated_date || transaction.createdAt)}</td>
                  <td className={styles.classTitle}>
                    {transaction.classTitle || transaction.classes?.[0]?.title || 'N/A'}
                  </td>
                  <td>{transaction.subject || 'N/A'}</td>
                  <td>
                    {transaction.tutor ? 
                      `${transaction.tutor.firstName} ${transaction.tutor.lastName}` : 
                      'N/A'}
                  </td>
                  <td>
                    {transaction.student ? 
                      `${transaction.student.firstName} ${transaction.student.lastName}` : 
                      'N/A'}
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusBadgeClass(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className={styles.amount}>
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </td>
                  <td>
                    {transaction.due_date ? formatDate(transaction.due_date) : '-'}
                  </td>
                  <td>-</td>
                  <td>
                    {transaction.status === 'unpaid' && (
                      <button
                        className={styles.payButton}
                        onClick={() => payTransaction(transaction)}
                      >
                        Pay Now
                      </button>
                    )}
                    {transaction.status === 'paid' && (
                      <span className={styles.paidBadge}>Paid</span>
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

      {loading && (
        <div className={styles.loadingOverlay}>
          Loading...
        </div>
      )}

      {/* Stripe Payment Modal */}
      {showPaymentModal && selectedTransaction && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            {stripePromise ? (
              <StripeCheckout
                transactionId={selectedTransaction.id}
                amount={selectedTransaction.amount}
                currency={selectedTransaction.currency || 'INR'}
                onSuccess={handlePaymentSuccess}
                onCancel={handlePaymentCancel}
              />
            ) : (
              <div className={styles.error}>
                <p>Stripe is not configured. Please contact support.</p>
                <button onClick={handlePaymentCancel}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentBillingView;