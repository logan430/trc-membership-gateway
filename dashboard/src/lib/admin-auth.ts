'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export const TOKEN_KEY = 'adminAccessToken';

interface AdminTokenPayload {
  sub: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  iat: number;
  exp: number;
}

/**
 * Validate admin token from localStorage
 * Returns decoded payload if valid, null otherwise
 */
export function validateAdminToken(): AdminTokenPayload | null {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  try {
    // JWT structure: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1])) as AdminTokenPayload;

    // Check expiration
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }

    return payload;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

/**
 * Get admin token for API calls
 */
export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Logout admin and redirect to login
 */
export function logout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = '/admin/login';
}

/**
 * Hook for admin authentication state
 */
export function useAdminAuth() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminTokenPayload | null>(null);
  const hasRedirected = useRef(false);

  useEffect(() => {
    const payload = validateAdminToken();
    setAdmin(payload);
    setIsLoading(false);

    // Only redirect once to prevent infinite loop
    if (!payload && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/admin/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount - router is stable

  return {
    isLoading,
    admin,
    isAuthenticated: !!admin,
    isSuperAdmin: admin?.role === 'SUPER_ADMIN',
    logout,
  };
}
