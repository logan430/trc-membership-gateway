import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui';
import { Card } from '@/components/ui';

export const metadata: Metadata = {
  title: 'The Gatekeeper | The Revenue Council',
  description: 'An exclusive community of revenue leaders who share battle-tested strategies, forge valuable connections, and elevate their craft together.',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="pt-16 pb-12 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-center mb-6">
            <Image
              src="/images/shield-logo.svg"
              alt="The Revenue Council"
              width={80}
              height={96}
              className="hover:scale-105 transition-transform"
              priority
            />
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold text-foreground tracking-wide font-heading mb-3">
            The Gatekeeper
          </h1>
          <p className="text-lg text-muted-foreground italic">
            Portal to The Revenue Council
          </p>
        </div>
      </header>

      {/* About Section */}
      <section className="py-12 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-gold-dark font-heading">
            What is The Revenue Council?
          </h2>
          <p className="text-foreground leading-relaxed">
            An exclusive community of revenue leaders who have mastered the art of sustainable growth.
            Within our halls, you&apos;ll find seasoned professionals who share battle-tested strategies,
            forge valuable connections, and elevate their craft together.
          </p>
          <p className="text-foreground leading-relaxed">
            Whether you seek wisdom from fellow practitioners or wish to contribute your own expertise,
            The Revenue Council welcomes those committed to excellence in the pursuit of revenue mastery.
          </p>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-gold-dark font-heading text-center mb-10">
            Choose Your Path
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Individual Plan */}
            <PricingCard
              title="Individual"
              subtitle="For the Solo Practitioner"
              price="$59"
              priceLabel="/month"
              features={[
                'Full community access',
                'Member discussions',
                'Resource library',
                'Private channels',
                'Weekly roundtables',
              ]}
              ctaText="Begin Your Journey"
              ctaHref="/signup"
            />

            {/* Company Plan */}
            <PricingCard
              title="Company"
              subtitle="For Teams of Champions"
              price="$59"
              priceLabel="/month + $29/seat"
              features={[
                'Everything in Individual',
                'Add team members at $29/seat',
                'Owner-only channels',
                'Team management dashboard',
                'Flexible seat scaling',
              ]}
              ctaText="Enlist Your Team"
              ctaHref="/signup?tier=company"
              featured
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="max-w-xl mx-auto">
          <Card className="p-8 sm:p-10 text-center border-gold/30">
            <h2 className="text-2xl sm:text-3xl font-bold text-gold-dark font-heading mb-3">
              Ready to Join the Council?
            </h2>
            <p className="text-muted-foreground mb-6">
              Take your place among the realm&apos;s finest revenue professionals.
            </p>
            <Link href="/signup">
              <Button variant="secondary" size="lg" className="text-base px-8">
                Enter the Gates
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t-2 border-border">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} The Revenue Council. All rights reserved.</p>
          <nav className="flex gap-6">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

interface PricingCardProps {
  title: string;
  subtitle: string;
  price: string;
  priceLabel: string;
  features: string[];
  ctaText: string;
  ctaHref: string;
  featured?: boolean;
}

function PricingCard({ title, subtitle, price, priceLabel, features, ctaText, ctaHref, featured }: PricingCardProps) {
  return (
    <Card className={`relative p-6 sm:p-8 flex flex-col ${featured ? 'border-gold' : ''}`}>
      {featured && (
        <span className="absolute -top-3 right-4 bg-gold text-foreground text-xs font-bold px-3 py-1 rounded-[6px] border-2 border-gold-dark">
          Best Value
        </span>
      )}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-foreground font-heading">{title}</h3>
        <p className="text-sm text-muted-foreground italic mt-1">{subtitle}</p>
      </div>
      <div className="text-center mb-6">
        <span className="text-4xl font-bold text-foreground">{price}</span>
        <span className="text-muted-foreground text-sm">{priceLabel}</span>
      </div>
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
            <span className="text-gold mt-0.5">&#10022;</span>
            {feature}
          </li>
        ))}
      </ul>
      <Link href={ctaHref} className="block">
        <Button variant="secondary" size="lg" className="w-full">
          {ctaText}
        </Button>
      </Link>
    </Card>
  );
}
