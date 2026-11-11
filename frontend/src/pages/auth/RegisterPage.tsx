import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { authApi } from "../../api/auth";
import { getFieldErrors } from "../../api/errorMessages";
import { ErrorAlert } from "../../components/ErrorAlert";
import { OAuthButtons } from "../../components/OAuthButtons";
import { PageTitle } from "../../components/PageTitle";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, MutedText } from "../../components/ui/Card";
import { TextField } from "../../components/ui/Field";
import { FieldRow, Form, Stack, TextLink } from "../../components/ui/layout";
import { availabilityMessages, useKeyAvailability } from "../../hooks/useKeyAvailability";
import { useRequest } from "../../hooks/useRequest";
import {
  collectErrors,
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirmation,
  validateUsername,
} from "../../lib/validation";
import type { AuthLocationState } from "../../router/locationState";

type Field = "firstName" | "lastName" | "username" | "email" | "password" | "confirmation";

const emptyForm: Record<Field, string> = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  password: "",
  confirmation: "",
};

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const usernameAvailability = useKeyAvailability(
    "username",
    form.username,
    validateUsername(form.username) !== null,
  );
  const emailAvailability = useKeyAvailability(
    "email",
    form.email.trim(),
    validateEmail(form.email.trim()) !== null,
  );

  const register = useRequest(async () => {
    const email = form.email.trim();
    await authApi.register({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      username: form.username,
      email,
      password: form.password,
    });
    const state: AuthLocationState = { email };
    navigate("/register/check-email", { state });
  });

  const update = (field: Field) => (event: { target: { value: string } }) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();

    const nextErrors = collectErrors<Field>({
      firstName: validateName(form.firstName, "first name"),
      lastName: validateName(form.lastName, "last name"),
      username: validateUsername(form.username),
      email: validateEmail(form.email.trim()),
      password: validatePassword(form.password),
      confirmation: validatePasswordConfirmation(form.password, form.confirmation),
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) register.run();
  };

  const serverErrors = getFieldErrors(register.error);
  const username = availabilityMessages(usernameAvailability, "That username is taken");
  const email = availabilityMessages(emailAvailability, "An account already uses this email");

  return (
    <Card>
      <PageTitle>Create an account</PageTitle>
      <CardHeader as="h1" title="Join the table" description="Create your Podrida account." />

      <Stack $gap={5}>
        <Form onSubmit={onSubmit} noValidate>
          <FieldRow>
            <TextField
              label="First name"
              autoComplete="given-name"
              value={form.firstName}
              error={errors.firstName ?? serverErrors.firstName}
              onChange={update("firstName")}
            />
            <TextField
              label="Last name"
              autoComplete="family-name"
              value={form.lastName}
              error={errors.lastName ?? serverErrors.lastName}
              onChange={update("lastName")}
            />
          </FieldRow>
          <TextField
            label="Username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={form.username}
            error={errors.username ?? username.error ?? serverErrors.username}
            success={username.success}
            hint={username.hint ?? "3 to 24 letters, numbers, _ or -. Other players see it."}
            onChange={update("username")}
          />
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            error={errors.email ?? email.error ?? serverErrors.email}
            hint={email.hint}
            onChange={update("email")}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            error={errors.password ?? serverErrors.password}
            hint="At least 8 characters."
            onChange={update("password")}
          />
          <TextField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={form.confirmation}
            error={errors.confirmation}
            onChange={update("confirmation")}
          />
          <ErrorAlert error={register.error} />
          <Button type="submit" block loading={register.isPending}>
            Create account
          </Button>
        </Form>

        <OAuthButtons returnTo="/" />

        <MutedText>
          Already have an account? <TextLink to="/login">Log in</TextLink>
        </MutedText>
      </Stack>
    </Card>
  );
}
