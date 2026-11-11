import { PageTitle } from "../../../components/PageTitle";
import { Stack } from "../../../components/ui/layout";
import { useUser } from "../../../stores/user/store";
import { PageHeading } from "../PageHeading";
import { DeleteAccountSection } from "./DeleteAccountSection";
import { PasswordSection } from "./PasswordSection";
import { SessionsSection } from "./SessionsSection";
import { SignInMethodsSection } from "./SignInMethodsSection";

// Everything here that changes how the account is signed in to needs a recent login: the API
// answers REAUTH_REQUIRED and the "confirm it's you" modal handles it, then the action goes through.
export function SecurityPage() {
  const { user } = useUser();
  if (!user) return null;

  return (
    <Stack $gap={6}>
      <PageTitle>Security</PageTitle>
      <PageHeading title="Security" description="How you log in, and where you're logged in." />
      <PasswordSection hasPassword={user.hasPassword} />
      <SignInMethodsSection user={user} />
      <SessionsSection />
      <DeleteAccountSection username={user.information.username} />
    </Stack>
  );
}
