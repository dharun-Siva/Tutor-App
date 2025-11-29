  import React, { useState, useEffect } from 'react';
  import styles from './BillingReport.module.css';

  const BillingReport = ({ userRole, userId }) => {
    const [reportData, setReportData] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      paymentStatus: '',
      groupBy: 'month'
    });

    useEffect(() => {
      loadBillingReport();
      loadTransactions();
    }, [filters]);

    const loadBillingReport = async () => {
      setLoading(true);
      setError('');
      
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
          startDate: filters.startDate,
          endDate: filters.endDate
        });

        let url;
        if (userRole === 'parent') {
          url = `/api/billing/reports/parent/${userId}?${params}&groupBy=${filters.groupBy}`;
        } else {
          url = `/api/billing/reports/summary?${params}`;
        }

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setReportData(data);
        } else {
          const errorData = await response.json();
          setError(errorData.message || 'Failed to load billing report');
        }
      } catch (error) {
        setError('Error loading billing report');
        console.error('Error loading billing report:', error);
      } finally {
        setLoading(false);
      }
    };

    const loadTransactions = async () => {
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
          startDate: filters.startDate,
          endDate: filters.endDate,
          page: 1,
          limit: 50
        });

        if (filters.paymentStatus) {
          params.append('paymentStatus', filters.paymentStatus);
        }

        if (userRole === 'parent') {
          params.append('parentId', userId);
        }

        const response = await fetch(`/api/billing/transactions?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setTransactions(data.transactions);
        }
      } catch (error) {
        console.error('Error loading transactions:', error);
      }
    };

    const handleFilterChange = (field, value) => {
      setFilters(prev => ({
        ...prev,
        [field]: value
      }));
    };

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    };

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString();
    };

    const getStatusBadgeClass = (status) => {
      switch (status) {
        case 'paid': return styles.statusPaid;
        case 'pending': return styles.statusPending;
        case 'overdue': return styles.statusOverdue;
        case 'failed': return styles.statusFailed;
        default: return styles.statusDefault;
      }
    };

    if (loading && !reportData) {
      return (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading billing report...</p>
        </div>
      );
    }

    return (
      <div className={styles.billingReport}>
        <div className={styles.header}>
          <h2>Billing Report</h2>
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <label>
                Start Date:
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </label>
            </div>
            
            <div className={styles.filterGroup}>
              <label>
                End Date:
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </label>
            </div>
            
            <div className={styles.filterGroup}>
              <label>
                Payment Status:
                <select
                  value={filters.paymentStatus}
                  onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="failed">Failed</option>
                </select>
              </label>
            </div>
            
            {userRole === 'parent' && (
              <div className={styles.filterGroup}>
                <label>
                  Group By:
                  <select
                    value={filters.groupBy}
                    onChange={(e) => handleFilterChange('groupBy', e.target.value)}
                  >
                    <option value="month">Month</option>
                    <option value="week">Week</option>
                    <option value="day">Day</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {reportData && (
          <div className={styles.reportContent}>
            {/* Summary Cards */}
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <h3>Total Amount</h3>
                <p className={styles.amount}>
                  {formatCurrency(reportData.summary?.totalAmount || reportData.totalAmount || 0)}
                </p>
              </div>
              
              <div className={styles.summaryCard}>
                <h3>Total Sessions</h3>
                <p className={styles.count}>
                  {reportData.summary?.totalSessions || reportData.totalTransactions || 0}
                </p>
              </div>
              
              <div className={styles.summaryCard}>
                <h3>Average Cost</h3>
                <p className={styles.amount}>
                  {formatCurrency(reportData.summary?.averageSessionCost || 
                    (reportData.totalAmount / Math.max(reportData.totalTransactions, 1)) || 0)}
                </p>
              </div>
              
              <div className={styles.summaryCard}>
                <h3>Paid Amount</h3>
                <p className={styles.amount}>
                  {formatCurrency(reportData.paidAmount || 0)}
                </p>
              </div>
              
              <div className={styles.summaryCard}>
                <h3>Pending Amount</h3>
                <p className={styles.amount}>
                  {formatCurrency(reportData.pendingAmount || 0)}
                </p>
              </div>
            </div>

            {/* Payment Status Breakdown */}
            {reportData.summary?.paymentsByStatus && (
              <div className={styles.statusBreakdown}>
                <h3>Payment Status Breakdown</h3>
                <div className={styles.statusGrid}>
                  {Object.entries(reportData.summary.paymentsByStatus).map(([status, data]) => (
                    <div key={status} className={styles.statusItem}>
                      <span className={`${styles.statusBadge} ${getStatusBadgeClass(status)}`}>
                        {status.toUpperCase()}
                      </span>
                      <div className={styles.statusData}>
                        <p>{data.count} transactions</p>
                        <p>{formatCurrency(data.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Grouped Transactions for Parents */}
            {userRole === 'parent' && reportData.groupedTransactions && (
              <div className={styles.groupedTransactions}>
                <h3>Transactions by {filters.groupBy}</h3>
                {Object.entries(reportData.groupedTransactions).map(([period, transactions]) => (
                  <div key={period} className={styles.periodGroup}>
                    <h4>{period}</h4>
                    <div className={styles.periodSummary}>
                      <p>Sessions: {transactions.length}</p>
                      <p>Total: {formatCurrency(transactions.reduce((sum, t) => sum + t.totalAmount, 0))}</p>
                    </div>
                    <div className={styles.periodTransactions}>
                      {transactions.slice(0, 5).map(transaction => (
                        <div key={transaction._id} className={styles.transactionRow}>
                          <span>{formatDate(transaction.invoiceDate)}</span>
                          <span>{transaction.billedTo.studentId.name}</span>
                          <span>{formatCurrency(transaction.totalAmount)}</span>
                          <span className={`${styles.statusBadge} ${getStatusBadgeClass(transaction.paymentStatus)}`}>
                            {transaction.paymentStatus}
                          </span>
                        </div>
                      ))}
                      {transactions.length > 5 && (
                        <p className={styles.moreTransactions}>
                          ...and {transactions.length - 5} more transactions
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Transactions */}
            <div className={styles.recentTransactions}>
              <h3>Recent Transactions</h3>
              {transactions.length === 0 ? (
                <p className={styles.noTransactions}>No transactions found for the selected period.</p>
              ) : (
                <div className={styles.transactionsList}>
                  {/* Card view for recent transactions (original version, no Join At/End At columns) */}
                  {transactions.map(transaction => (
                    <div key={transaction._id} className={styles.transactionCard}>
                      <div className={styles.transactionHeader}>
                        <span className={styles.invoiceNumber}>{transaction.invoiceNumber}</span>
                        <span className={`${styles.statusBadge} ${getStatusBadgeClass(transaction.paymentStatus)}`}>
                          {transaction.paymentStatus}
                        </span>
                      </div>
                      <div className={styles.transactionDetails}>
                        <p><strong>Student:</strong> {transaction.billedTo?.studentId?.name || ''}</p>
                        <p><strong>Date:</strong> {formatDate(transaction.invoiceDate)}</p>
                        <p><strong>Due Date:</strong> {formatDate(transaction.dueDate)}</p>
                        <p><strong>Duration:</strong> {transaction.billableMinutes} minutes</p>
                        <p><strong>Rate:</strong> {formatCurrency(transaction.hourlyRate)}/hour</p>
                      </div>
                      <div className={styles.transactionAmount}>
                        <p className={styles.totalAmount}>
                          {formatCurrency(transaction.totalAmount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  export default BillingReport;
