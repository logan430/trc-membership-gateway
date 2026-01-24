import { Trophy, Medal, Award } from 'lucide-react';

interface RankBadgeProps {
  rank: number;
}

/**
 * Visual badge for leaderboard ranking
 * Gold trophy for 1st, silver medal for 2nd, bronze award for 3rd
 * Number display for all other ranks
 */
export function RankBadge({ rank }: RankBadgeProps) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-8 h-8 bg-gold/20 rounded-full">
        <Trophy className="text-gold" size={16} />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-8 h-8 bg-gray-300/20 rounded-full">
        <Medal className="text-gray-400" size={16} />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-8 h-8 bg-amber-600/20 rounded-full">
        <Award className="text-amber-600" size={16} />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-8 h-8">
      <span className="text-sm font-medium text-muted-foreground">#{rank}</span>
    </div>
  );
}
