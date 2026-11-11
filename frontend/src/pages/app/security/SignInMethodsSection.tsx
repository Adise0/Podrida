import type { MyUser } from "@podrida/shared";
import { useState } from "react";
import styled from "styled-components";
import { oauthApi } from "../../../api/oauth";
import { ErrorAlert } from "../../../components/ErrorAlert";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader, MutedText } from "../../../components/ui/Card";
import { ConfirmModal } from "../../../components/ui/Modal";
import { Stack } from "../../../components/ui/layout";
import { useOAuthProviders } from "../../../hooks/useOAuthProviders";
import { useOAuthStart } from "../../../hooks/useOAuthStart";
import { useRequest } from "../../../hooks/useRequest";
import { formatDate } from "../../../lib/format";
import { getProviderLabel } from "../../../lib/oauth";
import { notify } from "../../../stores/notifications/actions";
import { loadMyUser } from "../../../stores/user/actions";

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
`;

const Item = styled.li`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space(4)};
  padding: ${({ theme }) => theme.space(4)};

  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }

  div {
    flex: 1;
    min-width: 0;
  }

  strong {
    display: block;
  }
`;

// Linking leaves for the provider and comes back through OAuthCallbackPage.
export function SignInMethodsSection({ user }: { user: MyUser }) {
  const providers = useOAuthProviders();
  const start = useOAuthStart();
  const [toUnlink, setToUnlink] = useState<string | null>(null);

  const unlink = useRequest(async (provider: string) => {
    await oauthApi.unlink(provider);
    await loadMyUser();
    setToUnlink(null);
    notify(`${getProviderLabel(provider)} is no longer linked.`, "info");
  });

  // Nothing to link or unlink on this server.
  if (!providers || (providers.length === 0 && user.linkedProviders.length === 0)) return null;

  const names = new Set([
    ...providers.map(({ name }) => name),
    ...user.linkedProviders.map(({ provider }) => provider),
  ]);

  return (
    <Card>
      <CardHeader
        title="Sign-in methods"
        description="Log in with another account instead of your password."
      />
      <Stack>
        <List>
          {[...names].map((name) => {
            const linked = user.linkedProviders.find(({ provider }) => provider === name);
            const provider = providers.find((candidate) => candidate.name === name);

            return (
              <Item key={name}>
                <div>
                  <strong>{getProviderLabel(name)}</strong>
                  <MutedText>
                    {linked
                      ? `${linked.email ?? "Linked"} · since ${formatDate(linked.linkedAt)}`
                      : "Not linked"}
                  </MutedText>
                </div>
                {linked ? (
                  <Button
                    variant="secondary"
                    small
                    onClick={() => {
                      unlink.reset();
                      setToUnlink(name);
                    }}
                  >
                    Unlink
                  </Button>
                ) : (
                  provider && (
                    <Button
                      small
                      loading={start.isPending}
                      onClick={() => start.run(provider, "link", "/account/security")}
                    >
                      Link
                    </Button>
                  )
                )}
              </Item>
            );
          })}
        </List>
        <ErrorAlert error={start.error} />
      </Stack>

      <ConfirmModal
        isOpen={toUnlink !== null}
        title={`Unlink ${getProviderLabel(toUnlink ?? "")}?`}
        body={
          user.hasPassword
            ? "You won't be able to log in with it anymore."
            : "You won't be able to log in with it anymore. You can still log in with a code sent to your email, or set a password."
        }
        confirmLabel="Unlink"
        variant="danger"
        isPending={unlink.isPending}
        error={<ErrorAlert error={unlink.error} />}
        onConfirm={() => toUnlink && unlink.run(toUnlink)}
        onCancel={() => setToUnlink(null)}
      />
    </Card>
  );
}
