const User = require('../models/User');
const mongoose = require('mongoose');

// Sample User Creation Examples
async function createSampleUsers() {
  try {
    // Create SuperAdmin
    const superAdmin = await User.createUser({
      email: 'superadmin@education.com',
      username: 'superadmin',
      password: 'SuperAdmin123!',
      role: 'superadmin',
      firstName: 'Super',
      lastName: 'Admin',
      phoneNumber: '+1234567890'
    });
    console.log('SuperAdmin created:', superAdmin._id);

    // Create Admin (requires center assignment)
    const admin = await User.createUser({
      email: 'admin@center1.com',
      username: 'admin_center1',
      password: 'AdminPass123!',
      role: 'admin',
      firstName: 'John',
      lastName: 'Admin',
      phoneNumber: '+1234567891',
      assignments: {
        center: new mongoose.Types.ObjectId() // Replace with actual center ID
      }
    });
    console.log('Admin created:', admin._id);

    // Create Tutor (requires class assignments)
    const tutor = await User.createUser({
      email: 'tutor@education.com',
      username: 'tutor_math',
      password: 'TutorPass123!',
      role: 'tutor',
      firstName: 'Jane',
      lastName: 'Smith',
      phoneNumber: '+1234567892',
      assignments: {
        classes: [
          new mongoose.Types.ObjectId(), // Replace with actual class IDs
          new mongoose.Types.ObjectId()
        ]
      }
    });
    console.log('Tutor created:', tutor._id);

    // Create Student (requires class assignments)
    const student = await User.createUser({
      email: 'student@education.com',
      username: 'student_john',
      password: 'StudentPass123!',
      role: 'student',
      firstName: 'Mike',
      lastName: 'Johnson',
      assignments: {
        classes: [
          new mongoose.Types.ObjectId() // Replace with actual class ID
        ]
      }
    });
    console.log('Student created:', student._id);

    // Create Parent (requires children assignments)
    const parent = await User.createUser({
      email: 'parent@education.com',
      username: 'parent_mary',
      password: 'ParentPass123!',
      role: 'parent',
      firstName: 'Mary',
      lastName: 'Johnson',
      phoneNumber: '+1234567893',
      assignments: {
        children: [student._id] // Assign the created student as child
      }
    });
    console.log('Parent created:', parent._id);

    return { superAdmin, admin, tutor, student, parent };

  } catch (error) {
    console.error('Error creating sample users:', error.message);
    throw error;
  }
}

// Authentication Examples
async function authenticateUser(identifier, password, role) {
  try {
    const user = await User.findByCredentials(identifier, password, role);
    console.log('Authentication successful for:', user.username);
    return user;
  } catch (error) {
    console.error('Authentication failed:', error.message);
    throw error;
  }
}

// Password Management Examples
async function changeUserPassword(userId, currentPassword, newPassword) {
  try {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new Error('User not found');
    }

    await user.changePassword(currentPassword, newPassword);
    console.log('Password changed successfully for user:', user.username);
    return user;
  } catch (error) {
    console.error('Password change failed:', error.message);
    throw error;
  }
}

// Permission Check Examples
async function checkUserPermissions(userId, permission) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const hasPermission = user.hasPermission(permission);
    console.log(`User ${user.username} ${hasPermission ? 'has' : 'does not have'} permission: ${permission}`);
    return hasPermission;
  } catch (error) {
    console.error('Permission check failed:', error.message);
    throw error;
  }
}

// Resource Access Check Examples
async function checkResourceAccess(userId, resourceType, resourceId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const canAccess = user.canAccessResource(resourceType, resourceId);
    console.log(`User ${user.username} ${canAccess ? 'can' : 'cannot'} access ${resourceType}: ${resourceId}`);
    return canAccess;
  } catch (error) {
    console.error('Resource access check failed:', error.message);
    throw error;
  }
}

// Query Users by Role Examples
async function getUsersByRole(role, filters = {}) {
  try {
    const query = User.getRoleBasedQuery(role, null, filters.assignments);
    const users = await User.find(query)
      .populate('assignments.center', 'name location')
      .populate('assignments.classes', 'name subject')
      .populate('assignments.children', 'firstName lastName username')
      .select('-password');

    console.log(`Found ${users.length} users with role: ${role}`);
    return users;
  } catch (error) {
    console.error('Query users failed:', error.message);
    throw error;
  }
}

// Usage Examples
async function runExamples() {
  try {
    // Create sample users
    console.log('=== Creating Sample Users ===');
    const users = await createSampleUsers();

    // Authenticate users
    console.log('\n=== Authentication Examples ===');
    await authenticateUser('superadmin@education.com', 'SuperAdmin123!', 'superadmin');
    await authenticateUser('tutor_math', 'TutorPass123!', 'tutor');

    // Check permissions
    console.log('\n=== Permission Check Examples ===');
    await checkUserPermissions(users.admin._id, 'manage_center');
    await checkUserPermissions(users.tutor._id, 'manage_center'); // Should fail

    // Check resource access
    console.log('\n=== Resource Access Examples ===');
    await checkResourceAccess(users.tutor._id, 'class', users.tutor.assignments.classes[0]);

    // Query users by role
    console.log('\n=== Query Users by Role ===');
    await getUsersByRole('tutor');
    await getUsersByRole('student');

  } catch (error) {
    console.error('Example execution failed:', error.message);
  }
}

module.exports = {
  createSampleUsers,
  authenticateUser,
  changeUserPassword,
  checkUserPermissions,
  checkResourceAccess,
  getUsersByRole,
  runExamples
};
