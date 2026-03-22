'use client';

import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CookiesPage() {
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
            Cookie Policy
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
                <strong>1. What Are Cookies</strong><br/>
                Cookies are small text files that are placed on your computer or mobile device when you visit our website. They help us provide you with a better experience by remembering your preferences and enabling certain functionality.
              </p>

              <p>
                <strong>2. How We Use Cookies</strong><br/>
                We use cookies for various purposes, including:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Essential cookies: Required for the website to function properly</li>
                <li>Analytics cookies: Help us understand how visitors use our website</li>
                <li>Functional cookies: Remember your preferences and settings</li>
                <li>Marketing cookies: Used to deliver relevant advertisements</li>
              </ul>

              <p>
                <strong>3. Types of Cookies We Use</strong><br/>
                <strong>Essential Cookies:</strong> These cookies are necessary for the website to function and cannot be switched off in our systems. They are usually only set in response to actions made by you which amount to a request for services.
              </p>

              <p>
                <strong>Analytics Cookies:</strong> These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site. They help us to know which pages are the most and least popular.
              </p>

              <p>
                <strong>Functional Cookies:</strong> These cookies enable the website to provide enhanced functionality and personalization. They may be set by us or by third party providers whose services we have added to our pages.
              </p>

              <p>
                <strong>4. Third-Party Cookies</strong><br/>
                We may also use third-party cookies from services like Google Analytics, which help us understand how our website is being used. These third parties have their own privacy policies and cookie practices.
              </p>

              <p>
                <strong>5. Managing Cookies</strong><br/>
                You can control and/or delete cookies as you wish. You can delete all cookies that are already on your computer and you can set most browsers to prevent them from being placed. However, if you do this, you may have to manually adjust some preferences every time you visit a site and some services and functionalities may not work.
              </p>

              <p>
                <strong>6. Browser Settings</strong><br/>
                Most web browsers allow some control of most cookies through the browser settings. To find out more about cookies, including how to see what cookies have been set and how to manage and delete them, visit www.aboutcookies.org or www.allaboutcookies.org.
              </p>

              <p>
                <strong>7. Updates to This Policy</strong><br/>
                We may update this cookie policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. Please revisit this policy regularly to stay informed about our use of cookies.
              </p>

              <p>
                <strong>8. Contact Us</strong><br/>
                If you have any questions about our use of cookies, please contact us at privacy@bumm.io
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
