import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/auth';

export function successResponse<T>(
  data: T,
  status = 200,
  headers?: HeadersInit
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers,
    }
  );
}

export function errorResponse(
  message: string,
  status = 400,
  code = 'BAD_REQUEST',
  details?: unknown,
  headers?: HeadersInit
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers,
    }
  );
}
