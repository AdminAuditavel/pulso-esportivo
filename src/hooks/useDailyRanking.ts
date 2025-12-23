import { useQuery } from "@tanstack/react-query";
import { get } from "../lib/api";

export type DailyRankingItem = {
  rank?: number;
  mentions: number;
  normalized_mentions?: number;
  iap_score?: number;
  date: string;
  club: {
    id: string;
    name: string;
    slug: string;
  };
  breakdown_by_source?: Array<{ source_id: string; mentions: number }>;
};

type PaginatedDailyRanking = {
  total: number;
  limit: number;
  offset: number;
  data: DailyRankingItem[];
};

type UseDailyRankingParams = {
  date?: string;
  start_date?: string;
  end_date?: string;
  club_id?: string;
  include_breakdown?: boolean;
  limit?: number;
  offset?: number;
};

export function useDailyRanking(params: UseDailyRankingParams = {}) {
  const key = ["daily_ranking", params];

  const queryFn = async (): Promise<PaginatedDailyRanking> => {
    const data = await get<PaginatedDailyRanking>("/daily_ranking", params as any);
    return data;
  };

  return useQuery({
    queryKey: key,
    queryFn,
    staleTime: 1000 * 60 * 2, // 2 minutos
    keepPreviousData: true
  });
}
