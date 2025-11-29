import React, { useState, useEffect, useRef } from 'react';
import { homeworkAPI } from '../../../utils/api';
import styles from './StudentsTable.module.css';

// Mapping for status badge classes
const getStatusBadgeClass = (status) => {
  return status?.toLowerCase() === 'active' ? styles.active : styles.inactive;
};

const StudentsTable = () => {
  // State management
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Refs to prevent duplicate API calls
  const abortControllerRef = useRef(null);
  const lastRequestRef = useRef(null);

  // Fetch enrolled students data
  const fetchEnrolledStudents = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
        sortBy,
        sortOrder
      };

      // Create query string to check for duplicates
      const queryString = JSON.stringify(params);
      
      // If this exact request was just made, skip it
      if (lastRequestRef.current === queryString) {
        setLoading(false);
        return;
      }
      
      lastRequestRef.current = queryString;

      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();

      const response = await homeworkAPI.getEnrolledStudents(params);
      setStudents(response.data.students);
      setTotalItems(response.data.total);
      setError(null);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Previous request was cancelled');
        return;
      }
      setError(err.message || 'Failed to fetch enrolled students');
      console.error('Error fetching enrolled students:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when dependencies change
  useEffect(() => {
    fetchEnrolledStudents();
  }, [currentPage, searchTerm, sortBy, sortOrder]);

  // Handle search input change
  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Handle sort change
  const handleSort = (column) => {
    if (sortBy === column) {
      // Toggle order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const getSortIcon = (column) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.mainTitle}>My Students</h2>
      <div className={styles.filtersRow}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by name, email, or parent"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <select 
          className={styles.searchInput}
          style={{ width: '120px' }}
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            setSortOrder('asc');
          }}
        >
          <option value="name">Sort by Name</option>
          <option value="class">Sort by Class</option>
          <option value="joinDate">Sort by Join Date</option>
        </select>
      </div>
      
      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loadingSpinner}>
            <i className="fas fa-spinner fa-spin"></i>
            Loading enrolled students...
          </div>
        ) : error ? (
          <div className={styles.error}>
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        ) : students.length > 0 ? (
          <>
            <table className={styles.compactTable}>
              <thead>
                <tr>
                  <th onClick={() => handleSort('className')}>
                    Class {getSortIcon('className')}
                  </th>
                  <th onClick={() => handleSort('studentName')}>
                    Student Name {getSortIcon('studentName')}
                  </th>
                  <th onClick={() => handleSort('email')}>
                    Email {getSortIcon('email')}
                  </th>
                  <th onClick={() => handleSort('parentName')}>
                    Parent {getSortIcon('parentName')}
                  </th>
                  <th onClick={() => handleSort('joinDate')}>
                    Joined {getSortIcon('joinDate')}
                  </th>
                  <th onClick={() => handleSort('status')}>
                    Status {getSortIcon('status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.class_name}</td>
                    <td>
                      <div className={styles.studentInfo}>
                        <div className={styles.avatar}>
                          {student.avatar_url ? (
                            <img 
                              src={student.avatar_url} 
                              alt={student.student_name}
                            />
                          ) : (
                            <span>{student.student_name?.charAt(0)?.toUpperCase() || '?'}</span>
                          )}
                        </div>
                        <div className={styles.nameWrapper}>
                          <span className={styles.name}>{student.student_name}</span>
                          <span className={styles.email}>{student.student_email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{student.student_email}</td>
                    <td>{student.parent_name}</td>
                    <td>{new Date(student.join_date).toLocaleDateString()}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${getStatusBadgeClass(student.status)}`}>
                        {student.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className={styles.pagination}>
              <button 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={styles.pageButton}
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              <span className={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={styles.pageButton}
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          </>
        ) : (
          <div className={styles.noResults}>
            <div className={styles.noResultsIcon}>🔍</div>
            <h3>No Enrolled Students Found</h3>
            <p>No students are currently enrolled in your classes.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentsTable;