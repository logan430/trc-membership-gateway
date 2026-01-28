'use client';

import { Check, X } from 'lucide-react';

interface PasswordRequirementsProps {
  password: string;
}

interface Requirement {
  label: string;
  met: boolean;
  required: boolean;
}

/**
 * Get password requirements with met status
 */
function getRequirements(password: string): Requirement[] {
  return [
    {
      label: 'At least 8 characters',
      met: password.length >= 8,
      required: true,
    },
    {
      label: 'Contains uppercase letter',
      met: /[A-Z]/.test(password),
      required: false,
    },
    {
      label: 'Contains lowercase letter',
      met: /[a-z]/.test(password),
      required: false,
    },
    {
      label: 'Contains number',
      met: /[0-9]/.test(password),
      required: false,
    },
    {
      label: 'Contains special character',
      met: /[^A-Za-z0-9]/.test(password),
      required: false,
    },
  ];
}

/**
 * Password Requirements Checklist
 *
 * Shows password requirements with check/uncheck status:
 * - Required items always visible
 * - Optional items shown when met or password is being typed
 * - Green checkmarks for met requirements
 * - Gray X for unmet requirements
 */
export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const requirements = getRequirements(password);

  // Filter: show required items always, optional items only when met or user started typing
  const visibleRequirements = requirements.filter(
    (req) => req.required || (password.length > 0 && (req.met || password.length >= 4))
  );

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-muted-foreground">Password requirements:</p>
      <ul className="space-y-1">
        {visibleRequirements.map((req) => (
          <li
            key={req.label}
            className={`flex items-center gap-2 text-sm ${
              req.met ? 'text-green-500' : 'text-muted-foreground'
            }`}
          >
            {req.met ? (
              <Check size={14} className="text-green-500 flex-shrink-0" />
            ) : (
              <X size={14} className="text-muted-foreground flex-shrink-0" />
            )}
            <span>{req.label}</span>
            {!req.required && (
              <span className="text-xs text-muted-foreground">(recommended)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
