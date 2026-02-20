import { redirect } from 'next/navigation';

/**
 * /admin redirect
 * Sends to /admin/login — auth guard on dashboard pages handles the rest
 */
export default function AdminPage() {
  redirect('/admin/login');
}
