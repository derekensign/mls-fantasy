import React, { useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/router";
import useUserStore from "../../stores/useUserStore";
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
import { createLeague, joinLeague } from "@mls-fantasy/api";

function JoinLeagueContent() {
  const [selectedLeague, setSelectedLeague] = useState<LeagueSetting | null>(
    null
  );
  const { userDetails } = useUserStore();
  const router = useRouter();

  const handleLeagueSelect = (league: LeagueSetting | null) => {
    setSelectedLeague(league);
  };

  const handleJoinLeague = async () => {
    if (!selectedLeague || !userDetails) return;

    try {
      const result = await joinLeague(
        selectedLeague.leagueId,
        userDetails.FantasyPlayerId
      );
      alert("Successfully joined the league!");
      setSelectedLeague(null);
      // Redirect to /league/{leagueId}
      router.push(`/league/${selectedLeague.leagueId}`);
    } catch (error) {
      alert("Failed to join league. Please try again.");
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
    if (!leagueName.trim()) {
      alert("Please enter a league name");
      return;
    }

    if (!userDetails) {
      alert("User details not available");
      return;
    }

    try {
      const response = await createLeague({
        leagueName: leagueName.trim(),
        fantasyPlayerId: userDetails.FantasyPlayerId.toString(),
        commissionerEmail: userDetails.email,
      });

      alert(`League created successfully! League ID: ${response.leagueId}`);
      setLeagueName("");
      // Redirect to /league/{leagueId}
      router.push(`/league/${response.leagueId}`);
    } catch (error) {
      alert("Failed to create league. Please try again.");
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

  if (userDetails?.LeagueId) return null;

  return (
    <Container>
      <LeagueTabsContent />
    </Container>
  );
}

export default LeaguePage;
