import { Response } from 'express';
import { ApiResponse, PaginatedResult } from '../types';

export function success<T>(res: Response, data?: T, message = 'success'): Response<ApiResponse<T>> {
  return res.json({
    code: 0,
    message,
    data
  });
}

export function fail(res: Response, message: string, code = 400): Response<ApiResponse> {
  return res.status(code).json({
    code,
    message
  });
}

export function paginate<T>(list: T[], page: number, pageSize: number): PaginatedResult<T> {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    list: list.slice(start, end),
    total: list.length,
    page,
    pageSize
  };
}

export function getCurrentUserId(req: any): string {
  return req.headers['x-user-id'] || 'user-001';
}
