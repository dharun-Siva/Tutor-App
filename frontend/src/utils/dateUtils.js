/**
 * Date utility functions for consistent date handling across the application
 */

/**
 * Get today's date in YYYY-MM-DD format in local timezone
 * This ensures that "today" is always in the user's local timezone
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export const getTodaysDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get a date string in YYYY-MM-DD format from a Date object in local timezone
 * @param {Date} date - The date object to format
 * @returns {string} Date in YYYY-MM-DD format
 */
export const getLocalDateString = (date) => {
  if (!date || !(date instanceof Date)) {
    return '';
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Check if a date string represents today
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {boolean} True if the date is today
 */
export const isToday = (dateString) => {
  return dateString === getTodaysDateString();
};

/**
 * Check if a date string represents a past date
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {boolean} True if the date is in the past
 */
export const isPastDate = (dateString) => {
  return dateString < getTodaysDateString();
};

/**
 * Check if a date string represents a future date
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {boolean} True if the date is in the future
 */
export const isFutureDate = (dateString) => {
  return dateString > getTodaysDateString();
};

/**
 * Validate that a date is not in the past (allows today and future dates)
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {boolean} True if the date is valid (today or future)
 */
export const isValidScheduleDate = (dateString) => {
  return !isPastDate(dateString);
};

/**
 * Get the minimum date that should be allowed for scheduling (today)
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export const getMinScheduleDate = () => {
  return getTodaysDateString();
};

/**
 * Convert a time string (HH:mm) in UTC to a target time zone
 * @param {string} time - Time in HH:mm format (UTC)
 * @param {string} timeZone - Target time zone (from TIME_ZONES)
 * @returns {string} Time in HH:mm format in target time zone
 */

export const convertUTCToTimeZone = (time, timeZone) => {
  if (!time || !timeZone) return time;
  // Create a date object for today with the given time in UTC
  const [hours, minutes] = time.split(':').map(Number);
  const utcDate = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  // Use Intl.DateTimeFormat to convert to target time zone
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone
    });
    return formatter.format(utcDate);
  } catch (e) {
    // Fallback: return original time if timeZone is invalid
    console.error('Timezone conversion error in convertUTCToTimeZone:', e);
    return time;
  }
};

/**
 * Convert a time string (HH:mm) in a target time zone to UTC
 * This uses JavaScript's timezone offset calculation for accuracy
 * @param {string} time - Time in HH:mm format in target time zone
 * @param {string} timeZone - Source time zone (from TIME_ZONES)
 * @returns {string} Time in HH:mm format in UTC
 */
export const convertTimeZoneToUTC = (time, timeZone) => {
  if (!time || !timeZone) return time;
  try {
    const [hours, minutes] = time.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) {
      console.warn('Invalid time format:', time);
      return time;
    }

    // Create a reference date with the time in the target timezone
    // Use a date that's NOT a DST transition date (Jan 1, 2000)
    const referenceDate = new Date(2000, 0, 1, hours, minutes, 0, 0);
    
    // Get the timezone offset by formatting the reference date
    const formatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone
    });
    
    const parts = formatter.formatToParts(referenceDate);
    const partMap = {};
    parts.forEach(p => {
      partMap[p.type] = p.value;
    });
    
    const tzHours = parseInt(partMap.hour, 10);
    const tzMinutes = parseInt(partMap.minute, 10);
    
    // Calculate the offset between the formatted time and our reference time
    const offsetMinutes = (hours * 60 + minutes) - (tzHours * 60 + tzMinutes);
    
    // Apply offset to get UTC time
    let utcHours = hours - Math.floor(offsetMinutes / 60);
    let utcMinutes = minutes - (offsetMinutes % 60);
    
    // Handle minute overflow
    if (utcMinutes < 0) {
      utcHours--;
      utcMinutes += 60;
    }
    if (utcMinutes >= 60) {
      utcHours++;
      utcMinutes -= 60;
    }
    
    // Handle hour overflow (normalize to 24-hour format)
    utcHours = ((utcHours % 24) + 24) % 24;

    return `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`;
  } catch (e) {
    console.error('UTC conversion error in convertTimeZoneToUTC:', e);
    return time;
  }
};
