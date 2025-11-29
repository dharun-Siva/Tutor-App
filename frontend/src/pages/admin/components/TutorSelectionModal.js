import React, { useState, useEffect } from 'react';
import styles from './TutorSelectionModal.module.css';

const TutorSelectionModal = ({ 
  isOpen, 
  onClose, 
  onSelectTutor, 
  selectedTutorId 
}) => {
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    experienceMin: '',
    experienceMax: '',
    ratingMin: '',
    hourlyRateMin: '',
    hourlyRateMax: '',
    verificationStatus: '',
    availableDay: '',
    availableTimeStart: '',
    availableTimeEnd: ''
  });

  // Filter options from API
  const [filterOptions, setFilterOptions] = useState({
    subjects: [],
    specializations: [],
    languages: [],
    experienceRange: { min: 0, max: 10 },
    rateRange: { min: 0, max: 100 },
    verificationStatuses: ['pending', 'verified', 'rejected'],
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  const itemsPerPage = 10;

  useEffect(() => {
    if (isOpen) {
      loadFilterOptions();
      resetFilters();
    }
  }, [isOpen]);

  const loadFilterOptions = async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        setError('No authentication token found');
        return;
      }

      const response = await fetch('http://localhost:5000/api/tutors/filter-options', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load filter options');
      }

      const data = await response.json();
      if (data.success) {
        setFilterOptions(data.data);
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
      setError('Failed to load filter options');
    }
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      experienceMin: '',
      experienceMax: '',
      ratingMin: '',
      hourlyRateMin: '',
      hourlyRateMax: '',
      verificationStatus: '',
      availableDay: '',
      availableTimeStart: '',
      availableTimeEnd: ''
    });
    setTutors([]);
    setCurrentPage(1);
    setHasSearched(false);
  };

  const searchTutors = async (page = 1) => {
    if (!hasAnyFilter()) {
      setError('Please apply at least one filter to search for tutors');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const token = getStoredToken();
      if (!token) {
        setError('No authentication token found');
        return;
      }

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        status: 'active' // Only show active tutors
      });

      // Add filters to query
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.experienceMin) queryParams.append('experienceMin', filters.experienceMin);
      if (filters.experienceMax) queryParams.append('experienceMax', filters.experienceMax);
      if (filters.ratingMin) queryParams.append('ratingMin', filters.ratingMin);
      if (filters.hourlyRateMin) queryParams.append('hourlyRateMin', filters.hourlyRateMin);
      if (filters.hourlyRateMax) queryParams.append('hourlyRateMax', filters.hourlyRateMax);
      if (filters.verificationStatus) queryParams.append('verificationStatus', filters.verificationStatus);
      if (filters.availableDay) queryParams.append('availableDay', filters.availableDay);
      if (filters.availableTimeStart) queryParams.append('availableTimeStart', filters.availableTimeStart);
      if (filters.availableTimeEnd) queryParams.append('availableTimeEnd', filters.availableTimeEnd);

      const response = await fetch(`http://localhost:5000/api/tutors?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to search tutors');
      }

      const data = await response.json();
      if (data.success) {
        setTutors(data.data.tutors);
        setCurrentPage(data.data.pagination.current);
        setTotalPages(data.data.pagination.total);
        setTotalRecords(data.data.pagination.totalRecords);
        setHasSearched(true);
      }
    } catch (error) {
      console.error('Error searching tutors:', error);
      setError('Failed to search tutors');
    } finally {
      setLoading(false);
    }
  };

  const hasAnyFilter = () => {
    return filters.search ||
           filters.experienceMin ||
           filters.experienceMax ||
           filters.ratingMin ||
           filters.hourlyRateMin ||
           filters.hourlyRateMax ||
           filters.verificationStatus ||
           filters.availableDay ||
           (filters.availableTimeStart && filters.availableTimeEnd);
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMultiSelectChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: prev[name].includes(value) 
        ? prev[name].filter(item => item !== value)
        : [...prev[name], value]
    }));
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      searchTutors(newPage);
    }
  };

  const handleSelectTutor = (tutor) => {
    onSelectTutor(tutor);
    onClose();
  };

  const formatAvailability = (availability) => {
    if (!availability) return 'Not specified';
    
    const availableDays = Object.keys(availability)
      .filter(day => availability[day]?.available)
      .map(day => day.charAt(0).toUpperCase() + day.slice(1));
    
    return availableDays.length > 0 ? availableDays.join(', ') : 'No availability set';
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Select Tutor</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          {/* Filter Section */}
          <div className={styles.filtersSection}>
            <h3>Search Filters</h3>
            
            <div className={styles.filterRow}>
              {/* Search Input */}
              <div className={styles.filterGroup}>
                <label>Search by Name/Email</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Enter tutor name or email..."
                />
              </div>

              {/* Verification Status */}
              <div className={styles.filterGroup}>
                <label>Verification Status</label>
                <select
                  value={filters.verificationStatus}
                  onChange={(e) => handleFilterChange('verificationStatus', e.target.value)}
                >
                  <option value="">All Statuses</option>
                  {filterOptions.verificationStatuses.map(status => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.filterRow}>
              {/* Experience Range */}
              <div className={styles.filterGroup}>
                <label>Experience (Years)</label>
                <div className={styles.rangeInputs}>
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.experienceMin}
                    onChange={(e) => handleFilterChange('experienceMin', e.target.value)}
                    min="0"
                  />
                  <span>to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.experienceMax}
                    onChange={(e) => handleFilterChange('experienceMax', e.target.value)}
                    min="0"
                  />
                </div>
              </div>

              {/* Rating */}
              <div className={styles.filterGroup}>
                <label>Minimum Rating</label>
                <select
                  value={filters.ratingMin}
                  onChange={(e) => handleFilterChange('ratingMin', e.target.value)}
                >
                  <option value="">Any Rating</option>
                  <option value="4.5">4.5+ Stars</option>
                  <option value="4.0">4.0+ Stars</option>
                  <option value="3.5">3.5+ Stars</option>
                  <option value="3.0">3.0+ Stars</option>
                </select>
              </div>
            </div>

            <div className={styles.filterRow}>
              {/* Hourly Rate Range */}
              <div className={styles.filterGroup}>
                <label>Hourly Rate ($)</label>
                <div className={styles.rangeInputs}>
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.hourlyRateMin}
                    onChange={(e) => handleFilterChange('hourlyRateMin', e.target.value)}
                    min="0"
                  />
                  <span>to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.hourlyRateMax}
                    onChange={(e) => handleFilterChange('hourlyRateMax', e.target.value)}
                    min="0"
                  />
                </div>
              </div>

              {/* Available Day */}
              <div className={styles.filterGroup}>
                <label>Available Day</label>
                <select
                  value={filters.availableDay}
                  onChange={(e) => handleFilterChange('availableDay', e.target.value)}
                >
                  <option value="">Any Day</option>
                  {filterOptions.days.map(day => (
                    <option key={day} value={day}>
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time Range (only show if day is selected) */}
            {filters.availableDay && (
              <div className={styles.filterRow}>
                <div className={styles.filterGroup}>
                  <label>Available Time Range</label>
                  <div className={styles.rangeInputs}>
                    <input
                      type="time"
                      value={filters.availableTimeStart}
                      onChange={(e) => handleFilterChange('availableTimeStart', e.target.value)}
                    />
                    <span>to</span>
                    <input
                      type="time"
                      value={filters.availableTimeEnd}
                      onChange={(e) => handleFilterChange('availableTimeEnd', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}



            {/* Search Button */}
            <div className={styles.searchButtonContainer}>
              <button 
                className={styles.searchButton}
                onClick={() => searchTutors(1)}
                disabled={loading || !hasAnyFilter()}
              >
                {loading ? 'Searching...' : 'Search Tutors'}
              </button>
              <button 
                className={styles.clearButton}
                onClick={resetFilters}
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className={styles.error}>{error}</div>
          )}

          {/* Results Section */}
          {hasSearched && (
            <div className={styles.resultsSection}>
              <div className={styles.resultsHeader}>
                <h3>Search Results ({totalRecords} tutors found)</h3>
              </div>

              {tutors.length === 0 ? (
                <div className={styles.noResults}>
                  No tutors found matching your criteria. Try adjusting your filters.
                </div>
              ) : (
                <>
                  {/* Tutors List */}
                  <div className={styles.tutorsList}>
                    {tutors.map(tutor => (
                      <div 
                        key={tutor._id} 
                        className={`${styles.tutorCard} ${selectedTutorId === tutor._id ? styles.selected : ''}`}
                        onClick={() => handleSelectTutor(tutor)}
                      >
                        <div className={styles.tutorInfo}>
                          <div className={styles.tutorName}>
                            {tutor.firstName} {tutor.lastName}
                            {tutor.tutorProfile?.verificationStatus === 'verified' && (
                              <span className={styles.verifiedBadge}>✓ Verified</span>
                            )}
                          </div>
                          <div className={styles.tutorDetails}>
                            <span className={styles.email}>{tutor.email}</span>
                            {tutor.tutorProfile?.experience && (
                              <span className={styles.experience}>
                                {tutor.tutorProfile.experience} years experience
                              </span>
                            )}
                            {tutor.tutorProfile?.hourlyRate && (
                              <span className={styles.rate}>
                                ${tutor.tutorProfile.hourlyRate}/hour
                              </span>
                            )}
                          </div>
                          {tutor.tutorProfile?.subjects && tutor.tutorProfile.subjects.length > 0 && (
                            <div className={styles.subjects}>
                              <strong>Subjects:</strong> {tutor.tutorProfile.subjects.join(', ')}
                            </div>
                          )}
                          {tutor.tutorProfile?.rating && tutor.tutorProfile.rating.average > 0 && (
                            <div className={styles.rating}>
                              <strong>Rating:</strong> {tutor.tutorProfile.rating.average.toFixed(1)}/5 
                              ({tutor.tutorProfile.rating.count} reviews)
                            </div>
                          )}
                          <div className={styles.availability}>
                            <strong>Availability:</strong> {formatAvailability(tutor.tutorProfile?.availability)}
                          </div>
                        </div>
                        <div className={styles.selectButton}>
                          Select
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className={styles.pagination}>
                      <button 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || loading}
                      >
                        Previous
                      </button>
                      
                      <span className={styles.pageInfo}>
                        Page {currentPage} of {totalPages}
                      </span>
                      
                      <button 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || loading}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorSelectionModal;
