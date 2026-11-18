import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "../layouts/AppLayout";
import { AuthLayout } from "../layouts/AuthLayout";
import { AdminRootLayout, RootLayout } from "../layouts/RootLayouts";
import { adminRoles } from "../lib/permissions";
import { AdminGamePage } from "../pages/admin/AdminGamePage";
import { AdminGamesPage } from "../pages/admin/AdminGamesPage";
import { AdminUserPage } from "../pages/admin/AdminUserPage";
import { AdminUsersPage } from "../pages/admin/AdminUsersPage";
import { GamePage } from "../pages/app/GamePage";
import { FinishedGamePage } from "../pages/app/FinishedGamePage";
import { FinishedGamesPage } from "../pages/app/FinishedGamesPage";
import { HomePage } from "../pages/app/HomePage";
import { RoomPage } from "../pages/app/RoomPage";
import { ProfilePage } from "../pages/app/ProfilePage";
import { SecurityPage } from "../pages/app/security/SecurityPage";
import { CheckEmailPage } from "../pages/auth/CheckEmailPage";
import { CompleteSignupPage } from "../pages/auth/CompleteSignupPage";
import { ForgotPasswordPage } from "../pages/auth/ForgotPasswordPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { OAuthCallbackPage } from "../pages/auth/OAuthCallbackPage";
import { RegisterPage } from "../pages/auth/RegisterPage";
import {
  ActivatePage,
  CancelPasswordResetPage,
  CancelRegistrationPage,
  ConfirmEmailChangePage,
  RevokeOtpPage,
} from "../pages/emailLinks/EmailLinkPages";
import { ResetPasswordPage } from "../pages/emailLinks/ResetPasswordPage";
import { GamePreviewPage } from "../pages/dev/GamePreviewPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { GuestOnly, RequireAuth, RequireRole } from "./guards";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // Only for logged out users.
      {
        element: <GuestOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: "login", element: <LoginPage /> },
              { path: "register", element: <RegisterPage /> },
              { path: "register/check-email", element: <CheckEmailPage /> },
              { path: "forgot-password", element: <ForgotPasswordPage /> },
              { path: "auth/oauth/complete-signup", element: <CompleteSignupPage /> },
            ],
          },
        ],
      },

      // Whoever opens them. The email link paths are the ones the backend emails point to.
      {
        element: <AuthLayout />,
        children: [
          { path: "auth/oauth/:provider/callback", element: <OAuthCallbackPage /> },
          { path: "auth/activate/:token", element: <ActivatePage /> },
          { path: "auth/cancelRegistration/:token", element: <CancelRegistrationPage /> },
          { path: "auth/revokeOtp/:token", element: <RevokeOtpPage /> },
          { path: "auth/resetPassword/:token", element: <ResetPasswordPage /> },
          { path: "auth/cancelPasswordReset/:token", element: <CancelPasswordResetPage /> },
          { path: "auth/confirmEmailChange/:token", element: <ConfirmEmailChangePage /> },
        ],
      },

      // Logged in.
      {
        element: <RequireAuth />,
        children: [
          // The game screen has the whole window to itself (desktop only).
          { path: "games/:gameId", element: <GamePage /> },
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <HomePage /> },
              { path: "rooms/:roomId", element: <RoomPage /> },
              { path: "games/finished", element: <FinishedGamesPage /> },
              { path: "games/finished/:gameId", element: <FinishedGamePage /> },
              { path: "account", element: <ProfilePage /> },
              { path: "account/security", element: <SecurityPage /> },
              {
                path: "admin",
                element: <RequireRole roles={adminRoles} />,
                children: [
                  {
                    element: <AdminRootLayout />,
                    children: [
                      { index: true, element: <Navigate to="users" replace /> },
                      { path: "users", element: <AdminUsersPage /> },
                      { path: "users/:userId", element: <AdminUserPage /> },
                      { path: "games", element: <AdminGamesPage /> },
                      { path: "games/:gameId", element: <AdminGamePage /> },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },

      // Dev only: the game screen with a made-up game, to check the layout (see the page).
      ...(import.meta.env.DEV ? [{ path: "dev/game-preview", element: <GamePreviewPage /> }] : []),

      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
