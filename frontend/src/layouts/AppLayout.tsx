import { UserRole } from "@podrida/shared";
import { NavLink, Outlet } from "react-router";
import styled from "styled-components";
import { Brand } from "../components/Brand";
import { Button } from "../components/ui/Button";
import { useRequest } from "../hooks/useRequest";
import { logout } from "../stores/session/actions";
import { useUser } from "../stores/user/store";

const Header = styled.header`
  border-bottom: 1px solid ${({ theme }) => theme.colors.feltLine};
  background: ${({ theme }) => theme.colors.feltDeep};
`;

const HeaderInner = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => `${theme.space(3)} ${theme.space(6)}`};
  max-width: 960px;
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.space(3)} ${theme.space(4)}`};
`;

const Nav = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space(1)};
  flex: 1;

  ${({ theme }) => theme.media.small} {
    order: 3;
    flex-basis: 100%;
  }
`;

const NavItem = styled(NavLink)`
  padding: ${({ theme }) => `${theme.space(1.5)} ${theme.space(3)}`};
  border-radius: ${({ theme }) => theme.radii.pill};
  color: ${({ theme }) => theme.colors.onFeltMuted};
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.colors.onFelt};
  }

  &.active {
    background: rgba(255, 255, 255, 0.1);
    color: ${({ theme }) => theme.colors.onFelt};
  }
`;

const Account = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space(2)};
  margin-left: auto;
  color: ${({ theme }) => theme.colors.onFeltMuted};
  font-size: 14px;
`;

const Main = styled.main`
  max-width: 960px;
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.space(8)} ${theme.space(4)} ${theme.space(16)}`};

  ${({ theme }) => theme.media.small} {
    padding-top: ${({ theme }) => theme.space(5)};
  }
`;

const adminRoles = [UserRole.admin, UserRole.superuser];

export function AppLayout() {
  const { user } = useUser();
  const signOut = useRequest(logout);

  return (
    <>
      <Header>
        <HeaderInner>
          <Brand />
          <Nav aria-label="Main">
            <NavItem to="/" end>
              Play
            </NavItem>
            <NavItem to="/account" end>
              Account
            </NavItem>
            <NavItem to="/account/security">Security</NavItem>
            {user && adminRoles.includes(user.role) && <NavItem to="/admin">Admin</NavItem>}
          </Nav>
          <Account>
            <span>{user?.information.username}</span>
            <Button variant="ghost" small onClick={() => signOut.run()} loading={signOut.isPending}>
              Log out
            </Button>
          </Account>
        </HeaderInner>
      </Header>
      <Main>
        <Outlet />
      </Main>
    </>
  );
}
