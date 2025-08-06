const crypto = require('crypto');

// Generate a secure JWT secret
function generateJWTSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

// Generate and display the secret
const jwtSecret = generateJWTSecret();
console.log('Generated JWT Secret:');
console.log(jwtSecret);
console.log('\nCopy this secret and store it securely in your environment variables.');
console.log('Example: JWT_SECRET=' + jwtSecret); 