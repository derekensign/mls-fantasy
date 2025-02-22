import React, { useEffect, useState, ReactNode } from "react";
import type { AppProps } from "next/app";
import { AuthProvider, useAuth } from "react-oidc-context";
import Layout from "../components/Layout";
import useUserStore from "../stores/useUserStore"; // Import the user store
import "../styles/globals.css";
import "../styles/tailwind.css";
import { COGNITO_CONFIG } from "../config/authConfig";

// Define Cognito Auth Config with proper types
const cognitoAuthConfig = {
  authority: COGNITO_CONFIG.cognitoDomain, // Issuer URL for discovery
  client_id: COGNITO_CONFIG.clientId,
  redirect_uri: COGNITO_CONFIG.redirectUri,
  response_type: "code",
  scope: "phone openid email",
  metadata: {
    // Override to use your Hosted UI endpoints:
    authorization_endpoint:
      "https://us-east-1d6opuwwml.auth.us-east-1.amazoncognito.com/login",
    token_endpoint:
      "https://us-east-1d6opuwwml.auth.us-east-1.amazoncognito.com/oauth2/token",
    userinfo_endpoint:
      "https://us-east-1d6opuwwml.auth.us-east-1.amazoncognito.com/oauth2/userInfo",
  },
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
