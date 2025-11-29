const { pgClient } = require('../db');
const { ObjectId } = require('mongodb');

async function updateTableIdsToObjectId(tableName) {
  // Get all records
  const res = await pgClient.query(`SELECT id FROM ${tableName}`);
  const records = res.rows;

  for (const record of records) {
    // If id is already a valid ObjectId, skip
    if (/^[a-fA-F0-9]{24}$/.test(record.id)) continue;
    // Generate a new ObjectId
    const newId = new ObjectId().toHexString();
    // Update the id
    await pgClient.query(`UPDATE ${tableName} SET id = $1 WHERE id = $2`, [newId, record.id]);
    // You may need to update foreign keys in related tables as well
  }
  console.log(`${tableName} IDs updated to ObjectId format.`);
}

async function main() {
  await updateTableIdsToObjectId('users');
  await updateTableIdsToObjectId('centers');
  // Add other tables if needed
  pgClient.end();
}

main().catch(err => {
  console.error('Update error:', err);
  pgClient.end();
});
