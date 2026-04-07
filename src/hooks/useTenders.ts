import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appwriteClient } from '@/lib/appwrite';
import {
  fetchTenders,
  getTenderRealtimeChannel,
  updateTenderNotes,
  updateTenderStatus,
} from '@/services/tenders';
import { Tender, TenderStatus } from '@/types/tender';

export const tendersQueryKey = ['tenders'];

export function useTendersQuery() {
  return useQuery({
    queryKey: tendersQueryKey,
    queryFn: fetchTenders,
  });
}

export function useRealtimeTendersSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = appwriteClient.subscribe(getTenderRealtimeChannel(), () => {
      queryClient.invalidateQueries({ queryKey: tendersQueryKey });
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);
}

export function useUpdateTenderStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTenderStatus,
    onMutate: async ({ documentId, status }: { documentId: string; status: TenderStatus }) => {
      await queryClient.cancelQueries({ queryKey: tendersQueryKey });
      const previous = queryClient.getQueryData<Tender[]>(tendersQueryKey) || [];

      queryClient.setQueryData<Tender[]>(tendersQueryKey, (current = []) =>
        current.map((tender) =>
          tender.documentId === documentId ? { ...tender, status } : tender
        )
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tendersQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tendersQueryKey });
    },
  });
}

export function useUpdateTenderNotesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTenderNotes,
    onMutate: async ({ documentId, notes }: { documentId: string; notes: string }) => {
      await queryClient.cancelQueries({ queryKey: tendersQueryKey });
      const previous = queryClient.getQueryData<Tender[]>(tendersQueryKey) || [];

      queryClient.setQueryData<Tender[]>(tendersQueryKey, (current = []) =>
        current.map((tender) =>
          tender.documentId === documentId ? { ...tender, notes } : tender
        )
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tendersQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tendersQueryKey });
    },
  });
}
