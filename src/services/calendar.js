
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL
);

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

const createEvent = async (event) => {
  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
  });
  return response.data;
};

module.exports = {
  createEvent,
};
