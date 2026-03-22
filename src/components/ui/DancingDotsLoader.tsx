'use client';

import { motion } from 'framer-motion';

interface DancingDotsLoaderProps {
  className?: string;
}

export const DancingDotsLoader = ({ className = '' }: DancingDotsLoaderProps) => {
  const dotVariants = {
    initial: { y: 0 },
    animate: { y: -8 },
  };

  const containerVariants = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.2,
        repeat: Infinity,
        repeatType: "reverse" as const,
        duration: 0.6,
      }
    }
  };

  return (
    <motion.div 
      className={`flex items-center justify-center gap-1 ${className}`}
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-orange-500 rounded-full"
          variants={dotVariants}
          transition={{
            duration: 0.6,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "reverse",
            delay: i * 0.2,
          }}
        />
      ))}
    </motion.div>
  );
};
