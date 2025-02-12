import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import LeagueSettings from "../../components/LeagueSettings";
import DraftSettings from "../../components/DraftSettings";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { joinDraftSession } from "../../backend/API";
import useUserStore from "@/stores/useUserStore";

interface LeaguePageProps {
  leagueId: string;
}

const LeaguePage: React.FC<LeaguePageProps> = ({ leagueId }) => {
  const router = useRouter();
  const { userDetails } = useUserStore();
  const userFantasyPlayerId = userDetails?.FantasyPlayerId?.toString();
  const [hasJoined, setHasJoined] = useState<boolean>(false);

  const handleJoin = async () => {
    try {
      //   await joinDraftSession(leagueId, userFantasyPlayerId || "");
      setHasJoined(true);
      router.push(`/league/${leagueId}/draft`);
    } catch (error) {
      console.error("Error joining draft session:", error);
      alert("Failed to join draft session.");
    }
  };

  return (
    <Container
      maxWidth="md"
      className="py-4 bf-black"
      sx={{ minHeight: "100vh" }}
    >
      {/* Render the Draft Session header at the top */}

      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        align="center"
        sx={{ color: "white" }}
      >
        League {leagueId} Settings
      </Typography>

      {/* New JOIN DRAFT NOW button moved to the league page with join functionality */}
      {!hasJoined && (
        <Button
          variant="contained"
          fullWidth
          sx={{
            backgroundColor: "#FFD700 !important",
            color: "black !important",
            fontWeight: "bold",
            fontSize: "1.2rem",
            padding: "1rem",
            marginBottom: "1rem",
            animation: "shimmer 2s infinite",
          }}
          onClick={handleJoin}
        >
          JOIN DRAFT NOW
        </Button>
      )}

      {/* League Settings Section */}
      <div style={{ marginBottom: "2rem" }}>
        <Typography variant="h5" sx={{ color: "white", marginBottom: "1rem" }}>
          League Settings
        </Typography>
        <LeagueSettings leagueId={leagueId} />
      </div>

      {/* Draft Settings Section */}
      <div>
        <Typography variant="h5" sx={{ color: "white", marginBottom: "1rem" }}>
          Draft Settings
        </Typography>
        <DraftSettings leagueId={leagueId} />
      </div>
    </Container>
  );
};

export default LeaguePage;

export async function getStaticPaths() {
  return {
    paths: [], // if you have known league IDs, list them here; otherwise, use fallback
    fallback: "blocking",
  };
}

export async function getStaticProps({
  params,
}: {
  params: { leagueId: string };
}) {
  return {
    props: {
      leagueId: params.leagueId,
    },
  };
}
