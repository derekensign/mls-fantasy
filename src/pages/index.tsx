import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/router";

function TeamHome() {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.isAuthenticated) {
      router.push("/MyTeam");
    }
  }, [auth.isAuthenticated, router]);

  if (auth.isLoading) {
    return <div>Loading authentication...</div>;
  }

  if (auth.error) {
    return <div>Error: {auth.error.message}</div>;
  }

  if (!auth.isAuthenticated) {
    return (
      <div>
        <h1>Welcome to MLS Fantasy</h1>
        <p>Please log in to view your team standings.</p>
      </div>
    );
  }

  if (loading) {
    return <div>Loading team data...</div>;
  }

  return <div>Redirecting to your team page...</div>;
}

export default TeamHome;
