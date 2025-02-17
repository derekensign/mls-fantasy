import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/router";
import { Box, Typography, Button } from "@mui/material";

function TeamHome() {
  const auth = useAuth();
  const router = useRouter();
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    if (auth.isAuthenticated) {
      router.push("/MyTeam");
    }
  }, [auth.isAuthenticated, router]);

  const defaultBoxStyles = {
    p: 4,
    backgroundColor: "black",
    borderRadius: 2,
    boxShadow: 3,
    textAlign: "center",
    color: "white",
    maxWidth: "600px",
    mx: "auto", // centers horizontally
  };

  // Common button style using our gold color
  const buttonStyle = {
    mt: 1,
    mb: 1,
    borderColor: "#B8860B",
    color: "#B8860B",
    "&:hover": { backgroundColor: "#B8860B", color: "black" },
  };

  if (auth.isLoading) {
    return (
      <Box sx={defaultBoxStyles}>
        <Typography variant="h5">Loading authentication...</Typography>
      </Box>
    );
  }

  if (auth.error) {
    return (
      <Box sx={defaultBoxStyles}>
        <Typography variant="h5">Error: {auth.error.message}</Typography>
      </Box>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <Box sx={defaultBoxStyles}>
        <Typography variant="h3">Welcome to MLS Fantasy</Typography>
        <Typography variant="h6">
          If you already have an account, sign in to view your team standings.
        </Typography>
        <Button
          variant="outlined"
          onClick={() =>
            (window.location.href = process.env.NEXT_PUBLIC_COGNITO_SIGNIN_URL!)
          }
          sx={buttonStyle}
        >
          Sign In
        </Button>
        <Typography variant="body1">or</Typography>
        <Button
          variant="outlined"
          onClick={() => {
            const signupUrl = process.env.NEXT_PUBLIC_COGNITO_SIGNUP_URL;
            if (signupUrl) {
              window.location.href = signupUrl;
            } else {
              console.error("NEXT_PUBLIC_COGNITO_SIGNUP_URL is not defined");
            }
          }}
          sx={buttonStyle}
        >
          Sign Up
        </Button>
        <Box sx={{ borderTop: "1px solid white", pt: 1, mt: 2 }}>
          <Typography variant="h5">Getting Started</Typography>
          <Typography variant="body1">1. Create an account.</Typography>
          <Typography variant="body1">2. Join or create a league.</Typography>
          <Typography variant="body1">
            Follow these steps to start playing!
          </Typography>
        </Box>
      </Box>
    );
  }

  if (loadingTeam) {
    return (
      <Box sx={defaultBoxStyles}>
        <Typography variant="h5">Loading team data...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={defaultBoxStyles}>
      <Typography variant="h5">Redirecting to your team page...</Typography>
    </Box>
  );
}

export default TeamHome;
