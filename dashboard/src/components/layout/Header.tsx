'use client';

import { Menu, Bell, User } from 'lucide-react';

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

        {/* User menu placeholder */}
        <button
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
      </div>
    </header>
  );
}

export default Header;
