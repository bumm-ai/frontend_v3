'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X, Check } from 'lucide-react';
import Link from 'next/link';

export const CookieBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const cookiesAccepted = localStorage.getItem('cookies-accepted');
    if (!cookiesAccepted) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookies-accepted', 'true');
    setIsVisible(false);
  };

  const handleAcceptAll = () => {
    localStorage.setItem('cookies-accepted', 'all');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50"
      >
        <div className="bg-[#191919] border border-[#333] rounded-lg p-4 shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Cookie className="w-5 h-5 text-orange-500" />
            <h3 className="text-sm font-semibold text-white">We use cookies</h3>
          </div>

          {/* Content */}
          <p className="text-xs text-gray-300 mb-4 leading-relaxed">
            We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
            By clicking "Accept All", you consent to our use of cookies.
          </p>

          {/* Links */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Link 
              href="/cookies" 
              className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
            >
              Cookie Policy
            </Link>
            <span className="text-xs text-gray-500">•</span>
            <Link 
              href="/privacy" 
              className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
            >
              Privacy Policy
            </Link>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            <motion.button
              onClick={handleAccept}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#333] text-white text-xs rounded-lg hover:bg-[#444] transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Check className="w-3 h-3" />
              Accept Essential
            </motion.button>
            
            <motion.button
              onClick={handleAcceptAll}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500 text-white text-xs rounded-lg hover:bg-orange-600 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Cookie className="w-3 h-3" />
              Accept All
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
