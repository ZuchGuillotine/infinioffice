require('dotenv').config();

console.log('🔍 Testing Google Calendar API Key Configuration:\n');

console.log('Environment Variables:');
console.log('  - GOOGLE_CALENDAR_API_KEY:', process.env.GOOGLE_CALENDAR_API_KEY ? '✅ Set' : '❌ Not set');

if (process.env.GOOGLE_CALENDAR_API_KEY) {
  console.log('  - API Key length:', process.env.GOOGLE_CALENDAR_API_KEY.length, 'characters');
  console.log('  - API Key preview:', process.env.GOOGLE_CALENDAR_API_KEY.substring(0, 20) + '...');
} else {
  console.log('  - Please add GOOGLE_CALENDAR_API_KEY to your .env file');
}

console.log('\nOther Google Calendar Variables:');
console.log('  - GOOGLE_CALENDAR_CLIENT_ID:', process.env.GOOGLE_CALENDAR_CLIENT_ID ? '✅ Set' : '❌ Not set');
console.log('  - GOOGLE_CALENDAR_CLIENT_SECRET:', process.env.GOOGLE_CALENDAR_CLIENT_SECRET ? '✅ Set' : '❌ Not set');
console.log('  - GOOGLE_CALENDAR_REDIRECT_URL:', process.env.GOOGLE_CALENDAR_REDIRECT_URL ? '✅ Set' : '❌ Not set');

console.log('\n📋 Next Steps:');
console.log('1. Ensure GOOGLE_CALENDAR_API_KEY is set in your .env file');
console.log('2. Restart your server to pick up the new environment variable');
console.log('3. Test the calendar page again');
console.log('4. Check the console for the new debugging output');
