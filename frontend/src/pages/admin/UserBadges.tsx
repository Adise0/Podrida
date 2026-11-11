import { UserRole, type AdminUser } from "@podrida/shared";
import { Badge } from "../../components/ui/Badge";
import { Row } from "../../components/ui/layout";
import { roleLabels } from "../../lib/permissions";

export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge $tone={role === UserRole.user ? "neutral" : "info"}>{roleLabels[role]}</Badge>;
}

// Everything that's out of the ordinary about an account.
export function StatusBadges({ user }: { user: AdminUser }) {
  return (
    <Row $gap={1.5}>
      {user.isDisabled && <Badge $tone="danger">Disabled</Badge>}
      {!user.activatedAt && <Badge $tone="warning">Pending activation</Badge>}
      {user.resetPasswordOnLogin && <Badge $tone="warning">Password reset required</Badge>}
      {user.scheduledDeletionAt && <Badge $tone="danger">Deletion scheduled</Badge>}
      {!user.isDisabled && user.activatedAt && !user.scheduledDeletionAt && (
        <Badge $tone="success">Active</Badge>
      )}
    </Row>
  );
}
