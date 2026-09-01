/**
 * Client-Side Rate Limiter & Input Throttler
 * Enforces rate limits on UI inputs, form submissions, button interactions, and API calls.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  retryAfterSeconds: number;
}

class MemoryRateLimiter {
  private timestamps: Map<string, number[]> = new Map();

  /**
   * Checks if an action key has exceeded `maxAllowed` within `windowMs`.
   * If allowed, records the timestamp and returns allowed: true.
   * If exceeded, returns allowed: false and the milliseconds until retry.
   */
  check(key: string, maxAllowed = 5, windowMs = 5000): RateLimitCheckResult {
    const now = Date.now();
    const history = this.timestamps.get(key) || [];
    
    // Filter out timestamps older than the window
    const validHistory = history.filter(ts => now - ts < windowMs);

    if (validHistory.length >= maxAllowed) {
      const oldestValid = validHistory[0];
      const retryAfterMs = Math.max(0, windowMs - (now - oldestValid));
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
      
      this.timestamps.set(key, validHistory);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
        retryAfterSeconds
      };
    }

    validHistory.push(now);
    this.timestamps.set(key, validHistory);

    return {
      allowed: true,
      remaining: maxAllowed - validHistory.length,
      retryAfterMs: 0,
      retryAfterSeconds: 0
    };
  }

  /**
   * Resets rate limit for a specific action key
   */
  reset(key: string) {
    this.timestamps.delete(key);
  }

  /**
   * Clears all tracked keys
   */
  clear() {
    this.timestamps.clear();
  }
}

export const rateLimiter = new MemoryRateLimiter();

/**
 * Convenient check helper for quick inline rate-limit checks.
 */
export function checkRateLimit(
  actionKey: string, 
  maxAllowed = 5, 
  windowMs = 3000
): RateLimitCheckResult {
  return rateLimiter.check(actionKey, maxAllowed, windowMs);
}

/**
 * React hook to throttle or debounce frequent inputs (e.g. search bars, number fields, filter inputs).
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Hook for rate-limited form submission and button actions.
 * Automatically manages countdown, disabled state, and error message.
 */
export function useRateLimitedAction(
  actionKey: string,
  options: { maxAllowed?: number; windowMs?: number; cooldownMs?: number } = {}
) {
  const { maxAllowed = 3, windowMs = 4000, cooldownMs = 1000 } = options;
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const lastExecutionRef = useRef<number>(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const execute = useCallback(
    async <T>(actionFn: () => Promise<T> | T): Promise<{ success: boolean; result?: T; error?: string }> => {
      const now = Date.now();
      
      // Quick cooldown check between consecutive single clicks
      if (now - lastExecutionRef.current < cooldownMs) {
        return {
          success: false,
          error: `Please wait a moment before submitting again.`
        };
      }

      // Sliding window rate limit check
      const check = rateLimiter.check(actionKey, maxAllowed, windowMs);
      if (!check.allowed) {
        setIsRateLimited(true);
        setCooldownRemaining(check.retryAfterSeconds);

        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setCooldownRemaining(prev => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              setIsRateLimited(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        return {
          success: false,
          error: `Rate limit reached. Please wait ${check.retryAfterSeconds} second(s) before trying again.`
        };
      }

      lastExecutionRef.current = now;
      try {
        const result = await actionFn();
        return { success: true, result };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Action failed' };
      }
    },
    [actionKey, maxAllowed, windowMs, cooldownMs]
  );

  return {
    execute,
    isRateLimited,
    cooldownRemaining,
    reset: () => rateLimiter.reset(actionKey)
  };
}

/**
 * Throttle helper for fast events (scroll, keypress, typing)
 */
export function throttle<T extends (...args: any[]) => any>(func: T, limitMs: number): (...args: Parameters<T>) => void {
  let lastRan = 0;
  let timeout: any = null;

  return function (...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastRan >= limitMs) {
      lastRan = now;
      func(...args);
    } else {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        lastRan = Date.now();
        func(...args);
      }, limitMs - (now - lastRan));
    }
  };
}
