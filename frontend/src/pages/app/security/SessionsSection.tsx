import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import { ConfirmModal } from "../../../components/ui/Modal";
import { ErrorAlert } from "../../../components/ErrorAlert";
import { useRequest } from "../../../hooks/useRequest";
import { signOutEverywhere } from "../../../stores/session/actions";

export function SessionsSection() {
  const [isConfirming, setIsConfirming] = useState(false);
  const signOut = useRequest(signOutEverywhere);

  return (
    <Card>
      <CardHeader
        title="Devices"
        description="Lost a phone, or logged in somewhere you shouldn't have? Sign out of every device at once, this one included."
      />
      <Button variant="secondary" onClick={() => setIsConfirming(true)}>
        Sign out everywhere
      </Button>
      <ConfirmModal
        isOpen={isConfirming}
        title="Sign out everywhere?"
        body="Every device will have to log in again, including this one."
        confirmLabel="Sign out everywhere"
        variant="danger"
        isPending={signOut.isPending}
        error={<ErrorAlert error={signOut.error} />}
        onConfirm={() => signOut.run()}
        onCancel={() => setIsConfirming(false)}
      />
    </Card>
  );
}
