import { UserRole, type AdminUserListQuery } from "@podrida/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import styled from "styled-components";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageTitle } from "../../components/PageTitle";
import { Button } from "../../components/ui/Button";
import { Card, MutedText } from "../../components/ui/Card";
import { SelectField, TextField } from "../../components/ui/Field";
import { Row, Stack } from "../../components/ui/layout";
import { Spinner } from "../../components/ui/Spinner";
import { formatDate, getDisplayName } from "../../lib/format";
import { roleLabels } from "../../lib/permissions";
import { loadAdminUsers } from "../../stores/adminUsers/actions";
import { useAdminUsers } from "../../stores/adminUsers/store";
import { PageHeading } from "../app/PageHeading";
import { RoleBadge, StatusBadges } from "./UserBadges";

const pageSize = 20;
const searchDebounceMs = 350;

const Filters = styled.div`
  display: grid;
  grid-template-columns: 2fr repeat(3, 1fr);
  gap: ${({ theme }) => theme.space(3)};
  padding: ${({ theme }) => theme.space(5)};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  ${({ theme }) => theme.media.small} {
    grid-template-columns: 1fr 1fr;

    & > :first-child {
      grid-column: 1 / -1;
    }
  }
`;

const TableScroll = styled.div`
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  th,
  td {
    padding: ${({ theme }) => `${theme.space(3)} ${theme.space(5)}`};
    text-align: left;
    vertical-align: middle;
    white-space: nowrap;
  }

  th {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  tbody tr {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }

  tbody tr:hover {
    background: ${({ theme }) => theme.colors.surfaceSunken};
  }
`;

const UserLink = styled(Link)`
  color: ${({ theme }) => theme.colors.text};
  font-weight: 600;
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const Footer = styled(Row)`
  padding: ${({ theme }) => theme.space(4)} ${({ theme }) => theme.space(5)};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const Empty = styled.div`
  display: grid;
  place-items: center;
  gap: ${({ theme }) => theme.space(2)};
  padding: ${({ theme }) => theme.space(12)};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const toBoolean = (value: string | null) =>
  value === "true" ? true : value === "false" ? false : undefined;

// The filters live in the URL, so the back button and shared links keep them.
function readQuery(params: URLSearchParams): AdminUserListQuery {
  const role = params.get("role");
  const page = Number(params.get("page"));

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: pageSize,
    search: params.get("search") || undefined,
    role: Object.values(UserRole).includes(role as UserRole) ? (role as UserRole) : undefined,
    isDisabled: toBoolean(params.get("disabled")),
    isActivated: toBoolean(params.get("activated")),
  };
}

export function AdminUsersPage() {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => readQuery(params), [params]);
  const { byId, list } = useAdminUsers();
  const [search, setSearch] = useState(query.search ?? "");

  // The URL's search changed on its own (back button, a link): the input follows it.
  const [urlSearch, setUrlSearch] = useState(query.search);
  if (query.search !== urlSearch) {
    setUrlSearch(query.search);
    setSearch(query.search ?? "");
  }

  useEffect(() => {
    loadAdminUsers(query);
  }, [query]);

  const setParam = useCallback(
    (key: string, value: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value) next.set(key, value);
          else next.delete(key);
          if (key !== "page") next.delete("page"); // New filters start from the first page.
          return next;
        },
        { replace: key === "search" },
      );
    },
    [setParams],
  );

  // Typing only searches once it pauses.
  useEffect(() => {
    if (search.trim() === (query.search ?? "")) return undefined;
    const timer = setTimeout(() => setParam("search", search.trim()), searchDebounceMs);
    return () => clearTimeout(timer);
  }, [search, query.search, setParam]);

  const users = list.ids.map((id) => byId[id]).filter(Boolean);
  const page = query.page ?? 1;
  const isFirstLoad = list.status === "loading" && users.length === 0;

  return (
    <Stack $gap={6}>
      <PageTitle>Users</PageTitle>
      <PageHeading title="Users" description="Every account on Podrida." />

      <Card $padded={false}>
        <Filters>
          <TextField
            label="Search"
            type="search"
            placeholder="Start of a username or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <SelectField
            label="Role"
            value={query.role ?? ""}
            onChange={(event) => setParam("role", event.target.value)}
          >
            <option value="">Any</option>
            {Object.values(UserRole).map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Status"
            value={query.isDisabled === undefined ? "" : String(query.isDisabled)}
            onChange={(event) => setParam("disabled", event.target.value)}
          >
            <option value="">Any</option>
            <option value="false">Enabled</option>
            <option value="true">Disabled</option>
          </SelectField>
          <SelectField
            label="Activation"
            value={query.isActivated === undefined ? "" : String(query.isActivated)}
            onChange={(event) => setParam("activated", event.target.value)}
          >
            <option value="">Any</option>
            <option value="true">Activated</option>
            <option value="false">Pending</option>
          </SelectField>
        </Filters>

        {list.status === "error" ? (
          <Empty>
            <ErrorAlert error={list.error} />
            <Button variant="secondary" small onClick={() => loadAdminUsers(query)}>
              Try again
            </Button>
          </Empty>
        ) : isFirstLoad ? (
          <Empty>
            <Spinner />
          </Empty>
        ) : users.length === 0 ? (
          <Empty>No users match these filters.</Empty>
        ) : (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <UserLink to={`/admin/users/${user.id}`}>
                        {user.information.username}
                      </UserLink>
                      <MutedText>{getDisplayName(user.information) || "—"}</MutedText>
                    </td>
                    <td>{user.information.email}</td>
                    <td>
                      <RoleBadge role={user.role} />
                    </td>
                    <td>
                      <StatusBadges user={user} />
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}

        <Footer $justify="space-between">
          <MutedText>
            {list.total} user{list.total === 1 ? "" : "s"}
            {list.totalPages > 1 && ` · page ${page} of ${list.totalPages}`}
          </MutedText>
          <Row $gap={2}>
            {list.status === "loading" && !isFirstLoad && <Spinner $size={16} />}
            <Button
              variant="secondary"
              small
              disabled={page <= 1}
              onClick={() => setParam("page", String(page - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              small
              disabled={page >= list.totalPages}
              onClick={() => setParam("page", String(page + 1))}
            >
              Next
            </Button>
          </Row>
        </Footer>
      </Card>
    </Stack>
  );
}
