import { isReauthCancelled } from "../api/client";
import { getErrorMessage } from "../api/errorMessages";
import { Alert } from "./ui/Alert";

// The error of a request, as a banner. Nothing when there's no error worth showing.
export function ErrorAlert({ error }: { error: unknown }) {
  if (!error || isReauthCancelled(error)) return null;
  return <Alert tone="error">{getErrorMessage(error)}</Alert>;
}
