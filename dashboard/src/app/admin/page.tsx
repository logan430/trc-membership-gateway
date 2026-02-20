import { redirect } from 'next/navigation';

/**
 * /admin redirect
 * Sends users to /admin/dashboard (or /admin/login if not authenticated)
 */
export default function AdminPage() {
  redirect('/admin/dashboard');
}
