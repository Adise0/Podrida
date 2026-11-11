import { ErrorCode } from "@podrida/shared";
import type { ReactNode } from "react";
import { hasErrorCode } from "../../api/client";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { Alert } from "../../components/ui/Alert";
import { Button, type ButtonVariant } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Row, Stack } from "../../components/ui/layout";
import type { RequestStatus } from "../../hooks/useRequest";

interface EmailLinkResultProps {
  title: string;
  status: RequestStatus;
  error: unknown;
  // What the page asks before doing anything (see useEmailLinkAction for why it has to ask).
  prompt: ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
  successTitle: string;
  successBody: ReactNode;
  actions: ReactNode; // Links shown once it's done, whatever the outcome.
  // Some errors have a better explanation than the generic one, for a given page.
  errorOverride?: (error: unknown) => ReactNode | null;
}

// What every email-link page looks like: asking, done, or why it couldn't be done.
export function EmailLinkResult({
  title,
  status,
  error,
  prompt,
  confirmLabel,
  confirmVariant = "primary",
  onConfirm,
  successTitle,
  successBody,
  actions,
  errorOverride,
}: EmailLinkResultProps) {
  if (status === "idle" || status === "pending") {
    return (
      <Card>
        <PageTitle>{title}</PageTitle>
        <CardHeader as="h1" title={title} description={prompt} />
        <Button block variant={confirmVariant} loading={status === "pending"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card>
        <PageTitle>{title}</PageTitle>
        <CardHeader as="h1" title={successTitle} description={successBody} />
        <Row>{actions}</Row>
      </Card>
    );
  }

  const isExpired = hasErrorCode(error, ErrorCode.INVALID_OR_EXPIRED_LINK);

  return (
    <Card>
      <PageTitle>{title}</PageTitle>
      <CardHeader as="h1" title={isExpired ? "This link has expired" : "That didn't work"} />
      <Stack>
        {errorOverride?.(error) ??
          (isExpired ? (
            <Alert tone="error">
              Links in our emails only work for a short while, and only once. Ask for a new one.
            </Alert>
          ) : (
            <ErrorAlert error={error} />
          ))}
        <Row>{actions}</Row>
      </Stack>
    </Card>
  );
}
