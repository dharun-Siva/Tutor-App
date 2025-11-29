import React, { useState, useEffect } from 'react';
import { getStoredToken } from '../utils/helpers';
import styles from './TutorSelectionModal.module.css';

const TutorSelectionModal = ({ isOpen, onClose, onSelect, selectedTutorId }) => {
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTutors, setTotalTutors] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    name: '',
    minExperience: '',
    maxExperience: '',
    minRating: '',
    minRate: '',
    maxRate: '',
    verificationStatus: '',
    availableDay: '',
    availableTimeFrom: '',
    availableTimeTo: ''
  });
  
  // Filter options loaded from API
  const [filterOptions, setFilterOptions] = useState({
    subjects: [],
    specializations: [],
    languages: []
  });

  // Load filter options when modal opens
  useEffect(() => {
    if (isOpen) {
      loadFilterOptions();
    }
  }, [isOpen]);

  const loadFilterOptions = async () => {
    try {
      const token = getStoredToken();
      console.log('🔑 TutorSelectionModal - Token check:', token ? 'Token found' : 'No token found');
      console.log('🔑 TutorSelectionModal - Token value:', token ? `${token.substring(0, 20)}...${token.substring(token.length - 20)}` : 'null');
      
      if (!token) {
        console.error('❌ TutorSelectionModal - No authentication token found');
        setError('Authentication required. Please login again.');
        return;
      }

      console.log('🚀 TutorSelectionModal - Loading filter options...');
      const response = await fetch('http://localhost:5000/api/tutors/filter-options', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 TutorSelectionModal - Filter options response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ TutorSelectionModal - Filter options loaded:', data);
        if (data.success) {
          setFilterOptions(data.data);
        }
      } else {
        const errorData = await response.json();
        console.error('❌ TutorSelectionModal - Failed to load filter options:', errorData);
        setError('Failed to load filter options: ' + (errorData.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('💥 TutorSelectionModal - Error loading filter options:', error);
      setError('Failed to load filter options: ' + error.message);
    }
  };

  const searchTutors = async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      
      const token = getStoredToken();
      console.log('🔑 TutorSelectionModal - Search token check:', token ? 'Token found' : 'No token found');
      console.log('🔑 TutorSelectionModal - Search token value:', token ? `${token.substring(0, 20)}...${token.substring(token.length - 20)}` : 'null');
      
      if (!token) {
        console.error('❌ TutorSelectionModal - No authentication token for search');
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

      const searchUrl = `http://localhost:5000/api/tutors?${queryParams}`;
      console.log('🚀 TutorSelectionModal - Searching tutors:', searchUrl);

      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 TutorSelectionModal - Search response status:', response.status);
      const data = await response.json();
      console.log('📊 TutorSelectionModal - Search response data:', data);
      
      if (response.ok && data.success) {
        setTutors(data.data.tutors || []);
        setCurrentPage(data.data.currentPage || page);
        setTotalPages(data.data.totalPages || 1);
        setTotalTutors(data.data.totalTutors || 0);
        setHasSearched(true);
        console.log(`✅ TutorSelectionModal - Found ${data.data.tutors?.length || 0} tutors`);
      } else {
        const errorMsg = data.message || 'Failed to load tutors';
        console.error('❌ TutorSelectionModal - Search failed:', errorMsg);
        setError(errorMsg);
      }
    } catch (error) {
      console.error('💥 TutorSelectionModal - Search error:', error);
      setError('Failed to search tutors: ' + error.message);
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
      minExperience: '',
      maxExperience: '',
      minRating: '',
      minRate: '',
      maxRate: '',
      verificationStatus: '',
      availableDay: '',
      availableTimeFrom: '',
      availableTimeTo: ''
    });
    setTutors([]);
    setHasSearched(false);
    setCurrentPage(1);
  };

  const handleSelectTutor = (tutor) => {
    onSelect(tutor);
    onClose();
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    searchTutors(page);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Select Tutor</h3>
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
              <label>Experience (Years)</label>
              <div className={styles.rangeInputs}>
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minExperience}
                  onChange={(e) => handleFilterChange('minExperience', e.target.value)}
                />
                <span>to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxExperience}
                  onChange={(e) => handleFilterChange('maxExperience', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label>Min Rating</label>
              <select 
                value={filters.minRating}
                onChange={(e) => handleFilterChange('minRating', e.target.value)}
              >
                <option value="">Any Rating</option>
                <option value="4">4+ Stars</option>
                <option value="3">3+ Stars</option>
                <option value="2">2+ Stars</option>
                <option value="1">1+ Stars</option>
              </select>
            </div>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label>Hourly Rate ($)</label>
              <div className={styles.rangeInputs}>
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minRate}
                  onChange={(e) => handleFilterChange('minRate', e.target.value)}
                />
                <span>to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxRate}
                  onChange={(e) => handleFilterChange('maxRate', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.filterGroup}>
              <label>Verification Status</label>
              <select 
                value={filters.verificationStatus}
                onChange={(e) => handleFilterChange('verificationStatus', e.target.value)}
              >
                <option value="">All Status</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

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
          </div>

          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label>Available Time</label>
              <div className={styles.timeInputs}>
                <input
                  type="time"
                  value={filters.availableTimeFrom}
                  onChange={(e) => handleFilterChange('availableTimeFrom', e.target.value)}
                />
                <span>to</span>
                <input
                  type="time"
                  value={filters.availableTimeTo}
                  onChange={(e) => handleFilterChange('availableTimeTo', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={styles.filterActions}>
            <button 
              className={styles.searchButton} 
              onClick={() => searchTutors(1)}
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search Tutors'}
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
              <p>Use the filters above and click "Search Tutors" to find tutors.</p>
            </div>
          )}

          {loading && (
            <div className={styles.loading}>
              <p>Searching tutors...</p>
            </div>
          )}

          {hasSearched && !loading && tutors.length === 0 && (
            <div className={styles.noResults}>
              <p>No tutors found matching your criteria.</p>
            </div>
          )}

          {tutors.length > 0 && (
            <>
              <div className={styles.resultsHeader}>
                <p>Found {totalTutors} tutor{totalTutors !== 1 ? 's' : ''}</p>
              </div>

              <div className={styles.tutorsList}>
                {tutors.map(tutor => {
                  // Debug logging to see the structure
                  console.log('🔍 TutorSelectionModal - Tutor data:', tutor);
                  console.log('🔍 TutorSelectionModal - Tutor subjects:', tutor.tutorProfile?.subjects);
                  console.log('🔍 TutorSelectionModal - Tutor rating:', tutor.tutorProfile?.rating);
                  console.log('🔍 TutorSelectionModal - Tutor availability:', tutor.tutorProfile?.availability);
                  
                  return (
                    <div 
                      key={tutor._id} 
                      className={`${styles.tutorItem} ${selectedTutorId === tutor._id ? styles.selected : ''}`}
                      onClick={() => handleSelectTutor(tutor)}
                    >
                      <div className={styles.tutorInfo}>
                        <div className={styles.tutorName}>
                          {(tutor.firstName || 'Unknown')} {(tutor.lastName || '')}
                          {tutor.tutorProfile?.verificationStatus === 'verified' && (
                            <span className={styles.verifiedBadge}>✓</span>
                          )}
                        </div>
                        <div className={styles.tutorDetails}>
                          <span className={styles.email}>{tutor.email || 'No email'}</span>
                          {tutor.tutorProfile?.subjects && Array.isArray(tutor.tutorProfile.subjects) && tutor.tutorProfile.subjects.length > 0 && (
                            <span className={styles.subjects}>
                              Subjects: {tutor.tutorProfile.subjects.join(', ')}
                            </span>
                          )}
                          {tutor.tutorProfile?.experience && typeof tutor.tutorProfile.experience === 'number' && (
                            <span className={styles.experience}>
                              Experience: {tutor.tutorProfile.experience} years
                            </span>
                          )}
                          {tutor.tutorProfile?.hourlyRate && typeof tutor.tutorProfile.hourlyRate === 'number' && (
                            <span className={styles.rate}>
                              Rate: ${tutor.tutorProfile.hourlyRate}/hr
                            </span>
                          )}
                          {tutor.tutorProfile?.rating && 
                           typeof tutor.tutorProfile.rating === 'object' && 
                           tutor.tutorProfile.rating.average && 
                           tutor.tutorProfile.rating.average > 0 && (
                            <span className={styles.rating}>
                              Rating: {Number(tutor.tutorProfile.rating.average).toFixed(1)}/5 
                              ({tutor.tutorProfile.rating.count || 0} reviews)
                            </span>
                          )}
                          {/* Display tutor availability */}
                          {tutor.tutorProfile?.availability && typeof tutor.tutorProfile.availability === 'object' && (
                            <div className={styles.tutorAvailability}>
                              <strong>Available Times:</strong>
                              <div className={styles.availabilitySchedule}>
                                {Object.entries(tutor.tutorProfile.availability).map(([day, dayData]) => {
                                  // Ensure dayData is an object with the expected structure
                                  if (!dayData || typeof dayData !== 'object' || !dayData.available) {
                                    return null;
                                  }
                                  
                                  // Ensure timeSlots exists and is an array
                                  if (!dayData.timeSlots || !Array.isArray(dayData.timeSlots) || dayData.timeSlots.length === 0) {
                                    return null;
                                  }

                                  return (
                                    <span key={day} className={styles.scheduleItem}>
                                      {day}: {dayData.timeSlots.map(slot => {
                                        if (typeof slot === 'string') {
                                          return slot; // Legacy format
                                        } else if (slot && typeof slot === 'object' && slot.startTime && slot.endTime) {
                                          return `${slot.startTime}-${slot.endTime}`;
                                        }
                                        return '';
                                      }).filter(Boolean).join(', ')}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <button className={styles.selectButton} onClick={(e) => {
                        e.stopPropagation();
                        handleSelectTutor(tutor);
                      }}>
                        Select
                      </button>
                    </div>
                  );
                })}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorSelectionModal;
