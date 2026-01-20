import { Router, Request, Response } from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const publicRouter = Router();

/**
 * GET /auth/signup
 * Serve the registration page
 */
publicRouter.get('/auth/signup', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/signup.html'));
});

/**
 * GET /auth/login
 * Serve the login page
 */
publicRouter.get('/auth/login', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/login.html'));
});

/**
 * GET /
 * Serve The Gatekeeper landing page
 */
publicRouter.get('/', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/index.html'));
});
