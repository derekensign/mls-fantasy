import React, { useEffect, useState, ReactNode } from "react";
import type { AppProps } from "next/app";
import { AuthProvider, useAuth } from "react-oidc-context";
import { WebStorageStateStore } from "oidc-client-ts";
import Layout from "../components/Layout";
import useUserStore from "../stores/useUserStore"; // Import the user store
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
    return <div>Loading...</div>;
  }

  return (
    <AuthProvider {...cognitoAuthConfig}>
      <UserInitializer>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </UserInitializer>
    </AuthProvider>
  );
};

export default MyApp;
