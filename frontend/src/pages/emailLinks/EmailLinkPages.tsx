import { ErrorCode } from "@podrida/shared";
import { authApi } from "../../api/auth";
import { hasErrorCode } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { TextLink } from "../../components/ui/layout";
import { useEmailLinkAction } from "../../hooks/useEmailLinkAction";
import { startSession } from "../../stores/session/actions";
import { useSession } from "../../stores/session/store";
import { loadMyUser } from "../../stores/user/actions";
import { EmailLinkResult } from "./EmailLinkResult";

// The pages the links in our emails open. Each one sends the link's token once the user confirms.

async function activateAndLogIn(token: string) {
  const { token: sessionToken } = await authApi.activate(token);
  startSession(sessionToken);
}

export function ActivatePage() {
  const { status, error, confirm } = useEmailLinkAction(activateAndLogIn);

  return (
    <EmailLinkResult
      title="Activate your account"
      status={status}
      error={error}
      prompt="One click and you're in."
      confirmLabel="Activate my account"
      onConfirm={confirm}
      successTitle="You're in!"
      successBody="Your account is active and you're logged in."
      actions={<TextLink to="/">Take a seat</TextLink>}
      errorOverride={(activationError) =>
        hasErrorCode(activationError, ErrorCode.ACCOUNT_ALREADY_ACTIVATED) ? (
          <Alert tone="info">This account is already active. Log in to play.</Alert>
        ) : hasErrorCode(activationError, ErrorCode.INVALID_OR_EXPIRED_LINK) ? (
          <Alert tone="error">
            Activation links work for 20 minutes. Try logging in, and we'll offer to send you a new
            one.
          </Alert>
        ) : null
      }
    />
  );
}

export function CancelRegistrationPage() {
  const { status, error, confirm } = useEmailLinkAction(authApi.cancelRegistration);

  return (
    <EmailLinkResult
      title="Cancel registration"
      status={status}
      error={error}
      prompt="Didn't sign up for Podrida? Cancel the registration and nothing is kept."
      confirmLabel="Cancel the registration"
      confirmVariant="danger"
      onConfirm={confirm}
      successTitle="Registration cancelled"
      successBody="Nobody can activate that account. Thanks for letting us know. You can close this page."
      actions={<TextLink to="/">Go to Podrida</TextLink>}
    />
  );
}

export function RevokeOtpPage() {
  const { status, error, confirm } = useEmailLinkAction(authApi.revokeOtp);

  return (
    <EmailLinkResult
      title="Revoke sign-in code"
      status={status}
      error={error}
      prompt="Didn't ask for a sign-in code? Revoke it so nobody can use it."
      confirmLabel="Revoke the code"
      confirmVariant="danger"
      onConfirm={confirm}
      successTitle="Code revoked"
      successBody="That sign-in code can't be used anymore. Whoever asked for it may know your email or username, but they can't get in without the code."
      actions={<TextLink to="/login">Go to login</TextLink>}
    />
  );
}

export function CancelPasswordResetPage() {
  const { status, error, confirm } = useEmailLinkAction(authApi.cancelPasswordReset);

  return (
    <EmailLinkResult
      title="Cancel password reset"
      status={status}
      error={error}
      prompt="Didn't ask to reset your password? Cancel it: the reset link stops working and your password stays as it is."
      confirmLabel="Cancel the reset"
      confirmVariant="danger"
      onConfirm={confirm}
      successTitle="Password reset cancelled"
      successBody="The reset link can't be used anymore, and your password stays as it was."
      actions={<TextLink to="/login">Go to login</TextLink>}
    />
  );
}

export function ConfirmEmailChangePage() {
  const { status: sessionStatus } = useSession();

  const { status, error, confirm } = useEmailLinkAction(async (token: string) => {
    await authApi.confirmEmailChange(token);
    // Logged in here too: show the new address straight away.
    if (sessionStatus === "authenticated") await loadMyUser();
  });

  return (
    <EmailLinkResult
      title="Confirm your new email"
      status={status}
      error={error}
      prompt="Confirm this is the address you want to use for Podrida."
      confirmLabel="Confirm my new email"
      onConfirm={confirm}
      successTitle="Email changed"
      successBody="From now on, use your new address to log in and to get our emails."
      actions={
        sessionStatus === "authenticated" ? (
          <TextLink to="/account">Back to your account</TextLink>
        ) : (
          <TextLink to="/login">Log in</TextLink>
        )
      }
      errorOverride={(changeError) =>
        hasErrorCode(changeError, ErrorCode.DUPLICATE_KEY) ? (
          <Alert tone="error">Another account started using that address in the meantime.</Alert>
        ) : null
      }
    />
  );
}
