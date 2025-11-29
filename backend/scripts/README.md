# Setup Scripts

This directory contains scripts to set up sample data for the Tutor App.

## Available Scripts

### 1. Sample Users Setup
```bash
cd backend
node scripts/setupSampleUsers.js
```

### 2. Sample Centers Setup
```bash
cd backend
node scripts/setupSampleCenters.js
```

## Sample Users Script

**What it does:**
1. **Connects to your MongoDB database**
2. **Clears any existing sample users** (to avoid duplicates)
3. **Creates 5 sample users** (one for each role)
4. **Tests authentication** for each user
5. **Displays login credentials** for easy reference

## Sample Centers Script

**What it does:**
1. **Creates sample learning centers**
2. **Creates sample admin users**
3. **Assigns admins to centers**
4. **Creates a SuperAdmin account if none exists**
5. **Leaves some centers without admins for testing**

## Login Credentials

After running the setup script, you can use these credentials:

### SuperAdmin
- **Email**: `superadmin@education.com`
- **Username**: `superadmin` 
- **Password**: `SuperAdmin123!`

### Admin
- **Email**: `admin@center1.com`
- **Username**: `admin_center1`
- **Password**: `AdminPass123!`

### Tutor
- **Email**: `tutor@education.com`
- **Username**: `tutor_math`
- **Password**: `TutorPass123!`

### Student
- **Email**: `student@education.com`
- **Username**: `student_john`
- **Password**: `StudentPass123!`

### Parent
- **Email**: `parent@education.com`
- **Username**: `parent_mary`
- **Password**: `ParentPass123!`

## Prerequisites

Make sure you have:
1. MongoDB running locally or connection string in `.env`
2. All backend dependencies installed (`npm install`)
3. Environment variables set up (`.env` file)

## Troubleshooting

If you encounter issues:
1. Check your MongoDB connection
2. Verify your `.env` file has the correct `MONGODB_URI`
3. Make sure all npm packages are installed
4. Check that the User model is working correctly
