// Medieval/Council-themed roles per CONTEXT.md
export const ROLE_CONFIG = {
  SQUIRE: {
    name: 'Squire',
    color: 0x808080, // Gray - unintroduced
    description: 'Paid but unintroduced member',
  },
  KNIGHT: {
    name: 'Knight',
    color: 0x3498db, // Blue - active member
    description: 'Introduced individual member',
  },
  LORD: {
    name: 'Lord',
    color: 0xf1c40f, // Gold - company owner
    description: 'Company owner with full access',
  },
  DEBTOR: {
    name: 'Debtor',
    color: 0xe74c3c, // Red - billing issue
    description: 'Member with billing issue',
  },
} as const;

export const MANAGED_ROLES = Object.values(ROLE_CONFIG).map((r) => r.name);

export type RoleKey = keyof typeof ROLE_CONFIG;
