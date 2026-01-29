import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteProductLocation, getProductLocations } from '@/lib/mapManager';
import { getActiveLocationContext } from '@/lib/tenant';

export function useProductLocations() {
  const { locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: ['product-locations', locationId],
    queryFn: async () => {
      const { data, error } = await getProductLocations();
      if (error) throw error;
      return data;
    },
  });
}

export function useDeleteProductLocation() {
  const queryClient = useQueryClient();
  const { locationId } = getActiveLocationContext();

  return useMutation({
    mutationFn: async (locationIdToDelete: string) => {
      const { error } = await deleteProductLocation(locationIdToDelete);
      if (error) throw error;
      return locationIdToDelete;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-locations', locationId] });
    },
  });
}
