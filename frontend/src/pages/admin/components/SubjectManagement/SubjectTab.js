import React, { useState, useEffect, useRef } from 'react';
import api from '../../../../utils/api';
import { getErrorMessage } from '../../../../utils/helpers';
import styles from './SubjectManagement.module.css';

const SubjectTab = () => {
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('subjectName');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    subjectCode: '',
    subjectName: '',
    gradeId: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Prevent duplicate API calls
  const abortControllerRef = useRef(null);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    // Only load on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      loadData();
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
    loadData();
  }, [currentPage, itemsPerPage, sortField, sortDirection]);

  // allow overrides: { page, limit, sortField, sortDirection }
  const loadData = async (overrides = {}) => {
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

      console.debug('[SubjectTab] loadData request params:', { page, limit, sortField: sf, sortDirection: sd });
      
      // First load grades to get filtered list based on center_id
      const gradesResponse = await api.get('/dashboard/admin/grades', { 
        params: { all: 'true' },
        signal: abortControllerRef.current.signal
      });
      const centerGrades = gradesResponse.data.grades || [];
      const filteredGrades = gradesResponse.data.grades || [];
      setGrades(filteredGrades);

      // Load all subjects to filter them by center's grades
      const subjectsResponse = await api.get('/dashboard/admin/subjects', { 
        params: { 
          all: 'true' // Get all subjects without pagination to filter them properly
        },
        signal: abortControllerRef.current.signal
      });

      console.debug('[SubjectTab] Loaded data:', {
        grades: filteredGrades,
        subjects: subjectsResponse.data
      });
      console.debug('[SubjectTab] loadData responses:', {
        subjects: subjectsResponse?.data,
        grades: gradesResponse?.data
      });
      
      const allSubjects = subjectsResponse?.data?.data || subjectsResponse?.data?.subjects || [];
      
      console.log('Raw subject data:', allSubjects);
      
      // Get all grade IDs from the center
      const centerGradeIds = centerGrades.map(grade => grade._id || grade.id);
      console.log('Center Grade IDs:', centerGradeIds);
      
      // Filter subjects and log each subject's data for debugging
      const filteredSubjects = allSubjects.filter(subject => {
        const subjectGradeId = subject.gradeId?._id || subject.gradeId;
        console.log('Subject:', {
          name: subject.subjectName,
          subjectGradeId: subjectGradeId,
          isIncluded: centerGradeIds.includes(subjectGradeId)
        });
        return centerGradeIds.includes(subjectGradeId);
      });

      console.log('[SubjectTab] Filtered Data:', {
        totalSubjects: allSubjects.length,
        filteredCount: filteredSubjects.length,
        centerGrades,
        centerGradeIds,
        subjects: filteredSubjects
      });
      
      setSubjects(filteredSubjects);
      setTotalItems(filteredSubjects.length);
      setGrades(centerGrades);
      setError(null);
    } catch (err) {
      // Don't log error if request was aborted or canceled
      if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
        console.error('Error loading data:', err);
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

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

  const getGradeName = (gradeId) => {
    // Handle both populated grade object and simple ID
    if (typeof gradeId === 'object' && gradeId?.gradeName) {
      return gradeId.gradeName;
    }
    const grade = grades.find(g => g._id === gradeId);
    return grade ? grade.gradeName : 'Unknown Grade';
  };

  const filteredSubjects = subjects.filter(subject => {
    const gradeName = subject.gradeId?.gradeName || '';
    const matchesSearch = subject.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subject.subjectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         gradeName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const sortedSubjects = [...filteredSubjects].sort((a, b) => {
    let aVal, bVal;
    
    if (sortField === 'gradeName') {
      aVal = a.gradeId?.gradeName || '';
      bVal = b.gradeId?.gradeName || '';
    } else {
      aVal = a[sortField];
      bVal = b[sortField];
    }
    
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    
    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSubjects = subjects;

  const validateForm = () => {
    const errors = {};

    if (!formData.gradeId) {
      errors.gradeId = 'Grade selection is required';
    }

    if (!formData.subjectCode.trim()) {
      errors.subjectCode = 'Subject code is required';
    } else if (formData.subjectCode.length > 10) {
      errors.subjectCode = 'Subject code must be 10 characters or less';
    } else {
      // Check for duplicate subject code within the same grade
      const duplicate = subjects.find(subject => 
        subject.subjectCode.toLowerCase() === formData.subjectCode.toLowerCase() &&
        subject.gradeId === formData.gradeId &&
        subject.id !== editingSubject?.id
      );
      if (duplicate) {
        errors.subjectCode = 'Subject code already exists for this grade';
      }
    }

    if (!formData.subjectName.trim()) {
      errors.subjectName = 'Subject name is required';
    } else if (formData.subjectName.length > 100) {
      errors.subjectName = 'Subject name must be 100 characters or less';
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
      // Ensure gradeId is valid before sending
      const gradeId = formData.gradeId && formData.gradeId !== 'undefined' ? formData.gradeId : null;
      
      if (!gradeId) {
        setFormErrors({ gradeId: 'Grade is required' });
        setSubmitting(false);
        return;
      }

      const submitData = {
        ...formData,
        gradeId: gradeId
      };

      if (editingSubject) {
        const subjectId = editingSubject._id || editingSubject.id;
        if (!subjectId) {
          setError('Invalid subject ID');
          setSubmitting(false);
          return;
        }
        await api.put(`/dashboard/admin/subjects/${subjectId}`, submitData);
      } else {
        await api.post('/dashboard/admin/subjects', submitData);
      }
      
      await loadData();
      handleCloseModal();
    } catch (err) {
      console.error('Error saving subject:', err);
      const errorMessage = getErrorMessage(err);
      if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
        setFormErrors({ subjectCode: 'Subject code already exists for this grade' });
      } else {
        setError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (subject) => {
    setEditingSubject(subject);
    setFormData({
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      gradeId: subject.gradeId
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleDelete = async (subject) => {
    if (window.confirm(`Are you sure you want to delete subject "${subject.subjectName}"?`)) {
      try {
        const subjectId = subject._id || subject.id;
        if (!subjectId) {
          setError('Invalid subject ID');
          return;
        }
        await api.delete(`/dashboard/admin/subjects/${subjectId}`);
        await loadData();
      } catch (err) {
        console.error('Error deleting subject:', err);
        setError(getErrorMessage(err));
      }
    }
  };

  const handleAdd = () => {
    setEditingSubject(null);
    setFormData({ subjectCode: '', subjectName: '', gradeId: '' });
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSubject(null);
    setFormData({ subjectCode: '', subjectName: '', gradeId: '' });
    setFormErrors({});
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (loading && subjects.length === 0) {
    return (
      <div className={styles.tableContainer}>
        <div className={styles.emptyState}>
          <div className={styles.loadingSpinner}></div>
          <div className={styles.emptyMessage}>Loading subjects...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="alert alert-danger mb-3">
          <strong>Error:</strong> {error}
          <button className="btn btn-sm btn-outline ms-3" onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>Subject Management</h3>
          <div className={styles.tableActions}>
            <input
              type="text"
              placeholder="Search subjects..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <button className={styles.addButton} onClick={handleAdd}>
              Add Subject
            </button>
          </div>
        </div>

        {paginatedSubjects.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📖</div>
            <div className={styles.emptyMessage}>
              {searchTerm ? 'No subjects found matching your search' : 'No subjects added yet'}
            </div>
            <div className={styles.emptySubtext}>
              {searchTerm ? 'Try adjusting your search terms' : 'Click "Add Subject" to create your first subject'}
            </div>
          </div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th onClick={() => handleSort('gradeName')}>
                    Grade {sortField === 'gradeName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('subjectCode')}>
                    Subject Code {sortField === 'subjectCode' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('subjectName')}>
                    Subject Name {sortField === 'subjectName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('createdAt')}>
                    Created {sortField === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSubjects.map((subject) => {
                  // Find the grade name from our grades list
                  const grade = grades.find(g => g.id === subject.gradeId);
                  const gradeName = grade ? grade.gradeName : subject.gradeName || 'Unknown Grade';
                  
                  return (
                    <tr key={subject.id}>
                      <td>{gradeName}</td>
                      <td>{subject.subjectCode}</td>
                      <td>{subject.subjectName}</td>
                      <td>{subject.createdAt ? new Date(subject.createdAt).toLocaleString('en-US', {
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
                            onClick={() => handleEdit(subject)}
                          >
                            Edit
                          </button>
                          <button
                            className={styles.deleteButton}
                            onClick={() => handleDelete(subject)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                // immediately reload with new page size
                loadData({ page: 1, limit: n });
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
                {editingSubject ? 'Edit Subject' : 'Add New Subject'}
              </h3>
              <button className={styles.closeButton} onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="gradeId">
                    Grade *
                  </label>
                  <select
                    id="gradeId"
                    className={`${styles.formSelect} ${formErrors.gradeId ? styles.error : ''}`}
                    value={formData.gradeId}
                    onChange={(e) => handleInputChange('gradeId', e.target.value)}
                  >
                    <option value="">Select a grade</option>
                    {grades.map((grade) => (
                      <option key={grade._id} value={grade._id}>
                        {grade.gradeName}
                      </option>
                    ))}
                  </select>
                  {formErrors.gradeId && (
                    <span className={styles.errorMessage}>{formErrors.gradeId}</span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="subjectCode">
                    Subject Code *
                  </label>
                  <input
                    type="text"
                    id="subjectCode"
                    className={`${styles.formInput} ${formErrors.subjectCode ? styles.error : ''}`}
                    value={formData.subjectCode}
                    onChange={(e) => handleInputChange('subjectCode', e.target.value)}
                    placeholder="Enter subject code (e.g., MATH, ENG)"
                    maxLength="10"
                  />
                  {formErrors.subjectCode && (
                    <span className={styles.errorMessage}>{formErrors.subjectCode}</span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="subjectName">
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    id="subjectName"
                    className={`${styles.formInput} ${formErrors.subjectName ? styles.error : ''}`}
                    value={formData.subjectName}
                    onChange={(e) => handleInputChange('subjectName', e.target.value)}
                    placeholder="Enter subject name (e.g., Mathematics, English)"
                    maxLength="100"
                  />
                  {formErrors.subjectName && (
                    <span className={styles.errorMessage}>{formErrors.subjectName}</span>
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
                  {editingSubject ? 'Update Subject' : 'Add Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectTab;