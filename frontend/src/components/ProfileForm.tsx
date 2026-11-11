import type { MyUser, UpdateProfileData } from "@podrida/shared";
import { useState, type FormEvent } from "react";
import { getFieldErrors } from "../api/errorMessages";
import { availabilityMessages, useKeyAvailability } from "../hooks/useKeyAvailability";
import { useRequest } from "../hooks/useRequest";
import { collectErrors, validateName, validateUsername } from "../lib/validation";
import { notify } from "../stores/notifications/actions";
import { ErrorAlert } from "./ErrorAlert";
import { Button } from "./ui/Button";
import { TextField } from "./ui/Field";
import { FieldRow, Form, Row } from "./ui/layout";

type Field = "firstName" | "lastName" | "username";

interface ProfileFormProps {
  information: MyUser["information"];
  onSave: (changes: UpdateProfileData) => Promise<void>;
  disabled?: boolean;
}

// Accounts made through a provider may have no name: it can stay empty, but once set it can't be
// cleared (the API doesn't take empty strings).
function validateOptionalName(value: string, original: string | undefined, label: string) {
  if (!value.trim()) return original ? `Enter your ${label}` : null;
  return validateName(value, label);
}

// First name, last name and username. Used for the user's own profile and by admins.
// Only the fields that changed are sent.
export function ProfileForm({ information, onSave, disabled = false }: ProfileFormProps) {
  const [form, setForm] = useState<Record<Field, string>>({
    firstName: information.firstName ?? "",
    lastName: information.lastName ?? "",
    username: information.username,
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const changes: UpdateProfileData = {};
  if (form.firstName.trim() !== (information.firstName ?? ""))
    changes.firstName = form.firstName.trim();
  if (form.lastName.trim() !== (information.lastName ?? ""))
    changes.lastName = form.lastName.trim();
  if (form.username !== information.username) changes.username = form.username;
  const hasChanges = Object.keys(changes).length > 0;

  // Changing only the casing of your own username isn't a conflict.
  const isSameUsername = form.username.toLowerCase() === information.username.toLowerCase();
  const availability = useKeyAvailability(
    "username",
    form.username,
    isSameUsername || validateUsername(form.username) !== null,
  );

  const save = useRequest(async (data: UpdateProfileData) => {
    await onSave(data);
    notify("Profile saved.", "success");
  });

  const update = (field: Field) => (event: { target: { value: string } }) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = collectErrors<Field>({
      firstName: validateOptionalName(form.firstName, information.firstName, "first name"),
      lastName: validateOptionalName(form.lastName, information.lastName, "last name"),
      username: validateUsername(form.username),
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0 && hasChanges) save.run(changes);
  };

  const serverErrors = getFieldErrors(save.error);
  const usernameMessages = availabilityMessages(availability, "That username is taken");

  return (
    <Form onSubmit={onSubmit} noValidate>
      <FieldRow>
        <TextField
          label="First name"
          autoComplete="given-name"
          value={form.firstName}
          error={errors.firstName ?? serverErrors.firstName}
          disabled={disabled}
          onChange={update("firstName")}
        />
        <TextField
          label="Last name"
          autoComplete="family-name"
          value={form.lastName}
          error={errors.lastName ?? serverErrors.lastName}
          disabled={disabled}
          onChange={update("lastName")}
        />
      </FieldRow>
      <TextField
        label="Username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={form.username}
        error={errors.username ?? usernameMessages.error ?? serverErrors.username}
        success={usernameMessages.success}
        hint={usernameMessages.hint}
        disabled={disabled}
        onChange={update("username")}
      />
      <ErrorAlert error={save.error} />
      {!disabled && (
        <Row $justify="flex-end">
          <Button type="submit" loading={save.isPending} disabled={!hasChanges}>
            Save changes
          </Button>
        </Row>
      )}
    </Form>
  );
}
