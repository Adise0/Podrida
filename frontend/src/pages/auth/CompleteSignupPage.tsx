import { ErrorCode } from "@podrida/shared";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router";
import { hasErrorCode } from "../../api/client";
import { getFieldErrors } from "../../api/errorMessages";
import { oauthApi } from "../../api/oauth";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { TextField } from "../../components/ui/Field";
import { FieldRow, Form, TextLink } from "../../components/ui/layout";
import { availabilityMessages, useKeyAvailability } from "../../hooks/useKeyAvailability";
import { useRequest } from "../../hooks/useRequest";
import { validateUsername } from "../../lib/validation";
import { readAuthState } from "../../router/locationState";
import { startSession } from "../../stores/session/actions";

// First sign-in with a provider: the account is created once the user picks a username.
export function CompleteSignupPage() {
  const location = useLocation();
  const { oauthSignup, from } = readAuthState(location.state);

  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState(oauthSignup?.firstName ?? "");
  const [lastName, setLastName] = useState(oauthSignup?.lastName ?? "");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const availability = useKeyAvailability(
    "username",
    username,
    validateUsername(username) !== null,
  );

  const signup = useRequest(async (token: string) => {
    const response = await oauthApi.completeSignup({
      token,
      username,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
    });
    startSession(response.token); // GuestOnly then sends the user on to `from`.
  });

  if (!oauthSignup) return <Navigate to="/login" replace state={{ from }} />;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const error = validateUsername(username);
    setUsernameError(error);
    if (!error) signup.run(oauthSignup.signupToken);
  };

  const messages = availabilityMessages(availability, "That username is taken");
  const isExpired = hasErrorCode(
    signup.error,
    ErrorCode.INVALID_TOKEN,
    ErrorCode.INVALID_OR_EXPIRED_LINK,
  );

  return (
    <Card>
      <PageTitle>Pick a username</PageTitle>
      <CardHeader
        as="h1"
        title="Almost there"
        description={
          <>
            Pick the name other players will see. You'll sign in as{" "}
            <strong>{oauthSignup.email}</strong>.
          </>
        }
      />
      <Form onSubmit={onSubmit} noValidate>
        <TextField
          label="Username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          error={usernameError ?? messages.error ?? getFieldErrors(signup.error).username}
          success={messages.success}
          hint={messages.hint ?? "3 to 24 letters, numbers, _ or -."}
          onChange={(event) => {
            setUsername(event.target.value);
            setUsernameError(null);
          }}
        />
        <FieldRow>
          <TextField
            label="First name"
            autoComplete="given-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
          <TextField
            label="Last name"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </FieldRow>

        {isExpired ? (
          <Alert tone="error">
            <p>This took too long and the sign-in expired.</p>
            <TextLink to="/login">Start again</TextLink>
          </Alert>
        ) : (
          <ErrorAlert error={signup.error} />
        )}

        <Button type="submit" block loading={signup.isPending}>
          Create my account
        </Button>
      </Form>
    </Card>
  );
}
