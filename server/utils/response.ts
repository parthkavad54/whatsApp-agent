import { Response } from 'express';

export const sendSuccess = (res: Response, data: any, message: string = '', status: number = 200) =>
  res.status(status).json({ success: true, data, message });

export const sendError = (res: Response, message: string, code: string = 'SERVER_ERROR', status: number = 500) =>
  res.status(status).json({ success: false, error: { code, message } });
