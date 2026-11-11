import { useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { oauthApi, type OAuthCodeData } from "../../api/oauth";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { Alert } from "../../components/ui/Alert";
import { Card, CardHeader } from "../../components/ui/Card";
import { Row, Stack, TextLink } from "../../components/ui/layout";
import { Spinner } from "../../components/ui/Spinner";
import { useRequest } from "../../hooks/useRequest";
import { getProviderLabel, takePendingOAuth } from "../../lib/oauth";
import { getSafeReturnPath, type AuthLocationState } from "../../router/locationState";
import { notify } from "../../stores/notifications/actions";
import { startSession } from "../../stores/session/actions";
import { useSession } from "../../stores/session/store";
import { loadMyUser } from "../../stores/user/actions";

// A problem with the redirect itself, before the API is even asked.
class CallbackError extends Error {}

// Apple sends the name (first sign-in only) as JSON in a "user" parameter.
function readAppleName(user: string | null): Pick<OAuthCodeData, "firstName" | "lastName"> {
  try {
    const name = (JSON.parse(user ?? "") as { name?: { firstName?: string; lastName?: string } })
      .name;
    return { firstName: name?.firstName || undefined, lastName: name?.lastName || undefined };
  } catch {
    return {};
  }
}

// Where the provider sends the user back to, for both logging in and linking a provider.
export function OAuthCallbackPage() {
  const { provider = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { status: sessionStatus } = useSession();
  const label = getProviderLabel(provider);

  const complete = useRequest(async () => {
    const pending = takePendingOAuth();
    const code = params.get("code");

    if (params.get("error")) {
      throw new CallbackError(`The ${label} sign-in was cancelled.`);
    }

    // The state proves this redirect answers a sign-in this browser started.
    if (
      !pending ||
      pending.provider !== provider ||
      pending.state !== params.get("state") ||
      !code
    ) {
      throw new CallbackError("This sign-in link isn't valid anymore. Start again.");
    }

    const data: OAuthCodeData = {
      code,
      nonce: pending.nonce,
      codeVerifier: pending.codeVerifier,
      ...readAppleName(params.get("user")),
    };
    const returnTo = getSafeReturnPath(pending.returnTo);

    if (pending.mode === "link") {
      await oauthApi.link(provider, data);
      await loadMyUser();
      notify(`${label} is now linked to your account.`, "success");
      navigate(returnTo, { replace: true });
      return;
    }

    const response = await oauthApi.login(provider, data);

    if ("signupRequired" in response) {
      const { signupToken, email, firstName, lastName } = response;
      const state: AuthLocationState = {
        from: returnTo,
        oauthSignup: { signupToken, email, firstName, lastName },
      };
      navigate("/auth/oauth/complete-signup", { replace: true, state });
      return;
    }

    startSession(response.token);
    navigate(returnTo, { replace: true });
  });

  // Once: the code is single-use, and StrictMode runs effects twice in development.
  const { run } = complete;
  const hasRun = useRef(false);
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    run();
  }, [run]);

  const backLink =
    sessionStatus === "authenticated" ? (
      <TextLink to="/account/security">Back to security settings</TextLink>
    ) : (
      <TextLink to="/login">Back to login</TextLink>
    );

  return (
    <Card>
      <PageTitle>{`Signing in with ${label}`}</PageTitle>
      {complete.status === "error" ? (
        <>
          <CardHeader as="h1" title="That didn't work" />
          <Stack>
            {complete.error instanceof CallbackError ? (
              <Alert tone="error">{complete.error.message}</Alert>
            ) : (
              <ErrorAlert error={complete.error} />
            )}
            {backLink}
          </Stack>
        </>
      ) : (
        <Row>
          <Spinner />
          <span>Talking to {label}…</span>
        </Row>
      )}
    </Card>
  );
}
