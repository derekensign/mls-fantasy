import React from "react";
import type { AppProps } from "next/app";
import { AuthProvider } from "react-oidc-context";
import "../styles/tailwind.css";

const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_D6OPuwWML",
  client_id: "7b2ljliksvl2pn7gadjrn90e1a",
  redirect_uri: "http://localhost:3000/auth",
  response_type: "code",
  scope: "phone openid email",
};

export default function MyApp({ Component, pageProps }: AppProps) {
  if (!cognitoAuthConfig.redirect_uri) {
    console.error("Redirect URI is not set!");
  }

  return (
    <AuthProvider {...cognitoAuthConfig}>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
