import React, { useState, useEffect, useRef } from 'react';
import { tutorsAPI } from '../../../utils/api';
import { getErrorMessage } from '../../../utils/helpers';
import TutorModal from './TutorModal';
import TutorDetailsModal from './TutorDetailsModal';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import styles from './TutorManagement.module.css';

const TutorManagement = ({ onRefresh }) => {
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTutors, setSelectedTutors] = useState([]);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const tutorsPerPage = 5;
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('');
  
  // Modal states
  const [showTutorModal, setShowTutorModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingTutor, setEditingTutor] = useState(null);
  const [selectedTutorForDetails, setSelectedTutorForDetails] = useState(null);

  // Prevent duplicate API calls in StrictMode
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      setCurrentPage(1);
      loadTutors();
    }
  }, [sortBy, sortOrder, statusFilter, subjectFilter, searchTerm]);

  const loadTutors = async () => {
    try {
      setLoading(true);
      const params = {
        sortBy,
        sortOrder,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
  // subjectFilter removed
      };
      const response = await tutorsAPI.getTutors(params);
      setTutors(response.data.data.tutors);
      setError(null);
    } catch (err) {
      console.error('Load tutors error:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
  // removed setCurrentPage(1) for no pagination
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  // removed setCurrentPage(1) for no pagination
  };

  const handleSelectTutor = (tutorId) => {
    setSelectedTutors(prev =>
      prev.includes(tutorId)
        ? prev.filter(id => id !== tutorId)
        : [...prev, tutorId]
    );
  };

  const handleSelectAll = () => {
    setSelectedTutors(prev => 
      prev.length === tutors.length 
        ? []
        : tutors.map(tutor => tutor._id)
    );
  };

  const handleAddTutor = () => {
    setEditingTutor(null);
    setShowTutorModal(true);
  };

  const handleEditTutor = (tutor) => {
    setEditingTutor(tutor);
    setShowTutorModal(true);
  };

  const handleViewTutor = (tutor) => {
    setSelectedTutorForDetails(tutor);
    setShowDetailsModal(true);
  };

  const handleDeleteTutor = async (tutorId) => {
    if (!window.confirm('Are you sure you want to delete this tutor?')) {
      return;
    }

    try {
      console.log('🗑️ Deleting tutor:', tutorId);
      const response = await tutorsAPI.deleteTutor(tutorId);
      console.log('✅ Delete response:', response);
      await loadTutors();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('❌ Delete error:', err);
      alert(getErrorMessage(err));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTutors.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedTutors.length} tutors?`)) {
      return;
    }

    try {
      await tutorsAPI.bulkDeleteTutors(selectedTutors);
      setSelectedTutors([]);
      await loadTutors();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleTutorStatusChange = async (tutorId, newStatus) => {
    try {
      await tutorsAPI.updateTutorStatus(tutorId, newStatus);
      await loadTutors();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleModalSubmit = async () => {
    setShowTutorModal(false);
    await loadTutors();
    if (onRefresh) onRefresh();
  };

  const getStatusBadgeClass = (tutor) => {
    if (!tutor.isActive) return 'badge-danger';
    if (tutor.accountStatus === 'pending') return 'badge-warning';
    if (tutor.accountStatus === 'active') return 'badge-success';
    return 'badge-secondary';
  };

  const getStatusText = (tutor) => {
    if (!tutor.isActive) return 'Inactive';
    return tutor.accountStatus.charAt(0).toUpperCase() + tutor.accountStatus.slice(1);
  };

  const handleDownloadCV = async (tutorId, tutorName) => {
    try {
      const response = await tutorsAPI.downloadCV(tutorId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${tutorName}_CV.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download CV: ' + getErrorMessage(err));
    }
  };

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className="alert alert-danger">
          <h4>Error Loading Tutors</h4>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={loadTutors}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Client-side filtering logic
  const filteredTutors = tutors.filter((tutor) => {
    // Name/email search
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      tutor.fullName?.toLowerCase().includes(searchLower) ||
      tutor.email?.toLowerCase().includes(searchLower) ||
      tutor.data?.tutorProfile?.subjects?.some((subject) => subject.toLowerCase().includes(searchLower));

    // Status filter
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && tutor.accountStatus === 'active' && tutor.isActive) ||
      (statusFilter === 'inactive' && !tutor.isActive) ||
      (statusFilter === 'pending' && tutor.accountStatus === 'pending');

    // Subject filter
    const subjectLower = subjectFilter.toLowerCase();
    const matchesSubject =
      !subjectFilter ||
      tutor.data?.tutorProfile?.subjects?.some((subject) => subject.toLowerCase().includes(subjectLower));

    return matchesSearch && matchesStatus && matchesSubject;
  });

  // Pagination logic
  const indexOfLastTutor = currentPage * tutorsPerPage;
  const indexOfFirstTutor = indexOfLastTutor - tutorsPerPage;
  const currentTutors = filteredTutors.slice(indexOfFirstTutor, indexOfLastTutor);
  const totalPages = Math.ceil(filteredTutors.length / tutorsPerPage);

  return (
    <div className={styles.tutorManagement}>
      {/* Header */}
      <div className={styles.header}>
        <h2>👨‍🏫 Tutor Management</h2>
        <div className={styles.headerActions}>
          <span className={styles.resultsCount}>
            {tutors.length} tutors found
          </span>
          <button 
            className="btn btn-primary"
            onClick={handleAddTutor}
          >
            <i className="fas fa-plus mr-2"></i>
            Add Tutor
          </button>
          
          {selectedTutors.length > 0 && (
            <button 
              className="btn btn-danger ml-2"
              onClick={handleBulkDelete}
            >
              🗑️ Delete Selected ({selectedTutors.length})
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search tutors by name, email, or subject..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.filterGroup}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <LoadingSpinner />
        ) : tutors.length === 0 ? (
          <div className="text-center py-5">
            <i className="fas fa-chalkboard-teacher fa-3x text-muted mb-3"></i>
            <p className="text-muted">
              {searchTerm || statusFilter !== 'all' || subjectFilter
                ? "No tutors match your search criteria."
                : "Start by adding your first tutor to the system."
              }
            </p>
          </div>
        ) : (
          <>
            <table className={styles.tutorTable}>
              <thead>
                <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={selectedTutors.length === tutors.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th 
                      onClick={() => handleSort('firstName')}
                      className={styles.sortableHeader}
                    >
                      Name {sortBy === 'firstName' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('email')}
                      className={styles.sortableHeader}
                    >
                      Email {sortBy === 'email' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Subjects</th>
                    <th>Experience</th>
                    <th>Status</th>
                    <th 
                      onClick={() => handleSort('createdAt')}
                      className={styles.sortableHeader}
                    >
                      Joined {sortBy === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTutors.map((tutor) => (
                    <tr key={tutor._id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedTutors.includes(tutor._id)}
                          onChange={() => handleSelectTutor(tutor._id)}
                        />
                      </td>
                      <td>
                        <div className={styles.tutorName}>
                          <span className={styles.name}>
                            {`${tutor.first_name || ''} ${tutor.last_name || ''}`.trim()}
                          </span>
                          <span className={styles.username}>@{tutor.username}</span>
                        </div>
                      </td>
                      <td>{tutor.email}</td>
                      <td>
                        <div className={styles.subjectsCell}>
                          {tutor.tutorProfile?.subjects?.slice(0, 2).map((subject, index) => (
                            <span key={index} className={styles.subjectBadge}>
                              {subject}
                            </span>
                          ))}
                          {tutor.tutorProfile?.subjects?.length > 2 && (
                            <span className={styles.moreBadge}>
                              +{tutor.tutorProfile.subjects.length - 2} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{tutor.tutorProfile?.experience || 0} years</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[getStatusBadgeClass(tutor)]}`}>
                          {getStatusText(tutor)}
                        </span>
                      </td>
                      <td>
                        {new Date(tutor.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button
                            onClick={() => handleViewTutor(tutor)}
                            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                            title="View Details"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleEditTutor(tutor)}
                            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                            title="Edit Tutor"
                          >
                            Edit
                          </button>
                          {tutor.tutorProfile?.cvPath && (
                            <button
                              onClick={() => handleDownloadCV(tutor._id, tutor.fullName)}
                              className={`${styles.btn} ${styles.btnSuccess} ${styles.btnSmall}`}
                              title="Download CV"
                            >
                              CV
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteTutor(tutor._id)}
                            className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                            title="Delete Tutor"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
            </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination} style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={styles.paginationBtn}
                >
                  Previous
                </button>
              </div>
              <div className={styles.paginationInfo} style={{ flex: 1, textAlign: 'center' }}>
                Page {currentPage} of {totalPages} ({filteredTutors.length} tutors)
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={styles.paginationBtn}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>

      {/* Modals */}
      {showTutorModal && (
        <TutorModal
          isOpen={showTutorModal}
          onClose={() => setShowTutorModal(false)}
          onSubmit={handleModalSubmit}
          tutor={editingTutor}
        />
      )}

      {showDetailsModal && selectedTutorForDetails && (
        <TutorDetailsModal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          tutor={selectedTutorForDetails}
          onStatusChange={handleTutorStatusChange}
        />
      )}
    </div>
  );
};

export default TutorManagement;
