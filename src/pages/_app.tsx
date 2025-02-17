import React, { useEffect, ReactNode } from "react";
import type { AppProps } from "next/app";
import { AuthProvider, useAuth } from "react-oidc-context";
import Layout from "@/components/Layout";
import useUserStore from "@/stores/useUserStore"; // Import the user store
import "../styles/globals.css";
import "../styles/tailwind.css";
import { COGNITO_CONFIG } from "../config/authConfig";

// Define Cognito Auth Config with proper types
const cognitoAuthConfig = {
  authority: COGNITO_CONFIG.cognitoDomain,
  client_id: COGNITO_CONFIG.clientId,
  redirect_uri: COGNITO_CONFIG.redirectUri,
  response_type: "code",
  scope: "phone openid email",
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
      console.log("Auth state:", auth.isAuthenticated, auth.user);

      if (auth.isAuthenticated) {
        const profile = auth.user?.profile;
        console.log("Auth profile:", profile);

        if (profile?.email) {
          try {
            console.log("Fetching user details for email:", profile.email);
            await fetchUserDetails(profile.email); // Call the store's fetchUserDetails method
            console.log("User details successfully fetched.");
          } catch (error) {
            console.error("Error fetching user details:", error);
          }
        } else {
          console.warn("No email found in profile.");
        }
      } else {
        console.log("Clearing user details.");
        clearUserDetails();
      }
    };

    fetchAndSetUserDetails();
  }, [auth.isAuthenticated, auth.user, fetchUserDetails, clearUserDetails]);

  return <>{children}</>;
};

const MyApp: React.FC<AppProps> = ({ Component, pageProps }: AppProps) => {
  if (!cognitoAuthConfig.redirect_uri) {
    console.error("Redirect URI is not set!");
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
