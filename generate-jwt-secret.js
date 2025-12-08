#!/usr/bin/env node
/**
 * Generate a secure JWT_SECRET
 * Usage: node generate-jwt-secret.js
 */

const crypto = require('crypto');

// Generate a 64-byte (512-bit) random secret
const secret = crypto.randomBytes(64).toString('hex');

console.log('\n✅ Generated JWT_SECRET:');
console.log(secret);
console.log('\n📝 Add this to your .env file:');
console.log(`JWT_SECRET=${secret}`);
console.log('\n⚠️  Keep this secret secure and never commit it to version control!\n');

