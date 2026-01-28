import { useInfiniteQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import { getActiveLocationContext } from '@/lib/tenant';

const PAGE_SIZE = 50;

export function useActivityLog() {
  const { locationId } = getActiveLocationContext();

  return useInfiniteQuery({
    queryKey: queryKeys.activity.all(locationId),
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('activity_log')
        .select('id, action, entity_type, entity_id, details, actor_name, actor_image, created_at')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        data: data ?? [],
        nextPage: (data?.length ?? 0) === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });
}
