'use client';

import { motion } from 'framer-motion';
import { FileText, Shield, Cookie } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full border-t border-[#191919] bg-transparent mt-auto py-4">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
          {/* Left - Social Media (скрыто на мобильных, видимо на десктопе) */}
          <div className="hidden md:flex items-center gap-3">
            <motion.a
              href="https://twitter.com/bumm_io"
              target="_blank"
              rel="noopener noreferrer"
              className="w-5 h-5 text-gray-400 hover:text-white transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {/* Twitter/X Icon */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </motion.a>
            
            <motion.a
              href="https://www.linkedin.com/company/bumm-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="w-5 h-5 text-gray-400 hover:text-white transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {/* LinkedIn Icon */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </motion.a>
          </div>

          {/* Center - Copyright and Legal Links */}
          <div className="text-center flex-1 md:flex-initial">
            <div className="text-xs md:text-sm text-gray-400 mb-2">
              AI-powered code generation and deployment on Solana
            </div>
            <div className="flex flex-wrap justify-center gap-4 mb-2">
              <motion.a
                href="/terms"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-orange-500 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FileText className="w-3 h-3" />
                Terms of Service
              </motion.a>
              <motion.a
                href="/privacy"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-orange-500 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Shield className="w-3 h-3" />
                Privacy Policy
              </motion.a>
              <motion.a
                href="/cookies"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-orange-500 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Cookie className="w-3 h-3" />
                Cookie Policy
              </motion.a>
            </div>
            <div className="text-xs text-gray-500">
              © 2025 Bumm.io
            </div>
          </div>

          {/* Right - Social Media на мобильных, пустое место на десктопе */}
          <div className="flex md:hidden items-center gap-3">
            <motion.a
              href="https://twitter.com/bumm_io"
              target="_blank"
              rel="noopener noreferrer"
              className="w-5 h-5 text-gray-400 hover:text-white transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {/* Twitter/X Icon */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </motion.a>
            
            <motion.a
              href="https://www.linkedin.com/company/bumm-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="w-5 h-5 text-gray-400 hover:text-white transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {/* LinkedIn Icon */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </motion.a>
          </div>

          {/* Right spacer для десктопа */}
          <div className="hidden md:block w-[72px]"></div>
        </div>
      </div>
    </footer>
  );
}
