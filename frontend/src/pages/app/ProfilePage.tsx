import type { AvatarUpload } from "@podrida/shared";
import { useState, type FormEvent } from "react";
import { authApi } from "../../api/auth";
import { usersApi } from "../../api/users";
import { AvatarPicker } from "../../components/AvatarPicker";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { ProfileForm } from "../../components/ProfileForm";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { TextField } from "../../components/ui/Field";
import { Form, Row, Stack } from "../../components/ui/layout";
import { useRequest } from "../../hooks/useRequest";
import { getDisplayName } from "../../lib/format";
import { validateEmail } from "../../lib/validation";
import { notify } from "../../stores/notifications/actions";
import { updateMyAvatar, updateMyProfile } from "../../stores/user/actions";
import { useUser } from "../../stores/user/store";
import { PageHeading } from "./PageHeading";

function EmailCard({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const request = useRequest(async (to: string) => {
    await authApi.requestEmailChange(to);
    setSentTo(to);
    setEmail("");
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    const nextError =
      validateEmail(value) ??
      (value.toLowerCase() === currentEmail.toLowerCase() ? "That's already your email" : null);
    setError(nextError);
    if (!nextError) request.run(value);
  };

  return (
    <Card>
      <CardHeader
        title="Email"
        description={
          <>
            You log in and get our emails at <strong>{currentEmail}</strong>.
          </>
        }
      />
      <Form onSubmit={onSubmit} noValidate>
        <TextField
          label="New email"
          type="email"
          autoComplete="email"
          value={email}
          error={error}
          hint="We'll send a confirmation link to the new address. Nothing changes until you open it."
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
        />
        {sentTo && (
          <Alert tone="success">
            Check <strong>{sentTo}</strong> and open the link to confirm the change. It works for 30
            minutes.
          </Alert>
        )}
        <ErrorAlert error={request.error} />
        <Row $justify="flex-end">
          <Button type="submit" loading={request.isPending}>
            Change email
          </Button>
        </Row>
      </Form>
    </Card>
  );
}

async function saveAvatar(upload: AvatarUpload | null) {
  await updateMyAvatar(upload);
  notify(upload ? "Picture saved." : "Picture removed.", "success");
}

export function ProfilePage() {
  const { user } = useUser();
  if (!user) return null;

  return (
    <Stack $gap={6}>
      <PageTitle>Account</PageTitle>
      <PageHeading title="Account" description="How you appear to other players." />

      <Card>
        <CardHeader title="Profile" />
        <Stack $gap={6}>
          <AvatarPicker
            imageUrl={user.avatarUrl}
            name={getDisplayName(user.information) || user.information.username}
            onChange={saveAvatar}
            loadSavedSource={usersApi.getMyAvatarSource}
            hint="Shown in a circle next to your name. Saved as soon as you pick it."
          />
          {/* Keyed so the form starts over when the saved profile changes (eg. from another tab). */}
          <ProfileForm
            key={JSON.stringify(user.information)}
            information={user.information}
            onSave={updateMyProfile}
          />
        </Stack>
      </Card>

      <EmailCard currentEmail={user.information.email} />
    </Stack>
  );
}
