'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu, Bell, User, LogOut, Settings, UserCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface HeaderProps {
  /** Callback when mobile menu button is clicked */
  onMenuClick?: () => void;
  /** Member name for display */
  memberName?: string;
}

/**
 * Dashboard header component
 *
 * Per CONTEXT.md:
 * - Logo + User avatar + Gold count
 * - Mobile: shows menu button for sidebar toggle
 */
export function Header({ onMenuClick, memberName }: HeaderProps) {
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [userMenuOpen]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Continue with client-side cleanup even if server call fails
    }
    localStorage.removeItem('accessToken');
    router.push('/login');
  };

  return (
    <header className="
      flex items-center justify-between
      h-16 px-4
      bg-card border-b-2 border-border
    ">
      {/* Left: Mobile menu + Page title area */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button - only show on small screens */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label="Toggle menu"
        >
          <Menu size={24} />
        </button>

        {/* Page title area - can be customized per page */}
        <div>
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
        </div>
      </div>

      {/* Right: Actions + User */}
      <div className="flex items-center gap-3">
        {/* Notifications placeholder */}
        <button
          className="p-2 rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-accent relative"
          aria-label="Notifications"
        >
          <Bell size={20} />
          {/* Notification dot */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-gold rounded-full" />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="
              flex items-center gap-2 p-2 rounded-[8px]
              text-muted-foreground hover:text-foreground hover:bg-accent
            "
          >
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
              <User size={16} />
            </div>
            <span className="hidden sm:inline text-sm font-medium">
              {memberName || 'Member'}
            </span>
          </button>

          {/* Dropdown menu */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-card border-2 border-border rounded-[8px] shadow-lg py-1 z-50">
              <Link
                href="/dashboard/profile"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent"
              >
                <UserCircle size={16} />
                Profile
              </Link>
              <Link
                href="/dashboard/account"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent"
              >
                <Settings size={16} />
                Account Settings
              </Link>
              <div className="border-t border-border my-1" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-accent w-full text-left"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
