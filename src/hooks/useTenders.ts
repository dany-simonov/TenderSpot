import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  const [data, setData] = useState<Tender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const initialLoadRef = useRef(true);

  const refetch = useCallback(async () => {
    try {
      if (initialLoadRef.current) {
        setIsLoading(true);
      }
      setError(null);
      const items = await fetchTenders();
      setData(items);
      return items;
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Не удалось загрузить тендеры.');
      setError(nextError);
      return null;
    } finally {
      initialLoadRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data,
    isLoading,
    isError: Boolean(error),
    error,
    refetch,
  };
}

export function useRealtimeTendersSync(onChange?: () => void) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const unsubscribe = appwriteClient.subscribe(getTenderRealtimeChannel(), () => {
      onChangeRef.current?.();
    });

    return () => {
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
