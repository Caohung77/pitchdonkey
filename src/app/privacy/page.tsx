import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link href="/" className="flex items-center">
              <Zap className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-2xl font-bold text-gray-900">PitchDonkey</span>
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

      {/* Privacy Policy Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>

        <div className="prose prose-lg max-w-none">
          <p className="text-sm text-gray-600 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          {/* Controller & Contact Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Controller & Contact Information</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <ul className="space-y-2 text-gray-700">
                <li><strong>Service Provider / Company Name:</strong> The AIWhisperer — PitchDonkey (operated by)</li>
                <li><strong>Owner / Authorized Representative:</strong> Cao Hung Nguyen</li>
                <li><strong>Registered Address:</strong> Am Kaisersbusch 6, 42781 Haan, Germany</li>
                <li><strong>Contact Email (for privacy / data protection matters):</strong> hung@theaiwhisperer.de</li>
                <li><strong>Company Identifier / Wirtschafts-ID:</strong> DE435610609</li>
              </ul>
            </div>
          </section>

          {/* Introduction */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              PitchDonkey ("we", "us", "our"), operated by The AIWhisperer (Cao Hung Nguyen), provides an outreach and lead enrichment SaaS platform that lets you run cold email outreach, enrich contact/prospect data using publicly available sources (company websites, public LinkedIn etc.), manage contact lists that you upload, handle payments / account management, analytics etc. This Privacy Policy describes how we collect, process, store, protect, and share your personal data, especially for Users in the EU/EEA, in compliance with the GDPR. By using our Service, you agree to the practices described here.
            </p>
          </section>

          {/* Definitions */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Definitions</h2>
            <ul className="space-y-2 text-gray-700">
              <li><strong>Personal Data:</strong> Any information relating to an identified or identifiable natural person</li>
              <li><strong>User:</strong> Any person who uses our PitchDonkey service</li>
              <li><strong>Prospect/Contact Data:</strong> Information about potential customers or leads uploaded by Users</li>
              <li><strong>Enriched Data:</strong> Additional information we append to contact data from publicly available sources</li>
            </ul>
          </section>

          {/* What Data We Collect */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. What Data We Collect</h2>
            <ul className="space-y-3 text-gray-700">
              <li><strong>Account / Registration Data:</strong> name, business email, company name, job title, billing address, payment information etc.</li>
              <li><strong>Prospect / Contact Data provided by Users:</strong> names, emails, company, role etc uploaded or imported by you.</li>
              <li><strong>Enriched Data:</strong> public business/professional information appended to your prospect/contact data (only what is publicly available).</li>
              <li><strong>Usage/Technical Data:</strong> IPs, device/browser info, usage logs.</li>
              <li><strong>Support / Communications Data:</strong> messages you send us.</li>
              <li><strong>Cookies & Tracking Data:</strong> session cookies, analytics, possibly email open/click tracking etc.</li>
            </ul>
          </section>

          {/* How We Collect Data */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. How We Collect Data</h2>
            <ul className="space-y-2 text-gray-700">
              <li>From you directly (registration, upload).</li>
              <li>From public sources to enrich data you supplied.</li>
              <li>Automatically via logs, cookies etc.</li>
              <li>Via third-parties / integrations (if you connect them).</li>
            </ul>
          </section>

          {/* Legal Basis for Processing */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Legal Basis for Processing</h2>
            <ul className="space-y-2 text-gray-700">
              <li>Performance of contract (providing the Service etc.).</li>
              <li>Legitimate interests (enrichment, analytics, fraud prevention).</li>
              <li>Consent (for non-essential tracking / cookies etc.).</li>
              <li>Legal obligations.</li>
            </ul>
          </section>

          {/* Purpose of Processing */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Purpose of Processing</h2>
            <ul className="space-y-2 text-gray-700">
              <li>Provide, maintain, improve Service.</li>
              <li>Account, billing, payments.</li>
              <li>Enrichment for your contact data.</li>
              <li>Outreach features (email delivery, tracking if applicable).</li>
              <li>Security, abuse prevention.</li>
              <li>Analytics, support, communications.</li>
            </ul>
          </section>

          {/* Sharing & Disclosure */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Sharing & Disclosure</h2>
            <ul className="space-y-2 text-gray-700">
              <li>With service providers / sub-processors who help with hosting / email delivery / analytics / payments.</li>
              <li>Legal / regulatory authorities if required.</li>
              <li>In case of a merger, sale etc.</li>
              <li>We do not sell or provide your contact/prospect or enriched data to parties beyond those needed to operate the Service (unless you direct us to).</li>
            </ul>
          </section>

          {/* Cross-Border Transfers */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Cross-Border Transfers</h2>
            <p className="text-gray-700">
              May transfer data outside EU/EEA via providers / infrastructure, but we ensure appropriate safeguards (Standard Contractual Clauses, etc.).
            </p>
          </section>

          {/* Data Retention */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Data Retention</h2>
            <ul className="space-y-2 text-gray-700">
              <li>Keep data as long as needed for the purposes (service, billing, outreach/enrichment).</li>
              <li>After deletion of account, retain required records for legal / financial compliance (statutory period) then delete or anonymize.</li>
              <li>Enriched data retained as long as underlying contact/prospect data remains.</li>
            </ul>
          </section>

          {/* Security Measures */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Security Measures</h2>
            <p className="text-gray-700">
              We implement appropriate technical and organizational measures to protect your data, including encryption, access controls, regular backups, and minimal privilege access principles.
            </p>
          </section>

          {/* Cookies & Tracking */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Cookies, Tracking & Third-Party Tools</h2>
            <ul className="space-y-2 text-gray-700">
              <li>Use cookies / analytics / possibly open/click tracking in outreach.</li>
              <li>Allow you to manage cookie preferences / disable non-essential tracking.</li>
              <li>Disclose what third-party tools / trackers we use.</li>
            </ul>
          </section>

          {/* Your Rights under GDPR */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Your Rights under GDPR</h2>
            <p className="text-gray-700 mb-4">You have the following rights regarding your personal data:</p>
            <ul className="space-y-2 text-gray-700">
              <li><strong>Access:</strong> Request access to your personal data</li>
              <li><strong>Rectification:</strong> Request correction of inaccurate data</li>
              <li><strong>Erasure:</strong> Request deletion of your data</li>
              <li><strong>Portability:</strong> Request transfer of your data</li>
              <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
              <li><strong>Withdraw consent:</strong> Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="text-gray-700 mt-4">
              To exercise these rights, contact us at hung@theaiwhisperer.de
            </p>
          </section>

          {/* Data Breaches */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Data Breaches & Notification</h2>
            <p className="text-gray-700">
              In the event of a data breach that affects your personal data, we will notify you and relevant authorities in accordance with GDPR requirements.
            </p>
          </section>

          {/* Children's Privacy */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Children's Privacy</h2>
            <p className="text-gray-700">
              Our Service is not aimed at children under 16. We do not knowingly collect Personal Data from children under that age. If discovered, we will delete it.
            </p>
          </section>

          {/* Changes to Policy */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Changes to This Policy</h2>
            <p className="text-gray-700">
              We may update this policy; material changes will be communicated (email or notice), "Last updated" reflects changes.
            </p>
          </section>

          {/* Governing Law */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">16. Governing Law & Jurisdiction</h2>
            <p className="text-gray-700">
              This Policy is governed by German law (for The AIWhisperer / PitchDonkey), consistent with GDPR. Disputes will be handled in courts of appropriate jurisdiction in Germany, unless otherwise required by law.
            </p>
          </section>

          {/* Contact Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">17. Contact Information</h2>
            <p className="text-gray-700">
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <p className="text-gray-700">
                <strong>Email:</strong> hung@theaiwhisperer.de<br />
                <strong>Address:</strong> Am Kaisersbusch 6, 42781 Haan, Germany
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Zap className="h-6 w-6 text-blue-400" />
              <span className="ml-2 text-lg font-semibold">PitchDonkey</span>
            </div>
            <div className="text-sm text-gray-400">
              © 2024 PitchDonkey. Built with Next.js and TypeScript.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}