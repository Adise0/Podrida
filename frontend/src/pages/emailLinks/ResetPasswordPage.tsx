import { ErrorCode } from "@podrida/shared";
import { useState, type FormEvent } from "react";
import { useParams } from "react-router";
import { authApi } from "../../api/auth";
import { hasErrorCode } from "../../api/client";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { TextField } from "../../components/ui/Field";
import { Form, TextLink } from "../../components/ui/layout";
import { useRequest } from "../../hooks/useRequest";
import {
  collectErrors,
  validatePassword,
  validatePasswordConfirmation,
} from "../../lib/validation";
import { endSession } from "../../stores/session/actions";
import { tokenStorage } from "../../lib/tokenStorage";

export function ResetPasswordPage() {
  const { token = "" } = useParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirmation?: string }>({});

  const reset = useRequest(async () => {
    await authApi.resetPassword(token, password);
    // A reset signs out every session, this browser's included.
    if (tokenStorage.get()) endSession("logout");
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = collectErrors({
      password: validatePassword(password),
      confirmation: validatePasswordConfirmation(password, confirmation),
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) reset.run();
  };

  if (reset.status === "success") {
    return (
      <Card>
        <PageTitle>Password updated</PageTitle>
        <CardHeader
          as="h1"
          title="Password updated"
          description="You've been signed out everywhere. Log in with your new password."
        />
        <TextLink to="/login">Log in</TextLink>
      </Card>
    );
  }

  const isExpired = hasErrorCode(reset.error, ErrorCode.INVALID_OR_EXPIRED_LINK);

  return (
    <Card>
      <PageTitle>Choose a new password</PageTitle>
      <CardHeader as="h1" title="Choose a new password" />
      <Form onSubmit={onSubmit} noValidate>
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          error={errors.password}
          hint="At least 8 characters."
          onChange={(event) => setPassword(event.target.value)}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          error={errors.confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        {isExpired ? (
          <Alert tone="error">
            <p>This reset link has expired or was already used.</p>
            <TextLink to="/forgot-password">Ask for a new one</TextLink>
          </Alert>
        ) : (
          <ErrorAlert error={reset.error} />
        )}
        <Button type="submit" block loading={reset.isPending}>
          Save new password
        </Button>
      </Form>
    </Card>
  );
}
