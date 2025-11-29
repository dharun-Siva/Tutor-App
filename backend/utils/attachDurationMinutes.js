const ClassBillingTransaction = require('../models/ClassBillingTransaction');

// Helper to get durationMinutes for a session participant
async function attachDurationMinutesToParticipants(participants) {
  // Get all unique classId/tutorId pairs
  const pairs = participants.map(p => ({
    classId: p.meeting_class_id?._id || p.meeting_class_id,
    tutorId: p.meeting_class_id?.tutor?._id || p.meeting_class_id?.tutor
  }));
  // Remove duplicates
  const uniquePairs = Array.from(new Set(pairs.map(JSON.stringify))).map(JSON.parse);

  // Fetch all relevant transactions in one go
  const transactions = await ClassBillingTransaction.find({
    $or: uniquePairs.map(pair => ({ classId: pair.classId, tutorId: pair.tutorId }))
  }).select('classId tutorId durationMinutes');

  // Build a lookup
  const lookup = {};
  transactions.forEach(tx => {
    lookup[`${tx.classId}_${tx.tutorId}`] = tx.durationMinutes;
  });

  // Attach durationMinutes to each participant
  return participants.map(p => {
    const classId = p.meeting_class_id?._id || p.meeting_class_id;
    const tutorId = p.meeting_class_id?.tutor?._id || p.meeting_class_id?.tutor;
    const key = `${classId}_${tutorId}`;
    return { ...p.toObject(), durationMinutes: lookup[key] ?? null };
  });
}

module.exports = { attachDurationMinutesToParticipants };