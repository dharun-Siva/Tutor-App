const { pgClient } = require('../db');

async function migrateRelatedTablesToJsonb() {
  // 1. Get all users
  const usersRes = await pgClient.query('SELECT id, data FROM users');
  const users = usersRes.rows;

  // 2. Migrate parent_child_assignments
  const parentChildRes = await pgClient.query('SELECT * FROM parent_child_assignments');
  const parentChildAssignments = parentChildRes.rows;
  for (const assignment of parentChildAssignments) {
    // Add parent/child info to parent user
    await pgClient.query(
      `UPDATE users SET data = jsonb_set(data, '{children}', to_jsonb($1::text), true) WHERE id = $2`,
      [assignment.child_id, assignment.parent_id]
    );
    // Add parent info to child user
    await pgClient.query(
      `UPDATE users SET data = jsonb_set(data, '{parent}', to_jsonb($1::text), true) WHERE id = $2`,
      [assignment.parent_id, assignment.child_id]
    );
  }

  // 3. Migrate student_profiles
  const studentProfilesRes = await pgClient.query('SELECT * FROM student_profiles');
  const studentProfiles = studentProfilesRes.rows;
  for (const profile of studentProfiles) {
    await pgClient.query(
      `UPDATE users SET data = data || to_jsonb($1::json) WHERE id = $2`,
      [JSON.stringify(profile), profile.user_id]
    );
  }

  // Repeat for other related tables as needed...

  console.log('Migration complete.');
}

migrateRelatedTablesToJsonb()
  .then(() => pgClient.end())
  .catch(err => {
    console.error('Migration error:', err);
    pgClient.end();
  });
