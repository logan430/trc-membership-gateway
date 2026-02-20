'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock } from 'lucide-react';
import { Button, Card, Input, PasswordInput } from '@/components/ui';
import { adminAuthApi, AdminApiError } from '@/lib/admin-api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await adminAuthApi.login(email, password);
      router.push('/admin/dashboard');
    } catch (err) {
      if (err instanceof AdminApiError) {
        setError(err.message);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          {/* Shield Logo with Admin Badge */}
          <div className="relative inline-block mb-4">
            <Image
              src="/images/shield-logo.svg"
              alt="The Revenue Council"
              width={80}
              height={96}
              priority
            />
            {/* Admin Badge Overlay */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 bg-background border-2 border-gold rounded text-xs font-bold text-gold uppercase tracking-wider whitespace-nowrap">
              <Lock size={10} />
              Admin
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground font-cinzel">Council Chamber</h1>
          <p className="text-muted-foreground mt-2">Authorized personnel only</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              disabled={isLoading}
            />
          </div>

          <PasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
            disabled={isLoading}
          />

          {error && (
            <div className="p-3 bg-error/10 border border-error/30 rounded-[8px] text-error text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Entering...' : 'Enter the Council Chamber'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Return to main site
          </a>
        </div>
      </Card>
    </div>
  );
}
