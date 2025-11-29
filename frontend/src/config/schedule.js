// Schedule configuration
export const SCHEDULE_CONFIG = {
  // Buffer time between classes in minutes
  BUFFER_TIME_MINUTES: 5,
  
  // Time slot validation settings
  OVERLAP_VALIDATION: {
    ENABLED: true,
    CHECK_TUTORS: true,
    CHECK_STUDENTS: true,
    INCLUDE_BUFFER: true
  },
  
  // Default class durations
  DEFAULT_DURATIONS: [35, 60, 90, 120],
  
  // Working hours (24-hour format)
  WORKING_HOURS: {
    START: '08:00',
    END: '22:00'
  }
};

export default SCHEDULE_CONFIG;
