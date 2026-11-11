import type { MyUser } from "@podrida/shared";
import { useState, type FormEvent } from "react";
import { authApi } from "../api/auth";
import { useRequest } from "../hooks/useRequest";
import { cancelReauth, completeReauth } from "../stores/reauth/actions";
import { useReauth } from "../stores/reauth/store";
import { useUser } from "../stores/user/store";
import { ErrorAlert } from "./ErrorAlert";
import { Alert } from "./ui/Alert";
import { Button } from "./ui/Button";
import { MutedText } from "./ui/Card";
import { TextField } from "./ui/Field";
import { Form, LinkButton, Row } from "./ui/layout";
import { Modal } from "./ui/Modal";

type Step = { kind: "password" } | { kind: "otp"; isSent: boolean };

// Logs the user in again, in place, for actions that need a recent login. Whatever asked for it
// (see stores/reauth/actions.ts) is retried once it's done. Accounts without a password use a code
// sent to their email; providers aren't offered since they'd leave the page and lose the retry.
function ReauthForm({ user }: { user: MyUser }) {
  const identifier = user.information.email;
  const [step, setStep] = useState<Step>(
    user.hasPassword ? { kind: "password" } : { kind: "otp", isSent: false },
  );
  const [secret, setSecret] = useState("");

  const login = useRequest(async (password: string, withOtp: boolean) => {
    const { token } = await authApi.login({ email: identifier, password, withOtp });
    completeReauth(token);
  });

  const sendCode = useRequest(async () => {
    await authApi.requestOtp(identifier);
    setStep({ kind: "otp", isSent: true });
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!secret) return;
    login.run(secret, step.kind === "otp");
  };

  const switchTo = (next: Step) => {
    setSecret("");
    login.reset();
    setStep(next);
  };

  if (step.kind === "otp" && !step.isSent) {
    return (
      <Form onSubmit={(event) => event.preventDefault()}>
        <MutedText>
          We'll email a sign-in code to <strong>{identifier}</strong>.
        </MutedText>
        <ErrorAlert error={sendCode.error} />
        <Row $justify="flex-end">
          <Button variant="ghost" onClick={cancelReauth}>
            Cancel
          </Button>
          <Button onClick={() => sendCode.run()} loading={sendCode.isPending}>
            Email me a code
          </Button>
        </Row>
        {user.hasPassword && (
          <LinkButton type="button" onClick={() => switchTo({ kind: "password" })}>
            Use my password instead
          </LinkButton>
        )}
      </Form>
    );
  }

  return (
    <Form onSubmit={onSubmit} noValidate>
      {step.kind === "password" && (
        <>
          <MutedText>For your security, enter your password to continue.</MutedText>
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
          />
        </>
      )}

      {step.kind === "otp" && (
        <>
          <Alert tone="info">If the email is right, a code is on its way to {identifier}.</Alert>
          <TextField
            label="Sign-in code"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
          />
        </>
      )}

      <ErrorAlert error={login.error} />

      <Row $justify="flex-end">
        <Button variant="ghost" onClick={cancelReauth}>
          Cancel
        </Button>
        <Button type="submit" loading={login.isPending}>
          Confirm
        </Button>
      </Row>

      {step.kind === "password" && (
        <LinkButton type="button" onClick={() => switchTo({ kind: "otp", isSent: false })}>
          Email me a code instead
        </LinkButton>
      )}
    </Form>
  );
}

export function ReauthModal() {
  const { isOpen } = useReauth();
  const { user } = useUser();

  return (
    <Modal isOpen={isOpen && user !== null} title="Confirm it's you" onClose={cancelReauth}>
      {user && <ReauthForm user={user} />}
    </Modal>
  );
}
