import { useState, type FormEvent } from "react";
import { authApi } from "../../../api/auth";
import { ErrorAlert } from "../../../components/ErrorAlert";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import { Checkbox, TextField } from "../../../components/ui/Field";
import { Form, Row } from "../../../components/ui/layout";
import { useRequest } from "../../../hooks/useRequest";
import {
  collectErrors,
  validatePassword,
  validatePasswordConfirmation,
} from "../../../lib/validation";
import { notify } from "../../../stores/notifications/actions";
import { replaceSessionToken } from "../../../stores/session/actions";
import { patchMyUser } from "../../../stores/user/actions";

// Also how accounts made through a provider get a password. The current one isn't asked for: the
// API wants a recent login instead, which the "confirm it's you" modal takes care of.
export function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [errors, setErrors] = useState<{ password?: string; confirmation?: string }>({});

  const change = useRequest(async () => {
    // The answer is a new token for this session, so it stays logged in either way.
    const { token } = await authApi.changePassword({
      password,
      signOutOtherSessions: signOutOthers,
    });
    replaceSessionToken(token);
    patchMyUser({ hasPassword: true });
    setPassword("");
    setConfirmation("");
    notify(hasPassword ? "Password changed." : "Password set.", "success");
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = collectErrors({
      password: validatePassword(password),
      confirmation: validatePasswordConfirmation(password, confirmation),
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) change.run();
  };

  return (
    <Card>
      <CardHeader
        title={hasPassword ? "Password" : "Set a password"}
        description={
          hasPassword
            ? "Choose a new password for logging in."
            : "You sign in with a provider or an emailed code. Add a password to also log in with it."
        }
      />
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
        <Checkbox
          label="Sign out of my other devices"
          checked={signOutOthers}
          onChange={(event) => setSignOutOthers(event.target.checked)}
        />
        <ErrorAlert error={change.error} />
        <Row $justify="flex-end">
          <Button type="submit" loading={change.isPending}>
            {hasPassword ? "Change password" : "Set password"}
          </Button>
        </Row>
      </Form>
    </Card>
  );
}
