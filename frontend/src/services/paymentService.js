import axios from 'axios';
import { loadStripe } from '@stripe/js';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

let stripePromise = null;

/**
 * Initialize Stripe with publishable key
 */
const initializeStripe = async () => {
  if (!stripePromise) {
    const publishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error('Stripe publishable key not configured');
      throw new Error('Stripe publishable key is not configured');
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

class PaymentService {
  /**
   * Initialize Stripe for the application
   * @returns {Promise<Object>} Stripe instance
   */
  static async initStripe() {
    try {
      return await initializeStripe();
    } catch (error) {
      console.error('Error initializing Stripe:', error);
      throw error;
    }
  }

  /**
   * Create a payment intent for a billing transaction
   * @param {string} billingTransactionId - The ID of the billing transaction
   * @param {number} amount - The amount to pay in INR
   * @returns {Promise<Object>} Payment intent details including clientSecret
   */
  static async createPaymentIntent(billingTransactionId, amount) {
    try {
      // Get token from the correct localStorage key
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      const response = await axios.post(
        `${API_BASE_URL}/payments/create-intent`,
        {
          billingTransactionId,
          amount
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create payment intent');
      }

      return response.data;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error.response?.data || error;
    }
  }

  /**
   * Confirm a payment after card elements are confirmed on frontend
   * @param {string} paymentIntentId - The Stripe payment intent ID
   * @param {string} billingTransactionId - The billing transaction ID
   * @returns {Promise<Object>} Confirmation result
   */
  static async confirmPayment(paymentIntentId, billingTransactionId) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/payments/confirm-payment`,
        {
          paymentIntentId,
          billingTransactionId
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to confirm payment');
      }

      return response.data;
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error.response?.data || error;
    }
  }

  /**
   * Get payment status for a transaction
   * @param {string} transactionId - The billing transaction ID
   * @returns {Promise<Object>} Payment status details
   */
  static async getPaymentStatus(transactionId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/payments/status/${transactionId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to get payment status');
      }

      return response.data;
    } catch (error) {
      console.error('Error getting payment status:', error);
      throw error.response?.data || error;
    }
  }

  /**
   * Request a refund for a paid transaction
   * @param {string} transactionId - The billing transaction ID
   * @param {string} chargeId - The Stripe charge ID
   * @param {string} reason - Reason for refund (optional)
   * @returns {Promise<Object>} Refund details
   */
  static async requestRefund(transactionId, chargeId, reason = '') {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/payments/refund`,
        {
          transactionId,
          chargeId,
          reason
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to process refund');
      }

      return response.data;
    } catch (error) {
      console.error('Error requesting refund:', error);
      throw error.response?.data || error;
    }
  }

  /**
   * Retrieve details of a specific PaymentIntent
   * @param {string} paymentIntentId - The Stripe payment intent ID
   * @returns {Promise<Object>} PaymentIntent details
   */
  static async retrievePaymentIntent(paymentIntentId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/payments/retrieve-intent/${paymentIntentId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to retrieve payment intent');
      }

      return response.data;
    } catch (error) {
      console.error('Error retrieving payment intent:', error);
      throw error.response?.data || error;
    }
  }

  /**
   * Get Stripe publishable key for frontend
   * @returns {string} Stripe publishable key from config
   */
  static getStripePublicKey() {
    return process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
  }

  /**
   * Handle payment response and log it
   * @param {Object} paymentResult - Result from Stripe payment processing
   * @returns {Object} Processed result
   */
  static formatPaymentResult(paymentResult) {
    return {
      transactionId: paymentResult.transactionId,
      stripeTransactionId: paymentResult.stripeTransactionId,
      amount: paymentResult.amount,
      currency: paymentResult.currency || 'INR',
      status: paymentResult.status,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate payment amount
   * @param {number} amount - Amount to validate
   * @returns {Object} Validation result
   */
  static validateAmount(amount) {
    const minAmount = 0.01;
    const maxAmount = 999999.99;

    if (!amount || isNaN(amount)) {
      return {
        valid: false,
        error: 'Invalid amount'
      };
    }

    if (amount < minAmount) {
      return {
        valid: false,
        error: `Amount must be at least ₹${minAmount}`
      };
    }

    if (amount > maxAmount) {
      return {
        valid: false,
        error: `Amount cannot exceed ₹${maxAmount}`
      };
    }

    return {
      valid: true,
      amount: parseFloat(amount.toFixed(2))
    };
  }
}

export default PaymentService;
