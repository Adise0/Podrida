import { useState } from "react";
import { authApi } from "../../../api/auth";
import { ErrorAlert } from "../../../components/ErrorAlert";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import { TextField } from "../../../components/ui/Field";
import { ConfirmModal } from "../../../components/ui/Modal";
import { accountDeletionGraceInDays } from "../../../config";
import { useRequest } from "../../../hooks/useRequest";
import { formatDate } from "../../../lib/format";
import { notify } from "../../../stores/notifications/actions";
import { endSession } from "../../../stores/session/actions";

export function DeleteAccountSection({ username }: { username: string }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  const remove = useRequest(async () => {
    const { scheduledDeletionAt } = await authApi.deleteAccount();
    endSession("accountDeleted");
    notify(
      scheduledDeletionAt
        ? `Your account will be deleted on ${formatDate(scheduledDeletionAt)}. Log in before then to keep it.`
        : "Your account has been deleted.",
      "info",
    );
  });

  return (
    <Card>
      <CardHeader
        title="Delete account"
        description={`You'll be signed out everywhere. Change your mind? Logging back in within ${accountDeletionGraceInDays} days cancels it.`}
      />
      <Button
        variant="danger"
        onClick={() => {
          setTyped("");
          remove.reset();
          setIsConfirming(true);
        }}
      >
        Delete my account
      </Button>
      <ConfirmModal
        isOpen={isConfirming}
        title="Delete your account?"
        body={
          <>
            Type your username, <strong>{username}</strong>, to confirm.
          </>
        }
        confirmLabel="Delete account"
        variant="danger"
        isPending={remove.isPending}
        confirmDisabled={typed !== username}
        error={<ErrorAlert error={remove.error} />}
        onConfirm={() => remove.run()}
        onCancel={() => setIsConfirming(false)}
      >
        <TextField
          label="Username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </ConfirmModal>
    </Card>
  );
}
