import { Outlet } from "react-router";
import { ReauthModal } from "../components/ReauthModal";
import { Toaster } from "../components/Toaster";
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

// The admin store only lives while an admin page is open.
export function AdminRootLayout() {
  return (
    <AdminUsersProvider>
      <Outlet />
    </AdminUsersProvider>
  );
}
