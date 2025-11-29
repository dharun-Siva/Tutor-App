/**
 * Timezone Utilities for consistent timezone handling across the application
 * Ensures all timestamps are displayed in the user's local timezone
 */

/**
 * Get user's current timezone
 * @returns {string} - Timezone identifier (e.g., 'America/New_York')
 */
export const getUserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Could not determine user timezone:', error);
    return 'UTC';
  }
};

/**
 * Format a date string to user's local date
 * @param {string|Date} date - Date to format
 * @param {Object} options - Intl options (year, month, day)
 * @returns {string} - Formatted date
 */
export const formatDateToLocal = (date, options = {}) => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid date for formatting:', date);
      return 'Invalid Date';
    }
    
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    };
    
    return dateObj.toLocaleDateString('en-US', defaultOptions);
  } catch (error) {
    console.warn('Error formatting date:', date, error);
    return 'Invalid Date';
  }
};

/**
 * Format a time string to user's local time
 * @param {string|Date} time - Time to format
 * @param {Object} options - Intl options (hour, minute, etc.)
 * @returns {string} - Formatted time
 */
export const formatTimeToLocal = (time, options = {}) => {
  if (!time) return 'N/A';
  
  try {
    let timeObj;
    
    // Parse various time formats
    if (typeof time === 'string') {
      if (time.includes('GMT') || /\w{3}\s+\w{3}\s+\d{1,2}/.test(time)) {
        timeObj = new Date(time);
      } else if (time.includes('T')) {
        timeObj = new Date(time);
      } else if (time.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
        // HH:MM or HH:MM:SS format
        timeObj = new Date(`2000-01-01T${time}`);
      } else {
        timeObj = new Date(time);
      }
    } else if (time instanceof Date) {
      timeObj = time;
    } else {
      return 'Invalid Time';
    }
    
    if (isNaN(timeObj.getTime())) {
      console.warn('Invalid time for formatting:', time);
      return 'Invalid Time';
    }
    
    const defaultOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: getUserTimezone(),
      ...options
    };
    
    return timeObj.toLocaleTimeString('en-US', defaultOptions);
  } catch (error) {
    console.warn('Error formatting time:', time, error);
    return 'Invalid Time';
  }
};

/**
 * Format a datetime string to user's local datetime
 * @param {string|Date} datetime - DateTime to format
 * @param {Object} dateOptions - Intl options for date
 * @param {Object} timeOptions - Intl options for time
 * @returns {string} - Formatted datetime
 */
export const formatDateTimeToLocal = (datetime, dateOptions = {}, timeOptions = {}) => {
  if (!datetime) return 'N/A';
  
  try {
    const dateObj = new Date(datetime);
    if (isNaN(dateObj.getTime())) {
      return 'Invalid DateTime';
    }
    
    const date = formatDateToLocal(datetime, dateOptions);
    const time = formatTimeToLocal(datetime, timeOptions);
    
    if (date === 'Invalid Date' || time === 'Invalid Time') {
      return 'Invalid DateTime';
    }
    
    return `${date} ${time}`;
  } catch (error) {
    console.warn('Error formatting datetime:', datetime, error);
    return 'Invalid DateTime';
  }
};

/**
 * Get timezone offset in hours (e.g., +5.5 for IST)
 * @returns {number} - Timezone offset in hours
 */
export const getTimezoneOffset = () => {
  return -(new Date().getTimezoneOffset() / 60);
};

/**
 * Get a readable timezone string (e.g., "UTC+5:30" or "IST")
 * @returns {string} - Timezone display string
 */
export const getTimezoneDisplayString = () => {
  const timezone = getUserTimezone();
  const offset = getTimezoneOffset();
  
  // Try to get abbreviation from Intl
  const dateObj = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short'
  }).formatToParts(dateObj);
  
  const tzName = parts.find(part => part.type === 'timeZoneName')?.value || timezone;
  
  if (offset >= 0) {
    const sign = '+';
    const hours = Math.floor(Math.abs(offset));
    const minutes = Math.round((Math.abs(offset) - hours) * 60);
    return `${tzName} (UTC${sign}${hours}${minutes ? ':' + minutes.toString().padStart(2, '0') : ''})`;
  } else {
    const sign = '-';
    const hours = Math.floor(Math.abs(offset));
    const minutes = Math.round((Math.abs(offset) - hours) * 60);
    return `${tzName} (UTC${sign}${hours}${minutes ? ':' + minutes.toString().padStart(2, '0') : ''})`;
  }
};

export default {
  getUserTimezone,
  formatDateToLocal,
  formatTimeToLocal,
  formatDateTimeToLocal,
  getTimezoneOffset,
  getTimezoneDisplayString
};
