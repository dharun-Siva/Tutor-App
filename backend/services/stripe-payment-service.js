const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const BillingTransaction = require('../models/BillingTransaction');
const sequelize = require('../config/database/config');
const { DataTypes } = require('sequelize');
const ClassBilling = require('../models/sequelize/ClassBilling')(sequelize, DataTypes);

class StripePaymentService {
  /**
   * Create a Stripe PaymentIntent for a billing transaction
   * @param {string} billingTransactionId - Database ID of the transaction
   * @param {number} amount - Amount in the specified currency
   * @param {string} currency - Currency code (USD, EUR, GBP, INR, CAD, AUD)
   * @param {Object} metadata - Additional metadata to attach to PaymentIntent
   * @returns {Promise<Object>} PaymentIntent object with clientSecret
   */
  static async createPaymentIntent(billingTransactionId, amount, currency = 'USD', metadata = {}) {
    try {
      // Stripe expects amount in the smallest currency unit
      // For most currencies: multiply by 100 (USD: cents, EUR: cents, GBP: pence)
      // For JPY: no decimal places
      // For INR: multiply by 100 (paise)
      const minorUnits = currency === 'JPY' ? 1 : 100;
      const amountInMinorUnits = Math.round(amount * minorUnits);

      // Minimum amount validation (Stripe minimums vary by currency)
      const minimums = {
        'USD': 50,      // $0.50
        'EUR': 50,      // €0.50
        'GBP': 30,      // £0.30
        'INR': 100,     // ₹1
        'CAD': 50,      // C$0.50
        'AUD': 50       // A$0.50
      };

      if (amountInMinorUnits < (minimums[currency] || 50)) {
        return {
          success: false,
          error: `Amount is below minimum for ${currency}`
        };
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInMinorUnits,
        currency: currency.toLowerCase(),
        metadata: {
          billingTransactionId,
          ...metadata
        },
        automatic_payment_methods: {
          enabled: true
        }
      });

      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retrieve PaymentIntent status
   * @param {string} paymentIntentId - Stripe PaymentIntent ID
   * @returns {Promise<Object>} PaymentIntent details
   */
  static async retrievePaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      return {
        success: true,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        chargeId: paymentIntent.charges.data[0]?.id || null,
        paymentMethod: paymentIntent.payment_method,
        metadata: paymentIntent.metadata
      };
    } catch (error) {
      console.error('Error retrieving payment intent:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Confirm a payment after successful Stripe client-side confirmation
   * @param {string} paymentIntentId - Stripe PaymentIntent ID
   * @param {string} billingTransactionId - Database transaction ID (can be classId from class_billing table)
   * @param {Object} paymentDetails - Additional payment details
   * @returns {Promise<Object>} Confirmation result
   */
  static async confirmPayment(paymentIntentId, billingTransactionId, paymentDetails = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        const chargeId = paymentIntent.charges?.data?.[0]?.id || null;

        // Update class_billing table with Stripe transaction details
        console.log(`✅ Storing payment details for class_billing ID: ${billingTransactionId}`);
        await this._updateClassBillingWithPayment(billingTransactionId, paymentIntent);

        return {
          success: true,
          message: 'Payment confirmed successfully',
          status: paymentIntent.status,
          transactionId: billingTransactionId,
          stripeTransactionId: chargeId,
          stripePaymentIntentId: paymentIntentId
        };
      } else {
        return {
          success: false,
          message: `Payment status: ${paymentIntent.status}`,
          status: paymentIntent.status
        };
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update class_billing table with Stripe payment information
   * @private
   * @param {string} classId - Class ID from class_billing table
   * @param {Object} paymentIntent - Complete Stripe PaymentIntent object
   */
  static async _updateClassBillingWithPayment(classId, paymentIntent) {
    try {
      // Ensure paymentIntent is a plain object (not Stripe object)
      const paymentDetails = JSON.parse(JSON.stringify(paymentIntent));
      
      console.log(`📝 Preparing to store payment details for class: ${classId}`);
      console.log(`📝 Payment Intent ID:`, paymentIntent.id);
      console.log(`📝 Payment Status:`, paymentIntent.status);
      console.log(`📝 Amount:`, paymentIntent.amount);
      
      const updateData = {
        stripe_payment_intent_id: paymentIntent.id,
        transaction_date_time: new Date(paymentIntent.created * 1000),
        transaction_details: paymentDetails, // Store complete object
        status: 'paid'
      };

      console.log(`📝 Update data before DB:`, {
        stripe_payment_intent_id: updateData.stripe_payment_intent_id,
        transaction_date_time: updateData.transaction_date_time,
        has_transaction_details: !!updateData.transaction_details,
        transaction_details_keys: Object.keys(updateData.transaction_details).slice(0, 5)
      });

      const updated = await ClassBilling.update(updateData, {
        where: { id: classId },
        returning: true
      });

      console.log(`✅ Updated class_billing [${classId}] with Stripe payment: ${paymentIntent.id}`);
      console.log(`✅ Rows updated:`, updated[0]);
      
      // Verify the update
      const verification = await ClassBilling.findOne({ where: { id: classId } });
      console.log(`✅ Verification - Stored data:`, {
        id: verification.id,
        stripe_payment_intent_id: verification.stripe_payment_intent_id,
        transaction_date_time: verification.transaction_date_time,
        transaction_details_stored: !!verification.transaction_details,
        transaction_details_size: verification.transaction_details ? JSON.stringify(verification.transaction_details).length : 0
      });

      return updated;
    } catch (error) {
      console.error(`⚠️ Error updating class_billing [${classId}]:`, error.message);
      console.error(`⚠️ Error details:`, error);
      console.error(`⚠️ Stack:`, error.stack);
      // Don't throw - payment was already successful in Stripe
      return null;
    }
  }

  /**
   * Handle webhook events from Stripe
   * @param {string} body - Raw webhook body
   * @param {string} signature - Stripe signature header
   * @returns {Promise<Object>} Event processing result
   */
  static async handleWebhookEvent(body, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      let result = { processed: false };

      switch (event.type) {
        case 'payment_intent.succeeded':
          result = await this._handlePaymentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          result = await this._handlePaymentFailed(event.data.object);
          break;
        case 'charge.refunded':
          result = await this._handleChargeRefunded(event.data.object);
          break;
        default:
          result = { processed: false, message: `Unhandled event type: ${event.type}` };
      }

      return {
        success: true,
        event: event.type,
        ...result
      };
    } catch (error) {
      console.error('Webhook verification error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle successful payment intent
   * @private
   */
  static async _handlePaymentSucceeded(paymentIntent) {
    try {
      const billingTransactionId = paymentIntent.metadata.billingTransactionId;

      // Update class_billing with payment details
      console.log(`✅ Webhook: Storing payment details for class_billing ID: ${billingTransactionId}`);
      await this._updateClassBillingWithPayment(billingTransactionId, paymentIntent);

      return {
        processed: true,
        message: 'Payment succeeded webhook processed',
        billingTransactionId
      };
    } catch (error) {
      console.error('Error handling payment succeeded:', error);
      return {
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * Handle failed payment intent
   * @private
   */
  static async _handlePaymentFailed(paymentIntent) {
    try {
      const billingTransactionId = paymentIntent.metadata.billingTransactionId;

      await BillingTransaction.update(
        {
          status: 'failed',
          paymentReference: `stripe_failed_${paymentIntent.id}`
        },
        {
          where: { id: billingTransactionId }
        }
      );

      return {
        processed: true,
        message: 'Payment failed webhook processed',
        billingTransactionId
      };
    } catch (error) {
      console.error('Error handling payment failed:', error);
      return {
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * Handle charge refund event
   * @private
   */
  static async _handleChargeRefunded(charge) {
    try {
      // Find transaction by stripe charge ID
      const transaction = await BillingTransaction.findOne({
        where: { stripeTransactionId: charge.id }
      });

      if (transaction) {
        await transaction.update({
          status: 'refunded',
          paymentReference: `stripe_refunded_${charge.id}`
        });

        return {
          processed: true,
          message: 'Refund webhook processed',
          transactionId: transaction.id
        };
      }

      return {
        processed: false,
        message: 'Transaction not found for refund'
      };
    } catch (error) {
      console.error('Error handling charge refunded:', error);
      return {
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * Request a refund for a paid transaction
   * @param {string} chargeId - Stripe Charge ID
   * @param {string} billingTransactionId - Database transaction ID
   * @param {string} reason - Reason for refund
   * @returns {Promise<Object>} Refund result
   */
  static async requestRefund(chargeId, billingTransactionId, reason = '') {
    try {
      const refund = await stripe.refunds.create({
        charge: chargeId,
        metadata: {
          reason,
          billingTransactionId
        }
      });

      // Update transaction status
      await BillingTransaction.update(
        {
          status: 'refunded',
          paymentReference: `stripe_refunded_${refund.id}`
        },
        {
          where: { id: billingTransactionId }
        }
      );

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status
      };
    } catch (error) {
      console.error('Error requesting refund:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get payment status from Stripe for a transaction
   * @param {string} billingTransactionId - Database transaction ID
   * @returns {Promise<Object>} Payment status
   */
  static async getPaymentStatus(billingTransactionId) {
    try {
      const transaction = await BillingTransaction.findOne({
        where: { id: billingTransactionId }
      });

      if (!transaction) {
        return {
          success: false,
          error: 'Transaction not found'
        };
      }

      if (transaction.stripePaymentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          transaction.stripePaymentId
        );

        return {
          success: true,
          status: paymentIntent.status,
          transactionStatus: transaction.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          stripeStatus: paymentIntent.status
        };
      }

      return {
        success: true,
        status: transaction.status,
        message: 'No Stripe payment associated'
      };
    } catch (error) {
      console.error('Error getting payment status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  /**
   * Get payment details from class_billing table
   * @param {string} classId - Class ID (primary key from class_billing)
   * @returns {Promise<Object>} Transaction details with Stripe info
   */
  static async getClassBillingPaymentDetails(classId) {
    try {
      const classBilling = await ClassBilling.findOne({
        where: { id: classId }
      });

      if (!classBilling) {
        return {
          success: false,
          error: 'Class billing record not found'
        };
      }

      return {
        success: true,
        id: classBilling.id,
        status: classBilling.status,
        amount: classBilling.amount,
        currency: classBilling.currency,
        stripe_payment_intent_id: classBilling.stripe_payment_intent_id,
        transaction_date_time: classBilling.transaction_date_time,
        transaction_details: classBilling.transaction_details,
        student_id: classBilling.student_id,
        parent_id: classBilling.parent_id,
        month_year: classBilling.month_year,
        billing_generated_date: classBilling.billing_generated_date,
        createdAt: classBilling.createdAt,
        updatedAt: classBilling.updatedAt
      };
    } catch (error) {
      console.error('Error getting class billing payment details:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = StripePaymentService;

