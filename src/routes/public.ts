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
 * GET /app/dashboard
 * Serve the member dashboard page (HTML)
 * Note: /dashboard is the API route, /app/dashboard is the HTML page
 */
publicRouter.get('/app/dashboard', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/dashboard.html'));
});

/**
 * GET /app/claim
 * Serve the Discord claim page (HTML)
 * Note: /claim/* routes handle OAuth callbacks, /app/claim is the HTML page
 */
publicRouter.get('/app/claim', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/claim.html'));
});

/**
 * GET /
 * Serve The Gatekeeper landing page
 */
publicRouter.get('/', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/index.html'));
});
