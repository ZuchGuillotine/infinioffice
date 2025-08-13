import { Card, CardContent } from '../../components/ui/Card.jsx'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-8">
            <div className="prose max-w-none">
              <h1 className="text-3xl font-bold text-center mb-8">Terms of Service</h1>
              <p className="text-center text-muted-foreground mb-8">
                <strong>Effective Date:</strong> August 11, 2025
              </p>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
                <p className="mb-4">
                  These Terms of Service ("Terms") constitute a legally binding agreement between you ("User," "Customer," or "you") and InfiniOffice LLC, a Washington State limited liability company ("InfiniOffice," "we," "us," or "our"), governing your use of the InfiniOffice voice-driven office assistant service available at www.infinioffice.com and related services (collectively, the "Service").
                </p>
                <p className="mb-4">
                  By accessing, using, or subscribing to our Service, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms, you must not use our Service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">2. Eligibility</h2>
                <p className="mb-4">
                  You must be at least 18 years of age to use our Service. By using our Service, you represent and warrant that you meet this age requirement and have the legal capacity to enter into this agreement.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">3. Service Description</h2>
                <p className="mb-4">
                  InfiniOffice provides a voice-driven office assistant service that handles phone calls for businesses through automated speech recognition, natural language processing, and text-to-speech technology. Our Service includes:
                </p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Automated phone call handling and appointment scheduling</li>
                  <li>Voice transcription and conversation management</li>
                  <li>Calendar integration and appointment booking</li>
                  <li>Business process automation through voice interactions</li>
                  <li>Dashboard and analytics for call management</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">4. Subscription Plans and Billing</h2>
                
                <h3 className="text-lg font-medium mb-3">4.1 Subscription Tiers</h3>
                <p className="mb-4">We offer the following subscription plans:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li><strong>Standard Plan:</strong> $299/month for up to 250 calls</li>
                  <li><strong>Professional Plan:</strong> $899/month for up to 999 calls</li>
                  <li><strong>Enterprise Plan:</strong> Custom pricing and integrations for larger call volumes, negotiated on a case-by-case basis</li>
                </ul>

                <h3 className="text-lg font-medium mb-3">4.2 Billing and Payment</h3>
                <ul className="list-disc pl-6 mb-4">
                  <li>Subscription fees are billed monthly in advance</li>
                  <li>All fees are non-refundable except as expressly provided in Section 4.3</li>
                  <li>You authorize us to charge your designated payment method for all applicable fees</li>
                  <li>If payment fails, we may suspend or terminate your Service after reasonable notice</li>
                </ul>

                <h3 className="text-lg font-medium mb-3">4.3 Refund Policy</h3>
                <p className="mb-4">
                  You are entitled to a full refund of your most recent billing cycle payment if you cancel your subscription within 5 days of the billing date. Refund requests must be submitted to delicacybydesign@gmail.com within the 5-day period.
                </p>

                <h3 className="text-lg font-medium mb-3">4.4 Cancellation</h3>
                <p className="mb-4">
                  You may cancel your subscription at any time through your account dashboard or by contacting us. Cancellation will be effective at the end of your current billing period.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">5. Acceptable Use</h2>
                
                <h3 className="text-lg font-medium mb-3">5.1 Permitted Use</h3>
                <p className="mb-4">
                  You may use our Service only for lawful business purposes in accordance with these Terms.
                </p>

                <h3 className="text-lg font-medium mb-3">5.2 Prohibited Use</h3>
                <p className="mb-4">You agree not to:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Use the Service for any unlawful, harmful, or fraudulent purpose</li>
                  <li>Attempt to gain unauthorized access to our systems or networks</li>
                  <li>Interfere with or disrupt the Service or servers</li>
                  <li>Use the Service to harass, abuse, or harm another person</li>
                  <li>Transmit any viruses, malware, or other harmful code</li>
                  <li>Violate any applicable laws or regulations</li>
                  <li>Use the Service in a manner that could damage our reputation</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">6. Telephone and SMS Services</h2>
                <p className="mb-4">By using our Service, you acknowledge and agree that:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>You intend to utilize telephone and SMS services through our application</li>
                  <li>You understand that our Service will make and receive calls on your behalf</li>
                  <li>You are responsible for ensuring compliance with all applicable telecommunications regulations</li>
                  <li>You consent to the automated handling of calls and messages related to your business</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">7. Third-Party Services</h2>
                <p className="mb-4">Our Service integrates with third-party providers including:</p>
                <ul className="list-disc pl-6 mb-4">
                  <li>Twilio (telephony services)</li>
                  <li>Deepgram (speech recognition)</li>
                  <li>OpenAI (language processing)</li>
                </ul>
                <p className="mb-4">
                  You acknowledge that these third-party services have their own terms of service and privacy policies, and your use of our Service constitutes acceptance of their terms as well.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">8. Data and Privacy</h2>
                <p className="mb-4">
                  Your privacy is important to us. Our collection, use, and protection of your personal information is governed by our <a href="/privacy" className="text-blue-600 hover:text-blue-800 underline">Privacy Policy</a>, which is incorporated by reference into these Terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">9. Intellectual Property</h2>
                
                <h3 className="text-lg font-medium mb-3">9.1 Our Rights</h3>
                <p className="mb-4">
                  InfiniOffice and its licensors retain all rights, title, and interest in the Service, including all intellectual property rights. You are granted only a limited, non-exclusive, non-transferable license to use the Service in accordance with these Terms.
                </p>

                <h3 className="text-lg font-medium mb-3">9.2 Your Content</h3>
                <p className="mb-4">
                  You retain ownership of any content you provide to us. By using our Service, you grant us a limited license to use, process, and store your content solely for the purpose of providing the Service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">10. Disclaimers and Limitations</h2>
                
                <h3 className="text-lg font-medium mb-3">10.1 Service Availability</h3>
                <p className="mb-4">
                  We strive to maintain high availability but do not guarantee uninterrupted service. We may suspend the Service for maintenance, updates, or other operational reasons.
                </p>

                <h3 className="text-lg font-medium mb-3">10.2 No Business Loss Responsibility</h3>
                <p className="mb-4 font-semibold">
                  <strong>IMPORTANT:</strong> WE EXPLICITLY DISCLAIM ANY FINANCIAL RESPONSIBILITY FOR POTENTIAL LOSS OF SALES, BUSINESS OPPORTUNITIES, OR OTHER COMMERCIAL DAMAGES RELATED TO OUR SERVICE AND ITS RESULTING BUSINESS ACTIONS, INCLUDING BUT NOT LIMITED TO APPOINTMENT SCHEDULING, CALL HANDLING, OR ANY OTHER AUTOMATED BUSINESS PROCESSES.
                </p>

                <h3 className="text-lg font-medium mb-3">10.3 Limitation of Liability</h3>
                <p className="mb-4 font-semibold">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.
                </p>

                <h3 className="text-lg font-medium mb-3">10.4 Disclaimer of Warranties</h3>
                <p className="mb-4 font-semibold">
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">11. Indemnification</h2>
                <p className="mb-4">
                  You agree to indemnify, defend, and hold harmless InfiniOffice, its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising out of or related to your use of the Service or violation of these Terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">12. Termination</h2>
                <p className="mb-4">
                  We may terminate or suspend your account and access to the Service at any time, with or without cause, with or without notice. Upon termination, your right to use the Service will cease immediately.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">13. Governing Law and Dispute Resolution</h2>
                <p className="mb-4">
                  These Terms are governed by the laws of the State of Washington without regard to conflict of law principles. Any disputes arising under these Terms shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association, conducted in King County, Washington.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">14. Modifications</h2>
                <p className="mb-4">
                  We reserve the right to modify these Terms at any time. We will provide notice of material changes by posting the updated Terms on our website with a new effective date. Your continued use of the Service after such modifications constitutes acceptance of the updated Terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">15. Severability</h2>
                <p className="mb-4">
                  If any provision of these Terms is found to be unenforceable, the remaining provisions will continue to be valid and enforceable.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">16. Entire Agreement</h2>
                <p className="mb-4">
                  These Terms, together with our Privacy Policy, constitute the entire agreement between you and InfiniOffice regarding the Service and supersede all prior agreements and understandings.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4">17. Contact Information</h2>
                <p className="mb-4">For questions about these Terms, please contact us at:</p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-semibold">InfiniOffice LLC</p>
                  <p>Benjamin Cox</p>
                  <p>652 Cherry Ave NE</p>
                  <p>Bainbridge Island, WA 98110</p>
                  <p>Email: <a href="mailto:delicacybydesign@gmail.com" className="text-blue-600 hover:text-blue-800">delicacybydesign@gmail.com</a></p>
                  <p>Website: <a href="https://www.infinioffice.com" className="text-blue-600 hover:text-blue-800">www.infinioffice.com</a></p>
                </div>
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