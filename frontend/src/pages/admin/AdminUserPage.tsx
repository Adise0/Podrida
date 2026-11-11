import { ErrorCode, UserRole, type AdminUser } from "@podrida/shared";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import styled from "styled-components";
import { hasErrorCode } from "../../api/client";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { ProfileForm } from "../../components/ProfileForm";
import { Alert } from "../../components/ui/Alert";
import { Button, type ButtonVariant } from "../../components/ui/Button";
import { Card, CardHeader, MutedText } from "../../components/ui/Card";
import { SelectField } from "../../components/ui/Field";
import { ConfirmModal } from "../../components/ui/Modal";
import { Row, Stack, TextLink } from "../../components/ui/layout";
import { Spinner } from "../../components/ui/Spinner";
import { useRequest } from "../../hooks/useRequest";
import { formatDateTime, getDisplayName } from "../../lib/format";
import { canChangeRole, canManage, roleLabels } from "../../lib/permissions";
import {
  changeAdminUserRole,
  deleteAdminUser,
  disableAdminUser,
  enableAdminUser,
  forceAdminUserPasswordReset,
  loadAdminUser,
  signOutAdminUser,
  updateAdminUserProfile,
} from "../../stores/adminUsers/actions";
import { useAdminUsers } from "../../stores/adminUsers/store";
import { notify } from "../../stores/notifications/actions";
import { useUser } from "../../stores/user/store";
import { PageHeading } from "../app/PageHeading";
import { RoleBadge, StatusBadges } from "./UserBadges";

const Details = styled.dl`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${({ theme }) => `${theme.space(2)} ${theme.space(6)}`};
  margin: 0;
  font-size: 14px;

  dt {
    color: ${({ theme }) => theme.colors.textMuted};
  }

  dd {
    margin: 0;
    min-width: 0;
    word-break: break-word;
  }

  ${({ theme }) => theme.media.small} {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.space(0.5)};

    dd {
      margin-bottom: ${({ theme }) => theme.space(2)};
    }
  }
`;

const ActionList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space(4)};
    padding: ${({ theme }) => theme.space(3)} 0;
  }

  li + li {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }

  li > div {
    flex: 1;
    min-width: 0;
  }

  ${({ theme }) => theme.media.small} {
    li {
      flex-direction: column;
      align-items: stretch;
    }
  }
`;

interface UserAction {
  key: string;
  label: string;
  description: string;
  confirmTitle: string;
  confirmBody: ReactNode;
  variant: ButtonVariant;
  successMessage: string;
  run: (userId: string) => Promise<void>;
}

function getActions(user: AdminUser): UserAction[] {
  const name = user.information.username;

  return [
    user.isDisabled
      ? {
          key: "enable",
          label: "Enable",
          description: "Let them log in again.",
          confirmTitle: `Enable ${name}?`,
          confirmBody: "They'll be able to log in again.",
          variant: "secondary",
          successMessage: `${name} is enabled.`,
          run: enableAdminUser,
        }
      : {
          key: "disable",
          label: "Disable",
          description: "Sign them out everywhere and block logging in, until enabled again.",
          confirmTitle: `Disable ${name}?`,
          confirmBody: "They'll be signed out everywhere and won't be able to log in.",
          variant: "danger",
          successMessage: `${name} is disabled.`,
          run: disableAdminUser,
        },
    {
      key: "signOut",
      label: "Sign out",
      description: "End every session they have. They can log straight back in.",
      confirmTitle: `Sign ${name} out everywhere?`,
      confirmBody: "Every device they're logged in on will have to log in again.",
      variant: "secondary",
      successMessage: `${name} was signed out everywhere.`,
      run: signOutAdminUser,
    },
    {
      key: "forceReset",
      label: "Force password reset",
      description:
        "For a compromised account: they can only get back in through a reset link sent to their email.",
      confirmTitle: `Force ${name} to reset their password?`,
      confirmBody:
        "They'll be signed out, and emailed a link to choose a new password. Until then they can't log in.",
      variant: "danger",
      successMessage: `${name} has to reset their password.`,
      run: forceAdminUserPasswordReset,
    },
  ];
}

function RoleCard({ user }: { user: AdminUser }) {
  const [role, setRole] = useState<UserRole.user | UserRole.admin>(
    user.role === UserRole.admin ? UserRole.admin : UserRole.user,
  );
  const [isConfirming, setIsConfirming] = useState(false);

  const change = useRequest(async () => {
    await changeAdminUserRole(user.id, role);
    setIsConfirming(false);
    notify(`${user.information.username} is now ${roleLabels[role].toLowerCase()}.`, "success");
  });

  return (
    <Card>
      <CardHeader
        title="Role"
        description="Admins can manage players. Only superusers change roles."
      />
      <Row $justify="space-between">
        <SelectField
          label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole.user | UserRole.admin)}
        >
          <option value={UserRole.user}>{roleLabels[UserRole.user]}</option>
          <option value={UserRole.admin}>{roleLabels[UserRole.admin]}</option>
        </SelectField>
        <Button
          disabled={role === user.role}
          onClick={() => {
            change.reset();
            setIsConfirming(true);
          }}
        >
          Change role
        </Button>
      </Row>
      <ConfirmModal
        isOpen={isConfirming}
        title={`Make ${user.information.username} ${roleLabels[role].toLowerCase()}?`}
        body={
          role === UserRole.admin
            ? "They'll be able to manage every player's account."
            : "They'll lose access to the admin pages."
        }
        confirmLabel="Change role"
        isPending={change.isPending}
        error={<ErrorAlert error={change.error} />}
        onConfirm={() => change.run()}
        onCancel={() => setIsConfirming(false)}
      />
    </Card>
  );
}

function ManagedUser({ user, me }: { user: AdminUser; me: { id: string; role: UserRole } }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<UserAction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isManageable = canManage(me, user);
  const name = user.information.username;

  const runAction = useRequest(async (action: UserAction) => {
    await action.run(user.id);
    setPending(null);
    notify(action.successMessage, "success");
  });

  const remove = useRequest(async () => {
    await deleteAdminUser(user.id);
    notify(`${name} was deleted.`, "success");
    navigate("/admin/users", { replace: true });
  });

  return (
    <Stack $gap={6}>
      <PageTitle>{name}</PageTitle>
      <Stack $gap={3}>
        <TextLink to="/admin/users" style={{ color: "inherit" }}>
          ← All users
        </TextLink>
        <PageHeading title={name} description={getDisplayName(user.information) || undefined} />
      </Stack>

      <Card>
        <CardHeader title="Account" />
        <Details>
          <dt>Email</dt>
          <dd>{user.information.email}</dd>
          <dt>Role</dt>
          <dd>
            <RoleBadge role={user.role} />
          </dd>
          <dt>Status</dt>
          <dd>
            <StatusBadges user={user} />
          </dd>
          <dt>Joined</dt>
          <dd>{formatDateTime(user.createdAt)}</dd>
          <dt>Activated</dt>
          <dd>{user.activatedAt ? formatDateTime(user.activatedAt) : "Not yet"}</dd>
          {user.scheduledDeletionAt && (
            <>
              <dt>Deletion</dt>
              <dd>{formatDateTime(user.scheduledDeletionAt)}, unless they log in before</dd>
            </>
          )}
          <dt>Last change</dt>
          <dd>{formatDateTime(user.updatedAt)}</dd>
          <dt>Id</dt>
          <dd>{user.id}</dd>
        </Details>
      </Card>

      {!isManageable && (
        <Alert tone="info">
          {me.id === user.id
            ? "This is you. Manage your own account from the Account and Security pages."
            : `You can see ${name}'s account, but only a superuser can change it.`}
        </Alert>
      )}

      <Card>
        <CardHeader title="Profile" />
        <ProfileForm
          key={JSON.stringify(user.information)}
          information={user.information}
          disabled={!isManageable}
          onSave={(changes) => updateAdminUserProfile(user.id, changes)}
        />
      </Card>

      {canChangeRole(me, user) && <RoleCard key={user.role} user={user} />}

      {isManageable && (
        <Card>
          <CardHeader title="Actions" />
          <ActionList>
            {getActions(user).map((action) => (
              <li key={action.key}>
                <div>
                  <strong>{action.label}</strong>
                  <MutedText>{action.description}</MutedText>
                </div>
                <Button
                  variant={action.variant}
                  small
                  onClick={() => {
                    runAction.reset();
                    setPending(action);
                  }}
                >
                  {action.label}
                </Button>
              </li>
            ))}
            <li>
              <div>
                <strong>Delete</strong>
                <MutedText>
                  Remove the account and everything in it, right away. It can't be undone.
                </MutedText>
              </div>
              <Button
                variant="danger"
                small
                onClick={() => {
                  remove.reset();
                  setIsDeleting(true);
                }}
              >
                Delete
              </Button>
            </li>
          </ActionList>
        </Card>
      )}

      <ConfirmModal
        isOpen={pending !== null}
        title={pending?.confirmTitle ?? ""}
        body={pending?.confirmBody}
        confirmLabel={pending?.label ?? ""}
        variant={pending?.variant === "danger" ? "danger" : "primary"}
        isPending={runAction.isPending}
        error={<ErrorAlert error={runAction.error} />}
        onConfirm={() => pending && runAction.run(pending)}
        onCancel={() => setPending(null)}
      />

      <ConfirmModal
        isOpen={isDeleting}
        title={`Delete ${name}?`}
        body="Their account is removed right away and can't be recovered."
        confirmLabel="Delete for good"
        variant="danger"
        isPending={remove.isPending}
        error={<ErrorAlert error={remove.error} />}
        onConfirm={() => remove.run()}
        onCancel={() => setIsDeleting(false)}
      />
    </Stack>
  );
}

export function AdminUserPage() {
  const { userId = "" } = useParams();
  const { byId } = useAdminUsers();
  const { user: me } = useUser();
  const load = useRequest(loadAdminUser);
  const { run } = load;

  // Always fetched, even when the list already has it, so the page shows the latest.
  useEffect(() => {
    run(userId);
  }, [run, userId]);

  const user = byId[userId];

  if (!me) return null;

  if (!user) {
    if (load.status === "error") {
      const isMissing = hasErrorCode(
        load.error,
        ErrorCode.USER_NOT_FOUND,
        ErrorCode.VALIDATION_FAILED,
        ErrorCode.NOT_FOUND,
      );

      return (
        <Card>
          <PageTitle>User not found</PageTitle>
          <CardHeader title={isMissing ? "No such user" : "We couldn't load this user"} />
          <Stack>
            {!isMissing && <ErrorAlert error={load.error} />}
            <TextLink to="/admin/users">Back to all users</TextLink>
          </Stack>
        </Card>
      );
    }

    return (
      <Row>
        <Spinner />
      </Row>
    );
  }

  return <ManagedUser user={user} me={me} />;
}
