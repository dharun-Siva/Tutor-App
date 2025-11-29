import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Registration.css';
import { checkTutorTimeConflicts } from '../utils/scheduleValidation';

const Registration = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [centerLogo, setCenterLogo] = useState(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [form, setForm] = useState({ 
    firstName: '', 
    lastName: '', 
    email: '', 
    password: '', 
    confirmPassword: '',
    role: 'parent', // Only parent role
    phoneNumber: '',
    students: [
      {
        studentFirstName: '',
        studentLastName: '',
        studentPhoneNumber: '',
        studentDateOfBirth: '',
        grade: '',
        subjects: [],
        languages: []
      }
    ],
    // Step 3: Tutor selection and scheduling
    selectedTutor: null,
    classDate: '',
    classTime: '',
    classDuration: '60', // Default 60 minutes
    classSubject: ''
  });
  
  // Step 3 state
  const [tutors, setTutors] = useState([]);
  const [loadingTutors, setLoadingTutors] = useState(false);
  const [selectedTutorAvailability, setSelectedTutorAvailability] = useState(null);
  const [tutorExistingClasses, setTutorExistingClasses] = useState({}); // { [tutorId]: [classObj, ...] }
  const [selectedStudentIndex, setSelectedStudentIndex] = useState(0);
  const [availableTutorsForDate, setAvailableTutorsForDate] = useState([]);
  const [scheduledSubjects, setScheduledSubjects] = useState({}); // { studentIndex: { subject: {tutor, date, time, duration} } }
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [skippedSchedules, setSkippedSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Calendar state for inline right-side picker
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [centerSubjects, setCenterSubjects] = useState([]);

  // Fetch center logo and subjects if center ID is in query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const centerId = params.get('center');
    
    if (centerId) {
      fetchCenterLogo(centerId);
      fetchCenterSubjects();
    }
  }, []);

  const fetchCenterLogo = async (centerId) => {
    try {
      setLogoLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/centers/${centerId}/logo`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.logoUrl) {
          setCenterLogo(data.data.logoUrl);
        }
      }
    } catch (error) {
      console.error('Error fetching center logo:', error);
    } finally {
      setLogoLoading(false);
    }
  };

  const fetchCenterSubjects = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const centerId = params.get('center');
      
      if (!centerId) {
        console.log('No center ID in URL, using default subjects');
        return;
      }
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/centers/${centerId}/subjects`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const subjectsArray = data.subjects || data.data || [];
        if (Array.isArray(subjectsArray) && subjectsArray.length > 0) {
          const subjectNames = subjectsArray.map(s => s.subjectName || s.name || '');
          setCenterSubjects(subjectNames.filter(name => name)); // Filter out empty names
          console.log('Center subjects loaded:', subjectNames);
        } else {
          console.log('No subjects in response, using defaults');
        }
      } else {
        console.error('Failed to fetch subjects, status:', response.status);
      }
    } catch (error) {
      console.error('Error fetching center subjects:', error);
    }
  };

  const handleScheduleSubject = () => {
    const subject = form.classSubject;
    if (!subject || !form.selectedTutor || !form.classDate || !form.classTime || !form.classDuration) {
      setError('Please fill all scheduling fields and select a tutor.');
      return;
    }
    setScheduledSubjects(prev => {
      const studentKey = selectedStudentIndex;
      const studentSchedule = prev[studentKey] ? { ...prev[studentKey] } : {};
      studentSchedule[subject] = {
        tutor: form.selectedTutor,
        date: form.classDate,
        time: form.classTime,
        duration: form.classDuration
      };
      return { ...prev, [studentKey]: studentSchedule };
    });
    // Reset scheduling fields for next subject
    setForm(prev => ({
      ...prev,
      selectedTutor: null,
      classDate: '',
      classTime: '',
      classDuration: '60',
      classSubject: ''
    }));
    setError('');
    setSuccess('Class scheduled for subject!');
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  // Map a date string (YYYY-MM-DD) to weekday key used in tutor availability
  const getDayKey = (dateString) => {
    try {
      const d = new Date(dateString + 'T00:00:00');
      const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      return days[d.getDay()];
    } catch (err) {
      return null;
    }
  };

  const updateAvailableTutorsForDate = (dateString, subject = '') => {
    if (!dateString) {
      setAvailableTutorsForDate([]);
      return;
    }
    const dayKey = getDayKey(dateString);
    if (!dayKey) {
      setAvailableTutorsForDate([]);
      return;
    }
    const filtered = tutors.filter(t => {
      const avail = t.tutor_profile?.availability?.[dayKey];
      if (!avail || !avail.available) return false;
      if (subject) {
        const tutorSubjects = t.tutor_profile?.subjects || [];
        return tutorSubjects.includes(subject);
      }
      return true;
    });
    setAvailableTutorsForDate(filtered);
  };

  const handleStudentChange = (index, e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const students = [...prev.students];
      students[index][name] = value;
      return { ...prev, students };
    });
    if (error) setError('');
    if (success) setSuccess('');
  };

  // Calendar helpers
  const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const monthEnd = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
  // Return a YYYY-MM-DD string for the local date (avoid toISOString/UTC conversion)
  const formatISODate = (d) => {
    if (!d) return '';
    try {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) {
      return '';
    }
  };
  const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

  const handlePickDateFromCalendar = (dateObj) => {
    const iso = formatISODate(dateObj);
    // set selected date and update tutors for selected subject
    setForm(prev => ({ ...prev, classDate: iso }));
    // update tutors available for this date and subject
    updateAvailableTutorsForDate(iso, form.classSubject || '');
    // Load classes for selected tutor if any
    if (form.selectedTutor) {
      loadTutorClasses(form.selectedTutor.id, iso).catch(() => {});
    }
  };

  const handleStudentSubjectChange = (index, subject, isChecked) => {
    setForm(prev => {
      const students = [...prev.students];
      const current = students[index].subjects || [];
      if (isChecked) {
        // only add if not already present
        if (!current.includes(subject)) {
          students[index].subjects = [...current, subject];
        } else {
          students[index].subjects = current;
        }
      } else {
        students[index].subjects = current.filter(s => s !== subject);
      }
      return { ...prev, students };
    });
  };

  const handleStudentLanguageChange = (index, language, isChecked) => {
    setForm(prev => {
      const students = [...prev.students];
      const current = students[index].languages || [];
      if (isChecked) {
        if (!current.includes(language)) {
          students[index].languages = [...current, language];
        } else {
          students[index].languages = current;
        }
      } else {
        students[index].languages = current.filter(l => l !== language);
      }
      return { ...prev, students };
    });
  };

  const handleAddStudent = () => {
    setForm(prev => ({
      ...prev,
      students: [
        ...prev.students,
        {
          studentFirstName: '',
          studentLastName: '',
          studentPhoneNumber: '',
          studentDateOfBirth: '',
          grade: '',
          subjects: [],
          languages: []
        }
      ]
    }));
  };

  // Remove a student by index. If only one student exists, do nothing (keep at least one).
  const handleRemoveStudent = (index) => {
    setForm(prev => {
      if (prev.students.length === 1) return prev;
      const students = prev.students.filter((_, i) => i !== index);
      return { ...prev, students };
    });
    if (error) setError('');
    if (success) setSuccess('');
  };

  const validateForm = () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password || !form.confirmPassword) {
    }
    
    if (form.password !== form.confirmPassword) {
      return 'Passwords do not match';
    }
    
    if (form.password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      return 'Please enter a valid email address';
    }
    
    return null;
  };

  const validateStep2 = () => {
    for (let i = 0; i < form.students.length; i++) {
      const s = form.students[i];
      if (!s.studentFirstName || !s.studentLastName || !s.grade) {
        return `Student ${i + 1}: first name, last name, and grade are required`;
      }
      if (s.subjects.length === 0) {
        return `Student ${i + 1}: Please select at least one subject of interest`;
      }
      if (s.languages.length === 0) {
        return `Student ${i + 1}: Please select at least one language`;
      }
    }
    return null;
  };

  const validateStep3 = () => {
    // Require all subjects for selected student to be scheduled
    const subjects = Array.from(new Set(form.students[selectedStudentIndex]?.subjects || []));
    const studentSchedule = scheduledSubjects[selectedStudentIndex] || {};
    const scheduledCount = Object.keys(studentSchedule).length;
    if (scheduledCount < subjects.length) {
      return `Please schedule a class for all ${subjects.length} subjects for this student.`;
    }
    return null;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    // Only parent role is allowed
    if (currentStep === 1) {
      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }
      // Move to next step
      setCurrentStep(2);
      return;
    } else if (currentStep === 2) {
      // Validate step 2 fields
      const validationError = validateStep2();
      if (validationError) {
        setError(validationError);
        return;
      }
      // Load tutors and move to step 3
      await loadTutors();
      // Default selected student in Step 3 to the first student that has subjects selected
      const firstWithSubjects = (form.students || []).findIndex(s => Array.isArray(s.subjects) && s.subjects.length > 0);
      setSelectedStudentIndex(firstWithSubjects === -1 ? 0 : firstWithSubjects);
      setCurrentStep(3);
      return;
    } else if (currentStep === 3) {
      // Validate step 3 fields
      const validationError = validateStep3();
      if (validationError) {
        setError(validationError);
        return;
      }
      // Proceed with registration
    }
    setLoading(true);
    try {
      // API call to register user
      const registrationData = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        role: 'parent'
      };
      // Generate a username for backend (required). Prefer email local-part, fallback to first+last name.
      const makeUsername = () => {
        if (form.email && form.email.includes('@')) {
          return form.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '_');
        }
        const fn = (form.firstName || '').trim().toLowerCase().replace(/\s+/g, '_');
        const ln = (form.lastName || '').trim().toLowerCase().replace(/\s+/g, '_');
        const base = `${fn}${fn && ln ? '_' : ''}${ln}` || `user_${Date.now()}`;
        return base.replace(/[^a-z0-9._-]/g, '_');
      };
      registrationData.username = makeUsername();
      // Add additional fields for parent registration
      registrationData.phoneNumber = form.phoneNumber;
      // Student information: send all students as an array so backend can create 1..N students
      const mapStudentForBackend = (s) => ({
        firstName: s.studentFirstName || s.firstName || '',
        lastName: s.studentLastName || s.lastName || '',
        email: null,
        phoneNumber: s.studentPhoneNumber || s.phoneNumber || null,
        dateOfBirth: s.studentDateOfBirth || s.dateOfBirth || null,
        grade: s.grade || '',
        subjects: s.subjects || [],
        languages: s.languages || [],
        school: s.school || null,
        learningStyle: s.learningStyle || null,
        username: s.username || null
      });
      registrationData.students = (form.students || []).map(mapStudentForBackend);
      // Class scheduling information: include all scheduled subjects per student as an array
      // scheduledSubjects state shape: { [studentIndex]: { [subject]: { tutor, date, time, duration } } }
      const classSchedules = [];
      for (const [studentIdxStr, subjectsMap] of Object.entries(scheduledSubjects || {})) {
        const studentIdx = parseInt(studentIdxStr, 10);
        const student = form.students[studentIdx] || {};
        for (const [subject, info] of Object.entries(subjectsMap || {})) {
          classSchedules.push({
            studentIndex: studentIdx,
            studentName: `${student.studentFirstName || ''} ${student.studentLastName || ''}`.trim(),
            subject,
            tutorId: info.tutor?.id,
            tutorEmail: info.tutor?.email,
            date: info.date,
            time: info.time,
            duration: parseInt(info.duration) || 60
          });
        }
      }
      // If no scheduledSubjects but old single selection exists, include it for backward compatibility
      if (classSchedules.length === 0 && currentStep === 3 && form.selectedTutor && form.classSubject) {
        const selectedStudent = form.students[selectedStudentIndex] || {};
        classSchedules.push({
          studentIndex: selectedStudentIndex,
          studentName: `${selectedStudent.studentFirstName || ''} ${selectedStudent.studentLastName || ''}`.trim(),
          subject: form.classSubject,
          tutorId: form.selectedTutor.id,
          tutorEmail: form.selectedTutor.email,
          date: form.classDate,
          time: form.classTime,
          duration: parseInt(form.classDuration)
        });
      }
      if (classSchedules.length > 0) registrationData.classSchedules = classSchedules;
  // If the registration page was opened with a center query param, include it in the API POST
  const params = new URLSearchParams(window.location.search);
  const centerFromLocation = params.get('center');
  const postUrl = centerFromLocation ? `/api/auth/register?center=${encodeURIComponent(centerFromLocation)}` : '/api/auth/register';
  const res = await axios.post(postUrl, registrationData);
      const data = res.data || {};
      // If backend reported skipped schedules, surface them and do not reset/navigate away so user can reschedule
      if (Array.isArray(data.skippedSchedules) && data.skippedSchedules.length > 0) {
        setSkippedSchedules(data.skippedSchedules || []);
        setError('Registration completed but some requested schedules were skipped. See details below.');
        // Keep form state so user can reschedule skipped items; do not clear form or step
      } else {
        setSuccess('Registration successful! Please check your email to verify your account.');
        setForm({ 
          firstName: '', 
          lastName: '', 
          email: '', 
          password: '', 
          confirmPassword: '',
          role: 'parent',
          phoneNumber: '',
          students: [
            {
              studentFirstName: '',
              studentLastName: '',
              studentPhoneNumber: '',
              studentDateOfBirth: '',
              grade: '',
              subjects: [],
              languages: []
            }
          ],
          selectedTutor: null,
          classDate: '',
          classTime: '',
          classDuration: '60',
          classSubject: ''
        });
        setCurrentStep(1);
      }
    } catch (err) {
      console.log('Registration error details:', err);
      setError(err.response?.data?.error || err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleSubjectChange = (subject, isChecked) => {
    setForm(prev => ({
      ...prev,
      subjects: isChecked 
        ? [...prev.subjects, subject]
        : prev.subjects.filter(s => s !== subject)
    }));
  };

  const handleLanguageChange = (language, isChecked) => {
    setForm(prev => ({
      ...prev,
      languages: isChecked 
        ? [...prev.languages, language]
        : prev.languages.filter(l => l !== language)
    }));
  };

  const handleBackToStep1 = () => {
    setCurrentStep(1);
    setError('');
  };

  const handleBackToStep2 = () => {
    setCurrentStep(2);
    setError('');
  };

  const loadTutors = async () => {
    setLoadingTutors(true);
    try {
      const response = await axios.get('/api/auth/tutors');
      setTutors(response.data.tutors || []);
    } catch (err) {
      console.error('Error loading tutors:', err);
      setError('Failed to load tutors. Please try again.');
    } finally {
      setLoadingTutors(false);
    }
  };

  const handleTutorSelect = (tutor) => {
    setForm(prev => ({ ...prev, selectedTutor: tutor }));
    setSelectedTutorAvailability(tutor.tutor_profile?.availability || null);
    setError('');
    // Load existing classes for this tutor on the currently selected date
    if (tutor && form.classDate) {
      loadTutorClasses(tutor.id, form.classDate).catch(err => console.error('Failed to load tutor classes', err));
    }
  };

  const loadTutorClasses = async (tutorId, date) => {
    if (!tutorId || !date) return [];
    try {
      // Fetch classes for this tutor on the selected date
  // Use public registration helper endpoint to fetch classes for a tutor on a specific date
  const res = await axios.get(`/api/auth/tutors/${tutorId}/classes`, { params: { date } });
    const classes = res.data?.data?.classes || [];
    // Debug: log fetched classes for visibility while troubleshooting
    console.debug('LoadedTutorClasses', { tutorId, date, count: classes.length, classesSample: classes.slice(0,5) });
    setTutorExistingClasses(prev => ({ ...prev, [tutorId]: classes }));
    return classes;
    } catch (err) {
      console.error('Error loading tutor classes:', err?.response?.data || err.message || err);
      setTutorExistingClasses(prev => ({ ...prev, [tutorId]: [] }));
      return [];
    }
  };

  // Prefetch existing classes for available tutors when date or availableTutorsForDate changes
  React.useEffect(() => {
    if (!form.classDate || !Array.isArray(availableTutorsForDate) || availableTutorsForDate.length === 0) return;
    // For tutors where we haven't yet loaded classes for this date, fetch them in parallel
    const toLoad = availableTutorsForDate.filter(t => typeof tutorExistingClasses[t.id] === 'undefined');
    if (toLoad.length === 0) return;
    (async () => {
      try {
        await Promise.all(toLoad.map(t => loadTutorClasses(t.id, form.classDate)));
      } catch (e) {
        // ignore; loadTutorClasses handles errors and sets empty arrays
      }
    })();
  }, [form.classDate, availableTutorsForDate]);

  const tutorHasTimeSlot = (tutor, time, date) => {
    if (!tutor || !time || !date) return false;
    const dayKey = getDayKey(date);
    const slots = tutor.tutor_profile?.availability?.[dayKey]?.timeSlots || [];

    const parseTimeToMinutes = (t) => {
      if (!t) return null;
      const s = String(t).trim();
      // Support formats like '05:00', '5:00', '05:00 AM', '5:00 PM'
      const ampmMatch = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
      if (ampmMatch) {
        let h = parseInt(ampmMatch[1], 10);
        const m = parseInt(ampmMatch[2], 10);
        const ampm = ampmMatch[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      }
      const hmMatch = s.match(/^(\d{1,2}):(\d{2})$/);
      if (hmMatch) {
        const h = parseInt(hmMatch[1], 10);
        const m = parseInt(hmMatch[2], 10);
        return h * 60 + m;
      }
      return null;
    };

    const tMinutes = parseTimeToMinutes(time);
    if (tMinutes === null) return false;

    let availabilityMatch = false;
    for (const s of slots) {
      if (!s) continue;
      if (typeof s === 'string') {
        const slotMinutes = parseTimeToMinutes(s.slice(0,5));
        if (slotMinutes !== null && slotMinutes === tMinutes) {
          availabilityMatch = true;
          break;
        }
      } else if (s && typeof s === 'object') {
        // object may contain startTime/start/from and endTime/end/to or a single time field
        const startRaw = s.startTime || s.start || s.from || s.time || '';
        const endRaw = s.endTime || s.end || s.to || '';
        const startM = parseTimeToMinutes(String(startRaw).slice(0,8));
        const endM = parseTimeToMinutes(String(endRaw).slice(0,8));
        // if both start and end are available, check range
        if (startM !== null && endM !== null) {
          if (tMinutes >= startM && tMinutes < endM) {
            availabilityMatch = true;
            break;
          }
        } else if (startM !== null && endM === null) {
          // if only start is present, allow exact start match
          if (tMinutes === startM) {
            availabilityMatch = true;
            break;
          }
        } else if (s.time) {
          const slotMinutes = parseTimeToMinutes(String(s.time).slice(0,8));
          if (slotMinutes !== null && slotMinutes === tMinutes) {
            availabilityMatch = true;
            break;
          }
        }
      }
    }

    if (!availabilityMatch) return false;

    // Also ensure tutor does not already have a conflicting class at this date/time
    try {
      // Normalize existing classes similar to computeAvailableSlots so conflict checker sees expected fields
      const rawExisting = tutorExistingClasses[tutor.id] || [];
      const existing = (rawExisting || []).map(c => {
        let classDateNorm = c.classDate;
        try {
          if (c.classDate) {
            const d = new Date(c.classDate);
            if (!isNaN(d.getTime())) classDateNorm = formatISODate(d);
          }
        } catch (e) {
          classDateNorm = c.classDate;
        }
        return {
          ...c,
          _id: c.id || c._id,
          classDate: classDateNorm || c.classDate,
          scheduleType: c.scheduleType || 'one-time',
          tutor: { _id: (c.tutor && c.tutor._id) ? c.tutor._id : (tutor.id || (c.tutor && c.tutor.id)) }
        };
      });
      const newClass = {
        startTime: time,
        customDuration: parseInt(form.classDuration) || parseInt(form.classDuration) || 60,
        duration: parseInt(form.classDuration) || 60,
        classDate: date,
        scheduleType: 'one-time'
      };
  const conflictResult = checkTutorTimeConflicts(newClass, existing, tutor.id);
  // Debug: log conflictResult so we can see why a slot was allowed/blocked
  console.debug('ConflictCheck', { tutorId: tutor.id, start: time, date, conflictResult });
  if (conflictResult && conflictResult.hasConflict) return false;
    } catch (e) {
      // if conflict check fails, be conservative and allow scheduling (or we could block); log error
      console.error('Error checking tutor conflicts:', e);
    }

    return true;
  };

  // Check only availability (ignore existing class conflicts)
  const tutorAvailabilityOnly = (tutor, time, date) => {
    if (!tutor || !time || !date) return false;
    const dayKey = getDayKey(date);
    const slots = tutor.tutor_profile?.availability?.[dayKey]?.timeSlots || [];
    const parseTimeToMinutes = (t) => {
      if (!t) return null;
      const s = String(t).trim();
      const ampmMatch = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
      if (ampmMatch) {
        let h = parseInt(ampmMatch[1], 10);
        const m = parseInt(ampmMatch[2], 10);
        const ampm = ampmMatch[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      }
      const hmMatch = s.match(/^(\d{1,2}):(\d{2})$/);
      if (hmMatch) {
        const h = parseInt(hmMatch[1], 10);
        const m = parseInt(hmMatch[2], 10);
        return h * 60 + m;
      }
      return null;
    };
    const tMinutes = parseTimeToMinutes(time);
    if (tMinutes === null) return false;
    for (const s of slots) {
      if (!s) continue;
      if (typeof s === 'string') {
        const slotMinutes = parseTimeToMinutes(s.slice(0,5));
        if (slotMinutes !== null && slotMinutes === tMinutes) return true;
      } else if (s && typeof s === 'object') {
        const startRaw = s.startTime || s.start || s.from || s.time || '';
        const endRaw = s.endTime || s.end || s.to || '';
        const startM = parseTimeToMinutes(String(startRaw).slice(0,8));
        const endM = parseTimeToMinutes(String(endRaw).slice(0,8));
        if (startM !== null && endM !== null) {
          if (tMinutes >= startM && tMinutes < endM) return true;
        } else if (startM !== null && endM === null) {
          if (tMinutes === startM) return true;
        } else if (s.time) {
          const slotMinutes = parseTimeToMinutes(String(s.time).slice(0,8));
          if (slotMinutes !== null && slotMinutes === tMinutes) return true;
        }
      }
    }
    return false;
  };

  // Helpers to compute discrete available slots from a tutor's availability ranges
  const parseTimeToMinutes = (t) => {
    if (!t) return null;
    const s = String(t).trim();
    const ampmMatch = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const m = parseInt(ampmMatch[2], 10);
      const ampm = ampmMatch[3].toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    }
    const hmMatch = s.match(/^(\d{1,2}):(\d{2})$/);
    if (hmMatch) {
      const h = parseInt(hmMatch[1], 10);
      const m = parseInt(hmMatch[2], 10);
      return h * 60 + m;
    }
    return null;
  };

  const minutesToTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // Given a tutor, date and desired duration (minutes), produce an array of available ranges
  // gapMinutes defines the break between consecutive classes (default 15m)
  // Returns array of { start: 'HH:MM', end: 'HH:MM', label: 'HH:MM - HH:MM' }
  const computeAvailableSlots = (tutor, date, duration = 60, gapMinutes = 15) => {
    if (!tutor || !date) return [];
    const dayKey = getDayKey(date);
    const slots = tutor.tutor_profile?.availability?.[dayKey]?.timeSlots || [];
    // If we haven't fetched existing classes for this tutor yet, trigger the fetch and
    // return an empty list so we don't show potentially-conflicting slots.
    if (typeof tutorExistingClasses[tutor.id] === 'undefined') {
      // loadTutorClasses is async; fire-and-forget so UI updates once classes are loaded
      loadTutorClasses(tutor.id, date).catch(() => {});
      return [];
    }
    // Normalize existing classes to the shape expected by checkTutorTimeConflicts:
    // ensure each class has `_id` and `tutor._id` fields.
    const rawExisting = tutorExistingClasses[tutor.id] || [];
    const existing = (rawExisting || []).map(c => {
      // Normalize classDate to YYYY-MM-DD for comparison
      let classDateNorm = null;
      try {
        if (c.classDate) {
          const d = new Date(c.classDate);
          if (!isNaN(d.getTime())) classDateNorm = formatISODate(d);
        }
      } catch (e) {
        classDateNorm = null;
      }
      return {
        ...c,
        _id: c.id || c._id,
        classDate: classDateNorm || c.classDate,
        scheduleType: c.scheduleType || 'one-time',
        tutor: { _id: (c.tutor && c.tutor._id) ? c.tutor._id : (tutor.id || (c.tutor && c.tutor.id)) }
      };
    });
    const results = [];

    for (const s of slots) {
      if (!s) continue;
      let startRaw = '';
      let endRaw = '';
      if (typeof s === 'string') {
        // string like '09:00' - treat as a single-point availability
        startRaw = s;
        endRaw = '';
      } else if (typeof s === 'object') {
        startRaw = s.startTime || s.start || s.from || s.time || '';
        endRaw = s.endTime || s.end || s.to || '';
      }
      const startM = parseTimeToMinutes(String(startRaw).slice(0,8));
      const endM = endRaw ? parseTimeToMinutes(String(endRaw).slice(0,8)) : null;

      if (startM === null) continue;

      if (endM === null) {
        // single time slot — only allow exact match
        const candidateStart = startM;
        const candidateEnd = startM + duration;
        const candidateStartStr = minutesToTime(candidateStart);
        const newClass = { startTime: candidateStartStr, duration: duration, classDate: date, scheduleType: 'one-time' };
        const conflict = checkTutorTimeConflicts(newClass, existing, tutor.id);
        if (!(conflict && conflict.hasConflict)) {
          results.push({ start: candidateStartStr, end: minutesToTime(candidateEnd), label: `${candidateStartStr} - ${minutesToTime(candidateEnd)}` });
        }
        continue;
      }

      // iterate using non-overlapping windows: start at startM, next start = previous + duration + gapMinutes
      for (let tM = startM; tM + duration <= endM; tM += (duration + gapMinutes)) {
        const candidateStart = tM;
        const candidateEnd = tM + duration;
        const candidateStartStr = minutesToTime(candidateStart);
        const candidateEndStr = minutesToTime(candidateEnd);
        const newClass = { startTime: candidateStartStr, duration: duration, classDate: date, scheduleType: 'one-time' };
        const conflict = checkTutorTimeConflicts(newClass, existing, tutor.id);
        if (!(conflict && conflict.hasConflict)) {
          results.push({ start: candidateStartStr, end: candidateEndStr, label: `${candidateStartStr} - ${candidateEndStr}` });
        }
      }
    }
    // remove duplicates by label and sort by start time
    const unique = Array.from(new Map(results.map(r => [r.label, r])).values());
    unique.sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start));
    return unique;
  };

  // Render a human-friendly label for a tutor time slot which may be a string or an object
  const renderSlotLabel = (slot) => {
    if (slot === null || slot === undefined) return '';
    if (typeof slot === 'string') return slot;
    if (typeof slot === 'object') {
      const start = slot.startTime || slot.start || slot.from || slot.start_time || '';
      const end = slot.endTime || slot.end || slot.to || slot.end_time || '';
      if (start && end) {
        // show just HH:MM - HH:MM
        return `${(start || '').slice(0,5)} - ${(end || '').slice(0,5)}`;
      }
      if (slot.time) return (slot.time || '').slice(0,5);
      // avoid printing raw object when fields are empty — show a friendly label
      if (!start && !end) return 'Not set';
      // fallback: show what we can
      if (start) return (start || '').slice(0,5);
      return String(slot);
    }
    return String(slot);
  };

  const renderStep1 = () => (
    <form onSubmit={handleSubmit} className="registration-form">
      <div className="form-row">
        <div className="form-group half">
          <label htmlFor="firstName">
            <i className="fas fa-user"></i>
            First Name
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            placeholder="Enter your first name"
            value={form.firstName}
            onChange={handleChange}
            required
            className={error ? 'error' : ''}
            disabled={loading}
          />
        </div>

        <div className="form-group half">
          <label htmlFor="lastName">
            <i className="fas fa-user"></i>
            Last Name
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            placeholder="Enter your last name"
            value={form.lastName}
            onChange={handleChange}
            required
            className={error ? 'error' : ''}
            disabled={loading}
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="email">
          <i className="fas fa-envelope"></i>
          Email Address
        </label>
        <input
          type="email"
          id="email"
          name="email"
          placeholder="Enter your email address"
          value={form.email}
          onChange={handleChange}
          required
          className={error ? 'error' : ''}
          disabled={loading}
        />
      </div>

      {/* Hide Role field row - only parent role allowed, so do not show */}
      {/* <div className="form-group">
        <label htmlFor="role">
          <i className="fas fa-user-tag"></i>
          Role
        </label>
        <select
          id="role"
          name="role"
          value={form.role}
          disabled
          className={error ? 'error' : ''}
        >
          <option value="parent">Parent</option>
        </select>
      </div> */}

      {form.role === 'parent' && (
        <div className="form-group">
          <label htmlFor="phoneNumber">
            <i className="fas fa-phone"></i>
            Phone Number
          </label>
          <input
            type="tel"
            id="phoneNumber"
            name="phoneNumber"
            placeholder="Enter your phone number"
            value={form.phoneNumber}
            onChange={handleChange}
            className={error ? 'error' : ''}
            disabled={loading}
          />
        </div>
      )}

      <div className="form-group">
        <label htmlFor="password">
          <i className="fas fa-lock"></i>
          Password
        </label>
        <div className="password-input">
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            placeholder="Create a password"
            value={form.password}
            onChange={handleChange}
            required
            className={error ? 'error' : ''}
            disabled={loading}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={togglePasswordVisibility}
            disabled={loading}
          >
            <i className={showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
          </button>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="confirmPassword">
          <i className="fas fa-lock"></i>
          Confirm Password
        </label>
        <div className="password-input">
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Confirm your password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            className={error ? 'error' : ''}
            disabled={loading}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={toggleConfirmPasswordVisibility}
            disabled={loading}
          >
            <i className={showConfirmPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          <i className="fas fa-check-circle"></i>
          {success}
        </div>
      )}

      <button 
        type="submit" 
        className="registration-button"
        disabled={loading}
      >
        {loading ? (
          <>
            <i className="fas fa-spinner fa-spin"></i>
            {form.role === 'parent' ? 'Processing...' : 'Creating Account...'}
          </>
        ) : form.role === 'parent' ? (
          <>
            <i className="fas fa-arrow-right"></i>
            Next
          </>
        ) : (
          <>
            <i className="fas fa-user-plus"></i>
            Create Account
          </>
        )}
      </button>

      <div className="form-footer">
        <p>Already have an account? 
          <Link to="/login" className="login-link">
            <i className="fas fa-sign-in-alt"></i>
            Sign In
          </Link>
        </p>
      </div>
    </form>
  );

  const renderStep2 = () => (
    <form onSubmit={handleSubmit} className="registration-form">
      {/* Student Information Section - Multiple Students */}
      {form.students.map((student, idx) => (
        <div className="form-section" key={idx}>
          <div className="section-header">
            <i className="fas fa-user-graduate"></i>
            <h3>Student {idx + 1} Information</h3>
            {form.students.length > 1 && (
              <button
                type="button"
                className="remove-student-button"
                onClick={() => handleRemoveStudent(idx)}
                disabled={loading}
                title={`Remove Student ${idx + 1}`}
              >
                <i className="fas fa-trash"></i>
                Remove
              </button>
            )}
          </div>
          <div className="form-row">
            <div className="form-group third">
              <label htmlFor={`studentFirstName_${idx}`}>First Name *</label>
              <input
                type="text"
                id={`studentFirstName_${idx}`}
                name="studentFirstName"
                placeholder="Student's first name"
                value={student.studentFirstName}
                onChange={e => handleStudentChange(idx, e)}
                required
                className={error ? 'error' : ''}
                disabled={loading}
              />
            </div>
            <div className="form-group third">
              <label htmlFor={`studentLastName_${idx}`}>Last Name *</label>
              <input
                type="text"
                id={`studentLastName_${idx}`}
                name="studentLastName"
                placeholder="Student's last name"
                value={student.studentLastName}
                onChange={e => handleStudentChange(idx, e)}
                required
                className={error ? 'error' : ''}
                disabled={loading}
              />
            </div>
            <div className="form-group third">
              <label htmlFor={`studentDateOfBirth_${idx}`}>Date of Birth</label>
              <input
                type="date"
                id={`studentDateOfBirth_${idx}`}
                name="studentDateOfBirth"
                value={student.studentDateOfBirth}
                onChange={e => handleStudentChange(idx, e)}
                className={error ? 'error' : ''}
                disabled={loading}
              />
            </div>
          </div>
          {/* Academic Information Section for each student */}
          <div className="section-header">
            <i className="fas fa-graduation-cap"></i>
            <h3>Academic Information</h3>
          </div>
          <div className="form-row">
            <div className="form-group third">
              <label htmlFor={`grade_${idx}`}>Grade *</label>
              <select
                id={`grade_${idx}`}
                name="grade"
                value={student.grade}
                onChange={e => handleStudentChange(idx, e)}
                required
                className={error ? 'error' : ''}
                disabled={loading}
              >
                <option value="">Select Grade</option>
                <option value="K">Kindergarten</option>
                <option value="1">1st Grade</option>
                <option value="2">2nd Grade</option>
                <option value="3">3rd Grade</option>
                <option value="4">4th Grade</option>
                <option value="5">5th Grade</option>
                <option value="6">6th Grade</option>
                <option value="7">7th Grade</option>
                <option value="8">8th Grade</option>
                <option value="9">9th Grade</option>
                <option value="10">10th Grade</option>
                <option value="11">11th Grade</option>
                <option value="12">12th Grade</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Subjects of Interest * (select multiple)</label>
            <div className="subjects-grid">
              {(centerSubjects.length > 0 ? centerSubjects : [
                'Mathematics', 'Science', 'History', 'Geography',
                'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Art',
                'Music', 'Physical Education', 'Literature', 'Economics', 'Psychology'
              ]).map(subject => (
                <div key={subject} className="subject-checkbox">
                  <input
                    type="checkbox"
                    id={`${subject}_${idx}`}
                    checked={student.subjects.includes(subject)}
                    onChange={e => handleStudentSubjectChange(idx, subject, e.target.checked)}
                    disabled={loading}
                  />
                  <label htmlFor={`${subject}_${idx}`}>{subject}</label>
                </div>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Languages * (select multiple)</label>
            <div className="subjects-grid">
              {[
                'English', 'Spanish', 'French', 'German', 'Chinese', 'Arabic', 'Hindi',
                'Portuguese', 'Russian', 'Japanese', 'Italian', 'Korean'
              ].map(language => (
                <div key={language} className="subject-checkbox">
                  <input
                    type="checkbox"
                    id={`${language}_${idx}`}
                    checked={student.languages.includes(language)}
                    onChange={e => handleStudentLanguageChange(idx, language, e.target.checked)}
                    disabled={loading}
                  />
                  <label htmlFor={`${language}_${idx}`}>{language}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="add-student-button" onClick={handleAddStudent} disabled={loading}>
        <i className="fas fa-user-plus"></i> Add Student
      </button>

      {/* Only render dynamic student sections. Remove old academic info section. */}

      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          <i className="fas fa-check-circle"></i>
          {success}
        </div>
      )}

      <div className="button-row">
        <button 
          type="button" 
          className="back-button"
          onClick={handleBackToStep1}
          disabled={loading}
        >
          <i className="fas fa-arrow-left"></i>
          Back
        </button>
        
        <button 
          type="submit" 
          className="registration-button"
          disabled={loading}
        >
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              Processing...
            </>
          ) : (
            <>
              <i className="fas fa-arrow-right"></i>
              Next
            </>
          )}
        </button>
      </div>
    </form>
  );

  const renderStep3 = () => {
    const subjects = Array.from(new Set(form.students[selectedStudentIndex]?.subjects || []));
    const studentSchedule = scheduledSubjects[selectedStudentIndex] || {};
    // Build aggregated quick slots across available tutors when no tutor is selected
    let aggregatedSlots = [];
    if (!form.selectedTutor && Array.isArray(availableTutorsForDate) && availableTutorsForDate.length > 0 && form.classDate) {
      // compute short weekday label for selected date (Mon, Tue...)
      let weekdayShort = '';
      try {
        const d = new Date(form.classDate + 'T00:00:00');
        const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        weekdayShort = shortDays[d.getDay()] || '';
      } catch (e) {
        weekdayShort = '';
      }

        // Build aggregated slots per-time (deduplicated) and collect available tutors per time
        // Use a map keyed by start time so we show a single button per time with a tutor-count.
        const slotMap = {}; // { '09:00': { start: '09:00', label: 'Mon 09:00 - 10:00', tutors: [t, ...] } }
        for (const t of availableTutorsForDate) {
          try {
            // If we haven't loaded existing classes for this tutor/date yet, trigger load and skip this tutor for now
            if (typeof tutorExistingClasses[t.id] === 'undefined') {
              loadTutorClasses(t.id, form.classDate).catch(() => {});
              continue;
            }
            const dayKey = getDayKey(form.classDate);
            const rawSlots = t.tutor_profile?.availability?.[dayKey]?.timeSlots || [];
            const duration = parseInt(form.classDuration) || 60;
            const gap = 15;

            for (const s of rawSlots) {
              if (!s) continue;
              if (typeof s === 'string') {
                const startM = parseTimeToMinutes(s.slice(0,5));
                if (startM === null) continue;
                const startStr = minutesToTime(startM);
                const endStr = minutesToTime(startM + duration);
                try {
                  const has = tutorHasTimeSlot(t, startStr, form.classDate);
                  console.debug('QuickSlotEval', { tutorId: t.id, tutorName: t.username || `${t.first_name} ${t.last_name}`, start: startStr, date: form.classDate, has, existingCount: (tutorExistingClasses[t.id] || []).length });
                  if (has) {
                    const key = startStr;
                    const lbl = `${weekdayShort} ${startStr} - ${endStr}`;
                    if (!slotMap[key]) slotMap[key] = { start: startStr, label: lbl, tutors: [] };
                    slotMap[key].tutors.push(t);
                  }
                } catch (dbgErr) {
                  console.error('QuickSlotEval error', { tutorId: t.id, err: dbgErr });
                }
              } else if (typeof s === 'object') {
                const startRaw = s.startTime || s.start || s.from || s.time || '';
                const endRaw = s.endTime || s.end || s.to || '';
                const startM = parseTimeToMinutes(String(startRaw).slice(0,8));
                const endM = endRaw ? parseTimeToMinutes(String(endRaw).slice(0,8)) : null;
                if (startM === null) continue;
                if (endM === null) {
                  const startStr = minutesToTime(startM);
                  const endStr = minutesToTime(startM + duration);
                  try {
                    const has = tutorHasTimeSlot(t, startStr, form.classDate);
                    console.debug('QuickSlotEval', { tutorId: t.id, tutorName: t.username || `${t.first_name} ${t.last_name}`, start: startStr, date: form.classDate, has, existingCount: (tutorExistingClasses[t.id] || []).length });
                    if (has) {
                      const key = startStr;
                      const lbl = `${weekdayShort} ${startStr} - ${endStr}`;
                      if (!slotMap[key]) slotMap[key] = { start: startStr, label: lbl, tutors: [] };
                      slotMap[key].tutors.push(t);
                    }
                  } catch (dbgErr) {
                    console.error('QuickSlotEval error', { tutorId: t.id, err: dbgErr });
                  }
                } else {
                  for (let tM = startM; tM + duration <= endM; tM += (duration + gap)) {
                    const startStr = minutesToTime(tM);
                    const endStr = minutesToTime(tM + duration);
                    try {
                      const has = tutorHasTimeSlot(t, startStr, form.classDate);
                      console.debug('QuickSlotEval', { tutorId: t.id, tutorName: t.username || `${t.first_name} ${t.last_name}`, start: startStr, date: form.classDate, has, existingCount: (tutorExistingClasses[t.id] || []).length });
                      if (has) {
                        const key = startStr;
                        const lbl = `${weekdayShort} ${startStr} - ${endStr}`;
                        if (!slotMap[key]) slotMap[key] = { start: startStr, label: lbl, tutors: [] };
                        slotMap[key].tutors.push(t);
                      }
                    } catch (dbgErr) {
                      console.error('QuickSlotEval error', { tutorId: t.id, err: dbgErr });
                    }
                  }
                }
              }
            }
          } catch (e) {
            // ignore compute errors for a tutor
          }
        }
        // Convert map to sorted array of aggregated slots
        aggregatedSlots = Object.values(slotMap).sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start));
    }
    return (
      <form onSubmit={handleSubmit} className="registration-form" noValidate>
        <div className="form-section">
          <div className="section-header">
            <i className="fas fa-calendar-alt"></i>
            <h3>Schedule Your Class</h3>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ width: '100%' }}>
              <label>Students & Subjects</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                { (form.students || []).map((s, i) => (
                  <div key={i} className="student-card" style={{ border: '1px solid #e6eef8', borderRadius: 8, padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <strong>{`${s.studentFirstName || 'Student'} ${s.studentLastName || ''}`}</strong>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <small className="muted">Grade: {s.grade || 'N/A'}</small>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(s.subjects || []).map(sub => (
                          <div key={sub}>
                            <div id={`subject-row-${i}-${sub.replace(/\s+/g,'_')}`} className="subject-row">
                              <div>
                                <div className={`subject-name`}>{sub}</div>
                                {(scheduledSubjects[i] && scheduledSubjects[i][sub]) && (
                                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                                    Scheduled: {scheduledSubjects[i][sub].date} at {scheduledSubjects[i][sub].time}
                                  </div>
                                )}
                              </div>
                              <div className="subject-actions">
                                <button
                                  type="button"
                                  className="schedule-subject-inline-button"
                                  onClick={() => {
                                    // Set the selected student and subject and clear any previous selection
                                    setSelectedStudentIndex(i);
                                    setForm(prev => ({ ...prev, classSubject: sub, classDate: '', classTime: '', selectedTutor: null }));
                                    // reset calendar to current month
                                    setCalendarMonth(new Date());
                                    // scroll the subject row into view (so inline calendar is visible)
                                    window.setTimeout(() => {
                                      const el = document.getElementById(`subject-row-${i}-${sub.replace(/\s+/g,'_')}`);
                                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }, 50);
                                  }}
                                >
                                  {(scheduledSubjects[i] && scheduledSubjects[i][sub]) ? 'Change' : 'Schedule'}
                                </button>
                              </div>
                            </div>
                            {/* Inline calendar appears below the subject row when this subject is active */}
                            {form.classSubject === sub && selectedStudentIndex === i && (
                              <div className="inline-calendar-wrapper">
                                {/* reuse calendar rendering logic inline */}
                                <div className="inline-calendar">
                                  <div className="calendar-header">
                                    <button type="button" className="calendar-nav" onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}>&lt;</button>
                                    <div className="calendar-title">{calendarMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
                                    <button type="button" className="calendar-nav" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>&gt;</button>
                                  </div>
                                  <div className="calendar-weekdays">
                                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (<div key={d} className="calendar-weekday">{d}</div>))}
                                  </div>
                                  <div className="calendar-grid">
                                    {
                                      (() => {
                                        const start = monthStart(calendarMonth);
                                        const end = monthEnd(calendarMonth);
                                        const days = [];
                                        const pad = start.getDay();
                                        for (let k = 0; k < pad; k++) days.push(null);
                                        for (let d = 1; d <= end.getDate(); d++) days.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d));
                                        const todayIso = formatISODate(new Date());
                                        return days.map((dt, idx) => {
                                          if (dt === null) return (<div key={idx} className="calendar-cell empty" />);
                                          const iso = formatISODate(dt);
                                          const disabled = iso < todayIso;
                                          return (
                                            <button
                                              key={iso}
                                              type="button"
                                              className={`calendar-cell ${iso === form.classDate ? 'selected' : ''}` + (disabled ? ' disabled' : '')}
                                              onClick={() => { if (!disabled) handlePickDateFromCalendar(dt); }}
                                              disabled={disabled}
                                              title={iso}
                                            >
                                              <span>{dt.getDate()}</span>
                                            </button>
                                          );
                                        });
                                      })()
                                    }
                                  </div>
                                  <div className="calendar-footer">
                                    <small>select date to view slots</small>
                                  </div>
                                  {/* Inline time slots auto-open here for the selected date */}
                                  <div style={{ marginTop: '0.75rem' }}>
                                    {form.classDate ? (
                                      availableTutorsForDate && availableTutorsForDate.length > 0 ? (
                                        (() => {
                                          // build aggregatedSlots similar to renderStep3
                                          let weekdayShort = '';
                                          try {
                                            const d = new Date(form.classDate + 'T00:00:00');
                                            const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                            weekdayShort = shortDays[d.getDay()] || '';
                                          } catch (e) {
                                            weekdayShort = '';
                                          }
                                          const slotMap = {};
                                          for (const t of availableTutorsForDate) {
                                            try {
                                              if (typeof tutorExistingClasses[t.id] === 'undefined') {
                                                loadTutorClasses(t.id, form.classDate).catch(() => {});
                                                continue;
                                              }
                                              const dayKey = getDayKey(form.classDate);
                                              const rawSlots = t.tutor_profile?.availability?.[dayKey]?.timeSlots || [];
                                              const duration = parseInt(form.classDuration) || 60;
                                              const gap = 15;
                                              for (const s of rawSlots) {
                                                if (!s) continue;
                                                if (typeof s === 'string') {
                                                  const startM = parseTimeToMinutes(s.slice(0,5));
                                                  if (startM === null) continue;
                                                  const startStr = minutesToTime(startM);
                                                  const endStr = minutesToTime(startM + duration);
                                                  try {
                                                    const has = tutorHasTimeSlot(t, startStr, form.classDate);
                                                    if (has) {
                                                      const key = startStr;
                                                      const lbl = `${weekdayShort} ${startStr} - ${endStr}`;
                                                      if (!slotMap[key]) slotMap[key] = { start: startStr, label: lbl, tutors: [] };
                                                      slotMap[key].tutors.push(t);
                                                    }
                                                  } catch (dbgErr) {
                                                    // ignore
                                                  }
                                                } else if (typeof s === 'object') {
                                                  const startRaw = s.startTime || s.start || s.from || s.time || '';
                                                  const endRaw = s.endTime || s.end || s.to || '';
                                                  const startM = parseTimeToMinutes(String(startRaw).slice(0,8));
                                                  const endM = endRaw ? parseTimeToMinutes(String(endRaw).slice(0,8)) : null;
                                                  if (startM === null) continue;
                                                  if (endM === null) {
                                                    const startStr = minutesToTime(startM);
                                                    const endStr = minutesToTime(startM + duration);
                                                    try {
                                                      const has = tutorHasTimeSlot(t, startStr, form.classDate);
                                                      if (has) {
                                                        const key = startStr;
                                                        const lbl = `${weekdayShort} ${startStr} - ${endStr}`;
                                                        if (!slotMap[key]) slotMap[key] = { start: startStr, label: lbl, tutors: [] };
                                                        slotMap[key].tutors.push(t);
                                                      }
                                                    } catch (dbgErr) {
                                                      // ignore
                                                    }
                                                  } else {
                                                    for (let tM = startM; tM + duration <= endM; tM += (duration + gap)) {
                                                      const startStr = minutesToTime(tM);
                                                      const endStr = minutesToTime(tM + duration);
                                                      try {
                                                        const has = tutorHasTimeSlot(t, startStr, form.classDate);
                                                        if (has) {
                                                          const key = startStr;
                                                          const lbl = `${weekdayShort} ${startStr} - ${endStr}`;
                                                          if (!slotMap[key]) slotMap[key] = { start: startStr, label: lbl, tutors: [] };
                                                          slotMap[key].tutors.push(t);
                                                        }
                                                      } catch (dbgErr) {
                                                        // ignore
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            } catch (e) {
                                              // ignore
                                            }
                                          }
                                          const aggregated = Object.values(slotMap).sort((a,b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start));
                                          if (aggregated.length === 0) return (<p><small className="muted">No tutors available on this date for the selected subject.</small></p>);
                                          return (
                                            <div>
                                              <div className="section-header small"><h4>Available slots for {form.classDate}</h4></div>
                                              <div className="time-slots-grid quick-slots">
                                                {aggregated.map(slot => (
                                                  <button
                                                    key={`${slot.start}_${slot.tutors && slot.tutors[0] ? slot.tutors[0].id : 'noTutor'}`}
                                                    type="button"
                                                    className={`time-slot-button quick-slot ${form.classTime === slot.start && slot.tutors && slot.tutors.some(tt => tt.id === form.selectedTutor?.id) ? 'selected' : ''}`}
                                                    onClick={() => {
                                                      const chosenTutor = (slot.tutors && slot.tutors.length > 0) ? slot.tutors[0] : null;
                                                      if (chosenTutor) {
                                                        setForm(prev => ({ ...prev, classTime: slot.start, selectedTutor: chosenTutor }));
                                                        loadTutorClasses(chosenTutor.id, form.classDate).catch(() => {});
                                                      }
                                                    }}
                                                  >
                                                    {slot.label}{slot.tutors && slot.tutors.length > 1 ? ` (${slot.tutors.length} tutors)` : ''}
                                                  </button>
                                                ))}
                                              </div>
                                              {/* Inline confirm schedule button shown after selecting a slot for this subject */}
                                              {form.classTime && selectedStudentIndex === i && form.classSubject === sub && (
                                                <div className="schedule-subject-inline-confirm">
                                                  <button
                                                    type="button"
                                                    className="schedule-subject-button"
                                                    onClick={handleScheduleSubject}
                                                    disabled={loading || !(form.selectedTutor && form.classDate && form.classTime)}
                                                  >
                                                    <i className="fas fa-plus"></i> Schedule Class for {sub}
                                                  </button>
                                                 
                                                </div>
                                                
                                              )}
                                            </div>
                                          );
                                        })()
                                      ) : (
                                        <p><small className="muted">No tutors available on this date for the selected subject.</small></p>
                                      )
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      {(!s.subjects || s.subjects.length === 0) && (
                        <small className="muted">No subjects selected for this student.</small>
                      )}
                    </div>
                  </div>
                )) }
              </div>
            </div>
          </div>
          {false && (
          <div className="form-row">
            <div className="form-group quarter">
              <label htmlFor="classDate">Demo Class Date *</label>
              <input
                type="date"
                id="classDate"
                name="classDate"
                value={form.classDate}
                onChange={e => {
                  handleChange(e);
                  updateAvailableTutorsForDate(e.target.value, form.classSubject);
                  if (form.selectedTutor) {
                    loadTutorClasses(form.selectedTutor.id, e.target.value).catch(err => console.error(err));
                  }
                }}
                required
                className={error ? 'error' : ''}
                disabled={loading}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            {/* Class Time is selected via discrete tutor time-slot buttons below — keep value as hidden field */}
            <input type="hidden" id="classTime" name="classTime" value={form.classTime} />
            {/* Duration is fixed to 1 hour for parent registration flow (hidden from UI) */}
            <div className="form-group quarter">
              <label htmlFor="classSubject">Subject *</label>
              <select
                id="classSubject"
                name="classSubject"
                value={form.classSubject}
                onChange={e => {
                  handleChange(e);
                  updateAvailableTutorsForDate(form.classDate, e.target.value);
                }}
                required
                className={error ? 'error' : ''}
                disabled={loading}
              >
                <option value="">Select Subject</option>
                {subjects.filter(sub => !studentSchedule[sub]).map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>
          </div>
          )}
          {false && (
          <div className="class-summary">
            <h4>Class Summary:</h4>
            <p><strong>Student:</strong> {`${form.students[selectedStudentIndex]?.studentFirstName || ''} ${form.students[selectedStudentIndex]?.studentLastName || ''}`}</p>
            {form.selectedTutor && (
              <p><strong>Tutor:</strong> {form.selectedTutor.username || `${form.selectedTutor.first_name} ${form.selectedTutor.last_name}`}</p>
            )}
            {form.classDate && form.classTime && (
              <p><strong>Scheduled:</strong> {form.classDate} at {form.classTime} ({form.classDuration} minutes)</p>
            )}
            {form.classSubject && <p><strong>Subject:</strong> {form.classSubject}</p>}

            {/* When a slot/time is already selected, offer a Change slot button so user can pick another */}
            {form.classTime && (
              <div style={{ marginTop: '0.6rem' }}>
                <button
                  type="button"
                  className="change-slot-button"
                  onClick={() => {
                    // Clear the selected time and tutor so user can pick another slot
                    setForm(prev => ({ ...prev, classTime: '', selectedTutor: null }));
                    // Clear success message if any (we're changing selection)
                    setSuccess('');
                    // Keep availableTutorsForDate so slots remain visible after clearing
                  }}
                >
                  Change slot
                </button>
              </div>
            )}
          </div>
          )}
          {false && (
          <div className="form-section">
            <div className="section-header small">
              <h4>Available slots for {form.classDate || 'selected date'}</h4>
            </div>
            {form.classDate ? (
              availableTutorsForDate.length > 0 ? (
                <div className="tutors-grid compact">
                  {form.selectedTutor && !form.classTime ? (
                    // Show only the selected tutor card and a change button
                    (() => {
                      const t = form.selectedTutor;
                      return (
                        <div className="tutor-card-single-wrapper">
                          <div className={`tutor-card small selected`}>
                            <div className="tutor-avatar"><i className="fas fa-user-tie"></i></div>
                            <div className="tutor-info">
                              <h5>{t.username || `${t.first_name} ${t.last_name}`}</h5>
                              <small>{t.email}</small>
                              <div className="tutor-slots"><small className="muted">{(t.tutor_profile?.availability?.[getDayKey(form.classDate)]?.timeSlots || []).length > 0 ? renderSlotLabel((t.tutor_profile?.availability?.[getDayKey(form.classDate)]?.timeSlots || [])[0]) : 'Not set'}</small></div>
                            </div>
                            {/* <div className="tutor-card-meta">
                              <small className="muted">{t.tutor_profile?.availability ? `${renderSlotLabel((t.tutor_profile?.availability?.[getDayKey(form.classDate)]?.timeSlots || [])[0])} - ${renderSlotLabel((t.tutor_profile?.availability?.[getDayKey(form.classDate)]?.timeSlots || [])[1])}` : 'Not set'}</small>
                            </div> */}
                          </div>
                          <div style={{marginTop: '0.75rem'}}>
                            <button type="button" className="change-tutor-button" onClick={() => { setForm(prev => ({ ...prev, selectedTutor: null })); setAvailableTutorsForDate((prev) => prev); }}>
                              Change tutor
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    // No tutor selected: show aggregated quick time slots across tutors
                    aggregatedSlots.length > 0 ? (
                      <div className="time-slots-grid quick-slots">
                        {aggregatedSlots.map((slot) => (
                          <button
                            key={`${slot.start}_${slot.tutors && slot.tutors[0] ? slot.tutors[0].id : 'noTutor'}`}
                            type="button"
                            className={`time-slot-button quick-slot ${form.classTime === slot.start && slot.tutors && slot.tutors.some(tt => tt.id === form.selectedTutor?.id) ? 'selected' : ''}`}
                            onClick={() => {
                              // select the first available tutor for this aggregated time and set time
                              const chosenTutor = (slot.tutors && slot.tutors.length > 0) ? slot.tutors[0] : null;
                              if (chosenTutor) {
                                setForm(prev => ({ ...prev, classTime: slot.start, selectedTutor: chosenTutor }));
                                // ensure we load classes for the tutor/date
                                loadTutorClasses(chosenTutor.id, form.classDate).catch(() => {});
                              }
                            }}
                          >
                            {slot.label}{slot.tutors && slot.tutors.length > 1 ? ` (${slot.tutors.length} tutors)` : ''}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p><small>No tutors available on this date for the selected subject.</small></p>
                    )
                  )}
                </div>
              ) : (
                <p><small>No tutors available on this date for the selected subject.</small></p>
              )
            ) : (
              <p><small>select date to view slots</small></p>
            )}
          </div>
          )}
                {/* If a tutor is selected, show discrete available slots for that tutor on the selected date */}
                {form.selectedTutor && form.classDate && !form.classTime && (
                  (() => {
                    const slots = computeAvailableSlots(form.selectedTutor, form.classDate, parseInt(form.classDuration) || 60, 15);
                    return (
                      <div className="form-section small">
                        <div className="section-header small">
                          <h4>Available time slots for {form.selectedTutor.username || `${form.selectedTutor.first_name} ${form.selectedTutor.last_name}`}</h4>
                        </div>
                        {slots.length > 0 ? (
                          <div className="time-slots-grid">
                            {slots.map(slot => (
                                  <button
                                    key={slot.label || slot.start}
                                    type="button"
                                    className={`time-slot-button ${form.classTime === slot.start ? 'selected' : ''}`}
                                    onClick={() => {
                                      // set the time (start of the selected range) and ensure tutor is selected
                                      setForm(prev => ({ ...prev, classTime: slot.start, selectedTutor: form.selectedTutor }));
                                      // ensure we have loaded existing classes for this tutor/date (if not already)
                                      loadTutorClasses(form.selectedTutor.id, form.classDate).catch(() => {});
                                    }}
                                  >
                                    {form.classDate ? (() => {
                                      // prepend weekday short (Mon/Tue) to the slot label
                                      try {
                                        const d = new Date(form.classDate + 'T00:00:00');
                                        const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                        const wk = shortDays[d.getDay()] || '';
                                        return `${wk} ${slot.label}`;
                                      } catch (e) {
                                        return slot.label;
                                      }
                                    })() : slot.label}
                                  </button>
                                ))}
                          </div>
                        ) : (
                          <p><small className="muted">No free slots available for this tutor on the selected date.</small></p>
                        )}
                      </div>
                    );
                  })()
                )}
          {false && (
          <div className="button-row">
            <button
              type="button"
              className="schedule-subject-button"
              onClick={handleScheduleSubject}
              disabled={loading || !form.selectedTutor || !form.classSubject || !tutorHasTimeSlot(form.selectedTutor, form.classTime, form.classDate)}
            >
              <i className="fas fa-plus"></i> Schedule Class for Subject
            </button>
          </div>
          )}
        </div>
        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}
        {success && (
          <div className="success-message">
            <i className="fas fa-check-circle"></i>
            {success}
          </div>
        )}
        {skippedSchedules && skippedSchedules.length > 0 && (
          <div className="warning-message skipped-schedules">
            <i className="fas fa-exclamation-triangle"></i>
            <h4>Some schedules were skipped:</h4>
            <ul>
              {skippedSchedules.map((s, i) => (
                <li key={i}>
                  <strong>Subject:</strong> {s.schedule?.subject || 'N/A'} — <strong>Reason:</strong> {s.reason || 'Unknown'}
                </li>
              ))}
            </ul>
            <p className="muted">You can adjust the date/time or choose another tutor and try scheduling those subjects again.</p>
          </div>
        )}
        <div className="button-row">
          <button
            type="button"
            className="back-button"
            onClick={handleBackToStep2}
            disabled={loading}
          >
            <i className="fas fa-arrow-left"></i>
            Back
          </button>
          <button
            type="submit"
            className="registration-button"
            disabled={loading || subjects.length === 0 || Object.keys(studentSchedule).length < subjects.length}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Creating Account & Scheduling...
              </>
            ) : (
              <>
                <i className="fas fa-check"></i>
                Complete Registration
              </>
            )}
          </button>
        </div>
      </form>
    );
  };

  // inline calendar is rendered directly below the subject row (see above)

  return (
    <div className="registration-page">
      <div className="registration-container">
        {/* Header Section */}
        <div className="registration-header">
          {centerLogo && (
            <div className="center-logo-display">
              <img src={centerLogo} alt="Center Logo" className="center-logo-image" />
            </div>
          )}
          <div className="logo">
            <i className="fas fa-graduation-cap"></i>
            <h1>EduPlatform</h1>
          </div>
          <p className="tagline">
            {currentStep === 1 ? 'Create your account to get started' : 
             currentStep === 2 ? 'Add your student information' : 
             'Select tutor and schedule your first class'}
          </p>
          {form.role === 'parent' && (
            <div className="step-indicator">
              <span className={currentStep === 1 ? 'active' : 'completed'}>1</span>
              <div className="step-line"></div>
              <span className={currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}>2</span>
              <div className="step-line"></div>
              <span className={currentStep === 3 ? 'active' : ''}>3</span>
            </div>
          )}
        </div>

        {/* Registration Form */}
  {currentStep === 1 ? renderStep1() : currentStep === 2 ? renderStep2() : renderStep3()}
      </div>

      {/* Background Elements */}
      <div className="bg-elements">
        <div className="circle circle-1"></div>
        <div className="circle circle-2"></div>
        <div className="circle circle-3"></div>
      </div>
    </div>
  );
};

export default Registration;