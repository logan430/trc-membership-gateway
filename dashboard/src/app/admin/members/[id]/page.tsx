'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, History } from 'lucide-react';
import { Card } from '@/components/ui';
import { PageLoader } from '@/components/ui/GoldCoinsLoader';
import { MemberInfoCard } from '@/components/admin/MemberInfoCard';
import { PointsAdjuster } from '@/components/admin/PointsAdjuster';
import { useMember, usePointsHistory } from '@/hooks/useAdminMembers';
import { formatDistanceToNow } from 'date-fns';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MemberDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: memberData, isLoading: loadingMember } = useMember(id);
  const { data: historyData, isLoading: loadingHistory } = usePointsHistory(id);

  if (loadingMember) {
    return <PageLoader message="Loading member..." />;
  }

  const member = memberData?.member;
  if (!member) {
    return (
      <div className="min-h-screen bg-background p-6">
        <p className="text-muted-foreground">Member not found</p>
        <Link href="/admin/members" className="text-gold hover:underline">
          Back to members
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/members"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={16} />
          Back to Members
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Member Info */}
        <div className="lg:col-span-2">
          <MemberInfoCard member={member} />
        </div>

        {/* Points Adjuster */}
        <div>
          <PointsAdjuster memberId={id} currentPoints={member.totalPoints} />
        </div>
      </div>

      {/* Points History */}
      <Card className="mt-6 p-6">
        <div className="flex items-center gap-2 mb-4">
          <History size={20} className="text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Points History</h3>
        </div>

        {loadingHistory ? (
          <p className="text-muted-foreground">Loading history...</p>
        ) : historyData?.transactions && historyData.transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-2 px-3 font-semibold">Action</th>
                  <th className="text-right py-2 px-3 font-semibold">Points</th>
                  <th className="text-left py-2 px-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {historyData.transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50">
                    <td className="py-2 px-3">{tx.actionLabel}</td>
                    <td className={`py-2 px-3 text-right font-medium ${
                      tx.points > 0 ? 'text-success' : 'text-error'
                    }`}>
                      {tx.points > 0 ? '+' : ''}{tx.points}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground">No point transactions yet</p>
        )}
      </Card>
    </div>
  );
}
