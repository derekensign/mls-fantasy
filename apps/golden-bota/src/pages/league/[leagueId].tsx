import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import LeagueSettings from "../../components/LeagueSettings";
import DraftSettings from "../../components/DraftSettings";
import TransferWindowSettings from "../../components/TransferWindowSettings";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {
  joinDraftSession,
  getLeagueSettings,
  getDraftSettings,
} from "@mls-fantasy/api";

import useUserStore from "../../stores/useUserStore";
import { Box } from "@mui/material";

// Helper function to extract DynamoDB values
const extractValue = (value: any): any => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("S" in value) return value.S;
    if ("N" in value) return Number(value.N);
    if ("L" in value && Array.isArray(value.L))
      return value.L.map((item: any) => extractValue(item));
  }
  return value;
};

interface LeaguePageProps {
  leagueId: string;
  leagueName: string;
}

const LeaguePage: React.FC<LeaguePageProps> = ({ leagueId, leagueName }) => {
  const router = useRouter();
  const { userDetails } = useUserStore();
  const [leagueSettings, setLeagueSettings] = useState<any>(null);
  const [draftSettings, setDraftSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [leagueData, draftData] = await Promise.all([
          getLeagueSettings(leagueId),
          getDraftSettings(leagueId),
        ]);
        setLeagueSettings(leagueData);
        setDraftSettings(draftData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (leagueId) {
      fetchData();
    }
  }, [leagueId]);

  const handleJoinDraft = async () => {
    try {
      const userFantasyPlayerId =
        userDetails?.fantasyPlayerId?.toString() || "";
      await joinDraftSession(String(leagueId), userFantasyPlayerId);
      router.push(`/league/${leagueId}/draft`);
    } catch (error) {
      console.error("Error joining draft:", error);
    }
  };

  const handleGoToDraft = () => {
    router.push(`/league/${leagueId}/draft`);
  };

  const handleGoToTable = () => {
    router.push(`/league/${leagueId}/table`);
  };

  const handleGoToTransfer = () => {
    router.push(`/league/${leagueId}/transfer`);
  };

  if (loading) {
    return (
      <Container>
        <Typography variant="h4" component="h1" gutterBottom>
          Loading...
        </Typography>
      </Container>
    );
  }

  const userIsCommissioner =
    userDetails?.email === extractValue(leagueSettings?.commissioner);
  const draftStartTime = extractValue(draftSettings?.draftStartTime);

  // Debug logging
  console.log("🔍 Debug Commissioner Check:", {
    userEmail: userDetails?.email,
    leagueCommissioner: leagueSettings?.commissioner,
    extractedCommissioner: extractValue(leagueSettings?.commissioner),
    userIsCommissioner:
      userDetails?.email === extractValue(leagueSettings?.commissioner),
  });

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {leagueName}
      </Typography>

      {/* Draft Status Display */}
      <Box sx={{ mb: 4, p: 2, bgcolor: "background.paper", borderRadius: 1 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {draftSettings?.draft_status === "completed" && draftSettings?.draftStartTime
            ? `Draft completed on: ${new Date(draftSettings.draftStartTime).toLocaleString()}`
            : draftSettings?.draft_status === "in_progress"
            ? "Draft in progress..."
            : draftSettings?.draftStartTime
            ? `Draft scheduled for: ${new Date(draftSettings.draftStartTime).toLocaleString()}`
            : "Draft not yet scheduled"}
        </Typography>

        {/* Draft Room Buttons */}
        {draftSettings?.draft_status === "in_progress" && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleJoinDraft}
            sx={{ mr: 2 }}
          >
            Join Draft
          </Button>
        )}
        {draftSettings?.draftStartTime && draftSettings?.draft_status !== "in_progress" && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleGoToDraft}
          >
            {draftSettings?.draft_status === "completed" ? "View Draft Results" : "Enter Draft Room"}
          </Button>
        )}
      </Box>

      {/* Commissioner Settings */}
      {userIsCommissioner ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <LeagueSettings
            leagueId={leagueId}
            currentDraftStartTime={draftStartTime}
            onDraftTimeUpdated={(newTime) => {
              setDraftSettings((prev: any) => ({
                ...prev,
                draftStartTime: newTime,
              }));
            }}
          />
          <DraftSettings leagueId={leagueId} draftSettings={draftSettings} />
          <TransferWindowSettings
            leagueId={leagueId}
            draftSettings={draftSettings}
          />
        </Box>
      ) : (
        <Typography variant="body1">
          Only the league commissioner can modify settings.
        </Typography>
      )}
    </Container>
  );
};

export async function getServerSideProps({
  params,
}: {
  params: { leagueId: string };
}) {
  const { leagueId } = params;

  try {
    const leagueData = await getLeagueSettings(leagueId);
    const extractedLeagueName = extractValue(leagueData?.leagueName);
    return {
      props: {
        leagueId,
        leagueName: extractedLeagueName || `League ${leagueId}`,
      },
    };
  } catch (error) {
    console.error("Error fetching league data:", error);
    return {
      props: {
        leagueId,
        leagueName: `League ${leagueId}`,
      },
    };
  }
}

export default LeaguePage;
