import type { UserRole } from "@podrida/shared";
import { Navigate, Outlet, useLocation } from "react-router";
import { ErrorAlert } from "../components/ErrorAlert";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Stack } from "../components/ui/layout";
import { FullPageSpinner } from "../components/ui/Spinner";
import { useSession } from "../stores/session/store";
import { loadMyUser } from "../stores/user/actions";
import { useUser } from "../stores/user/store";
import { getSafeReturnPath, readAuthState, type AuthLocationState } from "./locationState";
import styled from "styled-components";

const Centered = styled.div`
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: ${({ theme }) => theme.space(4)};

  & > * {
    width: 100%;
    max-width: 440px;
  }
`;

// Only for logged in users, and only once their user has loaded (pages can rely on it being there).
export function RequireAuth() {
  const session = useSession();
  const { user, status, error } = useUser();
  const location = useLocation();

  if (session.status === "restoring") return <FullPageSpinner />;

  if (session.status === "anonymous") {
    // After a plain logout, the next login starts from the home page.
    const state: AuthLocationState =
      session.endReason === "logout" ? {} : { from: location.pathname + location.search };
    return <Navigate to="/login" replace state={state} />;
  }

  if (!user) {
    if (status !== "error") return <FullPageSpinner />;

    return (
      <Centered>
        <Card>
          <CardHeader title="We couldn't load your account" />
          <Stack>
            <ErrorAlert error={error} />
            <Button onClick={() => loadMyUser()}>Try again</Button>
          </Stack>
        </Card>
      </Centered>
    );
  }

  return <Outlet />;
}

// Login, register... A logged in user goes on to where they were heading.
export function GuestOnly() {
  const { status } = useSession();
  const location = useLocation();

  if (status === "restoring") return <FullPageSpinner />;

  if (status === "authenticated") {
    return <Navigate to={getSafeReturnPath(readAuthState(location.state).from)} replace />;
  }

  return <Outlet />;
}

// Goes inside RequireAuth. The API checks the role anyway, this is just to not show pages that can't work.
export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { user } = useUser();

  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <Outlet />;
}
