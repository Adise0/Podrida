import { useState, type FormEvent } from "react";
import { authApi } from "../../api/auth";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, MutedText } from "../../components/ui/Card";
import { TextField } from "../../components/ui/Field";
import { Form, LinkButton, TextLink } from "../../components/ui/layout";
import { emailRetryCooldownInSeconds } from "../../config";
import { useCooldown } from "../../hooks/useCooldown";
import { useRequest } from "../../hooks/useRequest";

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const cooldown = useCooldown();

  const send = useRequest(async (to: string) => {
    await authApi.requestPasswordReset(to);
    cooldown.start(emailRetryCooldownInSeconds);
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = identifier.trim();
    setError(value ? null : "Enter your email or username");
    if (value) send.run(value);
  };

  return (
    <Card>
      <PageTitle>Reset your password</PageTitle>
      <CardHeader
        as="h1"
        title="Forgot your password?"
        description="We'll email you a link to choose a new one."
      />
      <Form onSubmit={onSubmit} noValidate>
        <TextField
          label="Email or username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={identifier}
          error={error}
          onChange={(event) => setIdentifier(event.target.value)}
        />

        {send.status === "success" ? (
          <Alert tone="success">
            <p>If an account matches, a reset link is on its way. It works for 30 minutes.</p>
            <LinkButton
              type="button"
              disabled={cooldown.remaining > 0}
              onClick={() => send.run(identifier.trim())}
            >
              {cooldown.remaining > 0 ? `Send again in ${cooldown.remaining}s` : "Send again"}
            </LinkButton>
          </Alert>
        ) : (
          <>
            <ErrorAlert error={send.error} />
            <Button type="submit" block loading={send.isPending}>
              Send reset link
            </Button>
          </>
        )}

        <MutedText>
          Remembered it? <TextLink to="/login">Back to login</TextLink>
        </MutedText>
      </Form>
    </Card>
  );
}
