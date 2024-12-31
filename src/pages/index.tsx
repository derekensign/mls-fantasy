import React from "react";
import { useAuth } from "react-oidc-context";

export default function HomePage() {
  const auth = useAuth();

  const handleSignIn = async () => {
    try {
      console.log("Starting signinRedirect...");
      await auth.signinRedirect();
      console.log("signinRedirect completed.");
    } catch (error) {
      console.error("Error during signinRedirect:", error);
    }
    console.log("Sign-in complete.");
  };

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    console.error(auth.error);
    return <div>Error: {auth.error.message}</div>;
  }

  if (auth.isAuthenticated) {
    console.log("auth", auth);
    return (
      <div>
        <pre> Hello: {auth.user?.profile.email} </pre>
        <pre> ID Token: {auth.user?.id_token} </pre>
        <pre> Access Token: {auth.user?.access_token} </pre>
        <pre> Refresh Token: {auth.user?.refresh_token} </pre>
        <button onClick={() => auth.removeUser()}>Sign out</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Welcome to MLS Fantasy</h1>
      <button onClick={() => auth.signinRedirect()}>Sign in</button>
    </div>
  );
}
