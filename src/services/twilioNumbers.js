const twilio = require('twilio');

class TwilioNumberService {
  constructor() {
    this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    this.webhookBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL || process.env.BASE_URL;
  }

  /**
   * Provision a new phone number for an organization
   * @param {string} organizationId - The organization ID
   * @param {object} preferences - Number preferences (areaCode, country, etc.)
   * @returns {object} - The provisioned number details
   */
  async provisionNumber(organizationId, preferences = {}) {
    try {
      // Search for available local numbers
      const searchOptions = {
        countryCode: preferences.country || 'US',
        limit: 5,
        capabilities: ['voice'],
        ...preferences.areaCode && { areaCode: preferences.areaCode }
      };

      console.log('🔍 Searching for available numbers with options:', searchOptions);
      const availableNumbers = await this.client.availablePhoneNumbers(searchOptions.countryCode)
        .local
        .list(searchOptions);

      if (availableNumbers.length === 0) {
        throw new Error('No available phone numbers found for the requested criteria');
      }

      // Select the first available number
      const selectedNumber = availableNumbers[0];
      console.log('📞 Selected number:', selectedNumber.phoneNumber);

      // Purchase the number
      const purchasedNumber = await this.client.incomingPhoneNumbers.create({
        phoneNumber: selectedNumber.phoneNumber,
        voiceUrl: `${this.webhookBaseUrl}/voice`,
        voiceMethod: 'POST',
        statusCallback: `${this.webhookBaseUrl}/api/calls/status`,
        statusCallbackMethod: 'POST',
        friendlyName: `InfiniOffice - ${organizationId.substring(0, 8)}`
      });

      console.log('✅ Successfully provisioned number:', {
        sid: purchasedNumber.sid,
        phoneNumber: purchasedNumber.phoneNumber,
        organizationId
      });

      return {
        sid: purchasedNumber.sid,
        phoneNumber: purchasedNumber.phoneNumber,
        friendlyName: purchasedNumber.friendlyName,
        capabilities: purchasedNumber.capabilities,
        voiceUrl: purchasedNumber.voiceUrl
      };

    } catch (error) {
      console.error('❌ Error provisioning phone number:', error);
      throw new Error(`Failed to provision phone number: ${error.message}`);
    }
  }

  /**
   * Update webhook URLs for an existing phone number
   * @param {string} phoneNumberSid - Twilio phone number SID
   * @param {string} organizationId - Organization ID for context
   * @returns {object} - Updated number details
   */
  async updateWebhooks(phoneNumberSid, organizationId) {
    try {
      const updatedNumber = await this.client.incomingPhoneNumbers(phoneNumberSid).update({
        voiceUrl: `${this.webhookBaseUrl}/voice?org=${organizationId}`,
        statusCallback: `${this.webhookBaseUrl}/api/calls/status?org=${organizationId}`,
      });

      console.log('✅ Updated webhooks for number:', updatedNumber.phoneNumber);
      return updatedNumber;

    } catch (error) {
      console.error('❌ Error updating webhooks:', error);
      throw new Error(`Failed to update webhooks: ${error.message}`);
    }
  }

  /**
   * Release a phone number (use with caution)
   * @param {string} phoneNumberSid - Twilio phone number SID
   */
  async releaseNumber(phoneNumberSid) {
    try {
      await this.client.incomingPhoneNumbers(phoneNumberSid).remove();
      console.log('✅ Released phone number:', phoneNumberSid);
    } catch (error) {
      console.error('❌ Error releasing phone number:', error);
      throw new Error(`Failed to release phone number: ${error.message}`);
    }
  }

  /**
   * Get details for an organization's phone number
   * @param {string} phoneNumber - The phone number to lookup
   * @returns {object} - Phone number details
   */
  async getNumberDetails(phoneNumber) {
    try {
      const numbers = await this.client.incomingPhoneNumbers.list({
        phoneNumber: phoneNumber
      });

      if (numbers.length === 0) {
        throw new Error(`Phone number ${phoneNumber} not found`);
      }

      return numbers[0];
    } catch (error) {
      console.error('❌ Error getting number details:', error);
      throw new Error(`Failed to get number details: ${error.message}`);
    }
  }

  /**
   * Get organization ID from incoming call
   * This will be used to route calls to the correct organization context
   * @param {object} twilioRequest - Twilio webhook request
   * @returns {string} - Organization ID
   */
  static getOrganizationFromCall(twilioRequest) {
    // First try to get org from query parameter (if we updated webhooks)
    if (twilioRequest.org) {
      return twilioRequest.org;
    }

    // Otherwise, we'll need to look up by the 'To' number
    // This will require a database lookup which should be done in the main handler
    return twilioRequest.To;
  }

  /**
   * Mock provisioning for development/testing
   * Returns a simulated phone number without actually purchasing from Twilio
   */
  async mockProvisionNumber(organizationId, preferences = {}) {
    const areaCode = preferences.areaCode || '555';
    const randomNumber = Math.floor(Math.random() * 9000000) + 1000000;
    const phoneNumber = `+1${areaCode}${randomNumber}`;

    console.log('🧪 Mock provisioned number:', phoneNumber, 'for org:', organizationId);
    
    return {
      sid: `PN${Math.random().toString(36).substr(2, 32)}`,
      phoneNumber: phoneNumber,
      friendlyName: `InfiniOffice - ${organizationId.substring(0, 8)}`,
      capabilities: { voice: true, sms: true },
      voiceUrl: `${this.webhookBaseUrl}/voice`,
      mock: true // Flag to indicate this is a mock number
    };
  }
}

module.exports = { TwilioNumberService };