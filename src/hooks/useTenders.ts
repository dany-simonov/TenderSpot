import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appwriteClient } from '@/lib/appwrite';
import {
  fetchTenders,
  getTenderRealtimeChannel,
  updateTenderNotes,
  updateTenderStatus,
  updateTenderViewed,
} from '@/services/tenders';
import { Tender, TenderStatus } from '@/types/tender';

export const tendersQueryKey = ['tenders'];

export function useTendersQuery() {
  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: tendersQueryKey,
    queryFn: fetchTenders,
    staleTime: 1000 * 60 * 5,
  });

  return { data, isLoading, isError, error, refetch };
}

export function useRealtimeTendersSync(onChange?: () => void) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const unsubscribe = appwriteClient.subscribe(getTenderRealtimeChannel(), () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        onChangeRef.current?.();
      }, 2000);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);
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

export function useUpdateTenderViewedMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTenderViewed,
    onMutate: async ({ documentId, isViewed }: { documentId: string; isViewed: boolean }) => {
      await queryClient.cancelQueries({ queryKey: tendersQueryKey });
      const previous = queryClient.getQueryData<Tender[]>(tendersQueryKey) || [];

      queryClient.setQueryData<Tender[]>(tendersQueryKey, (current = []) =>
        current.map((tender) =>
          tender.documentId === documentId ? { ...tender, isViewed } : tender
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
