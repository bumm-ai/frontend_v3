'use client';

import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TermsPage() {
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
            Terms of Service
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
                <strong>1. Acceptance of Terms</strong><br/>
                By accessing and using Bumm.io ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>

              <p>
                <strong>2. Use License</strong><br/>
                Permission is granted to temporarily download one copy of Bumm.io per device for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>modify or copy the materials</li>
                <li>use the materials for any commercial purpose or for any public display (commercial or non-commercial)</li>
                <li>attempt to decompile or reverse engineer any software contained on Bumm.io's website</li>
                <li>remove any copyright or other proprietary notations from the materials</li>
              </ul>

              <p>
                <strong>3. Disclaimer</strong><br/>
                The materials on Bumm.io are provided on an 'as is' basis. Bumm.io makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
              </p>

              <p>
                <strong>4. Limitations</strong><br/>
                In no event shall Bumm.io or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Bumm.io, even if Bumm.io or a Bumm.io authorized representative has been notified orally or in writing of the possibility of such damage. Because some jurisdictions do not allow limitations on implied warranties, or limitations of liability for consequential or incidental damages, these limitations may not apply to you.
              </p>

              <p>
                <strong>5. Accuracy of materials</strong><br/>
                The materials appearing on Bumm.io could include technical, typographical, or photographic errors. Bumm.io does not warrant that any of the materials on its website are accurate, complete or current. Bumm.io may make changes to the materials contained on its website at any time without notice. However Bumm.io does not make any commitment to update the materials.
              </p>

              <p>
                <strong>6. Links</strong><br/>
                Bumm.io has not reviewed all of the sites linked to our website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by Bumm.io of the site. Use of any such linked website is at the user's own risk.
              </p>

              <p>
                <strong>7. Modifications</strong><br/>
                Bumm.io may revise these terms of service for its website at any time without notice. By using this website you are agreeing to be bound by the then current version of these terms of service.
              </p>

              <p>
                <strong>8. Governing Law</strong><br/>
                These terms and conditions are governed by and construed in accordance with the laws of the United States and you irrevocably submit to the exclusive jurisdiction of the courts in that state or location.
              </p>

              <p>
                <strong>9. Contact Information</strong><br/>
                If you have any questions about these Terms of Service, please contact us at legal@bumm.io
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
