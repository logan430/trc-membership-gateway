'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface AuthResponse {
  accessToken?: string;
  error?: string;
}

interface UseAuthReturn {
  login: (email: string, password: string, redirectUrl?: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook for authentication operations (login/signup)
 *
 * Handles:
 * - POST to /auth/login and /auth/signup
 * - Token storage in localStorage
 * - Redirect after successful auth
 * - Error state management
 */
export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const login = useCallback(async (email: string, password: string, redirectUrl = '/dashboard') => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data: AuthResponse = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid email or password.');
        return;
      }

      // Store access token if provided
      if (data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
      }

      // Redirect to dashboard or specified URL
      router.push(redirectUrl);
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const signup = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data: AuthResponse = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create account.');
        return;
      }

      // Store access token if provided
      if (data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
      }

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Signup error:', err);
      setError('Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  return { login, signup, isLoading, error, clearError };
}

/**
 * Handle magic link token from URL hash
 * Returns true if token was found and processed
 */
export function handleMagicLinkToken(redirectUrl = '/dashboard'): boolean {
  if (typeof window === 'undefined') return false;

  const hash = window.location.hash;
  if (hash && hash.startsWith('#token=')) {
    const token = hash.substring(7);
    localStorage.setItem('accessToken', token);
    // Clear the hash from URL
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    window.location.href = redirectUrl;
    return true;
  }
  return false;
}
