import React, { useEffect, useRef, useState, ReactNode } from "react";
import type { AppProps } from "next/app";
import { AuthProvider, useAuth } from "react-oidc-context";
import { WebStorageStateStore } from "oidc-client-ts";
import { ThemeProvider } from "@mui/material";
import Layout from "../components/Layout";
import useUserStore from "../stores/useUserStore"; // Import the user store
import botaTheme from "../config/muiTheme";
import "../styles/globals.css";
import "../styles/tailwind.css";
import { COGNITO_CONFIG } from "../config/authConfig";

// Define Cognito Auth Config with proper types
const cognitoAuthConfig = {
  authority: COGNITO_CONFIG.authority,
  client_id: COGNITO_CONFIG.clientId,
  redirect_uri: COGNITO_CONFIG.redirectUri,
  response_type: "code",
  scope: "phone openid email",
  // Use localStorage instead of sessionStorage for persistence across browser restarts
  userStore:
    typeof window !== "undefined"
      ? new WebStorageStateStore({ store: window.localStorage })
      : undefined,
  // Enable automatic silent renew of tokens
  automaticSilentRenew: true,
  // Try to renew the token 60 seconds before it expires
  accessTokenExpiringNotificationTimeInSeconds: 60,
  // Clean up auth code from URL after successful login to prevent
  // stale authorization codes from breaking sessions on page reload
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
  // No manual metadata override — OIDC discovery from the authority handles
  // all endpoints (authorization, token, userinfo, jwks_uri, etc.)
};

// Props type for UserInitializer
interface UserInitializerProps {
  children: ReactNode;
}

// UserInitializer Component
const UserInitializer: React.FC<UserInitializerProps> = ({ children }) => {
  const auth = useAuth();
  const { fetchUserDetails, clearUserDetails } = useUserStore();
  const hasAttemptedSilentRenewalOnStartup = useRef(false);

  // Cognito issues a refresh token (valid 30 days) for the auth-code flow, but
  // access/ID tokens expire after 60 minutes. On a fresh page load the OIDC
  // provider reports isAuthenticated=false whenever the stored access token has
  // already expired, and automaticSilentRenew only fires while the tab is open
  // with a still-valid token — never on startup. Without this effect, any user
  // returning after their 60-minute token lapsed is treated as logged out even
  // though a valid refresh token is sitting in storage. Exchange it once on
  // startup so sessions persist for the full refresh-token lifetime.
  useEffect(() => {
    if (
      auth.isLoading ||
      auth.isAuthenticated ||
      auth.activeNavigator ||
      hasAttemptedSilentRenewalOnStartup.current
    ) {
      return;
    }

    const storedUser = auth.user;
    const hasExpiredSessionWithRefreshToken =
      Boolean(storedUser?.refresh_token) && storedUser?.expired === true;

    if (hasExpiredSessionWithRefreshToken) {
      hasAttemptedSilentRenewalOnStartup.current = true;
      auth.signinSilent().catch((error) => {
        // A dead/expired refresh token (Cognito returns `invalid_grant`) means
        // the stored session can't be revived. Purge it so the app falls back
        // to a clean signed-out state instead of surfacing a token-exchange
        // error to the user, who then has to sign in again anyway.
        console.warn("Startup token renewal failed; clearing stale session:", error);
        auth.removeUser().catch((removeError) => {
          console.error("Failed to clear stale session:", removeError);
        });
      });
    }
  }, [
    auth.isLoading,
    auth.isAuthenticated,
    auth.activeNavigator,
    auth.user,
    auth,
  ]);

  useEffect(() => {
    const fetchAndSetUserDetails = async () => {
      if (auth.isAuthenticated) {
        const profile = auth.user?.profile;

        if (profile?.email) {
          try {
            await fetchUserDetails(profile.email); // Call the store's fetchUserDetails method
          } catch (error) {
            console.error("Error fetching user details:", error);
          }
        } else {
          console.warn("No email found in profile.");
        }
      } else {
        clearUserDetails();
      }
    };

    fetchAndSetUserDetails();
  }, [auth.isAuthenticated, auth.user, fetchUserDetails, clearUserDetails]);

  return <>{children}</>;
};

const MyApp: React.FC<AppProps> = ({ Component, pageProps }: AppProps) => {
  const [isInitialized, setIsInitialized] = useState(false);

  if (!cognitoAuthConfig.redirect_uri) {
    console.error("Redirect URI is not set!");
  }

  useEffect(() => {
    setIsInitialized(true);
  }, []);

  if (!isInitialized) {
    return (
      <div
        className="font-score"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--bone-dim)",
          letterSpacing: "0.24em",
        }}
      >
        POLISHING THE TROPHY…
      </div>
    );
  }

  return (
    <ThemeProvider theme={botaTheme}>
      <AuthProvider {...cognitoAuthConfig}>
        <UserInitializer>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </UserInitializer>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default MyApp;
