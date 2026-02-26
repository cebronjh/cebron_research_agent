import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const res = await fetch(queryKey[0] as string);
        // Treat 304 Not Modified as success - return empty object for cache revalidation
        if (res.status === 304) {
          return {};
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      },
      staleTime: 60000,
      retry: 1,
    },
  },
});
