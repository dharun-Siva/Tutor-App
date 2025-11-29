import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { userAPI } from '../../../utils/api';
import { getErrorMessage } from '../../../utils/helpers';
import { convertTimeZoneToUTC } from '../../../utils/dateUtils';
import styles from './StudentModal.module.css';

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

const StudentModalRefactored = ({ isOpen, onClose, onSave, student }) => {
  console.log('StudentModalRefactored mounted with student:', student);

  // Initialize state with default values
  const [formData, setFormData] = useState(() => {
    console.log('Initializing form data with student:', student);
    
    // If we have a student, use their data directly
    if (student) {
      console.log('Student data for form:', student);
      const studentProfile = student.student_profile || student.studentProfile || {};
      console.log('Student profile:', studentProfile);
      console.log('Parent ID from profile:', studentProfile.parent_id);
      const data = {
        // Personal Information
        email: student.email || '',
        username: student.username || '',
        password: '', // Leave blank for security
        firstName: student.firstName || student.first_name || '',
        lastName: student.lastName || student.last_name || '',
        phoneNumber: student.phoneNumber || student.phone_number || '',
        dateOfBirth: student.dateOfBirth || studentProfile.dateOfBirth || '',
        isActive: student.is_active !== undefined ? student.is_active : true,
        // Set parent ID from student profile - check all possible parent ID fields
        parentId: studentProfile.parent_id || studentProfile.parentId || student.parentId || '',
        
        // Address Information
        address: {
          street: student.address?.street || studentProfile.address?.street || '',
          city: student.address?.city || studentProfile.address?.city || '',
          state: student.address?.state || studentProfile.address?.state || '',
          zipCode: student.address?.zipCode || studentProfile.address?.zipCode || '',
          country: student.address?.country || studentProfile.address?.country || ''
        },
        
        // Billing Information
        hourlyRate: studentProfile.hourlyRate || 0,
        currency: studentProfile.preferences?.currency || 'USD',
        
        // Academic Information
        grade: student.grade || studentProfile.grade || '',
        school: student.school || studentProfile.school || '',
        subjects: studentProfile.subjects || studentProfile.preferences?.preferredSubjects || [],
        learningStyle: studentProfile.preferences?.learningStyle || '',
        goals: studentProfile.learningGoals || '',
        notes: studentProfile.additionalNotes || '',
        
        // Parent Link
        parentId: student.parentId || '',
        emergencyContact: {
          name: student.emergencyContact?.name || studentProfile.emergencyContact?.name || '',
          phone: student.emergencyContact?.phone || studentProfile.emergencyContact?.phone || '',
          relationship: student.emergencyContact?.relationship || studentProfile.emergencyContact?.relationship || '',
          email: student.emergencyContact?.email || studentProfile.emergencyContact?.email || ''
        },

        // Medical Information
        medicalInfo: student.medicalInfo || studentProfile.medicalInfo || {},
        
        // Time Zone
        timeZone: student.timeZone || studentProfile.timeZone || 'UTC'
      };
    }

    // Otherwise use default empty data for new student
    const defaultData = {
      // Step 1: Personal Information
      email: '',
      username: '',
      password: '',
      firstName: '',
      lastName: '',
      phoneNumber: '',
      dateOfBirth: '',
      isActive: true,
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      },
      timeZone: '',
      
      // Step 2: Billing Information
      hourlyRate: 0,
      currency: 'USD',
      
      // Step 3: Academic Information
      grade: '',
      school: '',
      subjects: [], // Simplified to single subject list
      learningStyle: '',
      goals: '',
      notes: '',
      
      // Step 4: Parent Link (REFACTORED)
      parentId: '', // Link to existing parent instead of creating inline
      emergencyContact: {
        name: '',
        phone: '',
        relationship: '',
        email: ''
      },
      medicalInfo: {
        allergies: '',
        medications: '',
        conditions: '',
        emergencyInfo: '',
        doctorContact: ''
      },
      
      // Step 5: Availability
      availability: {
        monday: { available: false, timeSlots: [] },
        tuesday: { available: false, timeSlots: [] },
        wednesday: { available: false, timeSlots: [] },
        thursday: { available: false, timeSlots: [] },
        friday: { available: false, timeSlots: [] },
        saturday: { available: false, timeSlots: [] },
        sunday: { available: false, timeSlots: [] }
      }
    };

    if (student) {
      console.log('Initializing form with student data:', student); // Debug log
      
      // First get all the possible data sources
      const studentData = student.data || {};
      const studentProfile = student.studentProfile || {};
      const academicInfo = studentProfile.academicInfo || studentData || {};
      
      return {
        ...defaultData, // Include all default data first
        // Personal Information
        firstName: student.firstName || student.first_name || studentProfile.firstName || '',
        lastName: student.lastName || student.last_name || studentProfile.lastName || '',
        email: student.email || studentProfile.email || '',
        username: student.username || '',
        password: '',  // Leave blank for editing
        phoneNumber: student.phoneNumber || student.phone_number || studentProfile.phoneNumber || '',
        dateOfBirth: student.dateOfBirth || studentProfile.dateOfBirth || '',
        isActive: student.is_active !== undefined ? student.is_active : student.isActive !== undefined ? student.isActive : true,
        
        // Address Information
        address: {
          street: student.address?.street || studentProfile.address?.street || '',
          city: student.address?.city || studentProfile.address?.city || '',
          state: student.address?.state || studentProfile.address?.state || '',
          zipCode: student.address?.zipCode || studentProfile.address?.zipCode || '',
          country: student.address?.country || studentProfile.address?.country || ''
        },
        
        // Academic Information
        grade: academicInfo.grade || student.grade || '',
        school: academicInfo.school || student.school || '',
        subjects: academicInfo.subjects || student.subjects || [],
        learningStyle: academicInfo.learningStyle || student.learningStyle || '',
        goals: academicInfo.goals || student.goals || '',
        notes: academicInfo.notes || student.notes || '',
        
        // Emergency Contact
        emergencyContact: {
          name: studentProfile.emergencyContact?.name || student.emergencyContact?.name || '',
          phone: studentProfile.emergencyContact?.phone || student.emergencyContact?.phone || '',
          relationship: studentProfile.emergencyContact?.relationship || student.emergencyContact?.relationship || '',
          email: studentProfile.emergencyContact?.email || student.emergencyContact?.email || ''
        },
        
        // Medical Information
        medicalInfo: {
          allergies: studentProfile.medicalInfo?.allergies || student.medicalInfo?.allergies || '',
          medications: studentProfile.medicalInfo?.medications || student.medicalInfo?.medications || '',
          conditions: studentProfile.medicalInfo?.conditions || student.medicalInfo?.conditions || '',
          emergencyInfo: studentProfile.medicalInfo?.emergencyInfo || student.medicalInfo?.emergencyInfo || '',
          doctorContact: studentProfile.medicalInfo?.doctorContact || student.medicalInfo?.doctorContact || ''
        },
        
        // Time Zone
        timeZone: studentProfile.timeZone || student.timeZone || 'UTC',
        
        // Billing Information
        hourlyRate: studentProfile.hourlyRate || student.hourlyRate || 0,
        currency: studentProfile.currency || student.currency || 'USD'
      };
    }

    return defaultData;
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [parents, setParents] = useState([]);
  const [loadingParents, setLoadingParents] = useState(true);
  const [centerSubjects, setCenterSubjects] = useState([]);

  const steps = [
    { number: 1, title: 'Personal Information' },
    { number: 2, title: 'Billing Information' },
    { number: 3, title: 'Academic Information' },
    { number: 4, title: 'Parent Link & Medical' },
    { number: 5, title: 'Availability' }
  ];

  const grades = ['Pre-K', 'Kindergarten', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
  // Simple subject list like tutor modal
  const subjects = [
    'Mathematics', 'Science', 'English', 'History', 'Geography', 'Physics', 
    'Chemistry', 'Biology', 'Computer Science', 'Art', 'Music', 'Physical Education',
    'French', 'Spanish', 'German', 'Literature', 'Economics', 'Psychology'
  ];
  const learningStyles = ['Visual', 'Auditory', 'Kinesthetic', 'Reading/Writing'];

  // Load parents when opening modal
  useEffect(() => {
    if (isOpen) {
      loadParents();
      setCurrentStep(1);
      setErrors({});
    }
  }, [isOpen]);

  // Set parent ID when student data changes
  useEffect(() => {
    if (student) {
      const parentId = student.student_profile?.parent_id || student.studentProfile?.parent_id;
      if (parentId) {
        console.log('Setting parent ID:', parentId);
        setFormData(prev => ({
          ...prev,
          parentId: parentId
        }));
      }
    }
  }, [student]);

  // Fetch center subjects when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchCenterSubjects = async () => {
        try {
          const token = localStorage.getItem('token');
          console.log('🔍 Token exists:', !!token);
          
          if (!token) {
            console.error('❌ No token found');
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
              console.warn('⚠️ No subjects in response');
            }
          } else {
            console.error('❌ Response not OK, status:', response.status);
            const errorData = await response.text();
            console.error('Error data:', errorData);
          }
        } catch (error) {
          console.error('💥 Error fetching center subjects:', error);
        }
      };
      
      fetchCenterSubjects();
    }
  }, [isOpen]);

  const loadParents = async () => {
    try {
      setLoadingParents(true);
      const response = await userAPI.getAllUsers('parent');
      console.log('Parent loading response:', response.data);
      setParents(response.data.data || []); // Fixed: backend returns data.data, not data.users
      console.log('Parents loaded:', response.data.data?.length || 0, 'parents');
    } catch (err) {
      console.error('Error loading parents:', err);
      setParents([]);
    } finally {
      setLoadingParents(false);
    }
  };

  useEffect(() => {
    if (student) {
      console.log('Loading student data:', student); // Debug log
      console.log('Student firstName:', student.firstName);
      console.log('Student first_name:', student.first_name);
      console.log('Student data:', student.data);
      
      // First get all the possible data sources
      const studentData = student.data || {};
      const studentProfile = student.studentProfile || {};
      const academicInfo = studentProfile.academicInfo || studentData || {};
      
      // Update form data when student prop changes
      setFormData(prevData => ({
        ...prevData, // Keep other default values
        // Personal Information
        firstName: student.firstName || student.first_name || studentProfile.firstName || '',
        lastName: student.lastName || student.last_name || studentProfile.lastName || '',
        email: student.email || studentProfile.email || '',
        username: student.username || '',
        password: '',  // Leave blank for editing
        phoneNumber: student.phoneNumber || student.phone_number || studentProfile.phoneNumber || '',
        dateOfBirth: student.dateOfBirth || studentProfile.dateOfBirth || '',
        
        // Address Information
        address: {
          street: student.address?.street || studentProfile.address?.street || '',
          city: student.address?.city || studentProfile.address?.city || '',
          state: student.address?.state || studentProfile.address?.state || '',
          zipCode: student.address?.zipCode || studentProfile.address?.zipCode || '',
          country: student.address?.country || studentProfile.address?.country || ''
        },
        
        // Academic Information
        grade: academicInfo.grade || student.grade || '',
        school: academicInfo.school || student.school || '',
        subjects: academicInfo.subjects || student.subjects || [],
        learningStyle: academicInfo.learningStyle || student.learningStyle || '',
        goals: academicInfo.goals || student.goals || '',
        notes: academicInfo.notes || student.notes || '',
        
        // Emergency Contact
        emergencyContact: {
          name: studentProfile.emergencyContact?.name || student.emergencyContact?.name || '',
          phone: studentProfile.emergencyContact?.phone || student.emergencyContact?.phone || '',
          relationship: studentProfile.emergencyContact?.relationship || student.emergencyContact?.relationship || '',
          email: studentProfile.emergencyContact?.email || student.emergencyContact?.email || ''
        },
        
        // Medical Information
        medicalInfo: {
          allergies: studentProfile.medicalInfo?.allergies || student.medicalInfo?.allergies || '',
          medications: studentProfile.medicalInfo?.medications || student.medicalInfo?.medications || '',
          conditions: studentProfile.medicalInfo?.conditions || student.medicalInfo?.conditions || '',
          emergencyInfo: studentProfile.medicalInfo?.emergencyInfo || student.medicalInfo?.emergencyInfo || '',
          doctorContact: studentProfile.medicalInfo?.doctorContact || student.medicalInfo?.doctorContact || ''
        },
        
        // Time Zone
        timeZone: studentProfile.timeZone || student.timeZone || 'UTC',
        
        // Billing Information
        hourlyRate: studentProfile.hourlyRate || student.hourlyRate || 0,
        currency: studentProfile.currency || student.currency || 'USD'
      }));

      // Find the parent that has this student in their children
      const findParentForStudent = () => {
        console.log('🔍 Finding parent for student:', student._id);
        console.log('🔍 Available parents:', parents.length);
        parents.forEach(parent => {
          console.log(`👨‍👩‍👧‍👦 Parent ${parent.firstName} ${parent.lastName} has children:`, parent.assignments?.children);
        });
        
        const foundParent = parents.find(parent => 
          parent.assignments?.children?.includes(student._id)
        );
        
        console.log('🎯 Found parent:', foundParent ? `${foundParent.firstName} ${foundParent.lastName}` : 'None');
        return foundParent;
      };

      const linkedParent = findParentForStudent();
      
      setFormData({
        // Personal Information
        email: student.email || '',
        username: student.username || '',
        password: '', // Never pre-fill password for security
        firstName: student.firstName || '',
        lastName: student.lastName || '',
        phoneNumber: student.phoneNumber || '',
        dateOfBirth: student.dateOfBirth || '',
        address: {
          street: student.studentProfile?.address?.street || '',
          city: student.studentProfile?.address?.city || '',
          state: student.studentProfile?.address?.state || '',
          zipCode: student.studentProfile?.address?.zipCode || '',
          country: student.studentProfile?.address?.country || ''
        },
        
        // Billing Information
        hourlyRate: student.studentProfile?.hourlyRate || 0,
        currency: student.studentProfile?.currency || 'USD',
        
        // Academic Information - read from studentProfile.academicInfo
        grade: student.studentProfile?.grade || '',
        school: student.studentProfile?.school || '',
        subjects: student.studentProfile?.academicInfo?.subjects || [],
        learningStyle: student.studentProfile?.academicInfo?.learningStyle || '',
        goals: student.studentProfile?.academicInfo?.goals || '',
        notes: student.studentProfile?.academicInfo?.notes || '',
        
        // Parent Link - find parent that has this student as child
        parentId: linkedParent?._id || '',
        emergencyContact: {
          name: student.studentProfile?.parentContact?.name || '',
          phone: student.studentProfile?.parentContact?.phone || '',
          relationship: student.studentProfile?.parentContact?.relationship || '',
          email: student.studentProfile?.parentContact?.email || ''
        },
        medicalInfo: {
          allergies: student.studentProfile?.medicalInfo?.allergies || '',
          medications: student.studentProfile?.medicalInfo?.medications || '',
          conditions: student.studentProfile?.medicalInfo?.conditions || '',
          emergencyInfo: student.studentProfile?.medicalInfo?.emergencyInfo || '',
          doctorContact: student.studentProfile?.medicalInfo?.doctorContact || ''
        },
        
        // Availability - read from studentProfile.availability and convert format
        availability: student.studentProfile?.availability ? 
          Object.fromEntries(
            Object.entries(student.studentProfile.availability).map(([day, dayData]) => [
              day,
              {
                available: dayData.available || false,
                timeSlots: (dayData.timeSlots || []).map(slot => ({
                  start: slot.startTime || '',
                  end: slot.endTime || ''
                }))
              }
            ])
          ) : {
          monday: { available: false, timeSlots: [] },
          tuesday: { available: false, timeSlots: [] },
          wednesday: { available: false, timeSlots: [] },
          thursday: { available: false, timeSlots: [] },
          friday: { available: false, timeSlots: [] },
          saturday: { available: false, timeSlots: [] },
          sunday: { available: false, timeSlots: [] }
        },

        // Time zone - default to UTC if not provided
        timeZone: student.studentProfile?.timeZone || 'UTC'
      });
    } else {
      // Reset form for new student
      setFormData({
        email: '',
        username: '',
        password: '',
        firstName: '',
        lastName: '',
        phoneNumber: '',
        dateOfBirth: '',
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: ''
        },
        grade: '',
        school: '',
        subjects: [],
        learningStyle: '',
        goals: '',
        notes: '',
        parentId: '',
        emergencyContact: {
          name: '',
          phone: '',
          relationship: '',
          email: ''
        },
        medicalInfo: {
          allergies: '',
          medications: '',
          conditions: '',
          emergencyInfo: '',
          doctorContact: ''
        },
        availability: {
          monday: { available: false, timeSlots: [] },
          tuesday: { available: false, timeSlots: [] },
          wednesday: { available: false, timeSlots: [] },
          thursday: { available: false, timeSlots: [] },
          friday: { available: false, timeSlots: [] },
          saturday: { available: false, timeSlots: [] },
          sunday: { available: false, timeSlots: [] }
        },
        timeZone: ''
      });
    }
  }, [student, parents]); // Added parents dependency so it updates when parents load

  const handleInputChange = (e, directValue = null) => {
    let name, value, type, checked;
    
    // Handle direct field name and value (for custom inputs like hourlyRate)
    if (typeof e === 'string' && directValue !== null) {
      name = e;
      value = directValue;
      type = 'text';
      checked = false;
    } else {
      // Handle standard event object
      if (!e || !e.target) {
        console.error('Invalid event object passed to handleInputChange:', e);
        return;
      }
      ({ name, value, type, checked } = e.target);
    }

    console.log('Input change:', { name, value, type }); // Debug log
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => {
        const newData = {
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: type === 'checkbox' ? checked : value
          }
        };
        console.log('Updated form data (nested):', newData); // Debug log
        return newData;
      });
    } else {
      let processedValue = type === 'checkbox' ? checked : value;
      
      // Special handling for numeric fields
      if (name === 'hourlyRate' && type === 'number') {
        // Keep the raw value for display, but ensure it's a valid number or empty
        if (value === '' || value === null || value === undefined) {
          processedValue = '';
        } else {
          const numValue = parseFloat(value);
          processedValue = isNaN(numValue) ? '' : numValue;
        }
      }
      
      setFormData(prev => {
        const newData = {
          ...prev,
          [name]: processedValue
        };
        console.log('Updated form data:', newData); // Debug log
        return newData;
      });
    }
    
    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubjectChange = (subject) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject]
    }));
  };

  const handleAvailabilityChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          [field]: value
        }
      }
    }));
  };

  const addTimeSlot = (day) => {
    setFormData(prev => {
      const newTimeSlots = [...(prev.availability[day].timeSlots || []), { startTime: '', endTime: '' }];
      const newTimeSlotsZones = newTimeSlots.map(slot => ({
        startTimeUTC: slot.startTime ? convertTimeZoneToUTC(slot.startTime, prev.timeZone || 'UTC') : '',
        endTimeUTC: slot.endTime ? convertTimeZoneToUTC(slot.endTime, prev.timeZone || 'UTC') : ''
      }));
      return {
        ...prev,
        availability: {
          ...prev.availability,
          [day]: {
            ...prev.availability[day],
            timeSlots: newTimeSlots,
            timeSlotsZones: newTimeSlotsZones
          }
        }
      };
    });
  };

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

  const updateTimeSlot = (day, index, field, value) => {
    setFormData(prev => {
      const newTimeSlots = (prev.availability[day].timeSlots || []).map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      );
      const newTimeSlotsZones = newTimeSlots.map(slot => ({
        startTimeUTC: slot.startTime ? convertTimeZoneToUTC(slot.startTime, prev.timeZone || 'UTC') : '',
        endTimeUTC: slot.endTime ? convertTimeZoneToUTC(slot.endTime, prev.timeZone || 'UTC') : ''
      }));
      return {
        ...prev,
        availability: {
          ...prev.availability,
          [day]: {
            ...prev.availability[day],
            timeSlots: newTimeSlots,
            timeSlotsZones: newTimeSlotsZones
          }
        }
      };
    });
  };

  const validateStep = (step) => {
    const newErrors = {};
    
    switch (step) {
      case 1:
        // Personal Information validation
        if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
        if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
        if (!formData.email.trim()) newErrors.email = 'Email is required';
        if (!formData.username.trim()) newErrors.username = 'Username is required';
        if (!student && !formData.password) newErrors.password = 'Password is required for new students';
        
        if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
          newErrors.email = 'Please enter a valid email address';
        }
        break;
        
      case 2:
        // Billing Information validation
        const hourlyRateNum = parseFloat(formData.hourlyRate);
        if (formData.hourlyRate !== '' && (isNaN(hourlyRateNum) || hourlyRateNum < 0)) {
          newErrors.hourlyRate = 'Hourly rate must be a valid positive number';
        }
        if (!formData.currency) newErrors.currency = 'Currency is required';
        break;
        
      case 3:
        // Academic Information validation
        if (!formData.grade) newErrors.grade = 'Grade is required';
        if (!formData.school.trim()) newErrors.school = 'School is required';
        if (formData.subjects.length === 0) newErrors.subjects = 'At least one subject is required';
        break;
        
      case 4:
        // Parent Link validation
        const selectedParent = parents[0];  // When editing, there will be only one parent loaded
        if (!selectedParent && !formData.parentId) {
          newErrors.parentId = 'Parent selection is required';
        }
        break;
        
      case 5:
        // Availability validation - at least one day should be available
        const hasAvailability = Object.values(formData.availability).some(day => day.available);
        if (!hasAvailability) {
          newErrors.availability = 'At least one day of availability is required';
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const prepareAvailabilityForSave = (availability, timeZone) => {
    const result = {};
    Object.entries(availability).forEach(([day, data]) => {
      result[day] = {
        ...data,
        timeSlotsZones: data.timeSlots.map(slot => ({
          startTimeUTC: convertTimeZoneToUTC(slot.startTime, timeZone),
          endTimeUTC: convertTimeZoneToUTC(slot.endTime, timeZone)
        }))
      };
    });
    return result;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('Form submission - Current form data:', formData); // Debug log
    
    if (!validateStep(currentStep)) {
      console.log('Current step validation failed:', currentStep);
      return;
    }
    
    // Validate all steps
    let allValid = true;
    for (let i = 1; i <= steps.length; i++) {
      if (!validateStep(i)) {
        console.log('Step validation failed:', i);
        allValid = false;
        break;
      }
    }
    
    if (!allValid) {
      alert('Please fill in all required fields correctly.');
      return;
    }

    setLoading(true);
    console.log('Starting submission with data:', formData); // Debug log

    try {
      // Ensure all required fields are present
      if (!formData.firstName?.trim()) {
        alert('First name is required');
        return;
      }
      if (!formData.lastName?.trim()) {
        alert('Last name is required');
        return;
      }
      if (!formData.email?.trim()) {
        alert('Email is required');
        return;
      }
      if (!formData.username?.trim()) {
        alert('Username is required');
        return;
      }
      if (!student && !formData.password?.trim()) {
        alert('Password is required for new students');
        return;
      }

      const studentData = {
        // Basic user info
        email: formData.email.trim(),
        username: formData.username.trim(),
        password: formData.password?.trim() || '',
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone_number: formData.phoneNumber?.trim() || '', // Changed to phone_number to match database column
        phone: formData.phoneNumber?.trim() || '', // Adding both formats to ensure compatibility
        phoneNumber: formData.phoneNumber?.trim() || '', // Keep this for backwards compatibility
        dateOfBirth: formData.dateOfBirth || '',
        role: 'student',
        isActive: formData.isActive !== false, // Add isActive status
        // Academic info
        grade: formData.grade || '',
        school: formData.school?.trim() || '',
        subjects: formData.subjects || [],
        preferredSubjects: formData.subjects || [],
        strugglingSubjects: [],
        learningStyle: formData.learningStyle || 'Mixed',
        goals: formData.goals?.trim() || '',
        notes: formData.notes?.trim() || '',
        ...(formData.parentId ? { parentId: formData.parentId } : {}),
        parentContact: {
          name: formData.emergencyContact?.name?.trim() || '',
          phone: formData.emergencyContact?.phone?.trim() || '',
          email: formData.emergencyContact?.email?.trim() || ''
        },
        medicalInfo: formData.medicalInfo || {},
        address: formData.address || {},
        // Billing Information
        hourlyRate: formData.hourlyRate === '' ? 0 : parseFloat(formData.hourlyRate) || 0,
        currency: formData.currency || 'USD',
        // Availability - ensure correct format for backend
        availability: Object.fromEntries(
          Object.entries(formData.availability).map(([day, dayData]) => [
            day,
            {
              available: dayData.available || false,
              timeSlots: (dayData.timeSlots || []).filter(slot => slot.startTime && slot.endTime).map(slot => ({
                startTime: slot.startTime,
                endTime: slot.endTime
              }))
            }
          ])
        ),
        // timeZone: formData.timeZone
        timeZone: formData.timeZone && TIME_ZONES.includes(formData.timeZone) 
    ? formData.timeZone 
    : 'UTC'
      };

      // Availability - ensure correct format for backend
      const preparedAvailability = prepareAvailabilityForSave(formData.availability, formData.timeZone);
      studentData.availability = preparedAvailability;

      console.log('=== SENDING STUDENT DATA ===');
      console.log('Student data:', JSON.stringify(studentData, null, 2));
      console.log('Required fields check:');
      console.log('- email:', studentData.email);
      console.log('- username:', studentData.username);
      console.log('- password:', studentData.password);
      console.log('- firstName:', studentData.firstName);
      console.log('- lastName:', studentData.lastName);
      console.log('- role:', studentData.role);
      console.log('- hourlyRate:', studentData.hourlyRate);
      console.log('- currency:', studentData.currency);

      // Debug log before saving
      console.log('Saving student data:', {
        ...studentData,
        phone_number: studentData.phone_number,
        phoneNumber: studentData.phoneNumber,
        phone: studentData.phone
      });

      await onSave(studentData);
      
    } catch (error) {
      console.error('Error saving student:', error);
      
      // Parse validation errors if they exist
      let errorMessage = error.message || 'Network or server error';
      
      // Show detailed error message
      alert(`Error saving student: ${errorMessage}`);
      
      // Don't retry for validation errors, let user fix them
      if (!errorMessage.includes('Validation failed')) {
        const shouldRetry = window.confirm(
          `${errorMessage}\n\nWould you like to try again?`
        );
        
        if (shouldRetry) {
          // Retry the submission
          return handleSubmit(e);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const getSelectedParent = () => {
    return parents.find(parent => parent._id === formData.parentId);
  };

  if (!isOpen) return null;

  const selectedParent = getSelectedParent();

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.headerContent}>
            <h2>{student ? 'Edit Student' : 'Add New Student'}</h2>
            {/* Step Indicator in header */}
            <div className={styles.stepIndicator}>
              {steps.map((step) => (
                <div
                  key={step.number}
                  className={`${styles.step} ${
                    currentStep === step.number ? styles.active : ''
                  } ${currentStep > step.number ? styles.completed : ''}`}
                >
                  <div className={styles.stepNumber}>
                    {currentStep > step.number ? '✓' : step.number}
                  </div>
                  <span className={styles.stepTitle}>{step.title}</span>
                </div>
              ))}
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose} type="button">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.modalBody}>
          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <div className={styles.stepContent}>
              <h3>👤 Personal Information</h3>
              
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="firstName">First Name *</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName || ''}
                    onChange={handleInputChange}
                    className={errors.firstName ? styles.error : ''}
                    required
                  />
                  {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="lastName">Last Name *</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName || ''}
                    onChange={handleInputChange}
                    className={errors.lastName ? styles.error : ''}
                    required
                  />
                  {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={errors.email ? styles.error : ''}
                    required
                  />
                  {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="username">Username *</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className={errors.username ? styles.error : ''}
                    required
                  />
                  {errors.username && <span className={styles.errorText}>{errors.username}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="password">
                    Password {!student && '*'}
                    {student && <small> (leave empty to keep current)</small>}
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={errors.password ? styles.error : ''}
                    required={!student}
                  />
                  {errors.password && <span className={styles.errorText}>{errors.password}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="phoneNumber">Phone Number</label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    name="phoneNumber"
                    value={formData.phoneNumber || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      console.log('Phone number input:', value); // Debug log
                      handleInputChange({
                        target: {
                          name: 'phoneNumber',
                          value: value,
                          type: 'tel'
                        }
                      });
                    }}
                    placeholder="Enter phone number"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="dateOfBirth">Date of Birth</label>
                  <input
                    type="date"
                    id="dateOfBirth"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                  />
                </div>

                {student && (
                  <div className={styles.formGroup}>
                    <label htmlFor="isActive">
                      <input
                        type="checkbox"
                        id="isActive"
                        name="isActive"
                        checked={formData.isActive !== false}
                        onChange={handleInputChange}
                        style={{ marginRight: '8px' }}
                      />
                      Active Status
                    </label>
                  </div>
                )}
              </div>

              <h4>📍 Address</h4>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="address.street">Street</label>
                  <input
                    type="text"
                    id="address.street"
                    name="address.street"
                    value={formData.address.street}
                    onChange={handleInputChange}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="address.city">City</label>
                  <input
                    type="text"
                    id="address.city"
                    name="address.city"
                    value={formData.address.city}
                    onChange={handleInputChange}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="address.state">State</label>
                  <input
                    type="text"
                    id="address.state"
                    name="address.state"
                    value={formData.address.state}
                    onChange={handleInputChange}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="address.zipCode">ZIP Code</label>
                  <input
                    type="text"
                    id="address.zipCode"
                    name="address.zipCode"
                    value={formData.address.zipCode}
                    onChange={handleInputChange}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="address.country">Country</label>
                  <input
                    type="text"
                    id="address.country"
                    name="address.country"
                    value={formData.address.country}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Time Zone *</label>
                <select
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
            </div>
          )}

          {/* Step 2: Billing Information */}
          {currentStep === 2 && (
            <div className={styles.stepContent}>
              <h3>💰 Billing Information</h3>
              
              <div className={styles.formGrid}>
                {/* Hourly Rate and Currency */}
                <div className="row">
                  <div className="col-md-8">
                    <div className={styles.formGroup}>
                      <label htmlFor="hourlyRate">Hourly Rate</label>
                      <input
                        type="number"
                        id="hourlyRate"
                        name="hourlyRate"
                        className={styles.formControl}
                        min="0"
                        step="0.01"
                        value={formData.hourlyRate || ''}
                        onChange={handleInputChange}
                        placeholder="0.00"
                      />
                      {errors.hourlyRate && <span className={styles.errorText}>{errors.hourlyRate}</span>}
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className={styles.formGroup}>
                      <label htmlFor="currency">Currency *</label>
                      <select
                        id="currency"
                        name="currency"
                        className={styles.formControl}
                        value={formData.currency || 'USD'}
                        onChange={handleInputChange}
                        required
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
                      {errors.currency && <span className={styles.errorText}>{errors.currency}</span>}
                    </div>
                  </div>
                </div>
                
                <div className={styles.formGroup}>
                  <p className="text-muted">
                    <small>
                      💡 <strong>Billing Information:</strong> The hourly rate will be used for calculating session costs and generating invoices. 
                      This rate can be adjusted later if needed. Currency selection affects all billing calculations for this student.
                    </small>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Academic Information */}
          {currentStep === 3 && (
            <div className={styles.stepContent}>
              <h3>📚 Academic Information</h3>
              
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="grade">Grade *</label>
                  <select
                    id="grade"
                    name="grade"
                    value={formData.grade}
                    onChange={handleInputChange}
                    className={errors.grade ? styles.error : ''}
                    required
                  >
                    <option value="">Select Grade</option>
                    {grades.map(grade => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                  {errors.grade && <span className={styles.errorText}>{errors.grade}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="school">School *</label>
                  <input
                    type="text"
                    id="school"
                    name="school"
                    value={formData.school}
                    onChange={handleInputChange}
                    className={errors.school ? styles.error : ''}
                    required
                  />
                  {errors.school && <span className={styles.errorText}>{errors.school}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="learningStyle">Learning Style</label>
                  <select
                    id="learningStyle"
                    name="learningStyle"
                    value={formData.learningStyle}
                    onChange={handleInputChange}
                  >
                    <option value="">Select Learning Style</option>
                    {learningStyles.map(style => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Subjects of Interest * (select multiple)</label>
                {errors.subjects && <span className={styles.errorText}>{errors.subjects}</span>}
                <div className={styles.subjectGrid}>
                  {(centerSubjects.length > 0 ? centerSubjects : subjects).map(subject => (
                    <label key={subject} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={formData.subjects.includes(subject)}
                        onChange={() => handleSubjectChange(subject)}
                      />
                      {subject}
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="goals">Learning Goals</label>
                  <textarea
                    id="goals"
                    name="goals"
                    value={formData.goals}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="What does the student hope to achieve?"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="notes">Additional Notes</label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="Any additional information about the student"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Parent Link & Medical */}
          {currentStep === 4 && (
            <div className={styles.stepContent}>
              <h3>👨‍👩‍👧‍👦 Parent Assignment</h3>
              
              {loadingParents ? (
                <div className={styles.loadingMessage}>Loading parents...</div>
              ) : (
                <>
                  <div className={styles.formGroup}>
                    <label htmlFor="parentId">Select Parent *</label>
                    <select
                      id="parentId"
                      name="parentId"
                      value={formData.parentId || ''}
                      onChange={handleInputChange}
                      className={errors.parentId ? styles.error : ''}
                      required
                    >
                      {!student && <option value="">Choose a parent...</option>}
                      {parents.map(parent => (
                        <option 
                          key={parent._id || parent.id} 
                          value={parent._id || parent.id}
                          selected={parent._id === formData.parentId || parent.id === formData.parentId}
                        >
                          {parent.first_name || parent.firstName} {parent.last_name || parent.lastName} ({parent.email})
                        </option>
                      ))}
                    </select>
                    {errors.parentId && <span className={styles.errorText}>{errors.parentId}</span>}
                    
                    {parents.length === 0 && (
                      <div className={styles.infoMessage}>
                        <strong>No parents found.</strong> Please create parent accounts in the Parents tab first.
                      </div>
                    )}
                  </div>

                  {selectedParent && (
                    <div className={styles.parentPreview}>
                      <h4>👤 Selected Parent Information</h4>
                      <div className={styles.parentDetails}>
                        <p><strong>Name:</strong> {selectedParent.fullName || `${selectedParent.firstName} ${selectedParent.lastName}`}</p>
                        <p><strong>Email:</strong> {selectedParent.email}</p>
                        <p><strong>Phone:</strong> {selectedParent.phoneNumber || 'Not provided'}</p>
                        <p><strong>Username:</strong> {selectedParent.username}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              <h4>🚨 Emergency Contact</h4>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="emergencyContact.name">Emergency Contact Name</label>
                  <input
                    type="text"
                    id="emergencyContact.name"
                    name="emergencyContact.name"
                    value={formData.emergencyContact.name}
                    onChange={handleInputChange}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="emergencyContact.phone">Emergency Phone</label>
                  <input
                    type="tel"
                    id="emergencyContact.phone"
                    name="emergencyContact.phone"
                    value={formData.emergencyContact.phone}
                    onChange={handleInputChange}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="emergencyContact.relationship">Relationship</label>
                  <select
                    id="emergencyContact.relationship"
                    name="emergencyContact.relationship"
                    value={formData.emergencyContact.relationship}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select relationship</option>
                    <option value="Mother">Mother</option>
                    <option value="Father">Father</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Grandparent">Grandparent</option>
                    <option value="Aunt">Aunt</option>
                    <option value="Uncle">Uncle</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="emergencyContact.email">Emergency Email</label>
                  <input
                    type="email"
                    id="emergencyContact.email"
                    name="emergencyContact.email"
                    value={formData.emergencyContact.email}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <h4>🏥 Medical Information</h4>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="medicalInfo.allergies">Allergies</label>
                  <textarea
                    id="medicalInfo.allergies"
                    name="medicalInfo.allergies"
                    value={formData.medicalInfo.allergies}
                    onChange={handleInputChange}
                    rows="2"
                    placeholder="List any known allergies"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="medicalInfo.medications">Current Medications</label>
                  <textarea
                    id="medicalInfo.medications"
                    name="medicalInfo.medications"
                    value={formData.medicalInfo.medications}
                    onChange={handleInputChange}
                    rows="2"
                    placeholder="List current medications"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="medicalInfo.conditions">Medical Conditions</label>
                  <textarea
                    id="medicalInfo.conditions"
                    name="medicalInfo.conditions"
                    value={formData.medicalInfo.conditions}
                    onChange={handleInputChange}
                    rows="2"
                    placeholder="Any medical conditions to be aware of"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="medicalInfo.doctorContact">Doctor Contact</label>
                  <input
                    type="text"
                    id="medicalInfo.doctorContact"
                    name="medicalInfo.doctorContact"
                    value={formData.medicalInfo.doctorContact}
                    onChange={handleInputChange}
                    placeholder="Primary doctor name and phone"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Availability */}
          {currentStep === 5 && (
            <div className={styles.stepContent}>
              <h3>📅 Availability Schedule</h3>
              {errors.availability && <div className={styles.errorText}>{errors.availability}</div>}
              
              <div className={styles.availabilitySection}>
                {Object.entries(formData.availability).map(([day, dayData]) => (
                  <div key={day} className={styles.dayAvailability}>
                    <div className={styles.dayHeader}>
                      <label className={styles.dayLabel}>
                        <input
                          type="checkbox"
                          checked={dayData.available}
                          onChange={(e) => handleAvailabilityChange(day, 'available', e.target.checked)}
                        />
                        <span className={styles.dayName}>
                          {day.charAt(0).toUpperCase() + day.slice(1)}
                        </span>
                      </label>
                    </div>
                    {dayData.available && (
                      <div className={styles.timeSlots}>
                        {/* Show input fields for each slot */}
                        {dayData.timeSlots && dayData.timeSlots.length > 0
                          ? dayData.timeSlots.map((slot, idx) => (
                              <div key={idx} className={styles.timeSlotInputs}>
                                <label>Start Time</label>
                                <input
                                  type="time"
                                  value={slot.startTime || ''}
                                  onChange={e => updateTimeSlot(day, idx, 'startTime', e.target.value)}
                                />
                                <label>End Time</label>
                                <input
                                  type="time"
                                  value={slot.endTime || ''}
                                  onChange={e => updateTimeSlot(day, idx, 'endTime', e.target.value)}
                                />
                                <button
                                  type="button"
                                  className={`btn btn-sm btn-danger ${styles.removeSlotBtn}`}
                                  onClick={() => removeTimeSlot(day, idx)}
                                  title="Remove time slot"
                                >
                                  ×
                                </button>
                              </div>
                            ))
                          : null
                        }
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
          )}
          </div>

          {/* Navigation */}
          <div className={styles.modalFooter}>
            <div className={styles.navigationButtons}>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className={styles.prevButton}
                  disabled={loading}
                >
                  ← Previous
                </button>
              )}
              
              {currentStep < steps.length ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className={styles.nextButton}
                  disabled={loading}
                >
                  Next →
                </button>
              ) : (
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={loading}
                >
                  {loading ? (
                    <span>
                      <span className={styles.spinner}></span>
                      {student ? 'Updating...' : 'Creating...'}
                    </span>
                  ) : (
                    student ? 'Update Student' : 'Create Student'
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default StudentModalRefactored;
