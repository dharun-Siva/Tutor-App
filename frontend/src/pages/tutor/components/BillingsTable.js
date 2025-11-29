import React, { useState, useMemo } from 'react';

const BillingsTable = ({ billings }) => {
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [search, setSearch] = useState('');

  // Filtered and paginated data
  const filteredBillings = useMemo(() => {
    if (!search) return billings;
    return billings.filter(b =>
      (b.invoiceNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.studentName || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.subject || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [billings, search]);

  const totalItems = filteredBillings.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedBillings = filteredBillings.slice(startIndex, startIndex + rowsPerPage);

  // Handlers
  const handlePageChange = (page) => setCurrentPage(page);
  const handleRowsChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };
  const handleSearch = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  // Format helpers
  const formatCurrency = (amount, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount || 0);
  const formatDate = (date) => date ? new Date(date).toLocaleDateString() : '-';

  return (
    <div className="billings-table-section">
      <div className="billings-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Billings ({totalItems})</h3>
        <input
          type="text"
          placeholder="Search billings..."
          value={search}
          onChange={handleSearch}
          style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc', minWidth: 200 }}
        />
      </div>
      <div className="table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Student</th>
              <th>Subject</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedBillings.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#888' }}>No billings found.</td></tr>
            ) : (
              paginatedBillings.map((b, idx) => (
                <tr key={b._id || idx}>
                  <td>{b.invoiceNumber || '-'}</td>
                  <td>{b.studentName || b.billedTo?.studentId?.name || '-'}</td>
                  <td>{b.subject || '-'}</td>
                  <td>{formatDate(b.invoiceDate)}</td>
                  <td>{formatCurrency(b.totalAmount, b.currency || 'USD')}</td>
                  <td>
                    <span className={`badge badge-${(b.paymentStatus || '').toLowerCase()}`}>{b.paymentStatus || '-'}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination Controls - always visible */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <div>
          Rows:
          <select value={rowsPerPage} onChange={handleRowsChange} style={{ marginLeft: 8 }}>
            {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <button onClick={() => handlePageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>&lt;</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              style={{ fontWeight: page === currentPage ? 'bold' : 'normal', margin: '0 2px' }}
              disabled={page === currentPage}
            >
              {page}
            </button>
          ))}
          <button onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>&gt;</button>
        </div>
      </div>
    </div>
  );
};

export default BillingsTable;