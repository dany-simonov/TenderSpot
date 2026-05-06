import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchParserStatus, runParser } from '@/services/parser';

export const parserStatusQueryKey = ['parser-status'];

export function useParserStatusQuery() {
  return useQuery({
    queryKey: parserStatusQueryKey,
    queryFn: fetchParserStatus,
    refetchInterval: 60_000,
  });
}

export function useRunParserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runParser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parserStatusQueryKey });
    },
  });
}
