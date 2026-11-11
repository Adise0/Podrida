import { ErrorCode, type LoginData } from "@podrida/shared";
import { useState, type FormEvent } from "react";
import { useLocation } from "react-router";
import { authApi } from "../../api/auth";
import { hasErrorCode } from "../../api/client";
import { ErrorAlert } from "../../components/ErrorAlert";
import { OAuthButtons } from "../../components/OAuthButtons";
import { PageTitle } from "../../components/PageTitle";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, MutedText } from "../../components/ui/Card";
import { TextField } from "../../components/ui/Field";
import { Form, LinkButton, Stack, TextLink } from "../../components/ui/layout";
import { emailRetryCooldownInSeconds } from "../../config";
import { useCooldown } from "../../hooks/useCooldown";
import { useRequest } from "../../hooks/useRequest";
import { readAuthState } from "../../router/locationState";
import { startSession } from "../../stores/session/actions";

type Mode = "password" | "otp";

export function LoginPage() {
  const location = useLocation();
  const { from, notice } = readAuthState(location.state);

  const [mode, setMode] = useState<Mode>("password");
  const [identifier, setIdentifier] = useState("");
  const [secret, setSecret] = useState("");
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ identifier?: string; secret?: string }>({});
  const cooldown = useCooldown();

  const login = useRequest(async (data: LoginData) => {
    const { token } = await authApi.login(data);
    startSession(token); // GuestOnly then sends the user on to `from`.
  });

  const sendCode = useRequest(async (to: string) => {
    await authApi.requestOtp(to);
    setCodeSentTo(to);
    cooldown.start(emailRetryCooldownInSeconds);
  });

  const resendActivation = useRequest(authApi.resendActivation);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();

    const nextErrors = {
      identifier: identifier.trim() ? undefined : "Enter your email or username",
      secret: secret ? undefined : mode === "password" ? "Enter your password" : "Enter the code",
    };
    setErrors(nextErrors);
    if (nextErrors.identifier || nextErrors.secret) return;

    login.run({ email: identifier.trim(), password: secret, withOtp: mode === "otp" });
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setSecret("");
    setErrors({});
    login.reset();
  };

  const requestCode = () => {
    if (!identifier.trim()) {
      setErrors({ identifier: "Enter your email or username" });
      return;
    }
    setErrors({});
    sendCode.run(identifier.trim());
  };

  const isNotActivated = hasErrorCode(login.error, ErrorCode.ACCOUNT_NOT_ACTIVATED);
  const needsReset = hasErrorCode(login.error, ErrorCode.PASSWORD_RESET_REQUIRED);
  const isCodeStep = mode === "otp" && codeSentTo !== null;

  return (
    <Card>
      <PageTitle>Log in</PageTitle>
      <CardHeader
        as="h1"
        title="Welcome back"
        description="Log in to take your seat at the table."
      />

      <Stack $gap={5}>
        {notice && <Alert tone="info">{notice}</Alert>}

        <Form onSubmit={onSubmit} noValidate>
          <TextField
            label="Email or username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={identifier}
            error={errors.identifier}
            disabled={isCodeStep}
            onChange={(event) => setIdentifier(event.target.value)}
          />

          {mode === "password" && (
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={secret}
              error={errors.secret}
              hint={<TextLink to="/forgot-password">Forgot your password?</TextLink>}
              onChange={(event) => setSecret(event.target.value)}
            />
          )}

          {isCodeStep && (
            <>
              <Alert tone="info">
                If an account matches <strong>{codeSentTo}</strong>, a sign-in code is on its way.
                It works for 10 minutes.
              </Alert>
              <TextField
                label="Sign-in code"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                value={secret}
                error={errors.secret}
                onChange={(event) => setSecret(event.target.value)}
              />
            </>
          )}

          <ErrorAlert error={sendCode.error} />

          {isNotActivated ? (
            <Alert tone="warning">
              <p>This account isn't activated yet. Check your inbox for the activation link.</p>
              {resendActivation.status === "success" ? (
                <p>A new link is on its way.</p>
              ) : (
                <LinkButton
                  type="button"
                  disabled={resendActivation.isPending}
                  onClick={() => resendActivation.run(identifier.trim())}
                >
                  Send me a new activation link
                </LinkButton>
              )}
            </Alert>
          ) : needsReset ? (
            <Alert tone="warning">
              <p>This account needs a new password before you can log in.</p>
              <TextLink to="/forgot-password">Set a new password</TextLink>
            </Alert>
          ) : (
            <ErrorAlert error={login.error} />
          )}

          {mode === "otp" && !isCodeStep ? (
            <Button block onClick={requestCode} loading={sendCode.isPending}>
              Email me a code
            </Button>
          ) : (
            <Button type="submit" block loading={login.isPending}>
              Log in
            </Button>
          )}

          {isCodeStep && (
            <MutedText>
              Didn't get it?{" "}
              <LinkButton
                type="button"
                disabled={cooldown.remaining > 0 || sendCode.isPending}
                onClick={() => sendCode.run(codeSentTo)}
              >
                {cooldown.remaining > 0 ? `Send again in ${cooldown.remaining}s` : "Send again"}
              </LinkButton>
              {" · "}
              <LinkButton
                type="button"
                onClick={() => {
                  setCodeSentTo(null);
                  setSecret("");
                }}
              >
                Change account
              </LinkButton>
            </MutedText>
          )}

          <LinkButton
            type="button"
            onClick={() => switchMode(mode === "password" ? "otp" : "password")}
          >
            {mode === "password" ? "Email me a sign-in code instead" : "Use my password instead"}
          </LinkButton>
        </Form>

        <OAuthButtons returnTo={from ?? "/"} />

        <MutedText>
          New to Podrida? <TextLink to="/register">Create an account</TextLink>
        </MutedText>
      </Stack>
    </Card>
  );
}
