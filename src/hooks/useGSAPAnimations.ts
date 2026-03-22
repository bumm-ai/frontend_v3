'use client';

import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

// Register ScrollTrigger plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export const useGSAPAnimations = () => {
  const demoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (demoRef.current && typeof window !== 'undefined') {
      // Block appearance animation on scroll
      gsap.fromTo(demoRef.current,
        { 
          opacity: 0, 
          y: 50,
          scale: 0.95
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: demoRef.current,
            start: 'top 80%',
            end: 'bottom 20%',
            toggleActions: 'play none none reverse',
          }
        }
      );

      // Remove floating animation - keep only glow

      // Glow animation for border - smoother with reduced wavelength
      gsap.to(demoRef.current, {
        boxShadow: "0 0 18px rgba(255, 102, 51, 0.3), 0 0 35px rgba(255, 102, 51, 0.15), 0 0 56px rgba(255, 102, 51, 0.08)",
        duration: 3.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });

      // Gradient borders remain constant (no animation)

      // Animation for elements inside block
      const header = demoRef.current.querySelector('.demo-header');
      const progress = demoRef.current.querySelector('.demo-progress');
      const content = demoRef.current.querySelector('.demo-content');

      if (header) {
        gsap.fromTo(header,
          { opacity: 0, y: -30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            delay: 0.2,
            ease: "power2.out"
          }
        );
      }

      if (progress) {
        gsap.fromTo(progress,
          { opacity: 0, scaleX: 0 },
          {
            opacity: 1,
            scaleX: 1,
            duration: 1,
            delay: 0.4,
            ease: "power2.out"
          }
        );
      }

      if (content) {
        gsap.fromTo(content,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            delay: 0.6,
            ease: "power2.out"
          }
        );
      }

      // Animation for buttons and interactive elements
      const buttons = demoRef.current.querySelectorAll('.demo-button');
      buttons.forEach((button, index) => {
        gsap.fromTo(button,
          { opacity: 0, scale: 0.8 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            delay: 0.8 + (index * 0.1),
            ease: "back.out(1.7)"
          }
        );
      });

      // Animation for panels (projects, chat, code)
      const panels = demoRef.current.querySelectorAll('.demo-panel');
      panels.forEach((panel, index) => {
        gsap.fromTo(panel,
          { opacity: 0, x: index % 2 === 0 ? -20 : 20 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            delay: 1 + (index * 0.2),
            ease: "power2.out"
          }
        );
      });

      // Animation for chat messages
      const messages = demoRef.current.querySelectorAll('.chat-message');
      messages.forEach((message, index) => {
        gsap.fromTo(message,
          { opacity: 0, y: 20, scale: 0.9 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            delay: 1.5 + (index * 0.1),
            ease: "power2.out"
          }
        );
      });

      // Animation for code
      const codeBlock = demoRef.current.querySelector('.code-block');
      if (codeBlock) {
        gsap.fromTo(codeBlock,
          { opacity: 0, scale: 0.95 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.8,
            delay: 2,
            ease: "power2.out"
          }
        );
      }

      // Animation for credits indicator
      const creditsIndicator = demoRef.current.querySelector('.credits-indicator');
      if (creditsIndicator) {
        gsap.fromTo(creditsIndicator,
          { opacity: 0, scale: 0.8, rotation: -5 },
          {
            opacity: 1,
            scale: 1,
            rotation: 0,
            duration: 0.6,
            delay: 1.2,
            ease: "back.out(1.7)"
          }
        );

        // Pulsing animation for indicator
        gsap.to(creditsIndicator, {
          scale: 1.05,
          duration: 1.5,
          repeat: -1,
          yoyo: true,
          ease: "power2.inOut"
        });
      }

      // Cleanup function
      return () => {
        ScrollTrigger.getAll().forEach(trigger => trigger.kill());
        gsap.killTweensOf(demoRef.current);
      };
    }
  }, []);

  return { demoRef };
};
