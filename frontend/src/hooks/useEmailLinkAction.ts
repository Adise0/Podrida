import { useCallback } from "react";
import { useParams } from "react-router";
import { useRequest } from "./useRequest";

// For the pages emailed links land on: sends the link's :token when the user confirms. Never on
// open: email scanners (Outlook Safe Links, Gmail, corporate gateways) open every link, some of
// them running the page's scripts, and would activate, cancel or revoke on their own.
export function useEmailLinkAction<Result>(action: (token: string) => Promise<Result>) {
  const { token = "" } = useParams();
  const request = useRequest(action);
  const { run } = request;

  const confirm = useCallback(() => run(token), [run, token]);

  return { ...request, confirm };
}
