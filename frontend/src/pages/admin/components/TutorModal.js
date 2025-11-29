import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { tutorsAPI } from '../../../utils/api';
import { getErrorMessage, getStoredUser } from '../../../utils/helpers';
import { convertTimeZoneToUTC } from '../../../utils/dateUtils';
import styles from './TutorModal.module.css';

const SUBJECTS_OPTIONS = [
  'Mathematics', 'Science', 'English', 'History', 'Geography', 'Physics', 
  'Chemistry', 'Biology', 'Computer Science', 'Art', 'Music', 'Physical Education',
  'French', 'Spanish', 'German', 'Literature', 'Economics', 'Psychology'
];

const LANGUAGES_OPTIONS = [
  'English', 'Spanish', 'French', 'German', 'Chinese', 'Arabic', 'Hindi',
  'Portuguese', 'Russian', 'Japanese', 'Italian', 'Korean'
];

const TIME_SLOTS = [
  '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', 
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', 
  '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM'
];

const TIME_ZONES = [
  "UTC",
  "GMT",
  "EST",
  "EDT",
  "CST",
  "CDT",
  "MST",
  "MDT",
  "PST",
  "PDT",
  "IST",
  "BST",
  "CET",
  "CEST",
  "EET",
  "EEST",
  "JST",
  "AEST",
  "AEDT",
  "ACST",
  "ACDT",
  "AWST",
  "KST",
  "HKT",
  "SGT",
  "MSK"
];

const TutorModal = ({ isOpen, onClose, onSubmit, tutor }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [centerSubjects, setCenterSubjects] = useState([]);
  const [formData, setFormData] = useState({
    // Step 1: Personal Information
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '', // Add password field
    phoneNumber: '',
    dateOfBirth: '',
    isActive: true,  // Add isActive status
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US'
    },
    timeZone: '',
    
    // Step 2: Qualifications
    education: [{ degree: '', institution: '', year: '', field: '' }],
    experience: 0,
    certifications: [{ name: '', issuedBy: '', issuedDate: '', expiryDate: '', credentialId: '' }],
    cv: null,
    
    // Step 3: Subjects and Details
    subjects: [],
    bio: '',
    hourlyRate: 0,
    currency: 'USD',
    availability: {
      monday: { available: false, timeSlots: [] },
      tuesday: { available: false, timeSlots: [] },
      wednesday: { available: false, timeSlots: [] },
      thursday: { available: false, timeSlots: [] },
      friday: { available: false, timeSlots: [] },
      saturday: { available: false, timeSlots: [] },
      sunday: { available: false, timeSlots: [] }
    },
    languagesSpoken: [],
    specializations: []
  });

  const totalSteps = 3;

  const steps = [
    { number: 1, title: 'Personal Information' },
    { number: 2, title: 'Qualification' },
    { number: 3, title: 'Subjects & Details' }
  ];

  useEffect(() => {
    if (tutor) {
      // Populate form with existing tutor data
      setFormData({
        firstName: tutor.firstName || '',
        lastName: tutor.lastName || '',
        email: tutor.email || '',
        username: tutor.username || '',
        phoneNumber: tutor.phoneNumber || '',
        dateOfBirth: tutor.tutorProfile?.dateOfBirth ? 
          new Date(tutor.tutorProfile.dateOfBirth).toISOString().split('T')[0] : '',
        isActive: tutor.is_active !== undefined ? tutor.is_active : true,  // Populate isActive from tutor data
        address: {
          street: tutor.tutorProfile?.address?.street || '',
          city: tutor.tutorProfile?.address?.city || '',
          state: tutor.tutorProfile?.address?.state || '',
          zipCode: tutor.tutorProfile?.address?.zipCode || '',
          country: tutor.tutorProfile?.address?.country || 'US'
        },
        education: tutor.tutorProfile?.education?.length > 0 ? 
          tutor.tutorProfile.education : 
          [{ degree: '', institution: '', year: '', field: '' }],
        experience: tutor.tutorProfile?.experience || 0,
        certifications: tutor.tutorProfile?.certifications?.length > 0 ? 
          tutor.tutorProfile.certifications : 
          [{ name: '', issuedBy: '', issuedDate: '', expiryDate: '', credentialId: '' }],
        cv: null, // File can't be pre-populated
        subjects: tutor.tutorProfile?.subjects || [],
        bio: tutor.tutorProfile?.bio || '',
        hourlyRate: tutor.tutorProfile?.hourlyRate || 0,
        currency: tutor.tutorProfile?.currency || 'USD',
        availability: tutor.tutorProfile?.availability ? 
          // Convert old format to new format if needed
          Object.keys(tutor.tutorProfile.availability).reduce((acc, day) => {
            const dayData = tutor.tutorProfile.availability[day];
            const timeZone = tutor.tutorProfile?.timeZone || 'UTC';
            if (dayData && typeof dayData === 'object') {
              // Check if it's new format (has timeSlots) or old format (has start/end)
              if (dayData.timeSlots !== undefined) {
                // New format - use as is, but ensure available days have at least one slot
                let timeSlots = dayData.timeSlots || [];
                if (dayData.available && timeSlots.length === 0) {
                  timeSlots = [{ startTime: '', endTime: '' }];
                }
                acc[day] = {
                  available: dayData.available || false,
                  timeSlots: timeSlots
                };
              } else {
                // Old format - convert start/end to timeSlots
                let timeSlots = [];
                if (dayData.available && (dayData.start || dayData.end)) {
                  timeSlots = [{
                    startTime: dayData.start || '',
                    endTime: dayData.end || ''
                  }];
                } else if (dayData.available) {
                  timeSlots = [{ startTime: '', endTime: '' }];
                }
                const timeSlotsZones = timeSlots.map(slot => ({
                startTimeUTC: slot.startTime ? convertTimeZoneToUTC(slot.startTime, timeZone) : '',
                endTimeUTC: slot.endTime ? convertTimeZoneToUTC(slot.endTime, timeZone) : ''
              }));

              acc[day] = {
                available: dayData.available || false,
                timeSlots,
                timeSlotsZones
        };
              }
            } else {
              acc[day] = { available: false, timeSlots: [] };
            }
            return acc;
          }, {}) : {
          monday: { available: false, timeSlots: [] },
          tuesday: { available: false, timeSlots: [] },
          wednesday: { available: false, timeSlots: [] },
          thursday: { available: false, timeSlots: [] },
          friday: { available: false, timeSlots: [] },
          saturday: { available: false, timeSlots: [] },
          sunday: { available: false, timeSlots: [] }
        },
        languagesSpoken: tutor.tutorProfile?.languagesSpoken || [],
        specializations: tutor.tutorProfile?.specializations || [],
        timeZone: tutor.tutorProfile?.timeZone || 'UTC'
      });
    }
  }, [tutor]);

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

  // Fetch center subjects when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchCenterSubjects = async () => {
        try {
          const token = localStorage.getItem('token');
          console.log('🔍 Token exists:', !!token);
          
          if (!token) {
            console.error('❌ No token found');
            setCenterSubjects(SUBJECTS_OPTIONS);
            return;
          }

          console.log('📡 Fetching subjects from: http://localhost:5000/api/dashboard/admin/subjects?all=true');
          
          const response = await fetch('http://localhost:5000/api/dashboard/admin/subjects?all=true', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('📡 Response status:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('✅ Data received:', data);
            
            // API returns {subjects: Array}, not {data: Array}
            const subjectsArray = data.subjects || data.data || [];
            if (Array.isArray(subjectsArray) && subjectsArray.length > 0) {
              const subjectNames = subjectsArray.map(s => s.subjectName || s.name || s);
              console.log('✅ Subject names extracted:', subjectNames);
              setCenterSubjects(subjectNames);
            } else {
              console.warn('⚠️ No subjects in response, using defaults');
              setCenterSubjects(SUBJECTS_OPTIONS);
            }
          } else {
            console.error('❌ Response not OK, status:', response.status);
            const errorData = await response.text();
            console.error('Error data:', errorData);
            setCenterSubjects(SUBJECTS_OPTIONS);
          }
        } catch (error) {
          console.error('💥 Error fetching center subjects:', error);
          setCenterSubjects(SUBJECTS_OPTIONS);
        }
      };
      
      fetchCenterSubjects();
    }
  }, [isOpen]);

  const handleInputChange = (field, value, nestedField = null, index = null) => {
    setFormData(prev => {
      if (nestedField && index !== null) {
        // Handle array of objects (education, certifications)
        const newArray = [...prev[field]];
        newArray[index] = { ...newArray[index], [nestedField]: value };
        return { ...prev, [field]: newArray };
      } else if (nestedField) {
        // Handle nested objects (address, availability)
        return {
          ...prev,
          [field]: { ...prev[field], [nestedField]: value }
        };
      } else if (Array.isArray(prev[field])) {
        // Handle arrays (subjects, languages, specializations)
        return { ...prev, [field]: value };
      } else {
        // Handle simple fields
        return { ...prev, [field]: value };
      }
    });
  };

  const addEducationEntry = () => {
    setFormData(prev => ({
      ...prev,
      education: [...prev.education, { degree: '', institution: '', year: '', field: '' }]
    }));
  };

  const removeEducationEntry = (index) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index)
    }));
  };

  const addCertificationEntry = () => {
    setFormData(prev => ({
      ...prev,
      certifications: [...prev.certifications, { name: '', issuedBy: '', issuedDate: '', expiryDate: '', credentialId: '' }]
    }));
  };

  const removeCertificationEntry = (index) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index)
    }));
  };

  const handleAvailabilityChange = (day, field, value) => {
    setFormData(prev => {
      const updatedDay = {
        ...prev.availability[day],
        [field]: value
      };

      // If marking day as available and no time slots exist, add one empty slot
      if (field === 'available' && value && updatedDay.timeSlots.length === 0) {
        updatedDay.timeSlots = [{ startTime: '', endTime: '' }];
      }

      // If marking day as unavailable, clear time slots
      if (field === 'available' && !value) {
        updatedDay.timeSlots = [];
      }

      return {
        ...prev,
        availability: {
          ...prev.availability,
          [day]: updatedDay
        }
      };
    });
  };

  const handleTimeSlotToggle = (day, timeSlot) => {
    setFormData(prev => {
      const currentSlots = prev.availability[day].timeSlots || [];
      const updatedSlots = currentSlots.includes(timeSlot)
        ? currentSlots.filter(slot => slot !== timeSlot)
        : [...currentSlots, timeSlot];

      return {
        ...prev,
        availability: {
          ...prev.availability,
          [day]: {
            ...prev.availability[day],
            timeSlots: updatedSlots
          }
        }
      };
    });
  };

  // Add a new custom time slot
  const addTimeSlot = (day) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          timeSlots: [
            ...prev.availability[day].timeSlots,
            { startTime: '', endTime: '' }
          ]
        }
      }
    }));
  };

  // Remove a time slot
  const removeTimeSlot = (day, index) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          timeSlots: prev.availability[day].timeSlots.filter((_, i) => i !== index)
        }
      }
    }));
  };

  // Update a specific time slot
  const updateTimeSlot = (day, index, field, value) => {
    setFormData(prev => {
      const updatedSlots = [...prev.availability[day].timeSlots];
      updatedSlots[index] = {
        ...updatedSlots[index],
        [field]: value
      };

      return {
        ...prev,
        availability: {
          ...prev.availability,
          [day]: {
            ...prev.availability[day],
            timeSlots: updatedSlots
          }
        }
      };
    });
  };

  // Helper function to clean up form data before submission
  const cleanFormData = (data) => {
    const cleaned = { ...data };
    
    // Filter out empty education entries
    cleaned.education = data.education.filter(edu => 
      edu.degree && edu.institution && edu.year
    );
    
    // Filter out empty certification entries  
    cleaned.certifications = data.certifications.filter(cert => 
      cert.name && cert.name.trim() !== ''
    );
    
    return cleaned;
  };

  const handleSubjectToggle = (subject) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject]
    }));
  };

  const handleLanguageToggle = (language) => {
    setFormData(prev => ({
      ...prev,
      languagesSpoken: prev.languagesSpoken.includes(language)
        ? prev.languagesSpoken.filter(l => l !== language)
        : [...prev.languagesSpoken, language]
    }));
  };

  const validateStep = (step) => {
    console.log('Validating step:', step);
    console.log('Form data for validation:', formData);
    
    switch (step) {
      case 1:
        if (!formData.firstName || !formData.lastName || !formData.email || !formData.username) {
          console.log('Step 1 validation failed: missing required fields');
          setError('Please fill in all required personal information fields.');
          return false;
        }
        if (!formData.email.includes('@')) {
          console.log('Step 1 validation failed: invalid email');
          setError('Please enter a valid email address.');
          return false;
        }
        console.log('Step 1 validation passed');
        break;
      case 2:
        // CV is now optional for all tutors
        // Check if there are any education entries with partial data
        const hasIncompleteEducation = formData.education.some(edu => 
          (edu.degree && (!edu.institution || !edu.year)) ||
          (edu.institution && (!edu.degree || !edu.year)) ||
          (edu.year && (!edu.degree || !edu.institution))
        );
        if (hasIncompleteEducation) {
          console.log('Step 2 validation failed: incomplete education entries');
          setError('Please complete all education entries (degree, institution, and year are required) or remove incomplete ones.');
          return false;
        }
        console.log('Step 2 validation passed');
        break;
      case 3:
        if (formData.subjects.length === 0) {
          console.log('Step 3 validation failed: no subjects selected');
          setError('Please select at least one subject to teach.');
          return false;
        }
        console.log('Step 3 validation passed');
        break;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setError(null); // Clear error when moving to next step
      setCurrentStep(prev => Math.min(totalSteps, prev + 1));
    }
  };

  const handlePrev = () => {
  setCurrentStep(prev => Math.max(1, prev - 1));
  setError(null); // Clear error when moving to previous step
  };

  const handleSubmit = async () => {
    console.log('Submit button clicked');
    console.log('Current step:', currentStep);
    console.log('Form data:', formData);
    setError(null); // Clear lingering error before validation
    const isValid = validateStep(currentStep);
    console.log('Validation result:', isValid);
    if (!isValid) {
      console.log('Validation failed, stopping submission');
      return;
    }
    console.log('Starting API submission...');
    try {
      setLoading(true);
      setError(null);
      const submitData = new FormData();
      const safeFormData = {
        ...formData,
        subjects: Array.isArray(formData.subjects) ? formData.subjects : [],
        specializations: Array.isArray(formData.specializations) ? formData.specializations : [],
        education: Array.isArray(formData.education) ? formData.education.filter(edu => edu.degree && edu.institution && edu.year) : [],
        certifications: Array.isArray(formData.certifications) ? formData.certifications.filter(cert => cert.name && cert.name.trim() !== '') : [],
        languagesSpoken: Array.isArray(formData.languagesSpoken) ? formData.languagesSpoken : [],
        address: formData.address || {},
        availability: formData.availability || {},
        timeZone: formData.timeZone || 'UTC',
      };
      console.log('Submitting with timeZone:', safeFormData.timeZone);

      Object.keys(safeFormData).forEach(key => {
        if (key === 'cv') {
          if (safeFormData.cv) {
            submitData.append('cv', safeFormData.cv);
          }
        } else if (key === 'address' || key === 'education' || key === 'certifications' || key === 'languagesSpoken' || key === 'specializations' || key === 'subjects') {
          submitData.append(key, JSON.stringify(safeFormData[key]));
        } else if (key === 'availability') {
          // Ensure timeSlotsZones is populated with UTC times
          const prepareAvailabilityForSave = (availability, timeZone) => {
            const result = {};
            Object.entries(availability).forEach(([day, data]) => {
              result[day] = {
                ...data,
                timeSlotsZones: (data.timeSlots || []).map(slot => ({
                  startTimeUTC: convertTimeZoneToUTC(slot.startTime, timeZone),
                  endTimeUTC: convertTimeZoneToUTC(slot.endTime, timeZone),
                  // Also keep local time for reference
                  startTimeLocal: slot.startTime,
                  endTimeLocal: slot.endTime
                }))
              };
            });
            return result;
          };
          const availabilityToSave = prepareAvailabilityForSave(safeFormData.availability, safeFormData.timeZone);
          submitData.append('availability', JSON.stringify(availabilityToSave));
        } else {
          submitData.append(key, safeFormData[key]);
        }
      });

      // Inject center_id for admin-created tutors (always after all other fields)
      const user = getStoredUser && getStoredUser();
      let centerIdToSend = null;
      if (user && user.role === 'admin') {
        if (user.center_id) {
          centerIdToSend = user.center_id;
          console.log('DEBUG: Appending center_id to FormData:', centerIdToSend);
        } else if (Array.isArray(user.assignedCenters) && user.assignedCenters.length > 0) {
          centerIdToSend = user.assignedCenters[0].id;
          console.log('DEBUG: Appending center_id to FormData (from assignedCenters):', centerIdToSend);
        }
        // Only set error if truly no center assignment
        if (!centerIdToSend) {
          setError('Admin is not assigned to any center.');
          console.warn('No center_id or assignedCenters found in stored user:', user);
          setLoading(false);
          return;
        }
      }
      if (centerIdToSend) {
        submitData.append('center_id', centerIdToSend);
      }

      // Debug: Log all FormData entries
      console.log('=== FRONTEND DEBUG: FormData being sent ===');
      for (let pair of submitData.entries()) {
        console.log('FormData field:', pair[0], '=', pair[1]);
      }
      console.log('=== END FormData Debug ===');

      console.log('Making API call...');
      if (tutor) {
        // Update existing tutor
        console.log('Updating tutor with ID:', tutor._id);
        const result = await tutorsAPI.updateTutor(tutor._id, submitData);
        console.log('Update result:', result);
      } else {
        // Create new tutor
        console.log('Creating new tutor');
        const result = await tutorsAPI.createTutor(submitData);
        console.log('Create result:', result);
      }
      console.log('API call successful, calling onSubmit callback');
      onSubmit();
    } catch (err) {
      console.error('Submit tutor error:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            {renderPersonalInfoStep()}
            <div className={styles.timeZoneDisplay}>
              <strong>Selected Time Zone:</strong> {formData.timeZone}
            </div>
          </>
        );
      case 2:
        return renderQualificationsStep();
      case 3:
        return (
          <>
            {renderSubjectsStep()}
            <div className={styles.timeZoneDisplay}>
              <strong>Selected Time Zone:</strong> {formData.timeZone}
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const renderPersonalInfoStep = () => (
    <div className={styles.stepContent}>
      <h4>📝 Personal Information</h4>
      <div className="row">
        <div className="col-md-6">
          <div className="form-group">
            <label htmlFor="firstName">First Name *</label>
            <input
              type="text"
              id="firstName"
              className="form-control"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e?.target?.value)}
              required
            />
          </div>
        </div>
        <div className="col-md-6">
          <div className="form-group">
            <label htmlFor="lastName">Last Name *</label>
            <input
              type="text"
              id="lastName"
              className="form-control"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e?.target?.value)}
              required
            />
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              className="form-control"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e?.target?.value)}
              required
            />
          </div>
        </div>
        <div className="col-md-6">
          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              type="text"
              id="username"
              className="form-control"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e?.target?.value)}
              required
            />
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <div className="form-group">
            <label htmlFor="password">
              Password *
              <small className="text-muted ml-2">
                {tutor ? '(Leave blank to keep current password)' : '(Leave blank for auto-generated password)'}
              </small>
            </label>
            <input
              type="password"
              id="password"
              className="form-control"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e?.target?.value)}
              placeholder={tutor ? "Enter new password..." : "Leave blank for auto-generated"}
            />
            <small className="form-text text-muted">
              Must contain uppercase, lowercase, number, and special character (@$!%*?&)
            </small>
          </div>
        </div>
        <div className="col-md-6">
          <div className="form-group">
            <label htmlFor="phoneNumber">Phone Number</label>
            <input
              type="tel"
              id="phoneNumber"
              className="form-control"
              value={formData.phoneNumber}
              onChange={(e) => handleInputChange('phoneNumber', e?.target?.value)}
            />
          </div>
        </div>
        <div className="col-md-6">
          <div className="form-group">
            <label htmlFor="dateOfBirth">Date of Birth</label>
            <input
              type="date"
              id="dateOfBirth"
              className="form-control"
              value={formData.dateOfBirth}
              onChange={(e) => handleInputChange('dateOfBirth', e?.target?.value)}
            />
          </div>
        </div>
      </div>

      <h5>Address</h5>
      <div className="form-group">
        <label htmlFor="street">Street Address</label>
        <input
          type="text"
          id="street"
          className="form-control"
          value={formData.address.street}
          onChange={(e) => handleInputChange('address', e?.target?.value, 'street')}
        />
      </div>

      <div className="row">
        <div className="col-md-6">
          <div className="form-group">
            <label htmlFor="city">City</label>
            <input
              type="text"
              id="city"
              className="form-control"
              value={formData.address.city}
              onChange={(e) => handleInputChange('address', e?.target?.value, 'city')}
            />
          </div>
        </div>
        <div className="col-md-3">
          <div className="form-group">
            <label htmlFor="state">State</label>
            <input
              type="text"
              id="state"
              className="form-control"
              value={formData.address.state}
              onChange={(e) => handleInputChange('address', e?.target?.value, 'state')}
            />
          </div>
        </div>
        <div className="col-md-3">
          <div className="form-group">
            <label htmlFor="zipCode">ZIP Code</label>
            <input
              type="text"
              id="zipCode"
              className="form-control"
              value={formData.address.zipCode}
              onChange={(e) => handleInputChange('address', e?.target?.value, 'zipCode')}
            />
          </div>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label>Time Zone *</label>
        <select
          className="form-control"
          name="timeZone"
          value={formData.timeZone}
          onChange={e => setFormData({ ...formData, timeZone: e?.target?.value })}
          required
        >
          {TIME_ZONES.map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      {tutor && (
        <div className={styles.formGroup}>
          <label>
            <input
              type="checkbox"
              checked={formData.isActive !== false}
              onChange={(e) => handleInputChange('isActive', e?.target?.checked)}
            />
            {' '}Active Status
          </label>
        </div>
      )}
    </div>
  );

  const renderQualificationsStep = () => (
    <div className={styles.stepContent}>
      <h4>🎓 Qualifications & CV</h4>
      
      <div className="form-group">
        <label>CV Upload</label>
        <input
          type="file"
          className="form-control-file"
          accept=".pdf,.doc,.docx"
          onChange={(e) => handleInputChange('cv', e?.target?.files?.[0])}
        />
        <small className="form-text text-muted">
          Upload your CV in PDF, DOC, or DOCX format (max 5MB)
        </small>
        {tutor && tutor.tutorProfile?.cvOriginalName && (
          <div className="mt-2">
            <small className="text-info">
              Current CV: {tutor.tutorProfile.cvOriginalName}
            </small>
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="experience">Years of Experience</label>
        <input
          type="number"
          id="experience"
          className="form-control"
          min="0"
          value={formData.experience}
          onChange={(e) => handleInputChange('experience', parseInt(e?.target?.value) || 0)}
        />
      </div>

      <h5>Education</h5>
      {formData.education.map((edu, index) => (
        <div key={index} className={styles.educationEntry}>
          <div className="row">
            <div className="col-md-6">
              <div className="form-group">
                <label>Degree *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., Bachelor of Science"
                  value={edu.degree}
                  onChange={(e) => handleInputChange('education', e?.target?.value, 'degree', index)}
                  required
                />
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-group">
                <label>Institution *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., Harvard University"
                  value={edu.institution}
                  onChange={(e) => handleInputChange('education', e?.target?.value, 'institution', index)}
                  required
                />
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-md-4">
              <div className="form-group">
                <label>Year</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="2020"
                  value={edu.year}
                  onChange={(e) => handleInputChange('education', parseInt(e?.target?.value) || '', 'year', index)}
                />
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-group">
                <label>Field of Study</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., Mathematics"
                  value={edu.field}
                  onChange={(e) => handleInputChange('education', e?.target?.value, 'field', index)}
                />
              </div>
            </div>
            <div className="col-md-2">
              {formData.education.length > 1 && (
                <div className="form-group">
                  <label>&nbsp;</label>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm d-block"
                    onClick={() => removeEducationEntry(index)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary btn-sm mb-3"
        onClick={addEducationEntry}
      >
        + Add Education
      </button>

      <h5>Certifications</h5>
      {formData.certifications.map((cert, index) => (
        <div key={index} className={styles.certificationEntry}>
          <div className="row">
            <div className="col-md-6">
              <div className="form-group">
                <label>Certification Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., Teaching English as Foreign Language"
                  value={cert.name}
                  onChange={(e) => handleInputChange('certifications', e?.target?.value, 'name', index)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <div className="form-group">
                <label>Issued By</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., TESOL International"
                  value={cert.issuedBy}
                  onChange={(e) => handleInputChange('certifications', e?.target?.value, 'issuedBy', index)}
                />
              </div>
            </div>
            <div className="col-md-2">
              {formData.certifications.length > 1 && (
                <div className="form-group">
                  <label>&nbsp;</label>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm d-block"
                    onClick={() => removeCertificationEntry(index)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="row">
            <div className="col-md-4">
              <div className="form-group">
                <label>Issue Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={cert.issuedDate}
                  onChange={(e) => handleInputChange('certifications', e?.target?.value, 'issuedDate', index)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <div className="form-group">
                <label>Expiry Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={cert.expiryDate}
                  onChange={(e) => handleInputChange('certifications', e?.target?.value, 'expiryDate', index)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <div className="form-group">
                <label>Credential ID</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Certificate ID"
                  value={cert.credentialId}
                  onChange={(e) => handleInputChange('certifications', e?.target?.value, 'credentialId', index)}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={addCertificationEntry}
      >
        + Add Certification
      </button>
    </div>
  );

  const renderSubjectsStep = () => (
    <div className={styles.stepContent}>
      <h4>📚 Subjects & Details</h4>
      
      <div className="form-group">
        <label>Subjects to Teach * (select multiple)</label>
        <div className={styles.subjectGrid}>
          {(centerSubjects.length > 0 ? centerSubjects : SUBJECTS_OPTIONS).map((subject) => (
            <label key={subject} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.subjects.includes(subject)}
                onChange={() => handleSubjectToggle(subject)}
              />
              {subject}
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Languages Spoken (select multiple)</label>
        <div className={styles.subjectGrid}>
          {LANGUAGES_OPTIONS.map((language) => (
            <label key={language} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.languagesSpoken.includes(language)}
                onChange={() => handleLanguageToggle(language)}
              />
              {language}
            </label>
          ))}
        </div>
      </div>

      {/* Hourly Rate and Currency */}
      <div className="row">
        <div className="col-md-8">
          <div className="form-group">
            <label htmlFor="hourlyRate">Hourly Rate</label>
            <input
              type="number"
              id="hourlyRate"
              className="form-control"
              min="0"
              step="0.01"
              value={formData.hourlyRate}
              onChange={(e) => handleInputChange('hourlyRate', parseFloat(e?.target?.value) || 0)}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="col-md-4">
          <div className="form-group">
            <label htmlFor="currency">Currency</label>
            <select
              id="currency"
              className="form-control"
              value={formData.currency || 'USD'}
              onChange={(e) => handleInputChange('currency', e?.target?.value)}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="INR">INR (₹)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="SGD">SGD (S$)</option>
              <option value="HKD">HKD (HK$)</option>
              <option value="JPY">JPY (¥)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          className="form-control"
          rows="4"
          maxLength="1000"
          placeholder="Tell us about yourself, your teaching style, and what makes you a great tutor..."
          value={formData.bio}
          onChange={(e) => handleInputChange('bio', e?.target?.value)}
        />
        <small className="form-text text-muted">
          {formData.bio.length}/1000 characters
        </small>
      </div>

      <h5>Availability</h5>
      <p className="text-muted small mb-3">
        Select the days and times when the tutor is available for tutoring sessions.
      </p>
      <div className={styles.availabilityGrid}>
        {Object.keys(formData.availability).map((day) => (
          <div key={day} className={styles.dayAvailability}>
            <div className={styles.dayHeader}>
              <label className={styles.dayLabel}>
                <input
                  type="checkbox"
                  checked={formData.availability[day].available}
                  onChange={(e) => handleAvailabilityChange(day, 'available', e?.target?.checked)}
                />
                <span className={styles.dayName}>
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </span>
              </label>
            </div>
            
            {formData.availability[day].available && (
              <div className={styles.timeSlots}>
                {formData.availability[day].timeSlots.map((slot, index) => (
                  <div key={index} className={styles.timeSlot}>
                    <div className={styles.timeInputs}>
                      <div className={styles.timeInput}>
                        <label>Start Time</label>
                        <input
                          type="time"
                          value={slot.startTime || ''}
                          onChange={(e) => updateTimeSlot(day, index, 'startTime', e?.target?.value)}
                        />
                      </div>
                      <span className={styles.timeSeparator}>to</span>
                      <div className={styles.timeInput}>
                        <label>End Time</label>
                        <input
                          type="time"
                          value={slot.endTime || ''}
                          onChange={(e) => updateTimeSlot(day, index, 'endTime', e?.target?.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className={`btn btn-sm btn-danger ${styles.removeSlotBtn}`}
                        onClick={() => removeTimeSlot(day, index)}
                        title="Remove time slot"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className={`btn btn-sm btn-secondary ${styles.addSlotBtn}`}
                  onClick={() => addTimeSlot(day)}
                >
                  + Add Time Slot
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div className={styles.tutorModal} onClick={(e) => e?.target === e?.currentTarget && onClose()}>
      <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <div className={styles.headerContent}>
              <h5 className={styles.modalTitle}>
                {tutor ? 'Edit Tutor' : 'Add New Tutor'}
              </h5>
              {/* Progress bar in header */}
              <div className={styles.progressBar}>
                {steps.map((step) => (
                  <div
                    key={step.number}
                    className={`${styles.progressStep} ${step.number <= currentStep ? styles.active : ''}`}
                  >
                    <div className={styles.stepNumber}>
                      {step.number}
                    </div>
                    <span className={styles.stepTitle}>{step.title}</span>
                  </div>
                ))}
              </div>
            </div>
            <button type="button" className={styles.closeButton} onClick={onClose}>
              <span>&times;</span>
            </button>
          </div>
          <div className={styles.modalBody}>
            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}
            {renderStepContent()}
            {/* Navigation buttons */}
            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-secondary" onClick={handlePrev} disabled={currentStep === 1}>
                Previous
              </button>
              {currentStep < totalSteps ? (
                <button type="button" className="btn btn-primary" onClick={handleNext}>
                  Next
                </button>
              ) : (
                <button type="button" className="btn btn-success" onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Saving...' : tutor ? 'Save Changes' : 'Save Tutor'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    modalRoot
  );
};

export default TutorModal;
