
require('dotenv').config();

const phoneNumbers = process.env.TWILIO_PHONE_NUMBERS;

if (phoneNumbers) {
  const numberList = phoneNumbers.split(',');
  console.log('Twilio phone numbers loaded successfully:');
  numberList.forEach((number, index) => {
    console.log(`${index + 1}. ${number}`);
  });
} else {
  console.error('TWILIO_PHONE_NUMBERS not found in .env file.');
}
