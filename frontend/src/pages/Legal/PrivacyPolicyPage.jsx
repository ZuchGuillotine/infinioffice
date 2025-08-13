import { Card, CardContent } from '../../components/ui/Card.jsx'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-8">
            <div className="prose max-w-none">
              <h1 className="text-3xl font-bold text-center mb-8">Privacy Policy</h1>
              <p className="text-center text-muted-foreground mb-8">
                <strong>Effective Date:</strong> August 11, 2025
              </p>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
                <p className="mb-4">
                  InfiniOffice LLC ("InfiniOffice," "we," "us," or "our") respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our voice-driven office assistant service available at www.infinioffice.com and related services (collectively, the "Service").
                </p>
                <p className="mb-4">
                  By using our Service, you consent to the data practices described in this Privacy Policy.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
                
                <h3 className="text-lg font-medium mb-3">2.1 Information You Provide Directly</h3>
                <p className="mb-4">We collect information you provide when you:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Create an account or subscribe to our Service</li>
                  <li>Configure your business settings and preferences</li>
                  <li>Contact us for support or feedback</li>
                  <li>Participate in surveys or promotions</li>
                </ul>
                <p className="mb-4">This may include:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Name, email address, phone number</li>
                  <li>Business information and contact details</li>
                  <li>Billing and payment information</li>
                  <li>Account credentials and security information</li>
                </ul>

                <h3 className="text-lg font-medium mb-3">2.2 Information Collected Automatically</h3>
                <p className="mb-4">When you use our Service, we automatically collect:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Call records, audio recordings, and transcripts</li>
                  <li>Usage data and analytics</li>
                  <li>Technical information (IP address, browser type, device information)</li>
                  <li>Log data and performance metrics</li>
                </ul>

                <h3 className="text-lg font-medium mb-3">2.3 Voice and Audio Data</h3>
                <p className="mb-4">Our Service processes voice calls and audio data to provide automated call handling. This includes:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Recorded phone conversations</li>
                  <li>Voice transcriptions and speech-to-text data</li>
                  <li>Audio files and associated metadata</li>
                  <li>Call duration, timing, and routing information</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
                <p className="mb-4">We use your information to:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Provide, maintain, and improve our Service</li>
                  <li>Process voice calls and generate transcriptions</li>
                  <li>Manage your account and process payments</li>
                  <li>Send service-related communications</li>
                  <li>Provide customer support</li>
                  <li>Analyze usage patterns to improve our Service</li>
                  <li>Comply with legal obligations</li>
                  <li>Protect against fraud and abuse</li>
                </ul>

                <h3 className="text-lg font-medium mb-3">3.1 AI and Machine Learning</h3>
                <p className="mb-4">We use artificial intelligence and machine learning technologies to:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Convert speech to text and text to speech</li>
                  <li>Process natural language for call handling</li>
                  <li>Improve conversation accuracy and effectiveness</li>
                  <li>Analyze call patterns for service optimization</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">4. Information Sharing and Disclosure</h2>
                
                <h3 className="text-lg font-medium mb-3">4.1 Third-Party Service Providers</h3>
                <p className="mb-4">We share information with trusted third-party providers who help us operate our Service:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li><strong>Twilio:</strong> Telephony services and call routing</li>
                  <li><strong>Deepgram:</strong> Speech recognition and voice transcription</li>
                  <li><strong>OpenAI:</strong> Natural language processing and conversation management</li>
                  <li><strong>Payment processors:</strong> Billing and subscription management</li>
                  <li><strong>Cloud service providers:</strong> Data storage and hosting</li>
                </ul>
                <p className="mb-4">These providers are contractually obligated to protect your information and use it only for the purposes we specify.</p>

                <h3 className="text-lg font-medium mb-3">4.2 Business Transfers</h3>
                <p className="mb-4">
                  If InfiniOffice is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.
                </p>

                <h3 className="text-lg font-medium mb-3">4.3 Legal Requirements</h3>
                <p className="mb-4">
                  We may disclose your information if required by law, court order, or governmental request, or to protect our rights, property, or safety.
                </p>

                <h3 className="text-lg font-medium mb-3">4.4 Consent</h3>
                <p className="mb-4">
                  We may share your information with your explicit consent or at your direction.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">5. Data Retention and Deletion</h2>
                
                <h3 className="text-lg font-medium mb-3">5.1 Retention Period</h3>
                <p className="mb-4">We retain your personal information for as long as necessary to provide our Service and comply with legal obligations. Specifically:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li><strong>Call recordings and transcripts:</strong> Automatically deleted after 90 days</li>
                  <li><strong>Account information:</strong> Retained while your account is active</li>
                  <li><strong>Billing records:</strong> Retained as required by law (typically 7 years)</li>
                </ul>

                <h3 className="text-lg font-medium mb-3">5.2 Automated Deletion</h3>
                <p className="mb-4">
                  Our systems are configured to automatically delete call recordings, transcripts, and associated audio data after 90 days to protect your privacy and minimize data retention.
                </p>

                <h3 className="text-lg font-medium mb-3">5.3 Account Deletion</h3>
                <p className="mb-4">
                  When you close your account, we will delete your personal information within a reasonable timeframe, except where retention is required by law.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">6. Data Security</h2>
                <p className="mb-4">We implement appropriate technical and organizational security measures to protect your information, including:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Access controls and authentication</li>
                  <li>Regular security assessments and monitoring</li>
                  <li>Staff training on data protection practices</li>
                </ul>
                <p className="mb-4">
                  However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">7. Your Privacy Rights</h2>
                
                <h3 className="text-lg font-medium mb-3">7.1 Access and Control</h3>
                <p className="mb-4">You have the right to:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Access the personal information we hold about you</li>
                  <li>Update or correct your information</li>
                  <li>Delete your account and associated data</li>
                  <li>Withdraw consent where processing is based on consent</li>
                  <li>Request data portability</li>
                </ul>

                <h3 className="text-lg font-medium mb-3">7.2 Washington State Privacy Rights</h3>
                <p className="mb-4">
                  As a Washington State resident, you may have additional privacy rights under state law. Please contact us for information about exercising these rights.
                </p>

                <h3 className="text-lg font-medium mb-3">7.3 California Privacy Rights (CCPA)</h3>
                <p className="mb-4">
                  If you are a California resident, you have specific rights under the California Consumer Privacy Act, including the right to know, delete, and opt-out of the sale of personal information. We do not sell personal information.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">8. Cookies and Tracking Technologies</h2>
                <p className="mb-4">We use cookies and similar technologies to:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Maintain your login session</li>
                  <li>Remember your preferences</li>
                  <li>Analyze usage patterns</li>
                  <li>Improve our Service performance</li>
                </ul>
                <p className="mb-4">You can control cookie settings through your browser preferences.</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">9. Children's Privacy</h2>
                <p className="mb-4">
                  Our Service is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children under 18. If we become aware that we have collected such information, we will delete it promptly.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">10. International Data Transfers</h2>
                <p className="mb-4">
                  Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place for such transfers in accordance with applicable law.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">11. Changes to This Privacy Policy</h2>
                <p className="mb-4">We may update this Privacy Policy from time to time. We will notify you of any material changes by:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Posting the updated policy on our website</li>
                  <li>Sending you an email notification</li>
                  <li>Providing notice through our Service</li>
                </ul>
                <p className="mb-4">
                  Your continued use of our Service after such changes constitutes acceptance of the updated Privacy Policy.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">12. Third-Party Links and Services</h2>
                <p className="mb-4">
                  Our Service may contain links to third-party websites or integrate with third-party services. This Privacy Policy does not apply to these third parties. We encourage you to review their privacy policies.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">13. Data Processing Lawful Basis</h2>
                <p className="mb-4">We process your personal information based on the following lawful bases:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li><strong>Contract performance:</strong> To provide our Service and fulfill our obligations</li>
                  <li><strong>Legitimate interests:</strong> To improve our Service and ensure security</li>
                  <li><strong>Consent:</strong> Where you have explicitly consented to processing</li>
                  <li><strong>Legal compliance:</strong> To comply with applicable laws and regulations</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">14. Contact Information</h2>
                <p className="mb-4">
                  If you have questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <p className="font-semibold">InfiniOffice LLC</p>
                  <p>Privacy Officer: Benjamin Cox</p>
                  <p>652 Cherry Ave NE</p>
                  <p>Bainbridge Island, WA 98110</p>
                  <p>Email: <a href="mailto:delicacybydesign@gmail.com" className="text-blue-600 hover:text-blue-800">delicacybydesign@gmail.com</a></p>
                  <p>Website: <a href="https://www.infinioffice.com" className="text-blue-600 hover:text-blue-800">www.infinioffice.com</a></p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">15. Data Protection Officer</h2>
                <p className="mb-4">For data protection inquiries, you may contact our Data Protection Officer at:</p>
                <p className="mb-4">Email: <a href="mailto:delicacybydesign@gmail.com" className="text-blue-600 hover:text-blue-800">delicacybydesign@gmail.com</a></p>
              </section>

              <div className="text-center pt-8 border-t">
                <p className="text-muted-foreground text-sm">
                  <em>Last Updated: August 11, 2025</em>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}