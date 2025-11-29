import React, { useState, useEffect, useRef } from 'react';
import api from '../../../../utils/api';
import { getErrorMessage } from '../../../../utils/helpers';
import styles from './SubjectManagement.module.css';

const GradeTab = () => {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('gradeName');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    gradeCode: '',
    gradeName: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  // Prevent duplicate API calls
  const abortControllerRef = useRef(null);
  const isInitialMountRef = useRef(true);

  // allow optional overrides: { page, limit, sortField, sortDirection }
  const loadGrades = async (overrides = {}) => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      const page = overrides.page || currentPage;
      const limit = overrides.limit || itemsPerPage;
      const sf = overrides.sortField || sortField;
      const sd = overrides.sortDirection || sortDirection;

      console.debug('[GradeTab] loadGrades request params:', { page, limit, sortField: sf, sortDirection: sd });
      const response = await api.get('/dashboard/admin/grades', {
        params: { page, limit, sortField: sf, sortDirection: sd },
        signal: abortControllerRef.current.signal
      });
      console.debug('[GradeTab] loadGrades response total:', response?.data?.total);
      setGrades(response.data.grades || []);
      setTotalItems(response.data.total || 0);
      setError(null);
    } catch (err) {
      // Don't log error if request was aborted or canceled
      if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
        console.error('Error loading grades:', err);
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only load on initial mount, skip React Strict Mode's double mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      loadGrades();
    }

    return () => {
      // Cleanup: abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    // Load when pagination or sorting changes
    loadGrades();
  }, [currentPage, itemsPerPage, sortField, sortDirection]);

  const handleSearch = (term) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredGrades = grades.filter(grade =>
    (grade.gradeName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (grade.gradeCode?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const sortedGrades = [...filteredGrades].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    
    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // For server-side pagination we just display fetched grades
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedGrades = grades;

  const validateForm = () => {
    const errors = {};

    if (!formData.gradeCode.trim()) {
      errors.gradeCode = 'Grade code is required';
    } else if (formData.gradeCode.length > 10) {
      errors.gradeCode = 'Grade code must be 10 characters or less';
    } else {
      // Check for duplicate grade code
      const duplicate = grades.find(grade => 
        grade.gradeCode.toLowerCase() === formData.gradeCode.toLowerCase() &&
        grade.id !== editingGrade?.id
      );
      if (duplicate) {
        errors.gradeCode = 'Grade code already exists';
      }
    }

    if (!formData.gradeName.trim()) {
      errors.gradeName = 'Grade name is required';
    } else if (formData.gradeName.length > 100) {
      errors.gradeName = 'Grade name must be 100 characters or less';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      if (editingGrade) {
        const gradeId = editingGrade._id || editingGrade.id;
        if (!gradeId) {
          setError('Invalid grade ID');
          setSubmitting(false);
          return;
        }
        await api.put(`/dashboard/admin/grades/${gradeId}`, formData);
      } else {
        await api.post('/dashboard/admin/grades', formData);
      }
      
      await loadGrades();
      handleCloseModal();
    } catch (err) {
      console.error('Error saving grade:', err);
      const errorMessage = getErrorMessage(err);
      if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
        setFormErrors({ gradeCode: 'Grade code already exists' });
      } else {
        setError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (grade) => {
    setEditingGrade(grade);
    setFormData({
      gradeCode: grade.gradeCode,
      gradeName: grade.gradeName
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleDelete = async (grade) => {
    if (window.confirm(`Are you sure you want to delete grade "${grade.gradeName}"?`)) {
      try {
        const gradeId = grade._id || grade.id;
        if (!gradeId) {
          setError('Invalid grade ID');
          return;
        }
        await api.delete(`/dashboard/admin/grades/${gradeId}`);
        await loadGrades();
      } catch (err) {
        console.error('Error deleting grade:', err);
        setError(getErrorMessage(err));
      }
    }
  };

  const handleAdd = () => {
    setEditingGrade(null);
    setFormData({ gradeCode: '', gradeName: '' });
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingGrade(null);
    setFormData({ gradeCode: '', gradeName: '' });
    setFormErrors({});
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (loading && grades.length === 0) {
    return (
      <div className={styles.tableContainer}>
        <div className={styles.emptyState}>
          <div className={styles.loadingSpinner}></div>
          <div className={styles.emptyMessage}>Loading grades...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="alert alert-danger mb-3">
          <strong>Error:</strong> {error}
          <button className="btn btn-sm btn-outline ms-3" onClick={loadGrades}>
            Retry
          </button>
        </div>
      )}

      <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>Grade Management</h3>
          <div className={styles.tableActions}>
            <input
              type="text"
              placeholder="Search grades..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <button className={styles.addButton} onClick={handleAdd}>
              Add Grade
            </button>
          </div>
        </div>

        {paginatedGrades.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📚</div>
            <div className={styles.emptyMessage}>
              {searchTerm ? 'No grades found matching your search' : 'No grades added yet'}
            </div>
            <div className={styles.emptySubtext}>
              {searchTerm ? 'Try adjusting your search terms' : 'Click "Add Grade" to create your first grade'}
            </div>
          </div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th onClick={() => handleSort('gradeCode')}>
                    Grade Code {sortField === 'gradeCode' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('gradeName')}>
                    Grade Name {sortField === 'gradeName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('createdAt')}>
                    Created {sortField === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedGrades.map((grade) => (
                  <tr key={grade.id}>
                    <td>{grade.gradeCode}</td>
                    <td>{grade.gradeName}</td>
                    <td>{grade.createdAt ? new Date(grade.createdAt).toLocaleString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                    }) : 'N/A'}</td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button
                          className={styles.editButton}
                          onClick={() => handleEdit(grade)}
                        >
                          Edit
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDelete(grade)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <div className={styles.paginationInfo}>
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} entries
                </div>
                <div className={styles.paginationControls}>
                  <button
                    className={styles.paginationButton}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      className={`${styles.paginationButton} ${currentPage === page ? styles.active : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    className={styles.paginationButton}
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.5rem 1.5rem' }}>
              <label style={{ alignSelf: 'center', color: '#6c757d' }}>Rows:</label>
              <select value={itemsPerPage} onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setItemsPerPage(n);
                setCurrentPage(1);
                // immediately load first page with new limit
                loadGrades({ page: 1, limit: n });
              }}>
                {[5,10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {editingGrade ? 'Edit Grade' : 'Add New Grade'}
              </h3>
              <button className={styles.closeButton} onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="gradeCode">
                    Grade Code *
                  </label>
                  <input
                    type="text"
                    id="gradeCode"
                    className={`${styles.formInput} ${formErrors.gradeCode ? styles.error : ''}`}
                    value={formData.gradeCode}
                    onChange={(e) => handleInputChange('gradeCode', e.target.value)}
                    placeholder="Enter grade code (e.g., G1, G2)"
                    maxLength="10"
                  />
                  {formErrors.gradeCode && (
                    <span className={styles.errorMessage}>{formErrors.gradeCode}</span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="gradeName">
                    Grade Name *
                  </label>
                  <input
                    type="text"
                    id="gradeName"
                    className={`${styles.formInput} ${formErrors.gradeName ? styles.error : ''}`}
                    value={formData.gradeName}
                    onChange={(e) => handleInputChange('gradeName', e.target.value)}
                    placeholder="Enter grade name (e.g., Grade 1, Grade 2)"
                    maxLength="100"
                  />
                  {formErrors.gradeName && (
                    <span className={styles.errorMessage}>{formErrors.gradeName}</span>
                  )}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={submitting}
                >
                  {submitting && <span className={styles.loadingSpinner}></span>}
                  {editingGrade ? 'Update Grade' : 'Add Grade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradeTab;