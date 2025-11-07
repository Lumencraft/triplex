/**
 * Copyright (c) 2022—present Michael Dougall. All rights reserved.
 *
 * This repository utilizes multiple licenses across different directories. To
 * see this files license find the nearest LICENSE file up the source tree.
 */
import { useThree } from "@react-three/fiber";
import { on } from "@triplex/bridge/client";
import { useCallback, useEffect, useRef } from "react";

/**
 * Progressive frameloop configuration
 * Starts at 60fps, progressively slows down to 1fps over time when inactive
 */
const PROGRESSIVE_INTERVALS = [
  16, // ~60fps - initial fast rendering for immediate feedback
  16, // ~60fps - stay fast for a bit
  33, // ~30fps - after 1 second
  66, // ~15fps - after 2 seconds
  133, // ~7.5fps - after 3 seconds
  266, // ~3.75fps - after 4 seconds
  533, // ~1.8fps - after 5 seconds
  1000, // ~1fps - floor (stays here)
];

/**
 * Hook to manage progressive frameloop rendering for the canvas.
 * Reduces render strain by:
 * - Setting frameloop to "demand"
 * - Progressively slowing down render rate when inactive (from 60fps to 1fps)
 * - Resuming fast rendering on user interaction, HMR, or window focus
 */
export function useProgressiveFrameloop() {
  const { invalidate } = useThree();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalIndexRef = useRef(0);
  const isActiveRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleNextRender = useCallback(() => {
    clearTimer();

    const currentInterval =
      PROGRESSIVE_INTERVALS[intervalIndexRef.current] || 1000;

    timerRef.current = setTimeout(() => {
      invalidate();

      // Progress to next slower interval if not at the floor
      if (
        intervalIndexRef.current <
        PROGRESSIVE_INTERVALS.length - 1
      ) {
        intervalIndexRef.current++;
      }

      // Schedule next render
      scheduleNextRender();
    }, currentInterval);
  }, [clearTimer, invalidate]);

  const resetToFastRendering = useCallback(() => {
    // Reset to initial fast interval
    intervalIndexRef.current = 0;
    isActiveRef.current = true;
    clearTimer();
    scheduleNextRender();
    invalidate();
  }, [clearTimer, scheduleNextRender, invalidate]);

  useEffect(() => {
    // Start the progressive rendering loop
    scheduleNextRender();

    // Listen for HMR events to resume fast rendering
    const unsubscribeHMR = on("self:request-reset-error-boundary", () => {
      resetToFastRendering();
    });

    // Listen for window focus/blur events
    const handleFocus = () => {
      resetToFastRendering();
    };

    const handleBlur = () => {
      // Don't change anything on blur, let it progressively slow down
      isActiveRef.current = false;
    };

    // Listen for user interactions to reset the timer
    const handleUserInteraction = () => {
      if (!isActiveRef.current || intervalIndexRef.current > 0) {
        resetToFastRendering();
      }
    };

    // Track various user interactions
    const interactionEvents = [
      "mousemove",
      "mousedown",
      "mouseup",
      "wheel",
      "keydown",
      "touchstart",
      "touchmove",
    ];

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    interactionEvents.forEach((event) => {
      window.addEventListener(event, handleUserInteraction, { passive: true });
    });

    return () => {
      clearTimer();
      unsubscribeHMR();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      interactionEvents.forEach((event) => {
        window.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [clearTimer, resetToFastRendering, scheduleNextRender]);

  return null;
}
