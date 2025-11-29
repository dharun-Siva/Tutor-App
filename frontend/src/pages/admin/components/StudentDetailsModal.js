import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { convertUTCToTimeZone } from '../../../utils/dateUtils';
import styles from './StudentDetailsModal.module.css';

const StudentDetailsModal = ({ isOpen, onClose, student }) => {
  const [linkedParent, setLinkedParent] = useState(null);
  const [loadingParent, setLoadingParent] = useState(false);

  // Fetch linked parent information when modal opens
  useEffect(() => {
    if (isOpen && student) {
      fetchLinkedParent();
    } else {
      setLinkedParent(null);
    }
  }, [isOpen, student]);

  const fetchLinkedParent = async () => {
    if (!student?._id) return;
    
    setLoadingParent(true);
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/users?role=parent', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const parents = data.data || [];
        
        // Find parent that has this student as a child
        const parent = parents.find(p => 
          p.assignments?.children?.includes(student._id)
        );
        
        setLinkedParent(parent || null);
      } else {
        console.error('Failed to fetch parents:', response.status);
        setLinkedParent(null);
      }
    } catch (error) {
      console.error('Error fetching linked parent:', error);
      setLinkedParent(null);
    } finally {
      setLoadingParent(false);
    }
  };
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    return new Date(dateString).toLocaleDateString();
  };

  // Profile data accessor
  const profile = student?.student_profile || {};
  
  // Debug log to verify profile data
  console.log('Student Profile Data:', {
    dateOfBirth: profile.dateOfBirth,
    parentContact: profile.parentContact,
    subjects: profile.subjects,
    preferences: profile.preferences,
    phone_number: profile.phone_number,
    hourlyRate: profile.hourlyRate,
    currency: profile.preferences?.currency
  });

  const formatArray = (arr) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return 'None specified';
    return arr.join(', ');
  };

  const getStatusBadge = (student) => {
    if (!student.is_active) {
      return <span className={`${styles.badge} ${styles.badgeInactive}`}>Inactive</span>;
    }
    return <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>;
  };

  const renderAvailability = () => {
    console.log('🔍 StudentDetailsModal - Student availability data:', student.availability);
    
    if (!student.availability) {
      return <p className={styles.noData}>No availability information provided</p>;
    }

    const availability = student.availability;
    const days = Object.keys(availability);
    const studentTimeZone = 'UTC';

    console.log('🔍 StudentDetailsModal - Availability days:', days);

    return (
      <div className={styles.availabilityGrid}>
        {days.map(day => (
          <div key={day} className={styles.dayAvailability}>
            <div className={styles.dayName}>
              {day.charAt(0).toUpperCase() + day.slice(1)}
            </div>
            <div className={styles.dayStatus}>
              {availability[day].available ? (
                <div>
                  <span className={`${styles.badge} ${styles.badgeActive}`}>Available</span>
                  <div className={styles.timeSlots}>
                    {availability[day].timeSlotsZones && availability[day].timeSlotsZones.length > 0 ? (
                      availability[day].timeSlotsZones.map((slot, index) => (
                        <span key={index} className={styles.timeSlot}>{`${slot.startTimeUTC} - ${slot.endTimeUTC} UTC`}</span>
                      ))
                    ) : (
                      <span className={styles.noData}>No UTC time slots</span>
                    )}
                  </div>
                </div>
              ) : (
                <span className={styles.badge}>Not available</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen || !student) return null;

  return createPortal(
    <div 
      className={styles.modalOverlay}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.studentInfo}>
            <h2>{student.firstName} {student.lastName}</h2>
            <div className={styles.studentMeta}>
              <span className={styles.username}>@{student.username}</span>
              {getStatusBadge(student)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
          >
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Personal Information */}
          <div className={styles.section}>
            <h3>Personal Information</h3>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <label>Email</label>
                <span>{student.email}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Phone Number</label>
                <span>{student.phone_number || 'Not provided'}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Date of Birth</label>
                <span>{profile.dateOfBirth ? formatDate(profile.dateOfBirth) : 'Not provided'}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Enrollment Date</label>
                <span>{student.enrollment_date ? formatDate(student.enrollment_date) : 'Not provided'}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Student ID</label>
                <span>{student.id}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Registered On</label>
                <span>{formatDate(student.created_at)}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Hourly Rate</label>
                <span>{profile.hourlyRate ? `${profile.hourlyRate} ${profile.preferences?.currency || 'USD'}/hour` : 'Not set'}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Verification Status</label>
                <span className={`${styles.badge} ${student.studentProfile?.verificationStatus === 'pending' ? styles.badgePending : styles.badgeActive}`}>
                  {student.studentProfile?.verificationStatus || 'Not verified'}
                </span>
              </div>
            </div>

            {(student.address || student.studentProfile?.address) && (
              <>
                <h4>Address</h4>
                <div className={styles.addressInfo}>
                  {(student.address?.street || student.studentProfile?.address?.street) && (
                    <div>{student.address?.street || student.studentProfile?.address?.street}</div>
                  )}
                  <div>
                    {[
                      student.address?.city || student.studentProfile?.address?.city,
                      student.address?.state || student.studentProfile?.address?.state,
                      student.address?.zipCode || student.studentProfile?.address?.zipCode
                    ].filter(Boolean).join(', ')}
                  </div>
                  {(student.address?.country || student.studentProfile?.address?.country) && (
                    <div>{student.address?.country || student.studentProfile?.address?.country}</div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Academic Information */}
          <div className={styles.section}>
            <h3>Academic Information</h3>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <label>Grade Level</label>
                <span>{profile.grade || 'Not specified'}</span>
              </div>
              <div className={styles.detailItem}>
                <label>School</label>
                <span>{profile.school || 'Not specified'}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Learning Style</label>
                <span>{profile.preferences?.learningStyle || 'Not specified'}</span>
              </div>
            </div>

            <h4>Subject Information</h4>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <label>Current Subjects</label>
                <span>{formatArray(profile.subjects)}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Preferred Subjects</label>
                <span>{formatArray(profile.preferences?.preferredSubjects)}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Areas Needing Improvement</label>
                <span>{formatArray(profile.preferences?.strugglingSubjects)}</span>
              </div>
            </div>

            <h4>Academic Progress</h4>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <label>Current Performance Level</label>
                <span>{student.performanceLevel || student.studentProfile?.performanceLevel || student.studentProfile?.academicInfo?.performanceLevel || 'Not specified'}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Study Schedule</label>
                <span>{student.studySchedule || student.studentProfile?.studySchedule || student.studentProfile?.academicInfo?.studySchedule || 'Not specified'}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Preferred Learning Mode</label>
                <span>{student.preferredLearningMode || student.studentProfile?.preferredLearningMode || student.studentProfile?.academicInfo?.preferredLearningMode || 'Not specified'}</span>
              </div>
            </div>

            {(student.academicGoals || student.studentProfile?.academicGoals || student.studentProfile?.academicInfo?.goals) && (
              <div className={styles.detailItem}>
                <label>Academic Goals</label>
                <div className={styles.textContent}>
                  {student.academicGoals || student.studentProfile?.academicGoals || student.studentProfile?.academicInfo?.goals}
                </div>
              </div>
            )}

            {(student.academicNotes || student.studentProfile?.academicNotes || student.studentProfile?.academicInfo?.notes) && (
              <div className={styles.detailItem}>
                <label>Academic Notes</label>
                <div className={styles.textContent}>
                  {student.academicNotes || student.studentProfile?.academicNotes || student.studentProfile?.academicInfo?.notes}
                </div>
              </div>
            )}

            {(student.specialRequirements || student.studentProfile?.specialRequirements || student.studentProfile?.academicInfo?.specialRequirements) && (
              <div className={styles.detailItem}>
                <label>Special Learning Requirements</label>
                <div className={styles.textContent}>
                  {student.specialRequirements || student.studentProfile?.specialRequirements || student.studentProfile?.academicInfo?.specialRequirements}
                </div>
              </div>
            )}
            
            {student.studentProfile?.academicInfo?.achievements && student.studentProfile.academicInfo.achievements.length > 0 && (
              <div className={styles.detailItem}>
                <label>Recent Achievements</label>
                <div className={styles.achievementsList}>
                  {student.studentProfile.academicInfo.achievements.map((achievement, index) => (
                    <div key={index} className={styles.achievementItem}>
                      <span>{achievement.title}</span>
                      {achievement.date && (
                        <span className={styles.achievementDate}>{formatDate(achievement.date)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Parent/Guardian Contact */}
          <div className={styles.section}>
            <h3>Parent/Guardian Contact</h3>
            
            {/* Primary Parent/Guardian Information */}
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <label>Parent/Guardian Name</label>
                <span>{profile.parentContact?.name || 'Not provided'}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Parent Email</label>
                <span>{profile.parentContact?.email || 'Not provided'}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Parent Phone</label>
                <span>{profile.parentContact?.phone || 'Not provided'}</span>
              </div>
              {student.studentProfile?.parent_id && (
                <div className={styles.detailItem}>
                  <label>Parent Account ID</label>
                  <span>{student.studentProfile.parent_id}</span>
                </div>
              )}
            </div>

            {/* Emergency Contact Information */}
            {student.studentProfile?.medicalInfo?.emergencyInfo && (
              <>
                <h4>Emergency Contact</h4>
                <div className={styles.detailsGrid}>
                  <div className={styles.detailItem}>
                    <label>Emergency Contact Name</label>
                    <span>{student.studentProfile.medicalInfo.emergencyInfo}</span>
                  </div>
                  {student.studentProfile.medicalInfo.doctorContact && (
                    <div className={styles.detailItem}>
                      <label>Doctor Contact</label>
                      <span>{student.studentProfile.medicalInfo.doctorContact}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {student.studentProfile?.medicalInfo && Object.values(student.studentProfile.medicalInfo).some(v => v) && (
              <>
                <h4>Emergency Contact</h4>
                <div className={styles.detailsGrid}>
                  <div className={styles.detailItem}>
                    <label>Emergency Contact</label>
                    <span>{student.studentProfile.medicalInfo.emergencyInfo || 'Not provided'}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Doctor Contact</label>
                    <span>{student.studentProfile.medicalInfo.doctorContact || 'Not provided'}</span>
                  </div>
                </div>
              </>
            )}

            {/* Emergency Contact Information */}
            {(student.emergencyContact || student.studentProfile?.emergencyContact) && (
              <>
                <h4>Emergency Contact</h4>
                <div className={styles.detailsGrid}>
                  <div className={styles.detailItem}>
                    <label>Name</label>
                    <span>
                      {student.emergencyContact?.name || student.studentProfile?.emergencyContact?.name}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Relationship</label>
                    <span>
                      {student.emergencyContact?.relationship || student.studentProfile?.emergencyContact?.relationship}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Phone</label>
                    <span>
                      {student.emergencyContact?.phone || student.studentProfile?.emergencyContact?.phone}
                    </span>
                  </div>
                  {(student.emergencyContact?.altPhone || student.studentProfile?.emergencyContact?.altPhone) && (
                    <div className={styles.detailItem}>
                      <label>Alternative Phone</label>
                      <span>
                        {student.emergencyContact?.altPhone || student.studentProfile?.emergencyContact?.altPhone}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Medical Information */}
          {student.studentProfile?.medicalInfo && (
            <div className={styles.section}>
              <h3>Medical Information</h3>
              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <label>Allergies</label>
                  <div className={styles.textContent}>
                    {student.studentProfile.medicalInfo.allergies || 'None'}
                  </div>
                </div>

                <div className={styles.detailItem}>
                  <label>Medical Conditions</label>
                  <div className={styles.textContent}>
                    {student.studentProfile.medicalInfo.conditions || 'None'}
                  </div>
                </div>

                <div className={styles.detailItem}>
                  <label>Medications</label>
                  <div className={styles.textContent}>
                    {student.studentProfile.medicalInfo.medications || 'None'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Additional Information */}
          <div className={styles.section}>
            <h3>Additional Information</h3>
            <div className={styles.detailsGrid}>
              {student.studentProfile?.learningGoals && (
                <div className={styles.detailItem}>
                  <label>Learning Goals</label>
                  <div className={styles.textContent}>
                    {student.studentProfile.learningGoals}
                  </div>
                </div>
              )}
              
              {student.studentProfile?.additionalNotes && (
                <div className={styles.detailItem}>
                  <label>Additional Notes</label>
                  <div className={styles.textContent}>
                    {student.studentProfile.additionalNotes}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Availability */}
          <div className={styles.section}>
            <h3>Availability</h3>
            {renderAvailability()}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            onClick={onClose}
            className={`${styles.btn} ${styles.btnSecondary}`}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StudentDetailsModal;
