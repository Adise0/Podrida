import { NavLink, Outlet } from "react-router";
import styled from "styled-components";
import { ReauthModal } from "../components/ReauthModal";
import { Toaster } from "../components/Toaster";
import { Stack } from "../components/ui/layout";
import { AdminUsersProvider } from "../stores/adminUsers/store";

// The overlays every page can need: the "confirm it's you" modal and the toasts.
export function RootLayout() {
  return (
    <>
      <Outlet />
      <ReauthModal />
      <Toaster />
    </>
  );
}

const Tabs = styled.nav`
  display: flex;
  gap: ${({ theme }) => theme.space(1)};
  padding: ${({ theme }) => theme.space(1)};
  align-self: flex-start;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: rgba(0, 0, 0, 0.2);
`;

const Tab = styled(NavLink)`
  padding: ${({ theme }) => `${theme.space(1.5)} ${theme.space(4)}`};
  border-radius: ${({ theme }) => theme.radii.pill};
  color: ${({ theme }) => theme.colors.onFeltMuted};
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.colors.onFelt};
  }

  &.active {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }
`;

// The admin pages, under their tabs. The admin store only lives while one of them is open.
export function AdminRootLayout() {
  return (
    <AdminUsersProvider>
      <Stack $gap={6}>
        <Tabs aria-label="Admin">
          <Tab to="/admin/users">Users</Tab>
          <Tab to="/admin/games">Games</Tab>
        </Tabs>
        <Outlet />
      </Stack>
    </AdminUsersProvider>
  );
}
