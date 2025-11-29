const { MongoClient } = require('mongodb');
const { Client } = require('pg');

async function migrateAll() {
  // --- MongoDB connection ---
  const mongoClient = new MongoClient('mongodb://localhost:27017');
  await mongoClient.connect();
  const db = mongoClient.db('tutor1');

  const usersCollection = db.collection('users');

  // --- PostgreSQL connection ---
  const pgClient = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'Tutor Application',
    password: 'dharunsiva@1',
    port: 5432,
  });
  await pgClient.connect();

  // --- Fetch all users from MongoDB ---
  const users = await usersCollection.find({}).toArray();
  console.log(`Migrating ${users.length} users...`);

  // --- Step 1: Migrate users, tutor profiles, student profiles, centers, classes ---
  for (const user of users) {
    // --- Users ---
    await pgClient.query(
      `INSERT INTO users (id, email, username, password, role, first_name, last_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [
        user._id.toString(),
        user.email,
        user.username,
        user.password,
        user.role,
        user.firstName,
        user.lastName
      ]
    );

    // --- Tutor profile ---
    if (user.role === 'tutor' && user.tutorProfile) {
      const t = user.tutorProfile;
      await pgClient.query(
        `INSERT INTO tutor_profiles (user_id, date_of_birth, experience, bio, hourly_rate, currency, verification_status, time_zone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (user_id) DO NOTHING`,
        [
          user._id.toString(),
          t.dateOfBirth || null,
          t.experience || 0,
          t.bio || null,
          t.hourlyRate || 0,
          t.currency || 'USD',
          t.verificationStatus || 'pending',
          t.timeZone || null
        ]
      );
    }

    // --- Student profile ---
    if (user.role === 'student' && user.studentProfile) {
      const s = user.studentProfile;
      await pgClient.query(
        `INSERT INTO student_profiles (user_id, date_of_birth, grade, school, parent_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id) DO NOTHING`,
        [
          user._id.toString(),
          s.dateOfBirth || null,
          s.grade || null,
          s.school || null,
          s.parentId ? s.parentId.toString() : null
        ]
      );
    }

    // --- Center assignments ---
    if (user.assignments?.center) {
      await pgClient.query(
        `INSERT INTO user_center_assignments (user_id, center_id)
         VALUES ($1,$2)
         ON CONFLICT (user_id, center_id) DO NOTHING`,
        [user._id.toString(), user.assignments.center.toString()]
      );
    }

    // --- Class assignments ---
    if (user.assignments?.classes && user.assignments.classes.length > 0) {
      for (const classId of user.assignments.classes) {
        await pgClient.query(
          `INSERT INTO user_class_assignments (user_id, class_id)
           VALUES ($1,$2)
           ON CONFLICT (user_id, class_id) DO NOTHING`,
          [user._id.toString(), classId.toString()]
        );
      }
    }
  }

  // --- Step 2: Parent-child assignments ---
  for (const user of users) {
    if (user.assignments?.children && user.assignments.children.length > 0) {
      for (const childId of user.assignments.children) {
        // Ensure child exists
        const res = await pgClient.query(
          `SELECT id FROM users WHERE id = $1`,
          [childId.toString()]
        );
        if (res.rows.length === 0) continue; // skip if child doesn't exist

        await pgClient.query(
          `INSERT INTO parent_child_assignments (parent_id, child_id)
           VALUES ($1,$2)
           ON CONFLICT (parent_id, child_id) DO NOTHING`,
          [user._id.toString(), childId.toString()]
        );
      }
    }
  }

  console.log('Migration completed!');

  await mongoClient.close();
  await pgClient.end();
}

migrateAll().catch(err => console.error(err));
