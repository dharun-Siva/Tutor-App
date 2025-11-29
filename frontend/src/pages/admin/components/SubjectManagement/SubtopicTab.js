import React, { useState, useEffect, useRef } from 'react';
import api from '../../../../utils/api';
import { getErrorMessage } from '../../../../utils/helpers';
import styles from './SubjectManagement.module.css';

const SubtopicTab = () => {
  const [subtopics, setSubtopics] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSubtopic, setEditingSubtopic] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('subtopicName');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    subtopicName: '',
    gradeId: '',
    subjectId: '',
    topicId: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Filtered dropdowns
  const [filteredSubjects, setFilteredSubjects] = useState([]);
  const [filteredTopics, setFilteredTopics] = useState([]);

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
    console.log('SubtopicTab - Grade changed:', formData.gradeId, 'Available subjects:', subjects);
    if (formData.gradeId) {
      const selectedGrade = grades.find(g => g.id === formData.gradeId || g._id === formData.gradeId);
      console.log('Selected Grade:', selectedGrade);
      console.log('All subjects:', subjects);
      
      if (selectedGrade) {
        const filtered = subjects.filter(subject => {
          if (!subject || !selectedGrade) return false;
          
          const subjectGradeId = String(subject.gradeId || subject.grade_id);
          const selectedGradeId = String(selectedGrade.id || selectedGrade._id);
          const isMatch = subjectGradeId === selectedGradeId;
          console.log('Comparing:', {
            subject: subject.subjectName,
            subjectGradeId,
            selectedGradeId,
            isMatch
          });
          return isMatch;
        });
        
        console.log('Filtered subjects:', filtered);
        setFilteredSubjects(filtered);
        
        // Clear subject selection if it's not valid for the new grade
        if (formData.subjectId && !filtered.find(s => (s.id || s._id) === formData.subjectId)) {
          setFormData(prev => ({ ...prev, subjectId: '', topicId: '' }));
        }
      }
    } else {
      setFilteredSubjects([]);
      setFormData(prev => ({ ...prev, subjectId: '', topicId: '' }));
    }
  }, [formData.gradeId, subjects]);

  useEffect(() => {
    // Filter topics when subject changes
    console.log('SubtopicTab - Subject changed:', formData.subjectId, 'Available topics:', topics);
    if (formData.subjectId) {
      const filtered = topics.filter(topic => {
        const topicSubjectId = String(topic.subject_id || topic.subjectId);
        const selectedSubjectId = String(formData.subjectId);
        const isMatch = topicSubjectId === selectedSubjectId;
        console.log('Topic:', {
          name: topic.topic_name || topic.topicName,
          id: topic.id || topic._id,
          subjectId: topicSubjectId,
          selectedSubjectId: selectedSubjectId,
          match: isMatch
        });
        return isMatch;
      });
      console.log('Filtered topics:', filtered);
      setFilteredTopics(filtered);
      
      // Clear topic selection if it's not valid for the new subject
      if (formData.topicId && !filtered.find(t => String(t.id || t._id) === String(formData.topicId))) {
        setFormData(prev => ({ ...prev, topicId: '' }));
      }
    } else {
      setFilteredTopics([]);
      setFormData(prev => ({ ...prev, topicId: '' }));
    }
  }, [formData.subjectId, topics]);

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
      
      // Get all data in parallel
      const [subtopicsResponse, gradesResponse, subjectsResponse, topicsResponse] = await Promise.all([
        api.get('/dashboard/admin/subtopics', { 
          params: { 
            page, 
            limit, 
            sortField: sf, 
            sortDirection: sd
          },
          signal: abortControllerRef.current.signal
        }),
        api.get('/dashboard/admin/grades', { 
          params: { all: 'true' },
          signal: abortControllerRef.current.signal
        }),
        api.get('/dashboard/admin/subjects', { 
          params: { all: 'true' },
          signal: abortControllerRef.current.signal
        }),
        api.get('/dashboard/admin/topics', { 
          params: { all: 'true' },
          signal: abortControllerRef.current.signal
        })
      ]);
      
      console.log('API responses:', {
        subtopics: subtopicsResponse.data,
        grades: gradesResponse.data,
        subjects: subjectsResponse.data,
        topics: topicsResponse.data
      });

      console.log('API responses:', {
        subtopics: subtopicsResponse.data,
        grades: gradesResponse.data,
        subjects: subjectsResponse.data,
        topics: topicsResponse.data
      });

      // Process subtopics data
      const subtopicsData = subtopicsResponse.data.subtopics || [];
      setSubtopics(subtopicsData);
      setTotalItems(subtopicsResponse.data.total || subtopicsData.length || 0);
      
      // Process grades data
      const gradesData = gradesResponse.data.grades || gradesResponse.data || [];
      setGrades(gradesData);
      
      // Process subjects data
      const subjectsData = subjectsResponse.data.subjects || subjectsResponse.data || [];
      setSubjects(subjectsData);
      
      // Process topics data
      const topicsData = topicsResponse.data.topics || topicsResponse.data || [];
      setTopics(topicsData);
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
    const grade = grades.find(g => g.id === gradeId);
    return grade ? grade.grade_name : 'Unknown Grade';
  };

  const getSubjectName = (subjectId) => {
    // Handle both populated subject object and simple ID
    if (typeof subjectId === 'object' && subjectId?.subjectName) {
      return subjectId.subjectName;
    }
    const subject = subjects.find(s => s.id === subjectId);
    return subject ? subject.subject_name : 'Unknown Subject';
  };

  const getTopicName = (topicId) => {
    // Handle both populated topic object and simple ID
    if (typeof topicId === 'object' && topicId?.topicName) {
      return topicId.topicName;
    }
    const topic = topics.find(t => t.id === topicId);
    return topic ? topic.topic_name : 'Unknown Topic';
  };

  const getGradeIdFromTopic = (topicId) => {
    // Handle both populated topic object and simple ID
    if (typeof topicId === 'object' && topicId?.subjectId) {
      return topicId.subjectId?.gradeId || topicId.gradeId;
    }
    const topic = topics.find(t => t.id === topicId);
    if (topic) {
      const subject = subjects.find(s => s.id === topic.subject_id);
      return subject ? subject.grade_id : null;
    }
    return null;
  };

  const getSubjectIdFromTopic = (topicId) => {
    // Handle both populated topic object and simple ID
    if (typeof topicId === 'object' && topicId?.subject_id) {
      return topicId.subject_id;
    }
    const topic = topics.find(t => t.id === topicId);
    return topic ? topic.subject_id : null;
  };

  const filteredSubtopics = subtopics.filter(subtopic => {
    const topic = topics.find(t => t.id === subtopic.topic_id);
    const subject = subjects.find(s => s.id === (topic?.subject_id || ''));
    const grade = grades.find(g => g.id === (subject?.grade_id || ''));

    const subtopicName = subtopic.subtopic_name || '';
    const topicName = topic?.topic_name || '';
    const subjectName = subject?.subject_name || '';
    const gradeName = grade?.grade_name || '';

    const searchTermLower = searchTerm.toLowerCase();
    return subtopicName.toLowerCase().includes(searchTermLower) ||
           topicName.toLowerCase().includes(searchTermLower) ||
           subjectName.toLowerCase().includes(searchTermLower) ||
           gradeName.toLowerCase().includes(searchTermLower);
  });

  const sortedSubtopics = [...filteredSubtopics].sort((a, b) => {
    let aVal, bVal;
    
    if (sortField === 'gradeName') {
      aVal = a.topicId?.subjectId?.gradeId?.gradeName || '';
      bVal = b.topicId?.subjectId?.gradeId?.gradeName || '';
    } else if (sortField === 'subjectName') {
      aVal = a.topicId?.subjectId?.subjectName || '';
      bVal = b.topicId?.subjectId?.subjectName || '';
    } else if (sortField === 'topicName') {
      aVal = a.topicId?.topicName || '';
      bVal = b.topicId?.topicName || '';
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
  const paginatedSubtopics = subtopics;

  const validateForm = () => {
    const errors = {};
    
    if (!formData.subtopicName || !formData.subtopicName.trim()) {
      errors.subtopicName = 'Sub-topic name is required';
    } else if (formData.subtopicName.length > 100) {
      errors.subtopicName = 'Sub-topic name must be 100 characters or less';
    }

    if (!formData.topicId || formData.topicId === 'undefined' || formData.topicId === 'null') {
      errors.topicId = 'Topic selection is required';
    }

    // Additional validations
    if (!formData.gradeId) {
      errors.gradeId = 'Grade selection is required';
    }

    if (!formData.subjectId) {
      errors.subjectId = 'Subject selection is required';
    }

    // Check for duplicates
    if (formData.subtopicName && formData.topicId) {
      const duplicate = subtopics.find(subtopic => {
        const subtopicName = subtopic.subtopic_name || subtopic.subtopicName;
        if (!subtopicName) return false;
        
        return (
          subtopicName.toLowerCase() === formData.subtopicName.trim().toLowerCase() &&
          (subtopic.topic_id === formData.topicId || subtopic.topicId === formData.topicId) &&
          (subtopic.id !== editingSubtopic?.id && subtopic._id !== editingSubtopic?.id)
        );
      });
      
      if (duplicate) {
        errors.subtopicName = 'Sub-topic name already exists for this topic';
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
      // Ensure topicId is valid before sending
      const topicId = formData.topicId && formData.topicId !== 'undefined' ? formData.topicId : null;
      
      if (!topicId) {
        setFormErrors({ topicId: 'Topic is required' });
        setSubmitting(false);
        return;
      }

      const submitData = {
        subtopic_name: formData.subtopicName.trim(),
        topic_id: topicId
      };

      if (editingSubtopic) {
        await api.put(`/dashboard/admin/subtopics/${editingSubtopic.id}`, submitData);
      } else {
        await api.post('/dashboard/admin/subtopics', submitData);
      }
      
      await loadData();
      handleCloseModal();
    } catch (err) {
      console.error('Error saving subtopic:', err);
      const errorMessage = getErrorMessage(err);
      if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
        setFormErrors({ subtopicName: 'Sub-topic name already exists for this grade, subject, and topic' });
      } else {
        setError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (subtopic) => {
    // Get the topic for this subtopic
    const topic = topics.find(t => t.id === subtopic.topic_id);
    // Get the subject for this topic
    const subject = subjects.find(s => s.id === topic?.subject_id);
    // Get the grade for this subject
    const grade = grades.find(g => g.id === subject?.grade_id);
    
    // Ensure no undefined values are set as strings
    const safeTopicId = topic?.id || '';
    const safeSubjectId = subject?.id || '';
    const safeGradeId = grade?.id || '';
    
    console.log('SubtopicTab - Edit subtopic:', {
      subtopicName: subtopic.subtopic_name,
      topicId: safeTopicId,
      subjectId: safeSubjectId, 
      gradeId: safeGradeId,
      originalData: subtopic
    });
    
    setEditingSubtopic(subtopic);
    setFormData({
      subtopicName: subtopic.subtopic_name,
      gradeId: safeGradeId,
      subjectId: safeSubjectId,
      topicId: safeTopicId
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleDelete = async (subtopic) => {
    if (window.confirm(`Are you sure you want to delete sub-topic "${subtopic.subtopicName}"?`)) {
      try {
        await api.delete(`/dashboard/admin/subtopics/${subtopic.id}`);
        await loadData();
      } catch (err) {
        console.error('Error deleting subtopic:', err);
        setError(getErrorMessage(err));
      }
    }
  };

  const handleAdd = () => {
    setEditingSubtopic(null);
    setFormData({ subtopicName: '', gradeId: '', subjectId: '', topicId: '' });
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSubtopic(null);
    setFormData({ subtopicName: '', gradeId: '', subjectId: '', topicId: '' });
    setFormErrors({});
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (loading && subtopics.length === 0) {
    return (
      <div className={styles.tableContainer}>
        <div className={styles.emptyState}>
          <div className={styles.loadingSpinner}></div>
          <div className={styles.emptyMessage}>Loading sub-topics...</div>
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
          <h3 className={styles.tableTitle}>Sub-topic Management</h3>
          <div className={styles.tableActions}>
            <input
              type="text"
              placeholder="Search sub-topics..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <button className={styles.addButton} onClick={handleAdd}>
              Add Sub-topic
            </button>
          </div>
        </div>

        {paginatedSubtopics.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🔖</div>
            <div className={styles.emptyMessage}>
              {searchTerm ? 'No sub-topics found matching your search' : 'No sub-topics added yet'}
            </div>
            <div className={styles.emptySubtext}>
              {searchTerm ? 'Try adjusting your search terms' : 'Click "Add Sub-topic" to create your first sub-topic'}
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
                    Topic {sortField === 'topicName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('subtopicName')}>
                    Sub-topic Name {sortField === 'subtopicName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('createdAt')}>
                    Created {sortField === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSubtopics.map((subtopic) => {
                  return (
                    <tr key={subtopic._id || subtopic.id}>
                      <td>{subtopic.gradeName || 'Unknown Grade'}</td>
                      <td>{subtopic.subjectName || 'Unknown Subject'}</td>
                      <td>{subtopic.topicName || 'Unknown Topic'}</td>
                      <td>{subtopic.subtopicName}</td>
                      <td>
                        {subtopic.created_at || subtopic.createdAt ? 
                          new Date(subtopic.created_at || subtopic.createdAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                          }) : 
                          new Date().toLocaleDateString('en-GB')
                        }
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button
                            className={styles.editButton}
                            onClick={() => handleEdit(subtopic)}
                          >
                            Edit
                          </button>
                          <button
                            className={styles.deleteButton}
                            onClick={() => handleDelete(subtopic)}
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
                {editingSubtopic ? 'Edit Sub-topic' : 'Add New Sub-topic'}
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
                      <option key={grade.id || grade._id} value={grade.id || grade._id}>
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
                      <option key={subject.id || subject._id} value={subject.id || subject._id}>
                        {subject.subjectName}
                      </option>
                    ))}
                  </select>
                  {formErrors.subjectId && (
                    <span className={styles.errorMessage}>{formErrors.subjectId}</span>
                  )}
                  {!formData.gradeId && (
                    <small className="text-muted">Please select a grade first</small>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="topicId">
                    Topic *
                  </label>
                  <select
                    id="topicId"
                    className={`${styles.formSelect} ${formErrors.topicId ? styles.error : ''}`}
                    value={formData.topicId}
                    onChange={(e) => handleInputChange('topicId', e.target.value)}
                    disabled={!formData.subjectId}
                  >
                    <option value="">Select a topic</option>
                    {filteredTopics.map((topic) => (
                      <option key={topic.id || topic._id} value={topic.id || topic._id}>
                        {topic.topic_name || topic.topicName}
                      </option>
                    ))}
                  </select>
                  {formErrors.topicId && (
                    <span className={styles.errorMessage}>{formErrors.topicId}</span>
                  )}
                  {!formData.subjectId && (
                    <small className="text-muted">Please select a subject first</small>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="subtopicName">
                    Sub-topic Name *
                  </label>
                  <input
                    type="text"
                    id="subtopicName"
                    className={`${styles.formInput} ${formErrors.subtopicName ? styles.error : ''}`}
                    value={formData.subtopicName}
                    onChange={(e) => handleInputChange('subtopicName', e.target.value)}
                    placeholder="Enter sub-topic name (e.g., Linear Equations, Basic Addition)"
                    maxLength="100"
                  />
                  {formErrors.subtopicName && (
                    <span className={styles.errorMessage}>{formErrors.subtopicName}</span>
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
                  {editingSubtopic ? 'Update Sub-topic' : 'Add Sub-topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubtopicTab;