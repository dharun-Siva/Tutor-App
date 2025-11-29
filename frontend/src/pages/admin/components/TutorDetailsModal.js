import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { convertUTCToTimeZone } from '../../../utils/dateUtils';
import styles from './TutorDetailsModal.module.css';

const TutorDetailsModal = ({ isOpen, onClose, tutor, onStatusChange }) => {
  // Handle escape key press
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !tutor) return null;

  const handleStatusChange = (newStatus) => {
    onStatusChange(tutor._id, newStatus);
    onClose();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadgeClass = () => {
    if (!tutor.isActive) return 'badge-danger';
    if (tutor.accountStatus === 'pending') return 'badge-warning';
    if (tutor.accountStatus === 'active') return 'badge-success';
    return 'badge-secondary';
  };

  const getStatusText = () => {
    if (!tutor.isActive) return 'Inactive';
    return tutor.accountStatus.charAt(0).toUpperCase() + tutor.accountStatus.slice(1);
  };

  return createPortal(
    <div className={styles.detailsModal} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h5 className={styles.modalTitle}>
              👨‍🏫 Tutor Details - {tutor.firstName} {tutor.lastName}
            </h5>
            <button type="button" className={styles.closeButton} onClick={onClose}>
              <span>&times;</span>
            </button>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.tutorHeader}>
              <div className={styles.tutorBasicInfo}>
                <h3>{tutor.fullName}</h3>
                <p className="text-muted">@{tutor.username}</p>
                <p>{tutor.email}</p>
                <span className={`badge ${getStatusBadgeClass()}`}>
                  {getStatusText()}
                </span>
              </div>
            </div>

            <div className="row">
              {/* Personal Information */}
              <div className="col-md-6">
                <div className={styles.section}>
                  <h5>📝 Personal Information</h5>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <strong>Phone:</strong>
                      <span>{tutor.phoneNumber || 'Not provided'}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Date of Birth:</strong>
                      <span>{formatDate(tutor.tutorProfile?.dateOfBirth)}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Joined:</strong>
                      <span>{formatDate(tutor.createdAt)}</span>
                    </div>
                    {tutor.lastLogin && (
                      <div className={styles.infoItem}>
                        <strong>Last Login:</strong>
                        <span>{formatDate(tutor.lastLogin)}</span>
                      </div>
                    )}
                  </div>

                  {tutor.tutorProfile?.address && (
                    <div className={styles.addressSection}>
                      <strong>Address:</strong>
                      <p>
                        {tutor.tutorProfile.address.street && `${tutor.tutorProfile.address.street}, `}
                        {tutor.tutorProfile.address.city && `${tutor.tutorProfile.address.city}, `}
                        {tutor.tutorProfile.address.state && `${tutor.tutorProfile.address.state} `}
                        {tutor.tutorProfile.address.zipCode}
                        {tutor.tutorProfile.address.country && `, ${tutor.tutorProfile.address.country}`}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Professional Information */}
              <div className="col-md-6">
                <div className={styles.section}>
                  <h5>💼 Professional Details</h5>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <strong>Experience:</strong>
                      <span>{tutor.tutorProfile?.experience || 0} years</span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Hourly Rate:</strong>
                      <span>${tutor.tutorProfile?.hourlyRate || 0}/hour</span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Verification Status:</strong>
                      <span className={`badge ${
                        tutor.tutorProfile?.verificationStatus === 'verified' ? 'badge-success' :
                        tutor.tutorProfile?.verificationStatus === 'rejected' ? 'badge-danger' :
                        'badge-warning'
                      }`}>
                        {tutor.tutorProfile?.verificationStatus?.charAt(0).toUpperCase() + 
                         tutor.tutorProfile?.verificationStatus?.slice(1) || 'Pending'}
                      </span>
                    </div>
                    {tutor.tutorProfile?.rating?.count > 0 && (
                      <div className={styles.infoItem}>
                        <strong>Rating:</strong>
                        <span>
                          ⭐ {tutor.tutorProfile.rating.average.toFixed(1)} 
                          ({tutor.tutorProfile.rating.count} reviews)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Subjects */}
            {tutor.tutorProfile?.subjects?.length > 0 && (
              <div className={styles.section}>
                <h5>📚 Subjects</h5>
                <div className={styles.subjectsList}>
                  {tutor.tutorProfile.subjects.map((subject, index) => (
                    <span key={index} className="badge badge-info mr-2 mb-2">
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {tutor.tutorProfile?.languagesSpoken?.length > 0 && (
              <div className={styles.section}>
                <h5>🌍 Languages</h5>
                <div className={styles.languagesList}>
                  {tutor.tutorProfile.languagesSpoken.map((language, index) => (
                    <span key={index} className="badge badge-secondary mr-2 mb-2">
                      {language}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bio */}
            {tutor.tutorProfile?.bio && (
              <div className={styles.section}>
                <h5>📖 Bio</h5>
                <p className={styles.bioText}>{tutor.tutorProfile.bio}</p>
              </div>
            )}

            {/* Education */}
            {tutor.tutorProfile?.education?.length > 0 && (
              <div className={styles.section}>
                <h5>🎓 Education</h5>
                {tutor.tutorProfile.education.map((edu, index) => (
                  <div key={index} className={styles.educationItem}>
                    <div className={styles.educationHeader}>
                      <strong>{edu.degree}</strong>
                      {edu.year && <span className={styles.year}>{edu.year}</span>}
                    </div>
                    <div className={styles.educationDetails}>
                      <p>{edu.institution}</p>
                      {edu.field && <p className="text-muted">Field: {edu.field}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Certifications */}
            {tutor.tutorProfile?.certifications?.length > 0 && (
              <div className={styles.section}>
                <h5>🏆 Certifications</h5>
                {tutor.tutorProfile.certifications.map((cert, index) => (
                  cert.name && (
                    <div key={index} className={styles.certificationItem}>
                      <div className={styles.certificationHeader}>
                        <strong>{cert.name}</strong>
                      </div>
                      <div className={styles.certificationDetails}>
                        {cert.issuedBy && <p>Issued by: {cert.issuedBy}</p>}
                        {cert.issuedDate && (
                          <p>Issue Date: {formatDate(cert.issuedDate)}</p>
                        )}
                        {cert.expiryDate && (
                          <p>Expires: {formatDate(cert.expiryDate)}</p>
                        )}
                        {cert.credentialId && (
                          <p className="text-muted">ID: {cert.credentialId}</p>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}

            {/* Availability */}
            {tutor.tutorProfile?.availability && (
              <div className={styles.section}>
                <h5>📅 Availability</h5>
                <div className={styles.availabilityGrid}>
                  {Object.entries(tutor.tutorProfile.availability).map(([day, schedule]) => (
                    <div key={day} className={styles.daySchedule}>
                      <strong>{day.charAt(0).toUpperCase() + day.slice(1)}</strong>
                      {schedule.available ? (
                        <div className="text-success">
                          {schedule.timeSlotsZones && schedule.timeSlotsZones.length > 0 ? (
                            <div className={styles.timeSlots}>
                              {schedule.timeSlotsZones.map((slot, index) => (
                                <div key={index} className={styles.timeSlot}>
                                  {`${slot.startTimeUTC} - ${slot.endTimeUTC} UTC`}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className={styles.noData}>No UTC time slots</span>
                          )}
                        </div>
                      ) : (
                        <span className={styles.noData}>Not available</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CV Information */}
            {tutor.tutorProfile?.cvOriginalName && (
              <div className={styles.section}>
                <h5>📄 CV</h5>
                <p>
                  <strong>File:</strong> {tutor.tutorProfile.cvOriginalName}
                </p>
                <button 
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => {
                    // This would trigger the CV download
                    window.open(`/api/tutors/${tutor._id}/cv`, '_blank');
                  }}
                >
                  📥 Download CV
                </button>
              </div>
            )}

            {/* Class Assignments */}
            {tutor.assignments?.classes?.length > 0 && (
              <div className={styles.section}>
                <h5>📝 Assigned Classes</h5>
                <div className={styles.classesList}>
                  {tutor.assignments.classes.map((classItem, index) => (
                    <div key={index} className={styles.classItem}>
                      <strong>{classItem.name || `Class ${index + 1}`}</strong>
                      {classItem.subject && <p>Subject: {classItem.subject}</p>}
                      {classItem.level && <p>Level: {classItem.level}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <div className={styles.statusActions}>
              {tutor.isActive && tutor.accountStatus !== 'active' && (
                <button
                  className="btn btn-success"
                  onClick={() => handleStatusChange({ isActive: true, accountStatus: 'active' })}
                >
                  ✅ Approve
                </button>
              )}
              
              {tutor.isActive && (
                <button
                  className="btn btn-warning"
                  onClick={() => handleStatusChange({ isActive: false })}
                >
                  ⏸️ Deactivate
                </button>
              )}
              
              {!tutor.isActive && (
                <button
                  className="btn btn-success"
                  onClick={() => handleStatusChange({ isActive: true })}
                >
                  ▶️ Reactivate
                </button>
              )}
              
              {tutor.accountStatus !== 'rejected' && (
                <button
                  className="btn btn-danger"
                  onClick={() => handleStatusChange({ accountStatus: 'rejected', isActive: false })}
                >
                  ❌ Reject
                </button>
              )}
            </div>
            
            <div className={styles.modalFooter}>
              <div className={styles.modalActions}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TutorDetailsModal;
