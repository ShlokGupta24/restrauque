import { NextResponse } from 'next/server';

export const AUTH_COOKIE_NAME = 'restrauque_session';

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export function setAuthCookie(response: NextResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearAuthCookie(response: NextResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
