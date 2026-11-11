import type { OAuthProviderInfo } from "@podrida/shared";
import { useEffect, useState } from "react";
import { oauthApi } from "../api/oauth";

// The providers only change with the server's config, so they're fetched once per page load.
let cachedProviders: Promise<OAuthProviderInfo[]> | null = null;

function fetchProviders() {
  cachedProviders ??= oauthApi
    .providers()
    .then(({ providers }) => providers)
    .catch((error: unknown) => {
      cachedProviders = null; // Try again next time.
      throw error;
    });

  return cachedProviders;
}

// null while loading. A failure shows no providers: the other ways of logging in still work.
export function useOAuthProviders(): OAuthProviderInfo[] | null {
  const [providers, setProviders] = useState<OAuthProviderInfo[] | null>(null);

  useEffect(() => {
    let isCurrent = true;

    fetchProviders()
      .then((result) => {
        if (isCurrent) setProviders(result);
      })
      .catch(() => {
        if (isCurrent) setProviders([]);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return providers;
}
