# Student Availability Schema Migration

## Overview

This migration updates the student availability schema to match the tutor availability structure for consistency and improved scheduling functionality.

## Changes Made

### 1. Backend Model Updates (User.js)
- **Old Format**: Students only had `timeSlots` arrays for each day
- **New Format**: Students now have `start`, `end`, and `timeSlots` fields (same as tutors)

```javascript
// Old Format
availability: {
  monday: { 
    available: Boolean,
    timeSlots: [String] // e.g., ["09:00-10:00", "14:00-15:00"]
  }
}

// New Format
availability: {
  monday: { 
    available: Boolean,
    start: String,     // e.g., "09:00"
    end: String,       // e.g., "17:00"
    timeSlots: [String] // Kept for backward compatibility
  }
}
```

### 2. Backend Route Updates (students.js)
- Updated filtering logic to support both old and new formats
- Added start/end time-based filtering similar to tutors
- Maintained backward compatibility with timeSlots

### 3. Frontend Updates

#### StudentSelectionModal.js
- Updated availability display to handle both formats
- Shows start-end times when available
- Falls back to timeSlots display for old data

#### ScheduleClassesTab.js
- Updated conflict checking to work with both formats
- Improved availability validation logic
- Better error messages for conflicts

### 4. Migration Script
- Created `migrateStudentAvailability.js` script
- Converts existing student timeSlots to start/end format
- Preserves original timeSlots for compatibility

## Running the Migration

### Prerequisites
- Node.js and npm installed
- MongoDB connection available
- Backup your database before migration

### Steps

1. **Backup Database**
   ```bash
   mongodump --db tutoring_db --out backup/
   ```

2. **Run Migration Script**
   ```bash
   cd backend
   node scripts/migrateStudentAvailability.js
   ```

3. **Verify Migration**
   - Check console output for migration results
   - Verify student availability data in database
   - Test frontend scheduling functionality

### Environment Variables
Make sure these are set before running the migration:
```bash
MONGO_URL=mongodb://localhost:27017/tutoring_db
```

## Testing

### Manual Testing Checklist
- [ ] Student selection modal displays availability correctly
- [ ] Availability filtering works for both formats
- [ ] Conflict checking validates both tutor and student availability
- [ ] Class scheduling works with migrated data
- [ ] Old data (if any) still displays properly

### API Testing
Test these endpoints with both old and new data:
- `GET /api/students` with availability filters
- Class creation with availability conflicts

## Rollback Plan

If issues occur after migration:

1. **Restore Database Backup**
   ```bash
   mongorestore backup/
   ```

2. **Revert Code Changes**
   ```bash
   git checkout <previous-commit-hash>
   ```

## Benefits of Migration

1. **Consistency**: Student and tutor availability use the same structure
2. **Better Filtering**: More precise time-based filtering
3. **Improved UX**: Clearer availability display in modals
4. **Enhanced Scheduling**: Better conflict detection and resolution

## Support

For issues or questions about the migration:
- Check console logs for migration errors
- Verify database connection and permissions
- Ensure all environment variables are set correctly

## Future Enhancements

With the unified schema, future improvements can include:
- Advanced scheduling algorithms
- Availability templates
- Bulk availability updates
- Calendar integrations
