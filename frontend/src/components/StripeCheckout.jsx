import React, { useState, useEffect } from 'react';
import {
  useStripe,
  useElements,
  PaymentElement,
  Elements
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import axios from 'axios';
import './StripeCheckout.css';

const StripeCheckout = ({ 
  transactionId, 
  amount, 
  onSuccess, 
  onCancel,
  currency = 'USD'
}) => {
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize Stripe
  useEffect(() => {
    const publishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
    console.log('🔑 Stripe publishable key available:', !!publishableKey);
    
    if (publishableKey) {
      loadStripe(publishableKey)
        .then(stripe => {
          console.log('✅ Stripe loaded:', !!stripe);
          setStripePromise(stripe);
        })
        .catch(err => {
          console.error('❌ Failed to load Stripe:', err);
          setError('Failed to load Stripe');
          setLoading(false);
        });
    } else {
      setError('Stripe not configured');
      setLoading(false);
    }
  }, []);

  // Create payment intent on mount
  useEffect(() => {
    if (transactionId && amount) {
      createPaymentIntent();
    }
  }, [transactionId, amount]);

  const createPaymentIntent = async () => {
    try {
      setError(null);
      setLoading(true);

      // Get token from the correct localStorage key
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      console.log(`📤 Creating payment intent... Amount: ${amount} ${currency}`);

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/payments/create-intent`,
        {
          billingTransactionId: transactionId,
          amount: amount,
          currency: currency || 'USD'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Payment intent response:', response.data);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create payment intent');
      }

      setClientSecret(response.data.clientSecret);
      console.log('✅ Client secret set:', response.data.clientSecret.substring(0, 20) + '...');
      setLoading(false);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Error creating payment';
      setError(errorMsg);
      console.error('❌ Error creating payment intent:', err);
      setLoading(false);
    }
  };

  if (loading && !stripePromise) {
    return <div className="stripe-loading">Initializing Stripe...</div>;
  }

  if (error && !stripePromise) {
    return (
      <div className="stripe-error">
        <p>Error: {error}</p>
        <button onClick={onCancel}>Close</button>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div className="stripe-error">
        <p>Stripe failed to load</p>
        <button onClick={onCancel}>Close</button>
      </div>
    );
  }

  if (loading && !clientSecret) {
    return <div className="stripe-loading">Loading payment options...</div>;
  }

  if (!clientSecret) {
    return (
      <div className="stripe-error">
        <p>Failed to create payment session: {error}</p>
        <button onClick={onCancel}>Close</button>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#6366f1',
            colorBackground: '#ffffff',
            colorText: '#1f2937',
            colorDanger: '#ef4444',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            spacingUnit: '4px',
            borderRadius: '8px'
          },
        },
      }}
    >
      <CheckoutForm
        onSuccess={onSuccess}
        onCancel={onCancel}
        transactionId={transactionId}
        amount={amount}
        currency={currency}
      />
    </Elements>
  );
};

const CheckoutForm = ({ onSuccess, onCancel, transactionId, amount, currency }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Debug logging
  useEffect(() => {
    console.log('🔍 CheckoutForm mounted - Stripe available:', !!stripe, 'Elements available:', !!elements);
  }, [stripe, elements]);

  const handlePayment = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError('Stripe not loaded');
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Confirm payment using PaymentElement
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
          payment_method_data: {
            billing_details: {
              email: localStorage.getItem('userEmail') || 'unknown@example.com'
            }
          }
        },
        redirect: 'if_required'
      });

      if (result.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

      const paymentIntent = result.paymentIntent;

      // Payment succeeded
      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
        console.log('✅ Payment Intent:', paymentIntent);
        
        // Call success callback with complete payment details
        if (onSuccess) {
          onSuccess({
            transactionId: transactionId,
            id: paymentIntent.id,  // Stripe PaymentIntent ID
            stripeTransactionId: paymentIntent.charges?.data?.[0]?.id,
            status: paymentIntent.status,
            amount: amount,
            currency: currency,  // Include the currency
            paymentMethod: paymentIntent.payment_method_types?.[0],
            paymentIntent: paymentIntent  // Full payment intent object
          });
        }
      } else if (paymentIntent?.status === 'requires_action') {
        setError('Additional authentication required. Please check your payment method.');
      } else {
        throw new Error(`Payment failed with status: ${paymentIntent?.status}`);
      }
    } catch (err) {
      console.error('Error processing payment:', err);
      setError(err.message || 'Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stripe-checkout-container">
      <div className="stripe-checkout-card">
        <div className="payment-header">
          <h2>Complete Payment</h2>
          <p className="payment-subtitle">Secure payment powered by Stripe</p>
        </div>

        {/* Payment Summary */}
        <div className="payment-summary">
          <div className="summary-item">
            <span className="summary-label">Transaction ID</span>
            <span className="summary-value">{transactionId}</span>
          </div>
          <div className="summary-divider"></div>
          
          <div className="summary-item amount-summary">
            <span className="summary-label">Amount to Pay</span>
            <span className="summary-amount">{currency} {Number(amount).toFixed(2)}</span>
          </div>
        </div>

        {/* Main Payment Form */}
        <form onSubmit={handlePayment} className="payment-form">
          <div className="form-section">
            <label className="form-label">💳 Payment Method</label>
            <div className="payment-element-wrapper">
              {stripe && elements ? (
                <>
                  <PaymentElement />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '12px' }}>
                    Enter your card details above to proceed with payment
                  </p>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: '#9ca3af' }}>
                  <p>Loading payment options...</p>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message-container">
              <div className="error-icon">⚠️</div>
              <div className="error-text">
                <p className="error-title">Payment Error</p>
                <p className="error-detail">{error}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="button-group">
            <button
              type="button"
              className="cancel-btn"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel Payment
            </button>
            <button
              type="submit"
              className="pay-btn"
              disabled={loading || !stripe || !elements}
            >
              <span className="btn-icon">🔒</span>
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Processing...
                </>
              ) : (
                `Pay ${currency} ${Number(amount).toFixed(2)}`
              )}
            </button>
          </div>

          {/* Security Notice */}
          <div className="security-notice">
            <span className="lock-icon">🔐</span>
            <span>Your payment information is secure and encrypted by Stripe</span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StripeCheckout;
