import React, { useState, useEffect } from 'react';
import { getStoredToken } from '../utils/helpers';
import styles from './StudentSelectionModal.module.css';

const StudentSelectionModal = ({ isOpen, onClose, onSelect, selectedStudents = [] }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  
  // Filter states
  const [filters, setFilters] = useState({
    name: '',
    subjects: [],
    preferredSubjects: [],
    strugglingSubjects: [],
    ageFrom: '',
    ageTo: '',
    grade: '',
    availableDay: '',
    availableTimeStart: '',
    availableTimeEnd: ''
  });
  
  // Filter options loaded from API
  const [filterOptions, setFilterOptions] = useState({
    subjects: [],
    preferredSubjects: [],
    strugglingSubjects: [],
    grades: []
  });

  // Initialize selected students when modal opens
  useEffect(() => {
    if (isOpen) {
  setSelectedStudentIds(selectedStudents.map(s => s.id || s));
      loadFilterOptions();
    }
  }, [isOpen, selectedStudents]);

  const loadFilterOptions = async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        setError('Authentication required. Please login again.');
        return;
      }

      const response = await fetch('http://localhost:5000/api/students/filter-options', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFilterOptions(data.data);
        }
      } else {
        console.error('Failed to load filter options');
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const searchStudents = async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      
      const token = getStoredToken();
      if (!token) {
        setError('Authentication required. Please login again.');
        return;
      }

      // Build query params
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });

      // Add filters to query params
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '' && (!Array.isArray(value) || value.length > 0)) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v));
          } else {
            queryParams.set(key, value);
          }
        }
      });

      const response = await fetch(`http://localhost:5000/api/students?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setStudents(data.data.students || []);
        setCurrentPage(data.data.currentPage || page);
        setTotalPages(data.data.totalPages || 1);
        setTotalStudents(data.data.totalStudents || 0);
        setHasSearched(true);
      } else {
        setError(data.message || 'Failed to load students');
      }
    } catch (error) {
      console.error('Error searching students:', error);
      setError('Failed to search students: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMultiSelectChange = (name, value, checked) => {
    setFilters(prev => ({
      ...prev,
      [name]: checked 
        ? [...prev[name], value]
        : prev[name].filter(item => item !== value)
    }));
  };

  const resetFilters = () => {
    setFilters({
      name: '',
      subjects: [],
      preferredSubjects: [],
      strugglingSubjects: [],
      ageFrom: '',
      ageTo: '',
      grade: ''
    });
    setStudents([]);
    setHasSearched(false);
    setCurrentPage(1);
  };

  const handleStudentToggle = (student) => {
    const studentId = student.id;
    setSelectedStudentIds(prev => {
      const updated = prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId];
      console.log('Student toggled:', studentId, 'New selected:', updated);
      return updated;
    });
  };

  const handleSelectStudents = () => {
    const selectedStudentObjects = students.filter(student => 
      selectedStudentIds.includes(student.id)
    );
    onSelect(selectedStudentObjects);
    onClose();
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    searchStudents(page);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Select Students</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Filters Section */}
        <div className={styles.filtersSection}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label>Name</label>
              <input
                type="text"
                value={filters.name}
                onChange={(e) => handleFilterChange('name', e.target.value)}
                placeholder="Search by name..."
              />
            </div>

            <div className={styles.filterGroup}>
              <label>Age Range</label>
              <div className={styles.rangeInputs}>
                <input
                  type="number"
                  placeholder="From"
                  value={filters.ageFrom}
                  onChange={(e) => handleFilterChange('ageFrom', e.target.value)}
                />
                <span>to</span>
                <input
                  type="number"
                  placeholder="To"
                  value={filters.ageTo}
                  onChange={(e) => handleFilterChange('ageTo', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label>Grade</label>
              <select 
                value={filters.grade}
                onChange={(e) => handleFilterChange('grade', e.target.value)}
              >
                <option value="">All Grades</option>
                {filterOptions.grades.map((grade, idx) => (
                  <option key={grade + '-' + idx} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Availability Filter Row */}
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label>Available Day</label>
              <select 
                value={filters.availableDay}
                onChange={(e) => handleFilterChange('availableDay', e.target.value)}
              >
                <option value="">Any Day</option>
                <option value="monday">Monday</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday</option>
                <option value="saturday">Saturday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Available Time Range</label>
              <div className={styles.timeInputs}>
                <input
                  type="time"
                  value={filters.availableTimeStart}
                  onChange={(e) => handleFilterChange('availableTimeStart', e.target.value)}
                  placeholder="Start time"
                />
                <span>to</span>
                <input
                  type="time"
                  value={filters.availableTimeEnd}
                  onChange={(e) => handleFilterChange('availableTimeEnd', e.target.value)}
                  placeholder="End time"
                />
              </div>
            </div>

            <div className={styles.filterGroup}>
              <div className={styles.availabilityNote}>
                <small>Filter students by their available days and times</small>
              </div>
            </div>
          </div>

          <div className={styles.filterActions}>
            <button 
              className={styles.searchButton} 
              onClick={() => searchStudents(1)}
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search Students'}
            </button>
            <button className={styles.resetButton} onClick={resetFilters}>
              Reset Filters
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        {/* Results Section */}
        <div className={styles.resultsSection}>
          {!hasSearched && !loading && (
            <div className={styles.noSearch}>
              <p>Use the filters above and click "Search Students" to find students.</p>
            </div>
          )}

          {loading && (
            <div className={styles.loading}>
              <p>Searching students...</p>
            </div>
          )}

          {hasSearched && !loading && students.length === 0 && (
            <div className={styles.noResults}>
              <p>No students found matching your criteria.</p>
            </div>
          )}

          {students.length > 0 && (
            <>
              <div className={styles.resultsHeader}>
                <p>Found {totalStudents} student{totalStudents !== 1 ? 's' : ''}</p>
                <p>Selected: {selectedStudentIds.length} student{selectedStudentIds.length !== 1 ? 's' : ''}</p>
              </div>

              <div className={styles.studentsList}>
                {students.map(student => (
                  <div 
                    key={student.id} 
                    className={`${styles.studentItem} ${selectedStudentIds.includes(student.id) ? styles.selected : ''}`}
                  >
                    <div className={styles.checkbox}>
                      <input
                        type="checkbox"
                        id={`student-checkbox-${student.id}`}
                        name={`student-checkbox-${student.id}`}
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={() => handleStudentToggle(student)}
                      />
                    </div>
                    <div className={styles.studentInfo}>
                      <div className={styles.studentName}>
                        {student.firstName} {student.lastName}
                      </div>
                      <div className={styles.studentDetails}>
                        <span className={styles.email}>{student.email}</span>
                        {student.studentProfile?.subjects && student.studentProfile.subjects.length > 0 && (
                          <span className={styles.subjects}>
                            Subjects: {student.studentProfile.subjects.join(', ')}
                          </span>
                        )}
                        {student.studentProfile?.dateOfBirth && (
                          <span className={styles.age}>
                            Age: {Math.floor((Date.now() - new Date(student.studentProfile.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365))} years
                          </span>
                        )}
                        {student.studentProfile?.grade && (
                          <span className={styles.grade}>
                            Grade: {student.studentProfile.grade}
                          </span>
                        )}
                        {student.studentProfile?.preferredSubjects && student.studentProfile.preferredSubjects.length > 0 && (
                          <span className={styles.preferred}>
                            Preferred: {student.studentProfile.preferredSubjects.join(', ')}
                          </span>
                        )}
                        {/* Display student availability */}
                        {student.studentProfile?.availability && (
                          <div className={styles.studentAvailability}>
                            <strong>Available Times:</strong>
                            <div className={styles.availabilityTimes}>
                              {Object.entries(student.studentProfile.availability).map(([day, dayAvailability]) => {
                                if (!dayAvailability || !dayAvailability.available) return null;
                                
                                // Handle new format with start/end times
                                if (dayAvailability.start && dayAvailability.end) {
                                  return (
                                    <span key={day} className={styles.dayTime}>
                                      {day.charAt(0).toUpperCase() + day.slice(1)}: {dayAvailability.start} - {dayAvailability.end}
                                    </span>
                                  );
                                }
                                
                                // Handle new format with timeSlots array of objects
                                if (dayAvailability.timeSlots && dayAvailability.timeSlots.length > 0) {
                                  const timeDisplay = dayAvailability.timeSlots.map(slot => {
                                    if (typeof slot === 'string') {
                                      return slot; // Legacy format
                                    } else if (slot.startTime && slot.endTime) {
                                      return `${slot.startTime}-${slot.endTime}`;
                                    }
                                    return '';
                                  }).filter(Boolean).join(', ');
                                  
                                  return (
                                    <span key={day} className={styles.dayTime}>
                                      {day.charAt(0).toUpperCase() + day.slice(1)}: {timeDisplay}
                                    </span>
                                  );
                                }
                                
                                // Fallback for backward compatibility
                                if (Array.isArray(dayAvailability) && dayAvailability.length > 0) {
                                  return (
                                    <span key={day} className={styles.dayTime}>
                                      {day.charAt(0).toUpperCase() + day.slice(1)}: {dayAvailability.join(', ')}
                                    </span>
                                  );
                                }
                                
                                return null;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    Previous
                  </button>
                  
                  <span className={styles.pageInfo}>
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className={styles.actionButtons}>
                <button 
                  className={styles.selectAllButton} 
                  onClick={handleSelectStudents}
                  disabled={selectedStudentIds.length === 0}
                >
                  Select {selectedStudentIds.length} Student{selectedStudentIds.length !== 1 ? 's' : ''}
                </button>
                <button className={styles.cancelButton} onClick={onClose}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentSelectionModal;
