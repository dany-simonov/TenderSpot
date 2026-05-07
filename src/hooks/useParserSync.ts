import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runParser } from '@/services/parser';
import { tendersQueryKey } from '@/hooks/useTenders';

export function useRunParserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runParser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tendersQueryKey });
    },
  });
}
