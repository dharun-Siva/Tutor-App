import React, { useState, useEffect, useRef } from 'react';
import styles from './StudentManagement.module.css';
import StudentModalRefactored from './StudentModalRefactored';
import StudentDetailsModal from './StudentDetailsModal';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import { convertUTCToTimeZone } from '../../../utils/dateUtils';
import { studentsAPI } from '../../../utils/api';

const StudentManagement = () => {
  const [students, setStudents] = useState([]);
  const isInitialized = useRef(false);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 5;

  // Pagination
  const indexOfLastStudent = currentPage * studentsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
  
  // Helper function to normalize grade format (10, 10th, 5th, 5 => comparable format)
  const normalizeGrade = (gradeStr) => {
    if (!gradeStr || typeof gradeStr !== 'string') return '';
    // Remove ordinal suffixes (th, st, nd, rd) and convert to number
    const normalized = gradeStr.trim().toLowerCase().replace(/(?:st|nd|rd|th)$/i, '').trim();
    return normalized;
  };
  
  // Filter students
  const filteredStudents = students.filter(student => {
    const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
    const matchesSearch = fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.school?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && student.is_active) ||
                         (filterStatus === 'inactive' && !student.is_active);
    
    // Support both numeric (10) and ordinal (10th) grade formats
    const matchesGrade = filterGrade === 'all' || 
                        normalizeGrade(student.grade) === normalizeGrade(filterGrade);
    
    return matchesSearch && matchesStatus && matchesGrade;
  });

  const currentStudents = filteredStudents.slice(indexOfFirstStudent, indexOfLastStudent);
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const response = await studentsAPI.getStudents();
      setStudents(response.data.data.students || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      alert('Failed to fetch students: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      fetchStudents();
    }
  }, []);

  const handleAddStudent = () => {
    setSelectedStudent(null);
    setIsModalOpen(true);
  };

  const handleEditStudent = (student) => {
    // Format the student data to match the expected structure
    console.log('Formatting student data:', student);
    const formattedStudent = {
      id: student.id,
      firstName: student.first_name,
      lastName: student.last_name,
      email: student.email,
      username: student.username,
      phoneNumber: student.phone_number,
      // Personal Information
      dateOfBirth: student.student_profile?.dateOfBirth,
      // Academic Information
      grade: student.grade || student.student_profile?.grade,
      school: student.school || student.student_profile?.school,
      subjects: student.student_profile?.subjects || 
               student.student_profile?.preferences?.preferredSubjects || [],
      // Address
      address: student.student_profile?.address || {},
      // Billing Information
      hourlyRate: student.student_profile?.hourlyRate || 0,
      currency: student.student_profile?.preferences?.currency || 'USD',
      // Student Profile
      studentProfile: {
        address: student.student_profile?.address || {},
        grade: student.grade || student.student_profile?.grade,
        school: student.school || student.student_profile?.school,
        subjects: student.student_profile?.subjects || 
                 student.student_profile?.preferences?.preferredSubjects || [],
        hourlyRate: student.student_profile?.hourlyRate || 0,
        dateOfBirth: student.student_profile?.dateOfBirth,
        preferences: {
          currency: student.student_profile?.preferences?.currency || 'USD',
          learningStyle: student.student_profile?.preferences?.learningStyle || ''
        },
        academicInfo: {
          goals: student.student_profile?.learningGoals || '',
          notes: student.student_profile?.additionalNotes || '',
          subjects: student.student_profile?.subjects || 
                   student.student_profile?.preferences?.preferredSubjects || [],
          learningStyle: student.student_profile?.preferences?.learningStyle || ''
        }
      }
    };
    console.log('Formatted student data:', formattedStudent);
    setSelectedStudent(formattedStudent);
    setIsModalOpen(true);
  };

  const handleViewDetails = (student) => {
    setSelectedStudent(student);
    setIsDetailsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedStudent(null);
  };

  const handleDetailsModalClose = () => {
    setIsDetailsModalOpen(false);
    setSelectedStudent(null);
  };

  const handleStudentSave = async (studentData) => {
    try {
      const isEditing = selectedStudent && selectedStudent.id;
      
      if (isEditing) {
        await studentsAPI.updateStudent(selectedStudent.id, studentData);
      } else {
        await studentsAPI.createStudent(studentData);
      }

      await fetchStudents();
      handleModalClose();
      alert(isEditing ? 'Student updated successfully!' : 'Student created successfully!');
    } catch (error) {
      console.error('Error saving student:', error);
      
      // Handle validation errors
      if (error.response?.data?.validationErrors) {
        const errorMessages = Object.entries(error.response.data.validationErrors)
          .map(([field, message]) => `${field}: ${message}`)
          .join('\n');
        throw new Error(`Validation failed:\n${errorMessages}`);
      }
      
      throw error; // Re-throw so the modal can handle it
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
      return;
    }

    try {
      await studentsAPI.deleteStudent(studentId);
      await fetchStudents(); // Refresh the list
      alert('Student deleted successfully');
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('Failed to delete student: ' + error.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStudents.length === 0) {
      alert('Please select students to delete');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedStudents.length} selected students? This action cannot be undone.`)) {
      return;
    }

    try {
      await studentsAPI.bulkDeleteStudents(selectedStudents);
      setSelectedStudents([]);
      await fetchStudents();
      alert('Students deleted successfully');
    } catch (error) {
      console.error('Error deleting students:', error);
      alert('Failed to delete students: ' + error.message);
    }
  };

  const handleSelectStudent = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === currentStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(currentStudents.map(student => student._id));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    return new Date(dateString).toLocaleDateString();
  };

  const formatAvailability = (availability, timeZone = 'UTC') => {
    if (!availability) return 'Not set';
    const availableDays = Object.entries(availability)
      .filter(([day, data]) => data.available && data.timeSlots && data.timeSlots.length > 0)
      .map(([day, data]) => {
        const timeSlots = data.timeSlots.map(slot => {
          const start = convertUTCToTimeZone(slot.startTime, timeZone);
          const end = convertUTCToTimeZone(slot.endTime, timeZone);
          return `${start}-${end}`;
        }).join(', ');
        return `${day.charAt(0).toUpperCase() + day.slice(1)}: ${timeSlots}`;
      });
    return availableDays.length > 0 ? availableDays.join('; ') : 'No availability set';
  };

  const getStatusBadge = (student) => {
    if (!student.is_active) {
      return <span className={`${styles.badge} ${styles.badgeInactive}`}>Inactive</span>;
    }
    return <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>;
  };

  const getGrades = () => {
    const grades = [...new Set(students
      .map(student => student.grade)
      .filter(grade => grade)
    )];
    return grades.sort();
  };

  return (
    <div className={styles.studentManagement}>
      <div className={styles.header}>
        <h2>Student Management</h2>
        <div className={styles.headerActions}>
          {selectedStudents.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className={`${styles.btn} ${styles.btnDanger}`}
            >
              Delete Selected ({selectedStudents.length})
            </button>
          )}
          <button
            onClick={handleAddStudent}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            Add Student
          </button>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterGroup}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>

          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Grades</option>
            {getGrades().map(grade => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <table className={styles.studentTable}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedStudents.length === currentStudents.length && currentStudents.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>School</th>
                  <th>Grade</th>
                  <th>Availability</th>
                  <th>Status</th>
                  <th>Enrollment Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentStudents.length > 0 ? (
                  currentStudents.map((student) => (
                    <tr key={student._id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student._id)}
                          onChange={() => handleSelectStudent(student._id)}
                        />
                      </td>
                      <td>
                        <div className={styles.studentName}>
                          <span className={styles.name}>
                            {`${student.first_name || ''} ${student.last_name || ''}`.trim()}
                          </span>
                          <span className={styles.username}>@{student.username}</span>
                        </div>
                      </td>
                      <td>{student.email}</td>
                      <td>{student.school || 'Not provided'}</td>
                      <td>{student.grade || 'Not set'}</td>
                      <td>
                        <div className={styles.availabilityCell}>
                          {typeof student.availability === 'object' ? 
                            Object.entries(student.availability)
                              .filter(([day, settings]) => settings?.available)
                              .map(([day]) => day.charAt(0).toUpperCase() + day.slice(1))
                              .join(', ') || 'Not set'
                            : 'Not set'
                          }
                        </div>
                      </td>
                      <td>{getStatusBadge(student)}</td>
                      <td>{formatDate(student.enrollment_date)}</td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button
                            onClick={() => handleViewDetails(student)}
                            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                            title="View Details"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleEditStudent(student)}
                            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                            title="Edit Student"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student.id)}
                            className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                            title="Delete Student"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className={styles.noData}>
                      {searchTerm || filterStatus !== 'all' || filterGrade !== 'all'
                        ? 'No students found matching your criteria'
                        : 'No students available'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={styles.paginationBtn}
                >
                  Previous
                </button>
                
                <span className={styles.paginationInfo}>
                  Page {currentPage} of {totalPages} ({filteredStudents.length} students)
                </span>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={styles.paginationBtn}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Student Modal */}
      {isModalOpen && (
        <StudentModalRefactored
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSave={handleStudentSave}
          student={selectedStudent}
        />
      )}

      {/* Student Details Modal */}
      {isDetailsModalOpen && selectedStudent && (
        <StudentDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={handleDetailsModalClose}
          student={selectedStudent}
        />
      )}
    </div>
  );
};

export default StudentManagement;
