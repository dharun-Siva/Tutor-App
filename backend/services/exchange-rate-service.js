/**
 * Exchange Rate Service
 * Handles currency conversion to INR (Indian Rupees)
 * Uses cached rates to minimize API calls
 */

const axios = require('axios');

class ExchangeRateService {
  constructor() {
    // Cache exchange rates for 1 hour (3600000 ms)
    this.CACHE_DURATION = 3600000;
    this.rates = {
      INR: 1, // Base currency
      USD: null,
      EUR: null,
      GBP: null,
      AUD: null,
      CAD: null
    };
    this.lastFetchTime = 0;
  }

  /**
   * Fetch fresh exchange rates from API
   * Using exchangerate-api.com or similar
   * Falls back to hardcoded rates if API fails
   */
  async fetchFreshRates() {
    try {
      console.log('🌐 Fetching fresh exchange rates...');
      
      // Using exchangerate-api.com free tier
      // Fallback: If API key not available, use hardcoded rates
      const apiKey = process.env.EXCHANGE_RATE_API_KEY || 'free';
      const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/INR`;

      const response = await axios.get(url, { timeout: 5000 });
      
      if (response.data && response.data.conversion_rates) {
        const conversionRates = response.data.conversion_rates;
        
        // Store rates (rates are "how many INR per 1 foreign currency")
        // But we need the inverse (how many foreign currency per 1 INR)
        // Actually, exchangerate-api returns rates FROM INR TO other currencies
        // So we need to invert: if 1 INR = 0.012 USD, then 1 USD = 83.3 INR
        
        this.rates.USD = conversionRates.USD ? (1 / conversionRates.USD) : this.rates.USD;
        this.rates.EUR = conversionRates.EUR ? (1 / conversionRates.EUR) : this.rates.EUR;
        this.rates.GBP = conversionRates.GBP ? (1 / conversionRates.GBP) : this.rates.GBP;
        this.rates.AUD = conversionRates.AUD ? (1 / conversionRates.AUD) : this.rates.AUD;
        this.rates.CAD = conversionRates.CAD ? (1 / conversionRates.CAD) : this.rates.CAD;
        
        this.lastFetchTime = Date.now();
        console.log('✅ Exchange rates updated:', this.rates);
        
        return this.rates;
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch fresh exchange rates:', error.message);
      console.log('📌 Using cached/default rates');
    }

    // Fallback to default rates if API fails
    return this.getDefaultRates();
  }

  /**
   * Get default exchange rates (hardcoded fallback)
   * These are approximate rates - update monthly
   * Format: 1 USD/EUR/etc = X INR
   */
  getDefaultRates() {
    return {
      INR: 1,
      USD: 83.50,      // 1 USD = 83.50 INR (approximate, Nov 2025)
      EUR: 90.00,      // 1 EUR = 90 INR (approximate)
      GBP: 105.00,     // 1 GBP = 105 INR (approximate)
      AUD: 54.00,      // 1 AUD = 54 INR (approximate)
      CAD: 59.00       // 1 CAD = 59 INR (approximate)
    };
  }

  /**
   * Get current exchange rates (cached or fresh)
   */
  async getRates() {
    const now = Date.now();
    
    // Refresh rates if cache is expired or rates not loaded
    if (!this.lastFetchTime || (now - this.lastFetchTime > this.CACHE_DURATION)) {
      await this.fetchFreshRates();
    }

    // If still no rates, use defaults
    if (!this.rates.USD) {
      this.rates = this.getDefaultRates();
    }

    return this.rates;
  }

  /**
   * Convert amount from source currency to INR
   * @param {number} amount - Amount in source currency
   * @param {string} sourceCurrency - Source currency code (USD, EUR, GBP, etc.)
   * @returns {Promise<Object>} { amountInINR, conversionRate, sourceCurrency }
   */
  async convertToINR(amount, sourceCurrency = 'INR') {
    // Normalize currency code
    sourceCurrency = (sourceCurrency || 'INR').toUpperCase().trim();

    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // If already in INR, no conversion needed
    if (sourceCurrency === 'INR') {
      return {
        amountInINR: amount,
        conversionRate: 1,
        sourceCurrency: 'INR',
        targetCurrency: 'INR',
        originalAmount: amount
      };
    }

    // Get current rates
    const rates = await this.getRates();

    // Check if currency is supported
    if (!rates[sourceCurrency]) {
      throw new Error(`Unsupported currency: ${sourceCurrency}. Supported: USD, EUR, GBP, AUD, CAD, INR`);
    }

    const conversionRate = rates[sourceCurrency];
    const amountInINR = amount * conversionRate;

    return {
      amountInINR: Math.round(amountInINR * 100) / 100, // Round to 2 decimal places
      conversionRate,
      sourceCurrency,
      targetCurrency: 'INR',
      originalAmount: amount,
      formattedDisplay: `${sourceCurrency} ${amount.toFixed(2)} = ₹ ${(amountInINR).toFixed(2)}`
    };
  }

  /**
   * Get human-readable conversion display
   * @param {number} amount - Amount in source currency
   * @param {string} sourceCurrency - Source currency code
   * @returns {Promise<string>} Formatted conversion string
   */
  async getConversionDisplay(amount, sourceCurrency = 'INR') {
    const conversion = await this.convertToINR(amount, sourceCurrency);
    return conversion.formattedDisplay;
  }

  /**
   * Get conversion rate between two currencies (via INR)
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {Promise<number>} Conversion rate
   */
  async getConversionRate(fromCurrency = 'INR', toCurrency = 'INR') {
    const rates = await this.getRates();

    if (!rates[fromCurrency] || !rates[toCurrency]) {
      throw new Error(`Unsupported currency pair: ${fromCurrency} to ${toCurrency}`);
    }

    // Calculate rate: how many toCurrency equals 1 fromCurrency
    // E.g., how many INR = 1 USD
    return rates[toCurrency] / rates[fromCurrency];
  }
}

// Create singleton instance
const instance = new ExchangeRateService();

module.exports = instance;
