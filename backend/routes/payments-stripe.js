const express = require('express');
const router = express.Router();
const StripePaymentService = require('../services/stripe-payment-service');
const authMiddleware = require('../middleware/auth-postgres');

/**
 * POST /api/payments/create-intent
 * Create a Stripe PaymentIntent for a billing transaction
 * Requires: billingTransactionId, amount, currency (optional, defaults to USD)
 * Supported currencies: USD, EUR, GBP, INR, CAD, AUD
 */
router.post('/create-intent', authMiddleware(['parent', 'user']), async (req, res) => {
  try {
    let { billingTransactionId, amount, currency = 'USD' } = req.body;

    // Convert amount to number if it's a string
    amount = Number(amount);
    currency = (currency || 'USD').toUpperCase().trim();

    if (!billingTransactionId || !amount || isNaN(amount)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid fields: billingTransactionId and amount (must be a number)'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0'
      });
    }

    // Validate currency is supported by Stripe
    const supportedCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'];
    if (!supportedCurrencies.includes(currency)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported currency: ${currency}. Supported currencies: ${supportedCurrencies.join(', ')}`
      });
    }

    const result = await StripePaymentService.createPaymentIntent(
      billingTransactionId,
      amount,
      currency,
      {
        userId: req.user.id,
        userEmail: req.user.email
      }
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment intent',
      details: error.message
    });
  }
});

/**
 * POST /api/payments/confirm-payment
 * Confirm a payment after Stripe client-side processing
 * Requires: paymentIntentId, billingTransactionId
 */
router.post('/confirm-payment', authMiddleware(['parent', 'user']), async (req, res) => {
  try {
    const { paymentIntentId, billingTransactionId } = req.body;

    if (!paymentIntentId || !billingTransactionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: paymentIntentId, billingTransactionId'
      });
    }

    const result = await StripePaymentService.confirmPayment(
      paymentIntentId,
      billingTransactionId,
      {
        userId: req.user.id,
        confirmedAt: new Date()
      }
    );

    res.json(result);
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm payment',
      details: error.message
    });
  }
});

/**
 * GET /api/payments/status/:transactionId
 * Get payment status for a billing transaction
 */
router.get('/status/:transactionId', authMiddleware(['parent', 'user']), async (req, res) => {
  try {
    const { transactionId } = req.params;

    const result = await StripePaymentService.getPaymentStatus(transactionId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment status',
      details: error.message
    });
  }
});

/**
 * POST /api/payments/refund
 * Request a refund for a paid transaction
 * Requires: transactionId, chargeId, reason (optional)
 */
router.post('/refund', authMiddleware(['parent', 'user']), async (req, res) => {
  try {
    const { transactionId, chargeId, reason } = req.body;

    if (!transactionId || !chargeId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: transactionId, chargeId'
      });
    }

    const result = await StripePaymentService.requestRefund(
      chargeId,
      transactionId,
      reason || ''
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error requesting refund:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process refund',
      details: error.message
    });
  }
});

/**
 * POST /api/payments/webhook
 * Stripe webhook endpoint for payment events
 * Requires raw body for signature verification
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing Stripe signature'
      });
    }

    const result = await StripePaymentService.handleWebhookEvent(
      req.body,
      signature
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully',
      event: result.event
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook',
      details: error.message
    });
  }
});

/**
 * GET /api/payments/class-billing/:classId
 * Get stored payment details from class_billing table
 */
router.get('/class-billing/:classId', authMiddleware(['parent', 'user']), async (req, res) => {
  try {
    const { classId } = req.params;

    const result = await StripePaymentService.getClassBillingPaymentDetails(classId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting class billing payment details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment details',
      details: error.message
    });
  }
});

/**
 * GET /api/payments/retrieve-intent/:paymentIntentId
 * Retrieve details of a specific PaymentIntent
 */
router.get('/retrieve-intent/:paymentIntentId', authMiddleware(['parent', 'user']), async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    const result = await StripePaymentService.retrievePaymentIntent(paymentIntentId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error retrieving payment intent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payment intent',
      details: error.message
    });
  }
});

module.exports = router;
