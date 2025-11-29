#!/usr/bin/env node

/**
 * Health Check Script for Docker
 * This script is used by Docker to check if the application is healthy
 */

const http = require('http');

const options = {
  host: 'localhost',
  port: process.env.PORT || 5000,
  path: '/health',
  timeout: 2000,
  method: 'GET'
};

const request = http.request(options, (response) => {
  console.log(`Health check status: ${response.statusCode}`);
  if (response.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', (error) => {
  console.error('Health check failed:', error.message);
  process.exit(1);
});

request.on('timeout', () => {
  console.error('Health check timeout');
  request.abort();
  process.exit(1);
});

request.end();