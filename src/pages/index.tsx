import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/router";
import { fetchUserDetails } from "../../backend/API";

function TeamHome() {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTeamData = async () => {
      if (auth.isAuthenticated && auth.user?.profile.email) {
        setLoading(true);
        try {
          const response = await fetch(
            "https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod/get-my-team",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ email: auth.user.profile.email }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            router.push({
              pathname: "/MyTeam",
              query: { teamData: JSON.stringify(data) },
            });
          } else {
            console.error("Failed to fetch team data:", await response.text());
          }
        } catch (error) {
          console.error("Error fetching team data:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    if (auth.isAuthenticated) {
      fetchTeamData();
      // fetchUserDetails(auth.user?.profile.email);
    }
  }, [auth.isAuthenticated, auth.user?.profile.email, router]);

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

  return <div>Welcome to your team page!</div>;
}

export default TeamHome;
