'use client';

import { useState } from 'react';

interface NavigationProps {
  currentPage?: 'vibe' | 'pro' | 'faq';
}

export const Navigation = ({ currentPage = 'vibe' }: NavigationProps) => {
  const [hoveredPage, setHoveredPage] = useState<string | null>(null);

  const navItems = [
    { id: 'vibe', label: 'Vibe Mode', isActive: currentPage === 'vibe' },
    { id: 'pro', label: 'Pro Mode', isActive: currentPage === 'pro' },
    { id: 'faq', label: 'FAQ', isActive: currentPage === 'faq' }
  ];

  return (
    <nav className="hidden md:flex items-center gap-3 lg:gap-4">
      {navItems.map((item) => (
        <div
          key={item.id}
          className="relative"
          onMouseEnter={() => !item.isActive && setHoveredPage(item.id)}
          onMouseLeave={() => setHoveredPage(null)}
        >
          <button
            className={`text-xs font-medium transition-colors relative ${
              item.isActive 
                ? 'text-orange-500' 
                : 'text-[#989898] hover:text-white'
            }`}
            disabled={!item.isActive}
          >
            {item.label}
            {item.isActive && (
              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-orange-500 rounded-full"></div>
            )}
          </button>
          
          {/* Tooltip "Soon" для неактивных страниц */}
          {hoveredPage === item.id && !item.isActive && (
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1.5 bg-[#333] text-white text-xs rounded-lg shadow-lg z-50 whitespace-nowrap border border-[#555]">
              <div className="flex items-center gap-1">
                <span>Soon</span>
              </div>
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-[#333]"></div>
            </div>
          )}
        </div>
      ))}
    </nav>
  );
};
