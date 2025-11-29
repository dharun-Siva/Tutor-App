import React, { useEffect, useState, useRef } from 'react';
import { sessionParticipantsAPI } from '../../../utils/api';
import './SessionParticipantsTable.css';

const SessionParticipantsSummaryCards = ({ user, participants: participantsProp }) => {
  const [participants, setParticipants] = useState(participantsProp || []);
  const [loading, setLoading] = useState(!participantsProp);
  const [error, setError] = useState(null);
  
  // Ref to prevent duplicate API calls on mount
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    // Only fetch if participants are not provided as prop
    if (!participantsProp && !dataLoadedRef.current) {
      dataLoadedRef.current = true;
      fetchSessionParticipants();
    } else if (participantsProp) {
      setParticipants(participantsProp);
      setLoading(false);
    }
  }, [participantsProp]); // Depend on participantsProp

  const fetchSessionParticipants = async () => {
    try {
      setLoading(true);
      const response = await sessionParticipantsAPI.getHistory();
      if (response.data.success) {
        setParticipants(response.data.data);
      } else {
        setError('Failed to fetch session participants');
      }
    } catch (err) {
      setError('Failed to fetch session participants');
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary values
  let totalAmount = 0;
  let paidAmount = 0;
  let unpaidAmount = 0;

  let currency = 'USD'; // Default currency
  let attendedClassIds = new Set();
  
  console.log('🔍 [BILLING CALC] Processing participants:', participants.length);
  
  participants.forEach((participant, index) => {
    console.log(`🔍 [BILLING CALC] Participant ${index}:`, {
      total_payable: participant.total_payable,
      paymentStatus: participant.paymentStatus || participant.classObj?.paymentStatus
    });
    
    // Use total_payable from the Amount column instead of hourly rate
    let amount = 0;
    if (participant.total_payable !== undefined && participant.total_payable !== null) {
      amount = Number(participant.total_payable);
    }
    
    // Extract currency - check multiple sources to get the actual currency being used
    if (participant.currency && participant.currency !== 'USD') {
      currency = participant.currency;
    } else if (participant.classObj?.currency && participant.classObj?.currency !== 'USD') {
      currency = participant.classObj.currency;
    } else if (participant.currencyCode && participant.currencyCode !== 'USD') {
      currency = participant.currencyCode;
    } else if (participant.amount_currency && participant.amount_currency !== 'USD') {
      currency = participant.amount_currency;
    }
    
    console.log(`🔍 [BILLING CALC] Participant ${index} amount:`, amount, 'currency:', currency);
    
    if (amount > 0) {
      totalAmount += amount;
      
      // Check payment status (use participant's paymentStatus first, then class paymentStatus)
      const paymentStatus = participant.paymentStatus || participant.classObj?.paymentStatus;
      if (paymentStatus && paymentStatus.toLowerCase() === 'paid') {
        paidAmount += amount;
      } else {
        unpaidAmount += amount;
      }
    }
    
    // Count unique classes attended (by meeting_class_id)
    if (participant.meeting_class_id && participant.joined_at) {
      attendedClassIds.add(participant.meeting_class_id._id || participant.meeting_class_id);
    }
  });
  
  console.log('🔍 [BILLING CALC] Final totals:', {
    totalAmount,
    paidAmount,
    unpaidAmount,
    currency
  });
  const numClassesAttended = attendedClassIds.size;

  // Format numbers
  const formatAmount = (amount) =>
    `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) return null;
  if (error) return null;

  return (
    <div className="summary-cards-row" style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
      <div className="summary-card" style={{ background: '#f8f9fa', borderRadius: 12, padding: 20, minWidth: 160, boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 4 }}>Total Amount</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#333' }}>{formatAmount(totalAmount)}</div>
      </div>
      <div className="summary-card" style={{ background: '#e6f9ed', borderRadius: 12, padding: 20, minWidth: 160, boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, color: '#4cd964', marginBottom: 4 }}>Paid</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#2e8b57' }}>{formatAmount(paidAmount)}</div>
      </div>
      <div className="summary-card" style={{ background: '#fff4f4', borderRadius: 12, padding: 20, minWidth: 160, boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, color: '#ff6b6b', marginBottom: 4 }}>Unpaid</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#c0392b' }}>{formatAmount(unpaidAmount)}</div>
      </div>
      <div className="summary-card" style={{ background: '#f0f7ff', borderRadius: 12, padding: 20, minWidth: 160, boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, color: '#4285f4', marginBottom: 4 }}>No. of Classes Attended</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#1a4e8a' }}>{numClassesAttended}</div>
      </div>
    </div>
  );
};

export default SessionParticipantsSummaryCards;