/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getFriendlyErrorMessage } from '../lib/utils';

const DEFAULT_BASE_URL = 'http://localhost:4000';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/?$/, '') ?? DEFAULT_BASE_URL;
const STORAGE_KEY = 'closet.city.auth';

export interface AuthSession {
  token: string;
  userId: string;
  email: string;
}

interface RegisterResponse {
  userId: string;
}

interface LoginResponse {
  token: string;
}

const toJson = async (response: Response) => {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const decodeJwt = (token: string): { userId?: string } => {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return {};
    }
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '='));
    return JSON.parse(decoded);
  } catch (error) {
    console.warn('Failed to decode JWT token', error);
    return {};
  }
};

export const registerUser = async (email: string, password: string): Promise<RegisterResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizeEmail(email), password }),
  });

  const data = await toJson(response);
  if (!response.ok) {
    const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to register user.';
    throw new Error(errorMessage);
  }

  return data as RegisterResponse;
};

export const loginUser = async (email: string, password: string): Promise<AuthSession> => {
  const normalizedEmail = normalizeEmail(email);
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, password }),
  });

  const data = await toJson(response);
  if (!response.ok) {
    const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to authenticate user.';
    throw new Error(errorMessage);
  }

  const { token } = data as LoginResponse;
  if (!token) {
    throw new Error('Authentication response did not include a token.');
  }

  const payload = decodeJwt(token);
  if (!payload.userId) {
    throw new Error('Token payload missing user ID.');
  }

  return { token, userId: payload.userId, email: normalizedEmail };
};

export const storeAuthSession = (session: AuthSession) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('Failed to persist auth session', error);
  }
};

export const clearStoredAuthSession = () => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear auth session', error);
  }
};

export const getStoredAuthSession = (): AuthSession | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed.token || !parsed.userId || !parsed.email) {
      return null;
    }
    return parsed as AuthSession;
  } catch (error) {
    console.error('Failed to read auth session', error);
    return null;
  }
};

export const getAuthErrorMessage = (error: unknown, fallback: string) => {
  return getFriendlyErrorMessage(error, fallback);
};

