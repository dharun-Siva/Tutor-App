#!/usr/bin/env node

/**
 * Generate secure JWT secrets for production
 * Run this script to generate new JWT secrets for your production environment
 */

const crypto = require('crypto');

console.log('🔐 Generating Secure JWT Secrets for Production...\n');

// Generate secure random strings
const generateSecret = (length = 64) => {
  return crypto.randomBytes(length).toString('base64');
};

const jwtSecret = generateSecret(64);
const jwtRefreshSecret = generateSecret(64);
const sessionSecret = generateSecret(32);

console.log('📋 Copy these to your production .env file:');
console.log('=' .repeat(60));
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`JWT_REFRESH_SECRET=${jwtRefreshSecret}`);
console.log(`SESSION_SECRET=${sessionSecret}`);
console.log('=' .repeat(60));

console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
console.log('- Keep these secrets secure and never commit them to version control');
console.log('- Use different secrets for development, staging, and production');
console.log('- Rotate these secrets periodically (every 6-12 months)');
console.log('- Store them securely in your deployment environment');

console.log('\n🔧 Additional Security Recommendations:');
console.log('- Use environment variable injection in your deployment platform');
console.log('- Consider using a secret management service (AWS Secrets Manager, etc.)');
console.log('- Enable 2FA on all production accounts');
console.log('- Use HTTPS everywhere');
console.log('- Set up proper CORS policies');

console.log('\n✅ Next Steps:');
console.log('1. Update your production .env file with these secrets');
console.log('2. Configure your production database connection');
console.log('3. Set up SSL certificates');
console.log('4. Configure your Agora production credentials');
console.log('5. Set up monitoring and logging');