import { Router, Request, Response } from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const publicRouter = Router();

/* ================================
   Auth Route Redirects
   ================================
   Legacy routes redirect to Next.js auth pages.
   The Next.js pages at /login and /signup are proxied through Express.
*/

/**
 * GET /app/auth/signup - Redirect to Next.js signup
 */
publicRouter.get('/app/auth/signup', (_req: Request, res: Response): void => {
  res.redirect(301, '/signup');
});

/**
 * GET /app/auth/login - Redirect to Next.js login
 */
publicRouter.get('/app/auth/login', (_req: Request, res: Response): void => {
  res.redirect(301, '/login');
});

/**
 * GET /signup.html - Redirect to Next.js signup
 */
publicRouter.get('/signup.html', (_req: Request, res: Response): void => {
  res.redirect(301, '/signup');
});

/**
 * GET /login.html - Redirect to Next.js login
 */
publicRouter.get('/login.html', (_req: Request, res: Response): void => {
  res.redirect(301, '/login');
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
 * GET /app/account
 * Serve the member account settings page
 */
publicRouter.get('/app/account', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/account.html'));
});

/**
 * GET /app/billing
 * Serve the member billing details page
 */
publicRouter.get('/app/billing', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/billing.html'));
});

/**
 * GET /app/team
 * Serve the team dashboard page (for team owners)
 */
publicRouter.get('/app/team', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/team-dashboard.html'));
});

/**
 * GET /team/invite
 * Serve the team invite claim page
 * Token is passed via query string and handled client-side
 */
publicRouter.get('/team/invite', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/team-claim.html'));
});

/**
 * GET /checkout/success
 * Serve the post-checkout success page
 */
publicRouter.get('/checkout/success', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/checkout-success.html'));
});

/**
 * GET /
 * Serve The Gatekeeper landing page
 */
publicRouter.get('/', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/index.html'));
});

/* ================================
   Admin Pages
   ================================ */

/**
 * GET /app/admin/login
 * Serve the admin login page
 */
publicRouter.get('/app/admin/login', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/admin/login.html'));
});

/**
 * GET /app/admin/dashboard
 * Serve the admin dashboard page (auth checked client-side)
 */
publicRouter.get('/app/admin/dashboard', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/admin/dashboard.html'));
});

/**
 * GET /app/admin/members
 * Serve the member management page
 */
publicRouter.get('/app/admin/members', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/admin/members.html'));
});

/**
 * GET /app/admin/members/:id
 * Serve the member detail page (ID parsed client-side from query param)
 */
publicRouter.get('/app/admin/members/:id', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/admin/member-detail.html'));
});

/**
 * GET /app/admin/config
 * Serve the feature flags/config page
 */
publicRouter.get('/app/admin/config', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/admin/config.html'));
});

/**
 * GET /app/admin/audit
 * Serve the audit log viewer page
 */
publicRouter.get('/app/admin/audit', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/admin/audit.html'));
});

/**
 * GET /app/admin/admins
 * Serve the admin account management page (super admin only, checked client-side)
 */
publicRouter.get('/app/admin/admins', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/admin/admins.html'));
});

/**
 * GET /app/admin/templates
 * Serve the email template list page
 */
publicRouter.get('/app/admin/templates', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/admin/templates.html'));
});

/**
 * GET /app/admin/templates/:name
 * Serve the template edit page (template name parsed client-side from URL)
 */
publicRouter.get('/app/admin/templates/:name', (_req: Request, res: Response): void => {
  res.sendFile(join(__dirname, '../../public/admin/template-edit.html'));
});
