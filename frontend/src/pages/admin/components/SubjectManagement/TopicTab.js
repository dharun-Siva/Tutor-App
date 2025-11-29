import React, { useState, useEffect, useRef } from 'react';
import api from '../../../../utils/api';
import { getErrorMessage } from '../../../../utils/helpers';
import styles from './SubjectManagement.module.css';

const TopicTab = () => {
  const [topics, setTopics] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('topicName');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    topicName: '',
    gradeId: '',
    subjectId: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Filtered subjects based on selected grade
  const [filteredSubjects, setFilteredSubjects] = useState([]);

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

  useEffect(() => {
    // Filter subjects when grade changes
    if (formData.gradeId) {
      console.log('Selected Grade ID:', formData.gradeId);
      console.log('All subjects:', subjects);
      console.log('All grades:', grades);
      
      // Find the selected grade
      const selectedGrade = grades.find(g => g._id === formData.gradeId || g.id === formData.gradeId);
      console.log('Selected Grade:', selectedGrade);
      
      if (selectedGrade) {
        const filtered = subjects.filter(subject => {
          const subjectGradeId = String(subject.gradeId);
          const selectedGradeId = String(selectedGrade._id || selectedGrade.id);
          const isMatch = subjectGradeId === selectedGradeId;
          console.log(`Subject: ${subject.subjectName}, gradeId: ${subjectGradeId}, selected: ${selectedGradeId}, match: ${isMatch}`);
          return isMatch;
        });
        
        console.log('Filtered subjects:', filtered);
        setFilteredSubjects(filtered);
        
        // Clear subject selection if it's not valid for the new grade
        if (formData.subjectId && !filtered.find(s => String(s.id) === String(formData.subjectId))) {
          setFormData(prev => ({ ...prev, subjectId: '' }));
        }
      }
    } else {
      setFilteredSubjects([]);
      setFormData(prev => ({ ...prev, subjectId: '' }));
    }
  }, [formData.gradeId, subjects]);

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
      
      console.log('Loading data...');
      
      const [topicsResponse, gradesResponse, subjectsResponse] = await Promise.all([
        api.get('/dashboard/admin/topics', { 
          params: { page, limit, sortField: sf, sortDirection: sd },
          signal: abortControllerRef.current.signal
        }),
        api.get('/dashboard/admin/grades', { 
          params: { all: 'true' },
          signal: abortControllerRef.current.signal
        }),
        api.get('/dashboard/admin/subjects', { 
          params: { all: 'true' },
          signal: abortControllerRef.current.signal
        })
      ]);

      console.log('API Responses received:');
      console.log('Topics:', topicsResponse.data);
      console.log('Grades:', gradesResponse.data);
      console.log('Subjects:', subjectsResponse.data);

      // Handle topics response
      if (!topicsResponse.data.success) {
        throw new Error(topicsResponse.data.message || 'Failed to fetch topics');
      }
      const topics = topicsResponse.data.topics || [];

      // Handle grades response - grades come directly in the response
      if (!gradesResponse.data || !gradesResponse.data.grades) {
        throw new Error('Failed to fetch grades');
      }
      const grades = gradesResponse.data.grades || [];

      // Handle subjects response - subjects come directly in the response
      if (!subjectsResponse.data || !subjectsResponse.data.subjects) {
        throw new Error('Failed to fetch subjects');
      }
      const subjects = subjectsResponse.data.subjects || [];

      console.log('Processing data:');
      console.log('Grades available:', grades.map(g => ({ id: g._id || g.id, name: g.gradeName || g.grade_name })));
      console.log('Subjects by grade:', subjects.map(s => ({ 
        subject: s.subjectName,
        gradeId: s.gradeId,
        id: s.id
      })));

      setTopics(topics);
      setTotalItems(topicsResponse.data.total || 0);
      setGrades(grades);
      setSubjects(subjects);

      // If we're editing a topic, update filtered subjects
      if (formData.gradeId) {
        const filtered = subjects.filter(subject => subject.gradeId === formData.gradeId);
        setFilteredSubjects(filtered);
      }
      setError(null);
    } catch (err) {
      // Don't log error if request was aborted or canceled
      if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
        console.error('Error loading data:', err);
        const errorMessage = err.response?.data?.message || getErrorMessage(err);
        setError(errorMessage);
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

  const getGradeName = (topic) => {
    // First try the direct gradeName from the joined query
    if (topic.gradeName) {
      return topic.gradeName;
    }
    // If not found, try to find the grade through the subject's gradeId
    const grade = grades.find(g => g.id === (topic.gradeId || topic.subjectId?.gradeId));
    return grade ? grade.gradeName || grade.grade_name : 'Unknown Grade';
  };

  const getSubjectName = (topicOrSubjectId) => {
    // First try direct subject name from the joined query
    if (typeof topicOrSubjectId === 'object') {
      if (topicOrSubjectId.subjectName) {
        return topicOrSubjectId.subjectName;
      }
    }
    // Find subject by ID
    const subjectId = typeof topicOrSubjectId === 'object' ? topicOrSubjectId.subjectId : topicOrSubjectId;
    const subject = subjects.find(s => s.id === subjectId);
    return subject ? subject.subjectName : 'Unknown Subject';
  };

  const getGradeIdFromSubject = (subjectId) => {
    // Handle both populated subject object and simple ID
    if (typeof subjectId === 'object' && subjectId?.gradeId) {
      return subjectId.gradeId._id || subjectId.gradeId;
    }
    const subject = subjects.find(s => s._id === subjectId);
    return subject ? (subject.gradeId?._id || subject.gradeId) : null;
  };

  const filteredTopics = topics.filter(topic => {
    const gradeName = topic.gradeName || '';
    const subjectName = topic.subjectName || '';
    const matchesSearch = topic.topicName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         gradeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subjectName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const sortedTopics = [...filteredTopics].sort((a, b) => {
    let aVal, bVal;
    
    if (sortField === 'gradeName') {
      aVal = a.subjectId?.gradeId?.gradeName || '';
      bVal = b.subjectId?.gradeId?.gradeName || '';
    } else if (sortField === 'subjectName') {
      aVal = a.subjectId?.subjectName || '';
      bVal = b.subjectId?.subjectName || '';
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
  const paginatedTopics = topics;

  const validateForm = () => {
    const errors = {};

    if (!formData.gradeId) {
      errors.gradeId = 'Grade selection is required';
    }

    if (!formData.subjectId) {
      errors.subjectId = 'Subject selection is required';
    }

    if (!formData.topicName.trim()) {
      errors.topicName = 'Topic name is required';
    } else if (formData.topicName.length > 100) {
      errors.topicName = 'Topic name must be 100 characters or less';
    } else {
      // Check for duplicate topic name within the same grade+subject combination
      const duplicate = topics.find(topic => 
        topic.topicName.toLowerCase() === formData.topicName.toLowerCase() &&
        topic.subjectId === formData.subjectId &&
        topic._id !== editingTopic?._id
      );
      if (duplicate) {
        errors.topicName = 'Topic name already exists for this grade and subject';
      }
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
      // Ensure subjectId is valid before sending
      const subjectId = formData.subjectId && formData.subjectId !== 'undefined' ? formData.subjectId : null;
      
      if (!subjectId) {
        setFormErrors({ subjectId: 'Subject is required' });
        setSubmitting(false);
        return;
      }

      const submitData = {
        topicName: formData.topicName,
        subjectId: subjectId
      };

      if (editingTopic) {
        await api.put(`/dashboard/admin/topics/${editingTopic._id}`, submitData);
      } else {
        await api.post('/dashboard/admin/topics', submitData);
      }
      
      await loadData();
      handleCloseModal();
    } catch (err) {
      console.error('Error saving topic:', err);
      const errorMessage = getErrorMessage(err);
      if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
        setFormErrors({ topicName: 'Topic name already exists for this grade and subject' });
      } else {
        setError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (topic) => {
    const gradeId = getGradeIdFromSubject(topic.subjectId);
    setEditingTopic(topic);
    setFormData({
      topicName: topic.topicName,
      gradeId: gradeId,
      subjectId: topic.subjectId
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleDelete = async (topic) => {
    if (window.confirm(`Are you sure you want to delete topic "${topic.topicName}"?`)) {
      try {
        await api.delete(`/dashboard/admin/topics/${topic.id}`);
        await loadData();
      } catch (err) {
        console.error('Error deleting topic:', err);
        const errorMessage = err.response?.data?.message || getErrorMessage(err);
        setError(errorMessage);
      }
    }
  };

  const handleAdd = () => {
    setEditingTopic(null);
    setFormData({ topicName: '', gradeId: '', subjectId: '' });
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTopic(null);
    setFormData({ topicName: '', gradeId: '', subjectId: '' });
    setFormErrors({});
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (loading && topics.length === 0) {
    return (
      <div className={styles.tableContainer}>
        <div className={styles.emptyState}>
          <div className={styles.loadingSpinner}></div>
          <div className={styles.emptyMessage}>Loading topics...</div>
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
          <h3 className={styles.tableTitle}>Topic Management</h3>
          <div className={styles.tableActions}>
            <input
              type="text"
              placeholder="Search topics..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <button className={styles.addButton} onClick={handleAdd}>
              Add Topic
            </button>
          </div>
        </div>

        {paginatedTopics.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📝</div>
            <div className={styles.emptyMessage}>
              {searchTerm ? 'No topics found matching your search' : 'No topics added yet'}
            </div>
            <div className={styles.emptySubtext}>
              {searchTerm ? 'Try adjusting your search terms' : 'Click "Add Topic" to create your first topic'}
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
                  <th onClick={() => handleSort('subjectName')}>
                    Subject {sortField === 'subjectName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('topicName')}>
                    Topic Name {sortField === 'topicName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('createdAt')}>
                    Created {sortField === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTopics.map((topic) => (
                  <tr key={topic._id || topic.id}>
                    <td>{topic.gradeName || 'Unknown Grade'}</td>
                    <td>{topic.subjectName || 'Unknown Subject'}</td>
                    <td>{topic.topicName}</td>
                    <td>{new Date(topic.createdAt).toLocaleString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                    })}</td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button
                          className={styles.editButton}
                          onClick={() => handleEdit(topic)}
                        >
                          Edit
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDelete(topic)}
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
                {editingTopic ? 'Edit Topic' : 'Add New Topic'}
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
                      <option key={grade._id || grade.id} value={grade._id || grade.id}>
                        {grade.gradeName || grade.grade_name}
                      </option>
                    ))}
                  </select>
                  {formErrors.gradeId && (
                    <span className={styles.errorMessage}>{formErrors.gradeId}</span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="subjectId">
                    Subject *
                  </label>
                  <select
                    id="subjectId"
                    className={`${styles.formSelect} ${formErrors.subjectId ? styles.error : ''}`}
                    value={formData.subjectId}
                    onChange={(e) => handleInputChange('subjectId', e.target.value)}
                    disabled={!formData.gradeId}
                  >
                    <option value="">Select a subject</option>
                    {filteredSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.subjectName}
                      </option>
                    ))}
                  </select>
                  {formErrors.subjectId && (
                    <span className={styles.errorMessage}>{formErrors.subjectId}</span>
                  )}
                  {formData.gradeId && filteredSubjects.length === 0 && (
                    <span className={styles.helpText}>No subjects available for this grade</span>
                  )}
                  {!formData.gradeId && (
                    <small className={styles.helpText}>Please select a grade first</small>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="topicName">
                    Topic Name *
                  </label>
                  <input
                    type="text"
                    id="topicName"
                    className={`${styles.formInput} ${formErrors.topicName ? styles.error : ''}`}
                    value={formData.topicName}
                    onChange={(e) => handleInputChange('topicName', e.target.value)}
                    placeholder="Enter topic name (e.g., Algebra, Fractions)"
                    maxLength="100"
                  />
                  {formErrors.topicName && (
                    <span className={styles.errorMessage}>{formErrors.topicName}</span>
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
                  {editingTopic ? 'Update Topic' : 'Add Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopicTab;