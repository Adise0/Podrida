import { useEffect } from "react";
import { useLocation } from "react-router";
import { authApi } from "../../api/auth";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, MutedText } from "../../components/ui/Card";
import { Stack, TextLink } from "../../components/ui/layout";
import { emailRetryCooldownInSeconds } from "../../config";
import { useCooldown } from "../../hooks/useCooldown";
import { useRequest } from "../../hooks/useRequest";
import { readAuthState } from "../../router/locationState";

// Right after registering: the account only works once the emailed link is opened.
export function CheckEmailPage() {
  const location = useLocation();
  const { email } = readAuthState(location.state);
  const cooldown = useCooldown();
  const { start } = cooldown;

  // The first email just went out.
  useEffect(() => start(emailRetryCooldownInSeconds), [start]);

  const resend = useRequest(async (to: string) => {
    await authApi.resendActivation(to);
    start(emailRetryCooldownInSeconds);
  });

  return (
    <Card>
      <PageTitle>Check your inbox</PageTitle>
      <CardHeader
        as="h1"
        title="Check your inbox"
        description={
          email ? (
            <>
              We sent an activation link to <strong>{email}</strong>.
            </>
          ) : (
            "We sent you an activation link."
          )
        }
      />
      <Stack>
        <MutedText>
          Open it within 20 minutes to activate your account. If it doesn't show up, check your spam
          folder.
        </MutedText>
        {resend.status === "success" && <MutedText>A new link is on its way.</MutedText>}
        <ErrorAlert error={resend.error} />
        {email && (
          <Button
            variant="secondary"
            block
            loading={resend.isPending}
            disabled={cooldown.remaining > 0}
            onClick={() => resend.run(email)}
          >
            {cooldown.remaining > 0
              ? `Send it again in ${cooldown.remaining}s`
              : "Send the link again"}
          </Button>
        )}
        <MutedText>
          Already activated? <TextLink to="/login">Log in</TextLink>
        </MutedText>
      </Stack>
    </Card>
  );
}
