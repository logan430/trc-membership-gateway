'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  Shield,
  Mail,
  ClipboardList,
  FolderOpen,
  Flag,
  Coins,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { logout } from '@/lib/admin-auth';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const commandCenterItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Members', href: '/admin/members', icon: <Users size={20} /> },
  { label: 'Resources', href: '/admin/resources', icon: <FolderOpen size={20} /> },
  { label: 'Benchmarks', href: '/admin/benchmarks', icon: <Flag size={20} /> },
  { label: 'Analytics', href: '/admin/analytics', icon: <BarChart3 size={20} /> },
];

const systemItems: NavItem[] = [
  { label: 'Config', href: '/admin/config', icon: <Settings size={20} /> },
  { label: 'Templates', href: '/admin/templates', icon: <Mail size={20} /> },
  { label: 'Audit Logs', href: '/admin/audit', icon: <ClipboardList size={20} /> },
  { label: 'Admins', href: '/admin/admins', icon: <Shield size={20} /> },
  { label: 'Points Config', href: '/admin/points-config', icon: <Coins size={20} /> },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={`
        flex flex-col h-full
        bg-card border-r-2 border-border
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Logo */}
      <div className="p-4 border-b-2 border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Shield size={24} className="text-gold" />
            <span className="font-bold text-foreground">TRC Admin</span>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center">
            <Shield size={24} className="text-gold" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <NavSection
          title="Command Center"
          items={commandCenterItems}
          collapsed={collapsed}
          pathname={pathname}
        />
        <NavSection
          title="System"
          items={systemItems}
          collapsed={collapsed}
          pathname={pathname}
        />
      </nav>

      {/* Bottom Actions */}
      <div className="p-2 border-t-2 border-border space-y-1">
        <button
          onClick={logout}
          className={`
            w-full flex items-center gap-3 px-3 py-2 rounded-[8px]
            text-muted-foreground hover:text-error hover:bg-error/10
            transition-colors
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={20} />
          {!collapsed && <span className="font-medium">Logout</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="
            w-full flex items-center justify-center
            p-2 rounded-[8px]
            text-muted-foreground hover:text-foreground
            hover:bg-accent transition-colors
          "
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
    </aside>
  );
}

interface NavSectionProps {
  title: string;
  items: NavItem[];
  collapsed: boolean;
  pathname: string;
}

function NavSection({ title, items, collapsed, pathname }: NavSectionProps) {
  return (
    <div className="mb-6">
      {!collapsed && (
        <h3 className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
      )}
      <ul className="space-y-1 px-2">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-[8px]
                  transition-all duration-150
                  ${collapsed ? 'justify-center' : ''}
                  ${
                    isActive
                      ? 'bg-gold/10 text-gold-dark border-2 border-gold/30 shadow-[2px_2px_0px_0px_rgba(212,160,23,0.2)]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                {!collapsed && <span className="font-medium">{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default AdminSidebar;
