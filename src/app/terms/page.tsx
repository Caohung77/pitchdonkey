import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link href="/" className="flex items-center">
              <Zap className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-2xl font-bold text-gray-900">Eisbrief</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/auth/signin">
                <Button variant="outline">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Terms of Service Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>

        <div className="prose prose-lg max-w-none">
          <p className="text-sm text-gray-600 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          {/* Service Provider Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Service Provider & Contact Information</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <ul className="space-y-2 text-gray-700">
                <li><strong>Service Provider:</strong> The AIWhisperer — Eisbrief (operated by)</li>
                <li><strong>Owner / Authorized Representative:</strong> Cao Hung Nguyen</li>
                <li><strong>Registered Address:</strong> Am Kaisersbusch 6, 42781 Haan, Germany</li>
                <li><strong>Contact Email:</strong> hung@theaiwhisperer.de</li>
                <li><strong>Company Identifier / Wirtschafts-ID:</strong> DE435610609</li>
              </ul>
            </div>
          </section>

          {/* 1. Agreement to Terms */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Agreement to Terms</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              These Terms of Service ("Terms") constitute a legally binding agreement between you ("User," "you," or "your") and The AIWhisperer (Cao Hung Nguyen), operating Eisbrief ("Service," "we," "us," or "our"), concerning your access to and use of the Eisbrief platform located at eisbrief.com and any related services, features, content, or applications offered by us.
            </p>
            <p className="text-gray-700 leading-relaxed">
              By accessing or using our Service, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms, you must not access or use the Service.
            </p>
          </section>

          {/* 2. Description of Service */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Eisbrief is a Software as a Service (SaaS) platform that provides email outreach automation, contact management, lead enrichment, campaign management, and AI-powered personalization tools. The Service includes, but is not limited to:
            </p>
            <ul className="space-y-2 text-gray-700 ml-6">
              <li><strong>Email Campaign Management:</strong> Multi-step email sequences with scheduling, A/B testing, and performance tracking</li>
              <li><strong>Contact Management:</strong> Import, organize, segment, and manage contact lists with engagement scoring</li>
              <li><strong>Lead Enrichment:</strong> Automated enrichment of contact data using publicly available information</li>
              <li><strong>AI Personalization:</strong> AI-powered email personalization using OpenAI and Anthropic technologies</li>
              <li><strong>Email Provider Integration:</strong> Support for Gmail, Outlook, and custom SMTP providers with OAuth authentication</li>
              <li><strong>Analytics & Reporting:</strong> Campaign performance metrics, engagement tracking, and reporting tools</li>
              <li><strong>AI Personas:</strong> Autonomous AI agents for email reply handling and composition assistance</li>
            </ul>
          </section>

          {/* 3. Eligibility */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Eligibility</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              By using the Service, you represent and warrant that:
            </p>
            <ul className="space-y-2 text-gray-700 ml-6">
              <li>You are at least 18 years of age and have the legal capacity to enter into binding contracts</li>
              <li>You are not located in a country that is subject to a government embargo or designated as a "terrorist supporting" country</li>
              <li>You are not prohibited from receiving services under applicable laws</li>
              <li>You will comply with all applicable laws and regulations in your use of the Service</li>
              <li>If you are using the Service on behalf of an organization, you have the authority to bind that organization to these Terms</li>
            </ul>
          </section>

          {/* 4. Account Registration and Security */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Account Registration and Security</h2>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">4.1 Account Creation</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              To access certain features of the Service, you must register for an account. You agree to:
            </p>
            <ul className="space-y-2 text-gray-700 ml-6 mb-4">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Immediately notify us of any unauthorized use of your account</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">4.2 Account Responsibility</h3>
            <p className="text-gray-700 leading-relaxed">
              You are responsible for all activities that occur under your account. We are not liable for any loss or damage arising from your failure to maintain account security.
            </p>
          </section>

          {/* 5. Subscription Plans and Payment */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Subscription Plans and Payment</h2>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">5.1 Pricing</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              Eisbrief offers multiple subscription tiers (Starter, Professional, Agency) with different features and usage limits. Current pricing is available on our website and may be modified at our discretion with advance notice to existing subscribers.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">5.2 Billing</h3>
            <ul className="space-y-2 text-gray-700 ml-6 mb-4">
              <li>Subscription fees are billed in advance on a monthly or annual basis</li>
              <li>You authorize us to charge your payment method for all fees incurred</li>
              <li>All fees are non-refundable except as required by law or as expressly stated in these Terms</li>
              <li>Failed payments may result in service suspension or termination</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">5.3 Automatic Renewal</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              Your subscription will automatically renew at the end of each billing period unless you cancel before the renewal date. You may cancel your subscription at any time through your account settings.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">5.4 Usage Limits</h3>
            <p className="text-gray-700 leading-relaxed">
              Each subscription plan includes specific usage limits (email accounts, contacts, campaigns, monthly emails). Exceeding these limits may result in service restrictions or require an upgrade to a higher-tier plan.
            </p>
          </section>

          {/* 6. Acceptable Use Policy */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Acceptable Use Policy</h2>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">6.1 Permitted Use</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              You may use the Service only for lawful purposes and in accordance with these Terms. You agree to use the Service for business-to-business (B2B) outreach and legitimate marketing purposes.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">6.2 Prohibited Activities</h3>
            <p className="text-gray-700 leading-relaxed mb-4">You agree NOT to:</p>
            <ul className="space-y-2 text-gray-700 ml-6">
              <li>Send unsolicited bulk email (spam) or engage in practices that violate CAN-SPAM, GDPR, or other applicable anti-spam laws</li>
              <li>Use the Service for phishing, malware distribution, or any fraudulent activities</li>
              <li>Upload or transmit viruses, malware, or other malicious code</li>
              <li>Violate the intellectual property rights of others</li>
              <li>Harvest or collect email addresses or other contact information without proper consent</li>
              <li>Use purchased or rented email lists without proper verification and consent</li>
              <li>Impersonate any person or entity or falsely state or misrepresent your affiliation</li>
              <li>Attempt to gain unauthorized access to the Service, other accounts, or systems</li>
              <li>Interfere with or disrupt the Service or servers or networks connected to the Service</li>
              <li>Use automated means to access the Service except through our provided APIs</li>
              <li>Resell, sublicense, or redistribute the Service without our express written permission</li>
              <li>Send emails to individuals who have opted out or unsubscribed</li>
            </ul>
          </section>

          {/* 7. Email Compliance and Anti-Spam */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Email Compliance and Anti-Spam</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You are solely responsible for ensuring your email campaigns comply with all applicable laws, including but not limited to:
            </p>
            <ul className="space-y-2 text-gray-700 ml-6">
              <li><strong>CAN-SPAM Act (United States):</strong> Include accurate header information, clear subject lines, valid physical address, and functional unsubscribe mechanism</li>
              <li><strong>GDPR (European Union):</strong> Obtain proper consent before sending marketing emails, provide clear privacy information, and honor data subject rights</li>
              <li><strong>CASL (Canada):</strong> Obtain express or implied consent before sending commercial electronic messages</li>
              <li><strong>Other applicable regulations</strong> in your jurisdiction and the jurisdictions of your recipients</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              Failure to comply with anti-spam laws may result in immediate termination of your account and potential legal liability.
            </p>
          </section>

          {/* 8. Content Ownership and Intellectual Property */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Content Ownership and Intellectual Property</h2>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">8.1 Our Intellectual Property</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              The Service, including all content, features, functionality, software, code, designs, graphics, and user interface, is owned by The AIWhisperer and protected by copyright, trademark, patent, trade secret, and other intellectual property laws. You may not copy, modify, reproduce, or distribute any part of the Service without our express written permission.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">8.2 Your Content</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              You retain all rights to the content you upload to the Service, including contact data, email content, and campaign materials ("User Content"). By uploading User Content, you grant us a limited, non-exclusive, royalty-free license to use, store, process, and display your User Content solely for the purpose of providing and improving the Service.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">8.3 Feedback</h3>
            <p className="text-gray-700 leading-relaxed">
              If you provide us with feedback, suggestions, or ideas about the Service, you grant us the right to use such feedback without any obligation or compensation to you.
            </p>
          </section>

          {/* 9. AI and Automated Processing */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. AI and Automated Processing</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Eisbrief uses artificial intelligence (AI) technologies from OpenAI and Anthropic to provide personalization, content generation, and automated response features. You acknowledge and agree that:
            </p>
            <ul className="space-y-2 text-gray-700 ml-6">
              <li>AI-generated content may contain errors or inaccuracies</li>
              <li>You are responsible for reviewing and approving all AI-generated content before sending</li>
              <li>We do not guarantee the accuracy, quality, or appropriateness of AI-generated content</li>
              <li>You should not rely solely on AI-generated content without human review</li>
              <li>AI processing is subject to the terms and policies of our AI providers</li>
            </ul>
          </section>

          {/* 10. Data Protection and Privacy */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Data Protection and Privacy</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Your privacy is important to us. Our collection and use of personal information in connection with the Service is described in our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>, which is incorporated into these Terms by reference.
            </p>
            <p className="text-gray-700 leading-relaxed">
              You are responsible for ensuring that any personal data you upload to the Service has been collected and processed in compliance with applicable data protection laws, including obtaining necessary consents.
            </p>
          </section>

          {/* 11. Third-Party Services and Integrations */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Third-Party Services and Integrations</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The Service may integrate with or contain links to third-party services, websites, or applications ("Third-Party Services"), including:
            </p>
            <ul className="space-y-2 text-gray-700 ml-6 mb-4">
              <li>Email providers (Gmail, Outlook, SMTP services)</li>
              <li>Payment processors (Stripe, etc.)</li>
              <li>AI services (OpenAI, Anthropic)</li>
              <li>Analytics and tracking services</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              We are not responsible for the availability, content, privacy practices, or terms of Third-Party Services. Your use of Third-Party Services is subject to their respective terms and policies.
            </p>
          </section>

          {/* 12. Service Availability and Modifications */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Service Availability and Modifications</h2>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">12.1 Service Availability</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We strive to maintain high availability but do not guarantee that the Service will be uninterrupted, timely, secure, or error-free. We reserve the right to modify, suspend, or discontinue any part of the Service at any time, with or without notice.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">12.2 Maintenance</h3>
            <p className="text-gray-700 leading-relaxed">
              We may perform scheduled maintenance that may temporarily disrupt Service availability. We will attempt to provide advance notice of planned maintenance when possible.
            </p>
          </section>

          {/* 13. Termination */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Termination</h2>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">13.1 Termination by You</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              You may terminate your account at any time by canceling your subscription through your account settings or by contacting us at hung@theaiwhisperer.de. Termination will be effective at the end of your current billing period.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">13.2 Termination by Us</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may suspend or terminate your account immediately, without prior notice, if:
            </p>
            <ul className="space-y-2 text-gray-700 ml-6 mb-4">
              <li>You violate these Terms or any applicable laws</li>
              <li>Your use of the Service poses a security risk or adversely impacts other users</li>
              <li>You fail to pay fees when due</li>
              <li>You engage in fraudulent or illegal activities</li>
              <li>We are required to do so by law</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">13.3 Effect of Termination</h3>
            <p className="text-gray-700 leading-relaxed">
              Upon termination, your right to access and use the Service will immediately cease. We may delete your account and User Content after termination, subject to applicable legal retention requirements. You remain liable for all fees incurred prior to termination.
            </p>
          </section>

          {/* 14. Warranties and Disclaimers */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Warranties and Disclaimers</h2>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <p className="text-gray-800 font-semibold mb-2">DISCLAIMER OF WARRANTIES</p>
              <p className="text-gray-700 text-sm leading-relaxed">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE OF PERFORMANCE. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT DEFECTS WILL BE CORRECTED.
              </p>
            </div>
            <p className="text-gray-700 leading-relaxed">
              We make no representations or warranties about the accuracy, reliability, completeness, or timeliness of any content or results obtained through the Service, including AI-generated content and enriched data.
            </p>
          </section>

          {/* 15. Limitation of Liability */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Limitation of Liability</h2>
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
              <p className="text-gray-800 font-semibold mb-2">LIMITATION OF LIABILITY</p>
              <p className="text-gray-700 text-sm leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE AIWHISPERER, CAO HUNG NGUYEN, OR PITCHDONKEY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
              </p>
              <ul className="text-gray-700 text-sm mt-2 ml-4 space-y-1">
                <li>(a) Your access to or use of or inability to access or use the Service</li>
                <li>(b) Any conduct or content of any third party on the Service</li>
                <li>(c) Any content obtained from the Service</li>
                <li>(d) Unauthorized access, use, or alteration of your transmissions or content</li>
              </ul>
              <p className="text-gray-700 text-sm mt-2 leading-relaxed">
                OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU HAVE PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM OR (B) ONE HUNDRED EUROS (€100).
              </p>
            </div>
          </section>

          {/* 16. Indemnification */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">16. Indemnification</h2>
            <p className="text-gray-700 leading-relaxed">
              You agree to indemnify, defend, and hold harmless The AIWhisperer, Cao Hung Nguyen, PitchDonkey, and our affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with:
            </p>
            <ul className="space-y-2 text-gray-700 ml-6 mt-4">
              <li>Your access to or use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any third-party rights, including intellectual property or privacy rights</li>
              <li>Your violation of applicable laws or regulations</li>
              <li>Your User Content</li>
            </ul>
          </section>

          {/* 17. Dispute Resolution and Governing Law */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">17. Dispute Resolution and Governing Law</h2>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">17.1 Governing Law</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Germany, without regard to its conflict of law provisions.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">17.2 Jurisdiction</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of Düsseldorf, Germany, unless mandatory consumer protection laws require otherwise.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">17.3 Informal Dispute Resolution</h3>
            <p className="text-gray-700 leading-relaxed">
              Before filing a claim, you agree to try to resolve the dispute informally by contacting us at hung@theaiwhisperer.de. We will attempt to resolve the dispute informally within 30 days.
            </p>
          </section>

          {/* 18. Changes to Terms */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">18. Changes to Terms</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We reserve the right to modify these Terms at any time. If we make material changes, we will notify you by:
            </p>
            <ul className="space-y-2 text-gray-700 ml-6 mb-4">
              <li>Sending an email to the address associated with your account</li>
              <li>Posting a notice on our website</li>
              <li>Providing an in-app notification</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              Your continued use of the Service after the effective date of the modified Terms constitutes your acceptance of the changes. If you do not agree to the modified Terms, you must stop using the Service and terminate your account.
            </p>
          </section>

          {/* 19. General Provisions */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">19. General Provisions</h2>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">19.1 Entire Agreement</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and us regarding the Service and supersede all prior agreements and understandings.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">19.2 Severability</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              If any provision of these Terms is held to be invalid or unenforceable, that provision shall be struck and the remaining provisions shall remain in full force and effect.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">19.3 Waiver</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              Our failure to enforce any right or provision of these Terms will not be deemed a waiver of such right or provision.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">19.4 Assignment</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              You may not assign or transfer these Terms or your account without our prior written consent. We may assign these Terms without restriction.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">19.5 Force Majeure</h3>
            <p className="text-gray-700 leading-relaxed">
              We shall not be liable for any failure or delay in performance due to circumstances beyond our reasonable control, including acts of God, war, terrorism, riots, embargoes, acts of civil or military authorities, fire, floods, accidents, strikes, or shortages of transportation facilities, fuel, energy, labor, or materials.
            </p>
          </section>

          {/* 20. Contact Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">20. Contact Information</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have any questions about these Terms or need support, please contact us at:
            </p>
            <div className="bg-gray-50 p-6 rounded-lg">
              <ul className="space-y-2 text-gray-700">
                <li><strong>Email:</strong> hung@theaiwhisperer.de</li>
                <li><strong>Address:</strong> Am Kaisersbusch 6, 42781 Haan, Germany</li>
                <li><strong>Company:</strong> The AIWhisperer — Eisbrief</li>
                <li><strong>Wirtschafts-ID:</strong> DE435610609</li>
              </ul>
            </div>
          </section>

          {/* Acknowledgment */}
          <section className="mb-8">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
              <p className="text-gray-800 font-semibold mb-2">Acknowledgment</p>
              <p className="text-gray-700 text-sm leading-relaxed">
                BY USING THE SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE READ THESE TERMS OF SERVICE, UNDERSTAND THEM, AND AGREE TO BE BOUND BY THEM. IF YOU DO NOT AGREE TO THESE TERMS, YOU MUST NOT USE THE SERVICE.
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center mb-4 md:mb-0">
              <Zap className="h-6 w-6 text-blue-400" />
              <span className="ml-2 text-lg font-semibold">Eisbrief</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <span>© 2024 Eisbrief. Built with Next.js and TypeScript.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
