'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  FolderOpen,
  Trophy,
  User,
  Settings,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Coins,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const realmNavItems: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Benchmarks', href: '/dashboard/benchmarks', icon: <BarChart3 size={20} /> },
  { label: 'Resources', href: '/dashboard/resources', icon: <FolderOpen size={20} /> },
  { label: 'Guild Rankings', href: '/dashboard/leaderboard', icon: <Trophy size={20} /> },
];

const keepNavItems: NavItem[] = [
  { label: 'Profile', href: '/dashboard/profile', icon: <User size={20} /> },
  { label: 'Account', href: '/dashboard/account', icon: <Settings size={20} /> },
  { label: 'Billing', href: '/dashboard/billing', icon: <CreditCard size={20} /> },
];

interface SidebarProps {
  goldCount?: number;
}

/**
 * Sidebar navigation with medieval theme
 *
 * Per CONTEXT.md:
 * - Collapsible sidebar
 * - Grouped under "The Realm" (features) and "My Keep" (personal)
 * - Rank badge placeholder above navigation
 * - Gold summary in header area
 */
export function Sidebar({ goldCount = 0 }: SidebarProps) {
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
      {/* Logo and Gold Count */}
      <div className="p-4 border-b-2 border-border">
        {!collapsed && (
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-foreground">TRC</span>
            <div className="flex items-center gap-1 text-gold-dark">
              <Coins size={16} />
              <span className="text-sm font-semibold">{goldCount}</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center">
            <Coins size={20} className="text-gold" />
          </div>
        )}
      </div>

      {/* Rank Badge Placeholder */}
      {!collapsed && (
        <div className="p-4 border-b-2 border-border">
          <div className="bg-accent rounded-[8px] p-3 text-center pixel-border border-gold/30">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Rank</span>
            <p className="font-semibold text-foreground">Squire</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* The Realm Section */}
        <NavSection
          title="The Realm"
          items={realmNavItems}
          collapsed={collapsed}
          pathname={pathname}
        />

        {/* My Keep Section */}
        <NavSection
          title="My Keep"
          items={keepNavItems}
          collapsed={collapsed}
          pathname={pathname}
        />
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2 border-t-2 border-border">
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
          const isActive = pathname === item.href;
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

export default Sidebar;
