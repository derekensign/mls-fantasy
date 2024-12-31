import React from "react";
import { useAuth } from "react-oidc-context";
import GoldenBootTable from "../components/GoldenBootTable";

export default function TeamHome() {
  const auth = useAuth();

  // Handlers for login and logout
  const handleLogin = () => auth.signinRedirect();
  const handleLogout = () => auth.signoutRedirect();

  return (
    <div>
      <header>
        {/* Display login/logout based on authentication status */}
        {auth.isAuthenticated ? (
          <div>
            <p>Welcome, {auth.user?.profile.email}</p>
            <button onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <button onClick={handleLogin}>Login</button>
        )}
      </header>

      {/* Render the GoldenBootTable only for authenticated users */}
      {auth.isAuthenticated ? (
        <div>
          <GoldenBootTable />
        </div>
      ) : (
        <p>Please log in to view your team&#39;s standings.</p>
      )}
    </div>
  );
}
