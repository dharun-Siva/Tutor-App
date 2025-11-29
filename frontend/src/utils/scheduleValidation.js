import SCHEDULE_CONFIG from '../config/schedule';

/**
 * Convert time string (HH:MM) to minutes from midnight
 * @param {string} timeStr - Time in HH:MM format
 * @returns {number} - Minutes from midnight
 */
export const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Convert minutes from midnight back to time string (HH:MM)
 * @param {number} minutes - Minutes from midnight
 * @returns {string} - Time in HH:MM format
 */
export const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Check if two time slots overlap (including buffer time)
 * @param {Object} slot1 - First time slot
 * @param {Object} slot2 - Second time slot
 * @param {number} bufferMinutes - Buffer time in minutes
 * @returns {boolean} - True if slots overlap
 */
export const timeSlotsOverlap = (slot1, slot2, bufferMinutes = SCHEDULE_CONFIG.BUFFER_TIME_MINUTES) => {
  const start1 = timeToMinutes(slot1.startTime);
  const end1 = start1 + (slot1.duration || 35);
  
  const start2 = timeToMinutes(slot2.startTime);
  const end2 = start2 + (slot2.duration || 35);
  
  // Add buffer time to both slots
  const bufferedStart1 = start1 - bufferMinutes;
  const bufferedEnd1 = end1 + bufferMinutes;
  
  const bufferedStart2 = start2 - bufferMinutes;
  const bufferedEnd2 = end2 + bufferMinutes;
  
  // Check for overlap: slots overlap if one starts before the other ends
  return (bufferedStart1 < bufferedEnd2 && bufferedStart2 < bufferedEnd1);
};

/**
 * Get the day of week from a date
 * @param {Date|string} date - Date object or date string
 * @returns {string} - Day name in lowercase
 */
export const getDayOfWeek = (date) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dateObj = date instanceof Date ? date : new Date(date);
  return days[dateObj.getDay()];
};

/**
 * Check if a class date falls on specific recurring days
 * @param {Date|string} classDate - The date to check
 * @param {Array} recurringDays - Array of day names
 * @returns {boolean} - True if date matches recurring days
 */
export const dateMatchesRecurringDays = (classDate, recurringDays) => {
  if (!recurringDays || recurringDays.length === 0) return false;
  const dayOfWeek = getDayOfWeek(classDate);
  return recurringDays.includes(dayOfWeek);
};

/**
 * Check for time slot conflicts for a tutor
 * @param {Object} newClass - New class being scheduled
 * @param {Array} existingClasses - List of existing classes
 * @param {string} tutorId - ID of the tutor
 * @param {string} excludeClassId - ID of class to exclude (for editing)
 * @returns {Object} - Conflict information
 */

export const checkTutorTimeConflicts = (newClass, existingClasses, tutorId, excludeClassId = null) => {
  if (!tutorId || !newClass.startTime) return { hasConflict: false };

  const conflicts = [];
  
  const newSlot = {
    startTime: newClass.startTime,
    duration: newClass.customDuration || newClass.duration || 35
  };
  
console.log('🕒 Conflict check slot:', newSlot);
console.log('🔍 tutorId:', tutorId);
console.log('🔍 excludeClassId:', excludeClassId);

  for (const existingClass of existingClasses) {
    console.log('📘 existingClass._id:', existingClass._id?.toString());
  console.log('👨‍🏫 existingClass.tutor._id:', existingClass.tutor?._id?.toString());
    // Skip if not same tutor or if it's the class being edited
    if (
  existingClass.tutor?._id?.toString() !== tutorId?.toString() ||
  existingClass._id?.toString() === excludeClassId?.toString()
  
) {
  continue;
}


    const existingSlot = {
      startTime: existingClass.startTime,
      duration: existingClass.customDuration || existingClass.duration || 35
    };

    let hasConflict = false;
    let conflictDate = '';

    if (newClass.scheduleType === 'one-time') {
      if (existingClass.scheduleType === 'one-time') {
        // One-time vs One-time: check if same date and time overlap
        if (newClass.classDate === existingClass.classDate) {
          hasConflict = timeSlotsOverlap(newSlot, existingSlot);
          conflictDate = newClass.classDate;
        }
      } else {
        // One-time vs Recurring: check if one-time date falls on recurring days
        const oneTimeDate = new Date(newClass.classDate);
        if (dateMatchesRecurringDays(oneTimeDate, existingClass.recurringDays)) {
          hasConflict = timeSlotsOverlap(newSlot, existingSlot);
          conflictDate = getDayOfWeek(oneTimeDate);
        }
      }
    } else {
      // Recurring class
      if (existingClass.scheduleType === 'one-time') {
        // Recurring vs One-time: check if one-time date falls on recurring days
        const oneTimeDate = new Date(existingClass.classDate);
        if (dateMatchesRecurringDays(oneTimeDate, newClass.recurringDays)) {
          hasConflict = timeSlotsOverlap(newSlot, existingSlot);
          conflictDate = getDayOfWeek(oneTimeDate);
        }
      } else {
        // Recurring vs Recurring: check if any days overlap
        const overlappingDays = newClass.recurringDays?.filter(day => 
          existingClass.recurringDays?.includes(day)
        ) || [];
        
        if (overlappingDays.length > 0) {
          hasConflict = timeSlotsOverlap(newSlot, existingSlot);
          conflictDate = overlappingDays.join(', ');
        }
      }
    }

    if (hasConflict) {
      conflicts.push({
        class: existingClass,
        conflictDate: conflictDate,
        conflictTime: `${existingClass.startTime} - ${minutesToTime(
          timeToMinutes(existingClass.startTime) + (existingClass.customDuration || existingClass.duration || 35)
        )}`
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts: conflicts
  };
};

/**
 * Check for time slot conflicts for students
 * @param {Object} newClass - New class being scheduled
 * @param {Array} existingClasses - List of existing classes
 * @param {Array} studentIds - Array of student IDs
 * @param {string} excludeClassId - ID of class to exclude (for editing)
 * @returns {Object} - Conflict information
 */
export const checkStudentTimeConflicts = (newClass, existingClasses, studentIds, excludeClassId = null) => {
  if (!studentIds || studentIds.length === 0 || !newClass.startTime) {
    return { hasConflict: false };
  }

  const conflicts = [];
  
  const newSlot = {
    startTime: newClass.startTime,
    duration: newClass.customDuration || newClass.duration || 35
  };

  for (const existingClass of existingClasses) {
    // Skip if it's the class being edited
    if (existingClass._id === excludeClassId) {
      continue;
    }

    // Check if any of the new students are in the existing class
    const conflictingStudents = studentIds.filter(studentId => 
      existingClass.students?.some(student => student._id === studentId)
    );

    if (conflictingStudents.length === 0) {
      continue;
    }

    const existingSlot = {
      startTime: existingClass.startTime,
      duration: existingClass.customDuration || existingClass.duration || 35
    };

    let hasConflict = false;
    let conflictDate = '';

    // Same logic as tutor conflicts
    if (newClass.scheduleType === 'one-time') {
      if (existingClass.scheduleType === 'one-time') {
        if (newClass.classDate === existingClass.classDate) {
          hasConflict = timeSlotsOverlap(newSlot, existingSlot);
          conflictDate = newClass.classDate;
        }
      } else {
        const oneTimeDate = new Date(newClass.classDate);
        if (dateMatchesRecurringDays(oneTimeDate, existingClass.recurringDays)) {
          hasConflict = timeSlotsOverlap(newSlot, existingSlot);
          conflictDate = getDayOfWeek(oneTimeDate);
        }
      }
    } else {
      if (existingClass.scheduleType === 'one-time') {
        const oneTimeDate = new Date(existingClass.classDate);
        if (dateMatchesRecurringDays(oneTimeDate, newClass.recurringDays)) {
          hasConflict = timeSlotsOverlap(newSlot, existingSlot);
          conflictDate = getDayOfWeek(oneTimeDate);
        }
      } else {
        const overlappingDays = newClass.recurringDays?.filter(day => 
          existingClass.recurringDays?.includes(day)
        ) || [];
        
        if (overlappingDays.length > 0) {
          hasConflict = timeSlotsOverlap(newSlot, existingSlot);
          conflictDate = overlappingDays.join(', ');
        }
      }
    }

    if (hasConflict) {
      conflicts.push({
        class: existingClass,
        conflictDate: conflictDate,
        conflictTime: `${existingClass.startTime} - ${minutesToTime(
          timeToMinutes(existingClass.startTime) + (existingClass.customDuration || existingClass.duration || 35)
        )}`,
        conflictingStudents: conflictingStudents
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts: conflicts
  };
};

/**
 * Generate user-friendly conflict messages
 * @param {Object} tutorConflicts - Tutor conflict information
 * @param {Object} studentConflicts - Student conflict information
 * @param {Object} selectedTutor - Selected tutor object
 * @param {Array} selectedStudents - Array of selected student objects
 * @returns {Array} - Array of error messages
 */
export const generateConflictMessages = (tutorConflicts, studentConflicts, selectedTutor, selectedStudents) => {
  const messages = [];

  // Tutor conflict messages
  if (tutorConflicts.hasConflict) {
    tutorConflicts.conflicts.forEach(conflict => {
      const tutorName = selectedTutor ? `${selectedTutor.firstName} ${selectedTutor.lastName}` : 'Selected tutor';
      messages.push(
        `${tutorName} already has a class scheduled from ${conflict.conflictTime} on ${conflict.conflictDate}. Please select a different time slot.`
      );
    });
  }

  // Student conflict messages
  if (studentConflicts.hasConflict) {
    studentConflicts.conflicts.forEach(conflict => {
      const conflictingStudentNames = conflict.conflictingStudents
        .map(studentId => {
          const student = selectedStudents.find(s => s._id === studentId);
          return student ? `${student.firstName} ${student.lastName}` : 'Selected student';
        })
        .join(', ');
      
      messages.push(
        `${conflictingStudentNames} already ${conflict.conflictingStudents.length > 1 ? 'have' : 'has'} a class scheduled from ${conflict.conflictTime} on ${conflict.conflictDate}. Please select a different time slot.`
      );
    });
  }

  return messages;
};

const scheduleValidation = {
  timeToMinutes,
  minutesToTime,
  timeSlotsOverlap,
  getDayOfWeek,
  dateMatchesRecurringDays,
  checkTutorTimeConflicts,
  checkStudentTimeConflicts,
  generateConflictMessages
};

export default scheduleValidation;
