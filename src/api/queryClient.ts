import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

/** A 401 from any call means the session ended: drop to the sign-in screen. */
export const createQueryClient = () => {
  const handle = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401 && client.getQueryData(['me'])) {
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
      client.setQueryData(['me'], null);
    }
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handle }),
    mutationCache: new MutationCache({ onError: handle }),
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return client;
};
