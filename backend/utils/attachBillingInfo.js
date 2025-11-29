const ClassBillingTransaction = require('../models/ClassBillingTransaction');

// Helper to get durationMinutes and status for a session participant
async function attachBillingInfoToParticipants(participants) {
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
  }).select('classId tutorId durationMinutes status');

  // Build a lookup
  const lookup = {};
  transactions.forEach(tx => {
    lookup[`${tx.classId}_${tx.tutorId}`] = {
      durationMinutes: tx.durationMinutes,
      status: tx.status
    };
  });

  // Attach durationMinutes and status to each participant
  return participants.map(p => {
    const classId = p.meeting_class_id?._id || p.meeting_class_id;
    const tutorId = p.meeting_class_id?.tutor?._id || p.meeting_class_id?.tutor;
    const key = `${classId}_${tutorId}`;
    const billing = lookup[key] || {};
    return { ...p.toObject(), durationMinutes: billing.durationMinutes ?? null, paymentStatus: billing.status ?? null };
  });
}

module.exports = { attachBillingInfoToParticipants };