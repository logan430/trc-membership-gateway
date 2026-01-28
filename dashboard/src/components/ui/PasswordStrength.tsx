'use client';

type StrengthLevel = 'weak' | 'fair' | 'strong';

interface PasswordStrengthProps {
  password: string;
}

/**
 * Calculate password strength based on character variety
 */
function calculateStrength(password: string): StrengthLevel {
  if (!password || password.length < 8) {
    return 'weak';
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  // Count variety factors
  const factors = [hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

  if (factors >= 3) {
    return 'strong';
  } else if (factors >= 2) {
    return 'fair';
  }
  return 'weak';
}

/**
 * Get styling config for strength level
 */
function getStrengthConfig(level: StrengthLevel) {
  switch (level) {
    case 'strong':
      return {
        label: 'Strong',
        color: 'bg-green-500',
        width: 'w-full',
        textColor: 'text-green-500',
      };
    case 'fair':
      return {
        label: 'Fair',
        color: 'bg-yellow-500',
        width: 'w-2/3',
        textColor: 'text-yellow-500',
      };
    case 'weak':
    default:
      return {
        label: 'Weak',
        color: 'bg-destructive',
        width: 'w-1/3',
        textColor: 'text-destructive',
      };
  }
}

/**
 * Password Strength Indicator
 *
 * Visual feedback for password strength:
 * - Weak (red): < 8 chars or single character type
 * - Fair (yellow): 8+ chars with 2 character types
 * - Strong (green): 8+ chars with 3+ character types
 */
export function PasswordStrength({ password }: PasswordStrengthProps) {
  // Don't show until user starts typing
  if (!password) {
    return null;
  }

  const strength = calculateStrength(password);
  const config = getStrengthConfig(strength);

  return (
    <div className="space-y-1.5">
      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${config.color} ${config.width} transition-all duration-300`}
        />
      </div>

      {/* Label */}
      <p className={`text-sm font-medium ${config.textColor}`}>
        Password strength: {config.label}
      </p>
    </div>
  );
}
