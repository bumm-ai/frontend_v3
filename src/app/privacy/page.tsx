'use client';

import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Privacy Policy
          </h1>
          <p className="text-gray-400">
            Last updated: January 2025
          </p>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="prose prose-invert max-w-none"
        >
          <div className="bg-[#191919] border border-[#333] rounded-lg p-6 space-y-6">
            <div className="text-sm leading-relaxed text-gray-300 space-y-4">
              <p>
                <strong>1. Information We Collect</strong><br/>
                We collect information you provide directly to us, such as when you create an account, use our services, or contact us for support. This may include your name, email address, and any other information you choose to provide.
              </p>

              <p>
                <strong>2. How We Use Your Information</strong><br/>
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices, updates, security alerts, and support messages</li>
                <li>Respond to your comments, questions, and requests</li>
                <li>Monitor and analyze trends, usage, and activities</li>
              </ul>

              <p>
                <strong>3. Information Sharing and Disclosure</strong><br/>
                We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy. We may share your information in the following circumstances:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>With your consent</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and prevent fraud</li>
                <li>In connection with a business transfer</li>
              </ul>

              <p>
                <strong>4. Data Security</strong><br/>
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure.
              </p>

              <p>
                <strong>5. Cookies and Tracking Technologies</strong><br/>
                We use cookies and similar tracking technologies to collect and use personal information about you. You can control cookies through your browser settings, but disabling cookies may affect the functionality of our services.
              </p>

              <p>
                <strong>6. Third-Party Services</strong><br/>
                Our services may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies.
              </p>

              <p>
                <strong>7. Data Retention</strong><br/>
                We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this policy, unless a longer retention period is required or permitted by law.
              </p>

              <p>
                <strong>8. Your Rights</strong><br/>
                Depending on your location, you may have certain rights regarding your personal information, including the right to access, update, or delete your information. To exercise these rights, please contact us at privacy@bumm.io
              </p>

              <p>
                <strong>9. Children's Privacy</strong><br/>
                Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.
              </p>

              <p>
                <strong>10. Changes to This Policy</strong><br/>
                We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
              </p>

              <p>
                <strong>11. Contact Us</strong><br/>
                If you have any questions about this privacy policy, please contact us at privacy@bumm.io
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
