import { useOAuthProviders } from "../hooks/useOAuthProviders";
import { useOAuthStart } from "../hooks/useOAuthStart";
import { getProviderLabel } from "../lib/oauth";
import { ErrorAlert } from "./ErrorAlert";
import { ProviderIcon } from "./ProviderIcon";
import { Button } from "./ui/Button";
import { Divider, Stack } from "./ui/layout";

// "Continue with Google/Apple" on the login and register pages. Nothing when no provider is set up.
export function OAuthButtons({ returnTo }: { returnTo: string }) {
  const providers = useOAuthProviders();
  const start = useOAuthStart();

  if (!providers || providers.length === 0) return null;

  return (
    <Stack $gap={3}>
      <Divider>or</Divider>
      {providers.map((provider) => (
        <Button
          key={provider.name}
          variant="secondary"
          block
          loading={start.isPending}
          onClick={() => start.run(provider, "login", returnTo)}
        >
          {/* The button shows its spinner while loading: no icon next to it then. */}
          {!start.isPending && <ProviderIcon provider={provider.name} />}
          Continue with {getProviderLabel(provider.name)}
        </Button>
      ))}
      <ErrorAlert error={start.error} />
    </Stack>
  );
}
