'use client';

import { motion } from 'framer-motion';
import { TEMPLATE_CARDS, type TemplateCard } from '@/lib/contractTemplates';

interface TemplateGalleryProps {
  /**
   * Fired when a user picks a template card. Receives the card's ready-to-edit
   * starter prompt — the parent fills the chat input and focuses it (soft flow:
   * the user reviews/edits before hitting Generate).
   */
  onPick: (starterPrompt: string, card: TemplateCard) => void;
  /** Optional extra classes for the wrapper (layout tweaks from the parent). */
  className?: string;
}

/**
 * F3 — Template gallery shown on the empty/first-visit chat screen.
 *
 * Self-contained: it owns its own data (TEMPLATE_CARDS) and only calls back
 * with the chosen prompt. ChatScreen merely mounts it and wires the input.
 */
export function TemplateGallery({ onPick, className = '' }: TemplateGalleryProps) {
  return (
    <div className={`py-6 ${className}`}>
      <div className="text-center mb-4">
        <p className="text-white text-sm font-semibold">
          Not sure where to start?
        </p>
        <p className="text-[#888] text-xs mt-1">
          Pick a template — we&apos;ll drop a starter prompt in the box for you to tweak.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {TEMPLATE_CARDS.map((card) => (
          <motion.button
            key={card.id}
            type="button"
            onClick={() => onPick(card.starterPrompt, card)}
            className="group text-left p-3 rounded-lg bg-[#191919] border border-[#333] hover:border-orange-500/60 hover:bg-[#1f1f1f] transition-colors focus:outline-none focus-visible:border-orange-500"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            aria-label={`Use the ${card.label} template`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg leading-none" aria-hidden="true">
                {card.emoji}
              </span>
              <span className="text-white text-xs font-semibold group-hover:text-orange-400 transition-colors">
                {card.label}
              </span>
            </div>
            <p className="text-[#888] text-[11px] leading-snug">
              {card.description}
            </p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
