import React, { useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/router";
import useUserStore from "@/stores/useUserStore";
import {
  Container,
  Box,
  Tabs,
  Tab,
  Typography,
  TextField,
  Button,
} from "@mui/material";
import SearchableLeagueList, {
  LeagueSetting,
} from "../../components/SearchableLeagueList";
import { createLeague, joinLeague } from "@/backend/API";

function JoinLeagueContent() {
  const [selectedLeague, setSelectedLeague] = useState<LeagueSetting | null>(
    null
  );
  const { userDetails } = useUserStore();
  const router = useRouter();

  const handleLeagueSelect = (league: LeagueSetting | null) => {
    setSelectedLeague(league);
    console.log("Selected league: ", league);
  };

  const handleJoinLeague = async () => {
    if (selectedLeague) {
      if (!userDetails) {
        console.warn("User details not available");
        return;
      }
      try {
        console.log("Joining league:", selectedLeague);
        const result = await joinLeague(
          selectedLeague.leagueId,
          userDetails.FantasyPlayerId
        );
        console.log("Joined league successfully:", result);
        // Redirect to /league/{leagueId}
        router.push(`/league/${selectedLeague.leagueId}`);
      } catch (error) {
        console.error("Error joining league:", error);
      }
    } else {
      console.warn("No league selected");
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h5" align="center" gutterBottom color="white">
        Join a League
      </Typography>
      <SearchableLeagueList onSelect={handleLeagueSelect} />
      <Button
        variant="outlined"
        fullWidth
        onClick={handleJoinLeague}
        disabled={!selectedLeague}
        sx={{
          mt: 2,
          borderColor: "#B8860B",
          color: "#B8860B",
          "&:hover": { backgroundColor: "gold", color: "black" },
        }}
      >
        Join League
      </Button>
    </Box>
  );
}

function CreateLeagueContent() {
  const [leagueName, setLeagueName] = useState("");
  const { userDetails } = useUserStore();
  const router = useRouter();

  const handleCreateLeague = async () => {
    console.log("Create League button clicked.");
    console.log("leagueName:", leagueName);
    console.log("userDetails:", userDetails);

    if (!leagueName) {
      console.warn("League name is empty");
      return;
    }
    if (!userDetails) {
      console.warn("User details not available");
      return;
    }
    try {
      console.log("Calling createLeague API with:", {
        leagueName,
        fantasyPlayerId: userDetails.FantasyPlayerId.toString(),
        commissionerEmail: userDetails.email,
      });
      const response = await createLeague({
        leagueName,
        fantasyPlayerId: userDetails.FantasyPlayerId.toString(),
        commissionerEmail: userDetails.email,
      });
      console.log("League created successfully with id:", response.leagueId);
      // Redirect to /league/{leagueId}
      router.push(`/league/${response.leagueId}`);
    } catch (error) {
      console.error("Error creating league:", error);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h5" align="center" gutterBottom color="white">
        Create a League
      </Typography>
      <TextField
        label="League Name"
        variant="outlined"
        fullWidth
        value={leagueName}
        onChange={(e) => setLeagueName(e.target.value)}
        sx={{
          mb: 2,
          backgroundColor: "#B8860B",
          borderRadius: 1,
          "& .MuiOutlinedInput-root": {
            "& fieldset": { borderColor: "#B8860B" },
            "&:hover fieldset": { borderColor: "#B8860B" },
            "&.Mui-focused fieldset": { borderColor: "#B8860B" },
          },
          "& input": { color: "black" },
          "& label": { color: "black" },
        }}
      />
      <Button
        variant="outlined"
        fullWidth
        onClick={handleCreateLeague}
        sx={{
          borderColor: "#B8860B",
          color: "#B8860B",
          "&:hover": { backgroundColor: "gold", color: "black" },
        }}
      >
        Create League
      </Button>
    </Box>
  );
}

function LeagueTabsContent() {
  const [tabIndex, setTabIndex] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newIndex: number) => {
    setTabIndex(newIndex);
  };

  return (
    <Box
      sx={{
        bgcolor: "black",
        p: 4,
        borderRadius: 2,
        boxShadow: 3,
        color: "white",
        maxWidth: "600px",
        mx: "auto",
      }}
    >
      <Tabs
        value={tabIndex}
        onChange={handleTabChange}
        variant="fullWidth"
        textColor="inherit"
        indicatorColor="secondary"
      >
        <Tab label="Join League" />
        <Tab label="Create League" />
      </Tabs>
      {tabIndex === 0 ? <JoinLeagueContent /> : <CreateLeagueContent />}
    </Box>
  );
}

function LeaguePage() {
  const auth = useAuth();
  const router = useRouter();
  const { userDetails } = useUserStore();

  console.log("userDetails:", userDetails);
  const leagueId = userDetails?.LeagueId;

  // Local state to ensure client-side rendering
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // If authenticated and a LeagueId exists, redirect automatically.
  useEffect(() => {
    if (!mounted) return;

    if (auth.isAuthenticated && userDetails?.LeagueId) {
      router.push(`/league/${userDetails?.LeagueId}`);
    }
  }, [mounted, auth.isAuthenticated, userDetails, router]);

  if (!mounted || auth.isLoading) {
    return (
      <Container>
        <Typography variant="h5">Loading...</Typography>
      </Container>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <Container>
        <Typography variant="h5" align="center" sx={{ mt: 4 }}>
          Please sign in to access leagues.
        </Typography>
      </Container>
    );
  }

  if (leagueId) return null;

  return (
    <Container>
      <LeagueTabsContent />
    </Container>
  );
}

export default LeaguePage;
