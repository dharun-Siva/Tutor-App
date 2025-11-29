import TutorBillingDashboard from './components/TutorBillingDashboard';
import React, { useState, useEffect, useRef } from 'react';
import Header from '../../shared/components/Header';
import StatsCard from '../../shared/components/StatsCard';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import UserManagement from './components/UserManagement';
import TutorManagement from './components/TutorManagement';
import StudentManagement from './components/StudentManagement';
import ParentManagement from './components/ParentManagement';
import ScheduleClassesTab from './components/ScheduleClassesTab';
import CenterInfo from './components/CenterInfo';
import BillingReport from '../../components/BillingReport';
import AdminBillingDashboard from './components/AdminBillingDashboard';
import StudentBillingDashboard from './components/StudentBillingDashboard';
import SessionsTab from './components/SessionsTab';
import SubjectManagement from './components/SubjectManagement';
import MessageManagement from './components/MessageManagement';
import SessionParticipantsTab from './components/SessionParticipantsTab';
import { dashboardAPI, tutorsAPI, usersAPI, studentsAPI } from '../../utils/api';
import { getErrorMessage, getStoredUser } from '../../utils/helpers';
import styles from './Dashboard.module.css';

const AdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeSubTab, setActiveSubTab] = useState('scheduling');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [uploadType, setUploadType] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  const fileInputRef = useRef(null);
  const initialLoadDone = useRef(false);
  
  const user = getStoredUser();

  useEffect(() => {
    // Prevent running twice in Strict Mode
    if (initialLoadDone.current) {
      return;
    }
    initialLoadDone.current = true;
    
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      console.log('Loading admin dashboard data...');
      const response = await dashboardAPI.getAdminData();
      console.log('Dashboard data received:', response.data);
      setDashboardData(response.data);
      setError(null);
    } catch (err) {
      console.error('Dashboard loading error:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  // Function to escape CSV fields
  const escapeCsvField = (field) => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
  };

  const handleDownloadSampleCsv = () => {
    const headers = [
      'First Name *', 'Last Name *', 'Email Address *', 'Username *', 'Password *', 'Phone Number', 'Date of Birth (DD-MM-YYYY)', 'Street Address', 'City', 'State', 'ZIP Code', 'Time Zone *',
      'CV File Path', 'Years of Experience',
      'Education1_Degree *', 'Education1_Institution *', 'Education1_Year', 'Education1_Field of Study',
      'Education2_Degree', 'Education2_Institution', 'Education2_Year', 'Education2_Field of Study',
      'Education3_Degree', 'Education3_Institution', 'Education3_Year', 'Education3_Field of Study',
      'Certification1_Name', 'Certification1_Issued By', 'Certification1_Issue Date (DD-MM-YYYY)', 'Certification1_Expiry Date (DD-MM-YYYY)', 'Certification1_Credential ID',
      'Certification2_Name', 'Certification2_Issued By', 'Certification2_Issue Date (DD-MM-YYYY)', 'Certification2_Expiry Date (DD-MM-YYYY)', 'Certification2_Credential ID',
      'Certification3_Name', 'Certification3_Issued By', 'Certification3_Issue Date (DD-MM-YYYY)', 'Certification3_Expiry Date (DD-MM-YYYY)', 'Certification3_Credential ID',
      'Subjects to Teach *', 'Languages Spoken', 'Hourly Rate', 'Currency', 'Bio',
      'Monday Available', 'Tuesday Available', 'Wednesday Available', 'Thursday Available', 'Friday Available', 'Saturday Available', 'Sunday Available'
    ];
    const sampleRow = [
      'John', 'Doe', 'john.doe@example.com', 'johndoe', 'Abc@12345', '123-456-7890', '01-01-1990', '123 Main St', 'Anytown', 'CA', '12345', 'UTC',
      '', '5',
      'Bachelor of Science', 'Harvard University', '2020', 'Mathematics',
      '', '', '', '',
      '', '', '', '',
      '', '', '', '', '',
      '', '', '', '', '',
      '', '', '', '', '',
      'Mathematics, Science', 'English, Spanish', '50', 'USD', 'Experienced tutor with passion for teaching',
      'Yes', 'No', 'Yes', 'No', 'No', 'No', 'No'
    ];

    const csvContent = [headers.map(escapeCsvField).join(','), sampleRow.map(escapeCsvField).join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'tutor_sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSampleCsvForStudents = () => {
    const headers = [
      'Parent First Name *', 'Parent Last Name *', 'Parent Email *', 'Parent Password *', 'Parent Phone', 'Parent Address', 'Parent Username',
      'Student First Name *', 'Student Last Name *', 'Student Email *', 'Student Username *', 'Student Password *', 'Student Phone Number', 'Student Date of Birth (DD-MM-YYYY) *', 'Student Time Zone *',
      'Student Hourly Rate', 'Student Currency *', 'Student Grade * (e.g., 10th, Grade 10)', 'Student School *', 'Student Subjects of Interest *',
      'Student Street', 'Student City', 'Student State', 'Student ZIP Code', 'Student Country',
      'Student Learning Style', 'Student Learning Goals', 'Student Additional Notes',
      'Student Emergency Contact Name', 'Student Emergency Phone', 'Student Relationship', 'Student Emergency Email',
      'Student Allergies', 'Student Current Medications', 'Student Medical Conditions', 'Student Doctor Contact',
      'Student Monday Available', 'Student Tuesday Available', 'Student Wednesday Available', 'Student Thursday Available', 'Student Friday Available', 'Student Saturday Available', 'Student Sunday Available'
    ];
    const sampleRow = [
      'John', 'Doe', 'john.doe@example.com', 'Abc@12345', '123-456-7890', '123 Main St, Anytown, CA 12345', 'johndoe',
      'Jane', 'Doe', 'jane.doe@example.com', 'janedoe', 'Abc@12345', '123-456-7891', '01-01-2010', 'UTC',
      '50', 'USD', '10th', 'Anytown High School', 'Mathematics, Science',
      '123 Main St', 'Anytown', 'CA', '12345', 'US',
      'Visual', 'Improve math skills', 'Good student',
      'Emergency Contact', '123-456-7892', 'Grandparent', 'emergency@example.com',
      'None', 'None', 'None', 'Dr. Smith, 123-456-7893',
      'Yes', 'No', 'Yes', 'No', 'No', 'No', 'No'
    ];

    const csvContent = [headers.map(escapeCsvField).join(','), sampleRow.map(escapeCsvField).join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'student_sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleClearUpload = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Helper function to parse CSV line handling quotes
  const parseCsvLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  // Validate CSV data
  const validateCsvData = (data, uploadType, headers) => {
    const errors = [];
    let requiredFields = [];
    let emailFields = [];
    let passwordFields = [];
    let dateFields = [];
    let subjectsFields = [];
    let gradeFields = [];

    // Helper function to find header that starts with the expected field
    const findHeader = (expectedField) => {
      return headers.find(header => header.startsWith(expectedField));
    };

    if (uploadType === 'tutor') {
      requiredFields = [
        'First Name *', 'Last Name *', 'Email Address *', 'Username *', 'Password *', 'Date of Birth (DD-MM-YYYY)', 'Subjects to Teach *'
      ];
      emailFields = ['Email Address *'];
      passwordFields = ['Password *'];
      dateFields = ['Date of Birth (DD-MM-YYYY)'];
      subjectsFields = ['Subjects to Teach *'];
    } else if (uploadType === 'student') {
      requiredFields = [
        'Parent First Name *', 'Parent Last Name *', 'Parent Email *', 'Parent Password *',
        'Student First Name *', 'Student Last Name *', 'Student Email *', 'Student Username *', 'Student Password *', 'Student Date of Birth (DD-MM-YYYY) *', 'Student Time Zone *', 'Student Currency *', 'Student Grade *', 'Student School *', 'Student Subjects of Interest *'
      ];
      emailFields = ['Parent Email *', 'Student Email *'];
      passwordFields = ['Parent Password *', 'Student Password *'];
      dateFields = ['Student Date of Birth (DD-MM-YYYY) *'];
      subjectsFields = ['Student Subjects of Interest *'];
      gradeFields = ['Student Grade *'];
    }

    data.forEach((row, index) => {
      const rowErrors = [];

      // Check required fields
      requiredFields.forEach(field => {
        const actualHeader = findHeader(field);
        if (actualHeader && (!row[actualHeader] || row[actualHeader].trim() === '')) {
          rowErrors.push(`${field} is required`);
        }
      });

      // Validate email format
      emailFields.forEach(field => {
        const actualHeader = findHeader(field);
        if (actualHeader && row[actualHeader] && row[actualHeader].trim() && !row[actualHeader].includes('@')) {
          rowErrors.push(`Please enter a valid email address for ${field}.`);
        }
      });

      // Validate password regex
      passwordFields.forEach(field => {
        const actualHeader = findHeader(field);
        if (actualHeader && row[actualHeader] && row[actualHeader].trim()) {
          const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
          if (!passwordRegex.test(row[actualHeader].trim())) {
            rowErrors.push(`${field} must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)`);
          }
        }
      });

      // Validate date format
      dateFields.forEach(field => {
        const actualHeader = findHeader(field);
        if (actualHeader && row[actualHeader] && row[actualHeader].trim() && !/^\d{2}-\d{2}-\d{4}$/.test(row[actualHeader])) {
          rowErrors.push(`${field} must be in DD-MM-YYYY format`);
        }
      });

      // Validate subjects
      subjectsFields.forEach(field => {
        const actualHeader = findHeader(field);
        if (actualHeader && row[actualHeader] && row[actualHeader].split(',').length === 0) {
          rowErrors.push(`At least one subject is required for ${field}`);
        }
      });

      // Validate grade format for students
      gradeFields.forEach(field => {
        const actualHeader = findHeader(field);
        if (actualHeader && row[actualHeader] && row[actualHeader].trim()) {
          const grade = row[actualHeader].trim();
          const validGrades = ['Pre-K', 'Kindergarten', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', 'College', 'Graduate'];
          
          // Check if it's already in correct format
          if (!validGrades.includes(grade)) {
            // Check if it's "Grade X" format
            const gradeMatch = grade.match(/^Grade\s+(\d+)$/i);
            if (gradeMatch) {
              const num = parseInt(gradeMatch[1]);
              if (num < 1 || num > 12) {
                rowErrors.push(`${field} must be a valid grade (Grade 1-12, or use: ${validGrades.join(', ')})`);
              }
            } else {
              // Check if it's plain number
              const numMatch = grade.match(/^(\d+)$/);
              if (numMatch) {
                const num = parseInt(numMatch[1]);
                if (num < 1 || num > 12) {
                  rowErrors.push(`${field} must be a valid grade (1-12, or use: ${validGrades.join(', ')})`);
                }
              } else {
                rowErrors.push(`${field} must be a valid grade. Use format like "10th" or "Grade 10", or one of: ${validGrades.join(', ')}`);
              }
            }
          }
        }
      });

      if (rowErrors.length > 0) {
        errors.push({ rowIndex: index, errors: rowErrors });
      }
    });

    return errors;
  };

  // Create error CSV with validation error column
  const createErrorCsv = (headers, data, validationErrors) => {
    // Always use the order from the uploaded CSV headers
    const errorHeaders = [...headers, 'Validation Errors'];
    console.log('Creating error CSV with:', { headers, data, validationErrors });
    const errorRows = data.map((row, index) => {
      const rowValues = headers.map(header => row[header] || '');
      
      // Find all errors for this row
      const rowErrors = validationErrors.filter(e => e.rowIndex === index);
      let errorMessage = '';
      
      if (rowErrors.length > 0) {
        // Combine all error messages for this row
        errorMessage = rowErrors
          .map(error => {
            if (Array.isArray(error.errors)) {
              return error.errors.join('; ');
            } else if (typeof error.errors === 'string') {
              return error.errors;
            } else if (typeof error.errors === 'object') {
              return Object.entries(error.errors)
                .map(([field, msg]) => `${field}: ${msg}`)
                .join('; ');
            }
            return '';
          })
          .filter(msg => msg) // Remove empty messages
          .join(' | ');
      }
      
      return [...rowValues, errorMessage];
    });

    const csvContent = [errorHeaders.map(escapeCsvField).join(','), ...errorRows.map(row => row.map(escapeCsvField).join(','))].join('\n');
    return csvContent;
  };

  // Download CSV
  const downloadCsv = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Transform CSV row to PostgreSQL tutor format
  const transformCsvRowToTutorData = (row) => {
    // Helper function to convert DD-MM-YYYY to YYYY-MM-DD
    const convertDateFormat = (dateStr) => {
      if (!dateStr || dateStr.trim() === '') {
        console.log('Empty date field');
        return null;
      }
      
      // Check if already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
        console.log('Date already in YYYY-MM-DD format:', dateStr);
        return dateStr.trim();
      }
      
      // Convert from DD-MM-YYYY format
      if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr.trim())) {
        const [day, month, year] = dateStr.trim().split('-');
        const converted = `${year}-${month}-${day}`;
        console.log('Converted date:', dateStr, 'to', converted);
        return converted;
      }
      
      console.log('Invalid date format:', dateStr);
      return null;
    };

    // Format phone number
    const formatPhoneNumber = (phone) => {
      if (!phone) return null;
      // Remove all non-digit characters
      let phoneNumber = phone.replace(/\D/g, '');
      // If 10 digits, assume US and add +1
      if (phoneNumber.length === 10) {
        phoneNumber = '+1' + phoneNumber;
      } else if (!phoneNumber.startsWith('+')) {
        // If not starting with +, add +
        phoneNumber = '+' + phoneNumber;
      }
      return phoneNumber;
    };

    // Format education array
    const formatEducation = () => {
      const education = [];
      for (let i = 1; i <= 3; i++) {
        const degree = row[`Education${i}_Degree`];
        const institution = row[`Education${i}_Institution`];
        const year = row[`Education${i}_Year`];
        const fieldOfStudy = row[`Education${i}_Field of Study`];
        
        if (degree || institution) {
          education.push({
            degree: degree || '',
            institution: institution || '',
            year: year ? parseInt(year) : null,
            fieldOfStudy: fieldOfStudy || ''
          });
        }
      }
      return education;
    };

    // Format certifications array
    const formatCertifications = () => {
      const certifications = [];
      for (let i = 1; i <= 3; i++) {
        const name = row[`Certification${i}_Name`];
        const issuedBy = row[`Certification${i}_Issued By`];
        const issueDate = row[`Certification${i}_Issue Date (DD-MM-YYYY)`];
        const expiryDate = row[`Certification${i}_Expiry Date (DD-MM-YYYY)`];
        const credentialId = row[`Certification${i}_Credential ID`];
        
        if (name || issuedBy) {
          certifications.push({
            name: name || '',
            issuedBy: issuedBy || '',
            issueDate: convertDateFormat(issueDate),
            expiryDate: convertDateFormat(expiryDate),
            credentialId: credentialId || ''
          });
        }
      }
      return certifications;
    };

    // Format availability
    const formatAvailability = () => {
      const availability = {
        schedule: {},
        preferences: {
          maxHoursPerDay: 8,
          preferredDays: []
        }
      };
      
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach(day => {
        const dayLower = day.toLowerCase();
        const available = row[`${day} Available`]?.toLowerCase() === 'yes';
        
        availability.schedule[dayLower] = {
          isAvailable: available,
          slots: available ? [
            {
              start: '09:00',
              end: '17:00',
              status: 'active'
            }
          ] : []
        };
        
        if (available) {
          availability.preferences.preferredDays.push(dayLower);
        }
      });
      return availability;
    };

    // Prepare tutor data with proper structure for PostgreSQL
    const tutorData = {
      firstName: row['First Name *'] || '',
      lastName: row['Last Name *'] || '',
      email: row['Email Address *'] || '',
      username: row['Username *'] || '',
      password: row['Password *'] || '',
      phoneNumber: formatPhoneNumber(row['Phone Number'] || ''),
      dateOfBirth: convertDateFormat(row['Date of Birth (DD-MM-YYYY)']),
      timeZone: row['Time Zone *'] || 'UTC',
      role: 'tutor',
      isActive: true,
      address: {
        street: row['Street Address'] || '',
        city: row['City'] || '',
        state: row['State'] || '',
        zipCode: row['ZIP Code'] || '',
        country: 'US'
      },
      tutorProfile: {
        bio: row['Bio'] || '',
        experience: {
          years: parseInt(row['Years of Experience'] || '0', 10),
          details: ''
        },
        education: formatEducation(),
        certifications: formatCertifications(),
        teaching: {
          subjects: row['Subjects to Teach *'] ? row['Subjects to Teach *'].split(',').map(s => s.trim()) : [],
          languagesSpoken: row['Languages Spoken'] ? row['Languages Spoken'].split(',').map(s => s.trim()) : [],
          specializations: [],
          preferences: {
            hourlyRate: parseFloat(row['Hourly Rate'] || '0'),
            currency: row['Currency'] || 'USD'
          }
        },
        availability: formatAvailability(),
        status: {
          isVerified: false,
          rating: 0,
          totalRatings: 0,
          accountStatus: 'active',
          onboardingStatus: 'pending'
        }
      }
    };

    // Add education
    for (let i = 1; i <= 3; i++) {
      const degree = row[`Education${i}_Degree *`];
      const institution = row[`Education${i}_Institution *`];
      const year = row[`Education${i}_Year`];
      const field = row[`Education${i}_Field of Study`];
      if (degree || institution) {
        tutorData.tutorProfile.education.push({ 
          degree, 
          institution, 
          year: year ? parseInt(year) : null, 
          fieldOfStudy: field 
        });
      }
    }

    // Add certifications
    for (let i = 1; i <= 3; i++) {
      const name = row[`Certification${i}_Name`];
      const issuedBy = row[`Certification${i}_Issued By`];
      const issueDate = row[`Certification${i}_Issue Date (DD-MM-YYYY)`];
      const expiryDate = row[`Certification${i}_Expiry Date (DD-MM-YYYY)`];
      const credentialId = row[`Certification${i}_Credential ID`];
      if (name || issuedBy) {
        tutorData.tutorProfile.certifications.push({ 
          name, 
          issuedBy, 
          issueDate: convertDateFormat(issueDate), 
          expiryDate: convertDateFormat(expiryDate), 
          credentialId 
        });
      }
    }

    // Add availability
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    days.forEach(day => {
      const available = row[`${day} Available`]?.toLowerCase() === 'yes';
      tutorData.tutorProfile.availability[day.toLowerCase()] = {
        start: available ? '09:00' : null,
        end: available ? '17:00' : null,
        available,
        timeSlots: available ? [{ startTime: '09:00', endTime: '17:00' }] : [],
        timeSlotsZones: []
      };
    });

    return tutorData;
  };

  // Transform CSV row to PostgreSQL parent format
  const transformCsvRowToParentData = (row, headers) => {
    // Helper function to find header that starts with the expected field
    const findHeader = (expectedField) => {
      return headers.find(header => header.startsWith(expectedField));
    };

    const firstNameHeader = findHeader('Parent First Name *');
    const lastNameHeader = findHeader('Parent Last Name *');
    const emailHeader = findHeader('Parent Email *');
    const usernameHeader = findHeader('Parent Username');
    const passwordHeader = findHeader('Parent Password *');
    const phoneHeader = findHeader('Parent Phone');
    const addressHeader = findHeader('Parent Address');

    // Format phone number
    const formatPhoneNumber = (phone) => {
      if (!phone) return null;
      // Remove all non-digit characters
      let phoneNumber = phone.replace(/\D/g, '');
      // If 10 digits, assume US and add +1
      if (phoneNumber.length === 10) {
        phoneNumber = '+1' + phoneNumber;
      } else if (!phoneNumber.startsWith('+')) {
        // If not starting with +, add +
        phoneNumber = '+' + phoneNumber;
      }
      return phoneNumber;
    };

    return {
      firstName: firstNameHeader ? (row[firstNameHeader] || '') : '',
      lastName: lastNameHeader ? (row[lastNameHeader] || '') : '',
      email: emailHeader ? (row[emailHeader] || '') : '',
      username: usernameHeader ? (row[usernameHeader] || '') : '',
      password: passwordHeader ? (row[passwordHeader] || '') : '',
      phoneNumber: formatPhoneNumber(phoneHeader ? (row[phoneHeader] || '') : ''),
      address: addressHeader ? (row[addressHeader] || '') : '',
      role: 'parent',
      isActive: true
    };
  };

  // Transform CSV row to PostgreSQL student format
  const transformCsvRowToStudentData = (row, headers) => {
    if (!row) {
      console.error('No row data provided to transformCsvRowToStudentData');
      return null;
    }

    // Helper function to find header that starts with the expected field
    const findHeader = (expectedField) => {
      return headers.find(header => header.startsWith(expectedField));
    };

    // Helper function to convert DD-MM-YYYY to YYYY-MM-DD
    const convertDateFormat = (dateStr) => {
      if (!dateStr || dateStr.trim() === '') {
        return null;
      }
      
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
        return dateStr.trim();
      }
      
      if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr.trim())) {
        const [day, month, year] = dateStr.trim().split('-');
        return `${year}-${month}-${day}`;
      }
      
      return null;
    };

    // Helper function to convert grade format
    const convertGradeFormat = (gradeStr) => {
      if (!gradeStr || gradeStr.trim() === '') {
        return null;
      }
      
      const grade = gradeStr.trim();
      
      // If already in correct format (like "10th", "1st", etc.), return as is
      if (/^\d+(st|nd|rd|th)$/.test(grade) || ['Pre-K', 'Kindergarten', 'College', 'Graduate'].includes(grade)) {
        return grade;
      }
      
      // Convert "Grade X" format to "Xth" format
      const gradeMatch = grade.match(/^Grade\s+(\d+)$/i);
      if (gradeMatch) {
        const num = parseInt(gradeMatch[1]);
        if (num === 1) return '1st';
        if (num === 2) return '2nd';
        if (num === 3) return '3rd';
        return num + 'th';
      }
      
      // Convert plain number to "Xth" format
      const numMatch = grade.match(/^(\d+)$/);
      if (numMatch) {
        const num = parseInt(numMatch[1]);
        if (num === 1) return '1st';
        if (num === 2) return '2nd';
        if (num === 3) return '3rd';
        return num + 'th';
      }
      
      return grade; // Return as is if no conversion needed
    };

    // Format phone number
    const formatPhoneNumber = (phone) => {
      if (!phone) return null;
      // Remove all non-digit characters
      let phoneNumber = phone.replace(/\D/g, '');
      // If 10 digits, assume US and add +1
      if (phoneNumber.length === 10) {
        phoneNumber = '+1' + phoneNumber;
      } else if (!phoneNumber.startsWith('+')) {
        // If not starting with +, add +
        phoneNumber = '+' + phoneNumber;
      }
      return phoneNumber;
    };

    const firstNameHeader = findHeader('Student First Name *');
    const lastNameHeader = findHeader('Student Last Name *');
    const emailHeader = findHeader('Student Email *');
    const usernameHeader = findHeader('Student Username *');
    const passwordHeader = findHeader('Student Password *');
    const phoneHeader = findHeader('Student Phone Number');
    const dobHeader = findHeader('Student Date of Birth (DD-MM-YYYY) *');
    const gradeHeader = findHeader('Student Grade *');
    const schoolHeader = findHeader('Student School *');
    const subjectsHeader = findHeader('Student Subjects of Interest *');
    const hourlyRateHeader = findHeader('Student Hourly Rate');
    const currencyHeader = findHeader('Student Currency *');
    const timeZoneHeader = findHeader('Student Time Zone *');
    const learningStyleHeader = findHeader('Student Learning Style');
    const goalsHeader = findHeader('Student Learning Goals');
    const notesHeader = findHeader('Student Additional Notes');
    const streetHeader = findHeader('Student Street');
    const cityHeader = findHeader('Student City');
    const stateHeader = findHeader('Student State');
    const zipHeader = findHeader('Student ZIP Code');
    const countryHeader = findHeader('Student Country');
    const emergencyNameHeader = findHeader('Student Emergency Contact Name');
    const emergencyPhoneHeader = findHeader('Student Emergency Phone');
    const relationshipHeader = findHeader('Student Relationship');
    const emergencyEmailHeader = findHeader('Student Emergency Email');
    const allergiesHeader = findHeader('Student Allergies');
    const medicationsHeader = findHeader('Student Current Medications');
    const conditionsHeader = findHeader('Student Medical Conditions');
    const doctorHeader = findHeader('Student Doctor Contact');

    // Create student data object
    const studentData = {
      firstName: firstNameHeader ? (row[firstNameHeader] || '') : '',
      lastName: lastNameHeader ? (row[lastNameHeader] || '') : '',
      email: emailHeader ? (row[emailHeader] || '') : '',
      username: usernameHeader ? (row[usernameHeader] || '') : '',
      password: passwordHeader ? (row[passwordHeader] || '') : '',
      phoneNumber: formatPhoneNumber(phoneHeader ? (row[phoneHeader] || '') : ''),
      dateOfBirth: dobHeader ? convertDateFormat(row[dobHeader]) : null,
      role: 'student',
      address: {
        street: streetHeader ? (row[streetHeader] || '') : '',
        city: cityHeader ? (row[cityHeader] || '') : '',
        state: stateHeader ? (row[stateHeader] || '') : '',
        zipCode: zipHeader ? (row[zipHeader] || '') : '',
        country: countryHeader ? (row[countryHeader] || 'US') : 'US'
      },
      studentProfile: {
        grade: gradeHeader ? convertGradeFormat(row[gradeHeader]) : null,
        school: schoolHeader ? (row[schoolHeader] || '') : '',
        hourlyRate: hourlyRateHeader ? parseFloat(row[hourlyRateHeader] || '0') : 0,
        currency: currencyHeader ? (row[currencyHeader] || 'USD') : 'USD',
        timeZone: timeZoneHeader ? (row[timeZoneHeader] || 'UTC') : 'UTC',
        subjects: subjectsHeader ? row[subjectsHeader].split(',').map(s => s.trim()) : [],
        learningStyle: learningStyleHeader ? (row[learningStyleHeader] || '') : '',
        learningGoals: goalsHeader ? (row[goalsHeader] || '') : '',
        additionalNotes: notesHeader ? (row[notesHeader] || '') : '',
        emergencyContact: {
          name: emergencyNameHeader ? (row[emergencyNameHeader] || '') : '',
          phone: formatPhoneNumber(emergencyPhoneHeader ? (row[emergencyPhoneHeader] || '') : ''),
          relationship: relationshipHeader ? (row[relationshipHeader] || '') : '',
          email: emergencyEmailHeader ? (row[emergencyEmailHeader] || '') : ''
        },
        medicalInformation: {
          allergies: allergiesHeader ? (row[allergiesHeader] || '') : '',
          currentMedications: medicationsHeader ? (row[medicationsHeader] || '') : '',
          medicalConditions: conditionsHeader ? (row[conditionsHeader] || '') : '',
          doctorContact: doctorHeader ? (row[doctorHeader] || '') : ''
        }
      }
    };

    // Update student data with all required fields
    studentData.currency = currencyHeader ? (row[currencyHeader] || 'USD') : 'USD';
    studentData.timeZone = timeZoneHeader ? (row[timeZoneHeader] || 'UTC') : 'UTC';

    // Update student profile
    studentData.studentProfile = {
      ...studentData.studentProfile,
      parentContact: { name: '', phone: '', email: '' },
      subjects: subjectsHeader ? 
        (row[subjectsHeader] ? row[subjectsHeader].split(',').map(s => s.trim()) : []) 
        : [],
      preferredSubjects: subjectsHeader ? 
        (row[subjectsHeader] ? row[subjectsHeader].split(',').map(s => s.trim()) : []) 
        : [],
      strugglingSubjects: []
    };

    // Setup availability
    const availability = {};
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    days.forEach(day => {
      const availableHeader = findHeader(`Student ${day} Available`);
      const available = availableHeader ? (row[availableHeader]?.toLowerCase() === 'yes') : false;
      availability[day.toLowerCase()] = {
        available,
        timeSlots: available ? [] : [],
        timeSlotsZones: []
      };
    });
    studentData.studentProfile.availability = availability;

    return studentData;
  };

  const handleUploadCsv = async () => {
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvText = e.target.result;
      // Parse CSV with quoted fields
      const lines = csvText.split('\n').filter(line => line.trim());
      // Always use headers from the uploaded CSV, and trim them
      const headers = parseCsvLine(lines[0]).map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const values = parseCsvLine(line);
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = values[index]?.trim() || '';
        });
        return obj;
      });

      console.log('Parsed CSV data:', data);

      // Front-end validation
      const validationErrors = validateCsvData(data, uploadType, headers);
      if (validationErrors.length > 0) {
        console.error('Frontend validation errors:', validationErrors);
        
        // Create error CSV
        const errorCsvContent = createErrorCsv(headers, data, validationErrors);
        const fileName = uploadType === 'student' ? 'student_upload_validation_errors.csv' : 'tutor_upload_validation_errors.csv';
        downloadCsv(errorCsvContent, fileName);
        alert(`Validation failed. Please check the downloaded error CSV file for details.`);
        return;
      }

      try {
        let response;
        if (uploadType === 'tutor') {
          // Transform all tutor data
          const tutors = data.map(row => transformCsvRowToTutorData(row));
          console.log('Transformed tutor data:', tutors);
          
          // Send bulk upload request
          const token = localStorage.getItem('token');
          // Transform the tutors array into the expected format
          const transformedData = {
            data: tutors.map(tutor => ({
              user: {
                firstName: tutor.firstName,
                lastName: tutor.lastName,
                email: tutor.email,
                username: tutor.username,
                password: tutor.password,
                phoneNumber: tutor.phoneNumber,
                dateOfBirth: tutor.dateOfBirth,
                timeZone: tutor.timeZone,
                role: tutor.role,
                isActive: tutor.isActive,
                address: tutor.address
              },
              profile: tutor.tutorProfile
            }))
          };
          
          // Log the transformed data before sending
          console.log('Sending tutor data:', JSON.stringify(transformedData, null, 2));
          
          response = await fetch('/api/bulk-uploads/tutors', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            },
            body: JSON.stringify(transformedData)
          });
        } else if (uploadType === 'student') {
          // Transform data for parents and students
          const uploadData = data.map(row => {
            const parentData = transformCsvRowToParentData(row, headers);
            const studentData = transformCsvRowToStudentData(row, headers);
            
            if (!parentData || !studentData) {
                throw new Error('Failed to transform parent or student data');
            }

            return {
                parent: parentData,
                student: studentData
            };
          });
          console.log('Transformed student/parent data:', uploadData);
          
          // Send bulk upload request
          const token = localStorage.getItem('token');
          response = await fetch('/api/bulk-uploads/students', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ entries: uploadData })
          });
        }

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch (e) {
            console.error('Error parsing error response:', e);
            errorData = { message: 'Server error occurred' };
          }
          console.error('Bulk upload failed:', errorData);
          
          // Format server errors into the expected structure for CSV
          const serverErrors = [];
          if (errorData.errors) {
            if (Array.isArray(errorData.errors)) {
              // Handle array of errors
              errorData.errors.forEach((error, index) => {
                if (typeof error === 'object') {
                  const errorMessages = Object.entries(error)
                    .map(([field, message]) => `${field}: ${message}`)
                    .join('; ');
                  serverErrors.push({
                    rowIndex: index,
                    errors: [errorMessages]
                  });
                } else {
                  serverErrors.push({
                    rowIndex: index,
                    errors: [error.toString()]
                  });
                }
              });
            } else if (typeof errorData.errors === 'object') {
              // Handle error object
              const errorMessages = Object.entries(errorData.errors)
                .map(([field, message]) => `${field}: ${message}`)
                .join('; ');
              serverErrors.push({
                rowIndex: 0,
                errors: [errorMessages]
              });
            }
          }
          if (errorData.message && (!errorData.errors || serverErrors.length === 0)) {
            // If there's a general error message and no specific errors were processed
            serverErrors.push({
              rowIndex: 0,
              errors: [errorData.message]
            });
          }

          // Log the processed errors
          console.log('Processed server errors:', serverErrors);

          // Create error CSV with the formatted errors
          const errorCsvContent = createErrorCsv(headers, data, serverErrors);
          const fileName = uploadType === 'student' ? 'student_upload_server_errors.csv' : 'tutor_upload_server_errors.csv';
          downloadCsv(errorCsvContent, fileName);
          
          alert(`Upload failed. Please check the downloaded error CSV file for details.`);
          return;
        }

        const result = await response.json();
        console.log('Bulk upload result:', result);

        if (result.data && result.data.errors && result.data.errors.length > 0) {
          // Create error CSV with the formatted errors
                const serverErrors = result.data.errors.map((error, index) => ({
                    rowIndex: index,
                    errors: [error.error.includes('already exists') ? error.error : 'Unknown error']
                }));          // Create and download error CSV
          const errorCsvContent = createErrorCsv(headers, data, serverErrors);
          const fileName = uploadType === 'student' ? 'student_upload_errors.csv' : 'tutor_upload_errors.csv';
          downloadCsv(errorCsvContent, fileName);
          
          alert(`Upload completed with errors. ${result.data.success.length} ${uploadType}s created successfully. ${result.data.errors.length} entries failed. Please check the downloaded error report for details.`);
        } else {
          // All entries succeeded
          if (uploadType === 'student') {
            alert(`Successfully uploaded:\n- ${result.data.parentsCreated} Parents\n- ${result.data.studentsCreated} Students`);
          } else {
            alert(`Successfully uploaded ${result.data.success.length} tutors!`);
          }
        }

        // Clear file input
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        handleRefresh();
      } catch (error) {
        console.error('Upload error:', error);
        alert(`Upload failed: ${error.message}`);
      }
    };
    reader.readAsText(selectedFile);
  };

  if (loading && !dashboardData) {
    return <LoadingSpinner fullScreen message="Loading Admin Dashboard..." />;
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <Header title="Admin Dashboard" />
        <div className="container">
          <div className="alert alert-danger">
            <strong>Error:</strong> {error}
            <button className="btn btn-sm btn-outline ml-3" onClick={handleRefresh}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { data } = dashboardData || {};

  return (
    <div className={styles.dashboard}>
      <Header 
        title="Admin Dashboard" 
        actions={
          <button className="btn btn-primary btn-sm" onClick={handleRefresh}>
            {loading ? <div className="spinner"></div> : 'Refresh'}
          </button>
        }
      />
      
      <div className={styles.dashboardLayout}>
        {/* Left Sidebar Navigation */}
        <div className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''}`}>
          <div className={styles.sidebarProfile}>
            <div className={styles.profileInfo}>
              <div className={styles.profileAvatar}>
                {(user?.fullName || user?.firstName || 'A').charAt(0).toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div>
                  <h4 className={styles.profileName}>
                    {user?.fullName || `${user?.firstName} ${user?.lastName}` || user?.firstName || 'Admin'}
                  </h4>
                  <p className={styles.profileRole}>Admin Account</p>
                </div>
              )}
            </div>
          </div>
          
          <div className={styles.sidebarContent}>
            <nav className={styles.sidebarNav}>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'overview' ? styles.active : ''}`}
                onClick={() => setActiveTab('overview')}
                title="Overview"
              >
                <i className="fas fa-home"></i>
                <span className={styles.sidebarButtonText}>Overview</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'tutors' ? styles.active : ''}`}
                onClick={() => setActiveTab('tutors')}
                title="Tutors"
              >
                <i className="fas fa-chalkboard-teacher"></i>
                <span className={styles.sidebarButtonText}>Tutors</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'students' ? styles.active : ''}`}
                onClick={() => setActiveTab('students')}
                title="Students"
              >
                <i className="fas fa-user-graduate"></i>
                <span className={styles.sidebarButtonText}>Students</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'parents' ? styles.active : ''}`}
                onClick={() => setActiveTab('parents')}
                title="Parents"
              >
                <i className="fas fa-users"></i>
                <span className={styles.sidebarButtonText}>Parents</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'classes' ? styles.active : ''}`}
                onClick={() => setActiveTab('classes')}
                title="Schedule Classes"
              >
                <i className="fas fa-calendar-plus"></i>
                <span className={styles.sidebarButtonText}>Schedule Classes</span>
              </button>

              <button
                className={`${styles.sidebarButton} ${activeTab === 'student-billing' ? styles.active : ''}`}
                onClick={() => setActiveTab('student-billing')}
                title="Student Billing"
              >
                <i className="fas fa-user-graduate"></i>
                <span className={styles.sidebarButtonText}>Student Billing</span>
              </button>
              <button
                className={`${styles.sidebarButton} ${activeTab === 'tutor-billing' ? styles.active : ''}`}
                onClick={() => setActiveTab('tutor-billing')}
                title="Tutor Billing"
              >
                <i className="fas fa-chalkboard-teacher"></i>
                <span className={styles.sidebarButtonText}>Tutor Billing</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'subject-management' ? styles.active : ''}`}
                onClick={() => setActiveTab('subject-management')}
                title="Subject Management"
              >
                <i className="fas fa-book"></i>
                <span className={styles.sidebarButtonText}>Subject Management</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'communication' ? styles.active : ''}`}
                onClick={() => setActiveTab('communication')}
                title="Communication"
              >
                <i className="fas fa-comments"></i>
                <span className={styles.sidebarButtonText}>Communication</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'session-participants' ? styles.active : ''}`}
                onClick={() => setActiveTab('session-participants')}
                title="Session Participants"
              >
                <i className="fas fa-users-cog"></i>
                <span className={styles.sidebarButtonText}>Session Participants</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'bulk-uploads' ? styles.active : ''}`}
                onClick={() => setActiveTab('bulk-uploads')}
                title="Bulk Uploads"
              >
                <i className="fas fa-upload"></i>
                <span className={styles.sidebarButtonText}>Bulk Uploads</span>
              </button>
            </nav>
          </div>
          
          {/* Collapse/Expand Toggle on the Right Edge */}
          <div className={styles.sidebarToggle}>
            <button 
              className={styles.toggleButton}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <i className={`fas ${sidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className={styles.mainContent}>
          <div className={styles.container}>

            {/* Tab Content */}
            <div className={styles.tabContent}>
              {activeTab === 'overview' && (
                <div className="overview-content">
                  {/* Center Info */}
                  {data?.center && (
                    <CenterInfo center={data.center} />
                  )}

                  {/* Quick Overview Statistics */}
                  <div className={styles.overviewStatsSection}>
                    <h3 className={styles.overviewTitle}>Quick Overview</h3>
                    <div className={styles.statsGrid}>
                      <div className={styles.statCard}>
                        <div className={styles.statIcon}>👨‍🏫</div>
                        <div className={styles.statContent}>
                          <h3>{data?.usersByRole?.tutor || 0}</h3>
                          <p>Tutors</p>
                          <small className={styles.statTrend}>Teaching staff in center</small>
                        </div>
                      </div>

                      <div className={styles.statCard}>
                        <div className={styles.statIcon}>👨‍🎓</div>
                        <div className={styles.statContent}>
                          <h3>{data?.usersByRole?.student || 0}</h3>
                          <p>Students</p>
                          <small className={styles.statTrend}>Enrolled students</small>
                        </div>
                      </div>

                      <div className={styles.statCard}>
                        <div className={styles.statIcon}>👨‍👩‍👧‍👦</div>
                        <div className={styles.statContent}>
                          <h3>{data?.usersByRole?.parent || 0}</h3>
                          <p>Parents</p>
                          <small className={styles.statTrend}>Parent accounts</small>
                        </div>
                      </div>

                      <div className={styles.statCard}>
                        <div className={styles.statIcon}>📚</div>
                        <div className={styles.statContent}>
                          <h3>{data?.activeClasses || data?.runningClasses || data?.totalClasses || 0}</h3>
                          <p>Active Classes</p>
                          <small className={styles.statTrend}>Running classes</small>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activities - Flat View */}
                  <div className={styles.flatSection}>
                    <div className={styles.sectionHeader}>
                      <h3 className={styles.sectionTitle}>Recent Activities</h3>
                    </div>
                    <div className={styles.flatActivityList}>
                      <div className={styles.flatActivityItem}>
                        <div className={styles.activityIcon}>👤</div>
                        <div className={styles.activityContent}>
                          <div className={styles.activityText}>New student enrolled: John Doe</div>
                          <div className={styles.activityTime}>2 hours ago</div>
                        </div>
                      </div>
                      <div className={styles.flatActivityItem}>
                        <div className={styles.activityIcon}>📚</div>
                        <div className={styles.activityContent}>
                          <div className={styles.activityText}>Math class added to schedule</div>
                          <div className={styles.activityTime}>5 hours ago</div>
                        </div>
                      </div>
                      <div className={styles.flatActivityItem}>
                        <div className={styles.activityIcon}>👨‍🏫</div>
                        <div className={styles.activityContent}>
                          <div className={styles.activityText}>New tutor assigned: Jane Smith</div>
                          <div className={styles.activityTime}>1 day ago</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions - Flat View */}
                  <div className={styles.flatSection}>
                    <div className={styles.sectionHeader}>
                      <h3 className={styles.sectionTitle}>Quick Actions</h3>
                    </div>
                    <div className={styles.flatActionsList}>
                      <button className={`${styles.flatActionButton} ${styles.primaryAction}`}>
                        <div className={styles.actionIcon}>📝</div>
                        <div className={styles.actionText}>
                          <span className={styles.actionTitle}>Add New Student</span>
                          <small className={styles.actionDescription}>Enroll a new student to the center</small>
                        </div>
                      </button>
                      <button className={`${styles.flatActionButton} ${styles.successAction}`}>
                        <div className={styles.actionIcon}>👨‍🏫</div>
                        <div className={styles.actionText}>
                          <span className={styles.actionTitle}>Add New Tutor</span>
                          <small className={styles.actionDescription}>Add teaching staff to your team</small>
                        </div>
                      </button>
                      <button className={`${styles.flatActionButton} ${styles.infoAction}`}>
                        <div className={styles.actionIcon}>📚</div>
                        <div className={styles.actionText}>
                          <span className={styles.actionTitle}>Create Class</span>
                          <small className={styles.actionDescription}>Schedule a new class session</small>
                        </div>
                      </button>
                      <button className={`${styles.flatActionButton} ${styles.warningAction}`}>
                        <div className={styles.actionIcon}>📊</div>
                        <div className={styles.actionText}>
                          <span className={styles.actionTitle}>View Reports</span>
                          <small className={styles.actionDescription}>Access detailed analytics and reports</small>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'center-management' && (
                <div>
                  {/* Sub-tab Navigation */}
                  <div className={styles.subTabs}>
                    <button 
                      className={`${styles.subTabButton} ${activeSubTab === 'scheduling' ? styles.active : ''}`}
                      onClick={() => setActiveSubTab('scheduling')}
                    >
                      Scheduling
                    </button>
                  </div>

                  {activeSubTab === 'scheduling' && (
                    <div className={styles.overviewContent}>
                      <div className="row">
                        <div className="col-12">
                          <div className="card">
                            <div className="card-header">
                              <h3>Center Management - Scheduling</h3>
                            </div>
                            <div className="card-body">
                              <p>Center scheduling and management tools will be displayed here.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tutors' && (
                <TutorManagement onRefresh={handleRefresh} />
              )}

              {activeTab === 'students' && (
                <StudentManagement />
              )}

              {activeTab === 'parents' && (
                <ParentManagement onRefresh={handleRefresh} />
              )}

              {activeTab === 'classes' && (
                <ScheduleClassesTab />
              )}


              {activeTab === 'student-billing' && (
                <StudentBillingDashboard />
              )}
              {activeTab === 'tutor-billing' && (
                <TutorBillingDashboard />
              )}


              {activeTab === 'sessions' && (
                <SessionsTab />
              )}

              {activeTab === 'session-participants' && (
                <SessionParticipantsTab />
              )}

              {activeTab === 'bulk-uploads' && (
                <div className={styles.bulkUploadsContainer}>
                  <div className={styles.bulkUploadsHeader}>
                    <div className={styles.headerIcon}>📤</div>
                    <div className={styles.headerContent}>
                      <h2 className={styles.headerTitle}>Bulk Data Upload</h2>
                      <p className={styles.headerSubtitle}>Upload multiple tutors or students at once using CSV files</p>
                    </div>
                  </div>

                  <div className={styles.uploadTypeSelector}>
                    <h4 className={styles.sectionTitle}>Select Upload Type</h4>
                    <div className={styles.uploadTypeCards}>
                      <div
                        className={`${styles.uploadTypeCard} ${uploadType === 'tutor' ? styles.active : ''}`}
                        onClick={() => setUploadType('tutor')}
                      >
                        <div className={styles.cardIcon}>👨‍🏫</div>
                        <div className={styles.cardContent}>
                          <h5>Tutor Upload</h5>
                          <p>Upload multiple tutors with their profiles, subjects, and availability</p>
                        </div>
                        <div className={styles.cardArrow}>→</div>
                      </div>
                      <div
                        className={`${styles.uploadTypeCard} ${uploadType === 'student' ? styles.active : ''}`}
                        onClick={() => setUploadType('student')}
                      >
                        <div className={styles.cardIcon}>🎓</div>
                        <div className={styles.cardContent}>
                          <h5>Student Upload</h5>
                          <p>Upload multiple students with their information</p>
                        </div>
                        <div className={styles.cardArrow}>→</div>
                      </div>
                    </div>
                  </div>

                  {uploadType === 'tutor' && (
                    <div className={styles.uploadSection}>
                      <div className={styles.uploadSteps}>
                        <div className={styles.step}>
                          <div className={styles.stepNumber}>1</div>
                          <div className={styles.stepContent}>
                            <h5>Download Sample CSV</h5>
                            <p>Get the correct format for your data</p>
                            <button className={styles.sampleButton} onClick={handleDownloadSampleCsv}>
                              <span className={styles.buttonIcon}>📥</span>
                              Download Sample
                            </button>
                          </div>
                        </div>

                        <div className={styles.step}>
                          <div className={styles.stepNumber}>2</div>
                          <div className={styles.stepContent}>
                            <h5>Prepare Your CSV</h5>
                            <p>Fill in your tutor data following the sample format</p>
                            <div className={styles.requirements}>
                              <strong>Required fields:</strong> First Name, Last Name, Email, Username, Password, Date of Birth, Subjects
                            </div>
                          </div>
                        </div>

                        <div className={styles.step}>
                          <div className={styles.stepNumber}>3</div>
                          <div className={styles.stepContent}>
                            <h5>Upload & Validate</h5>
                            <p>Upload your file and we'll validate the data</p>
                            <div className={styles.fileUploadArea}>
                              <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                id="csvFileInput"
                                style={{ display: 'none' }}
                                ref={fileInputRef}
                              />
                              {!selectedFile ? (
                                <label htmlFor="csvFileInput" className={styles.uploadZone}>
                                  <div className={styles.uploadIcon}>📁</div>
                                  <div className={styles.uploadText}>
                                    <strong>Click to choose CSV file</strong>
                                    <span>or drag and drop here</span>
                                  </div>
                                  <div className={styles.uploadHint}>
                                    Supports CSV files up to 5MB
                                  </div>
                                </label>
                              ) : (
                                <div className={styles.fileSelected}>
                                  <div className={styles.fileIcon}>📄</div>
                                  <div className={styles.fileInfo}>
                                    <div className={styles.fileName}>{selectedFile.name}</div>
                                    <div className={styles.fileSize}>
                                      {(selectedFile.size / 1024).toFixed(1)} KB
                                    </div>
                                  </div>
                                  <button
                                    className={styles.removeFile}
                                    onClick={handleClearUpload}
                                    title="Remove file"
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {selectedFile && (
                        <div className={styles.uploadActions}>
                          <button
                            className={styles.uploadButton}
                            onClick={handleUploadCsv}
                          >
                            <span className={styles.buttonIcon}>🚀</span>
                            Upload & Process
                          </button>
                          <button
                            className={styles.clearButton}
                            onClick={handleClearUpload}
                          >
                            <span className={styles.buttonIcon}>🔄</span>
                            Clear & Start Over
                          </button>
                        </div>
                      )}

                      <div className={styles.uploadTips}>
                        <div className={styles.tipsIcon}>💡</div>
                        <div className={styles.tipsContent}>
                          <h6>Tips for successful uploads:</h6>
                          <ul>
                            <li>Ensure all required fields are filled</li>
                            <li>Use the exact column headers from the sample</li>
                            <li>Check email addresses and phone numbers format</li>
                            <li>Passwords must be at least 8 characters with uppercase, lowercase, number, and special character</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {uploadType === 'student' && (
                    <div className={styles.uploadSection}>
                      <div className={styles.uploadSteps}>
                        <div className={styles.step}>
                          <div className={styles.stepNumber}>1</div>
                          <div className={styles.stepContent}>
                            <h5>Download Sample CSV</h5>
                            <p>Get the correct format for your data</p>
                            <button className={styles.sampleButton} onClick={handleDownloadSampleCsvForStudents}>
                              <span className={styles.buttonIcon}>�</span>
                              Download Sample
                            </button>
                          </div>
                        </div>

                        <div className={styles.step}>
                          <div className={styles.stepNumber}>2</div>
                          <div className={styles.stepContent}>
                            <h5>Prepare Your CSV</h5>
                            <p>Fill in your parent and student data following the sample format</p>
                            <div className={styles.requirements}>
                              <strong>Required fields:</strong> Parent First Name, Parent Last Name, Parent Email, Parent Password, Student First Name, Student Last Name, Student Email, Student Username, Student Password, Student Date of Birth, Student Time Zone, Student Currency, Student Grade, Student School, Student Subjects of Interest
                            </div>
                          </div>
                        </div>

                        <div className={styles.step}>
                          <div className={styles.stepNumber}>3</div>
                          <div className={styles.stepContent}>
                            <h5>Upload & Validate</h5>
                            <p>Upload your file and we'll validate the data</p>
                            <div className={styles.fileUploadArea}>
                              <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                id="csvFileInput"
                                style={{ display: 'none' }}
                                ref={fileInputRef}
                              />
                              {!selectedFile ? (
                                <label htmlFor="csvFileInput" className={styles.uploadZone}>
                                  <div className={styles.uploadIcon}>📁</div>
                                  <div className={styles.uploadText}>
                                    <strong>Click to choose CSV file</strong>
                                    <span>or drag and drop here</span>
                                  </div>
                                  <div className={styles.uploadHint}>
                                    Supports CSV files up to 5MB
                                  </div>
                                </label>
                              ) : (
                                <div className={styles.fileSelected}>
                                  <div className={styles.fileIcon}>📄</div>
                                  <div className={styles.fileInfo}>
                                    <div className={styles.fileName}>{selectedFile.name}</div>
                                    <div className={styles.fileSize}>
                                      {(selectedFile.size / 1024).toFixed(1)} KB
                                    </div>
                                  </div>
                                  <button
                                    className={styles.removeFile}
                                    onClick={handleClearUpload}
                                    title="Remove file"
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {selectedFile && (
                        <div className={styles.uploadActions}>
                          <button
                            className={styles.uploadButton}
                            onClick={handleUploadCsv}
                          >
                            <span className={styles.buttonIcon}>🚀</span>
                            Upload & Process
                          </button>
                          <button
                            className={styles.clearButton}
                            onClick={handleClearUpload}
                          >
                            <span className={styles.buttonIcon}>🔄</span>
                            Clear & Start Over
                          </button>
                        </div>
                      )}

                      <div className={styles.uploadTips}>
                        <div className={styles.tipsIcon}>💡</div>
                        <div className={styles.tipsContent}>
                          <h6>Tips for successful uploads:</h6>
                          <ul>
                            <li>Ensure all required fields are filled</li>
                            <li>Use the exact column headers from the sample</li>
                            <li>Check email addresses and phone numbers format</li>
                            <li>Passwords must be at least 8 characters with uppercase, lowercase, number, and special character</li>
                            <li>One row per student with their parent information</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'subject-management' && (
                <SubjectManagement />
              )}

              {activeTab === 'communication' && (
                <MessageManagement />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
