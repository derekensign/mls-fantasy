import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import LeagueSettings from "../../components/LeagueSettings";
import DraftSettings from "../../components/DraftSettings";
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

interface LeaguePageProps {
  leagueId: string;
  leagueName: string;
  draftSettings: any; // Update with a proper type if available
  commissionerEmail: string;
}

const LeaguePage: React.FC<LeaguePageProps> = ({
  leagueId,
  leagueName,
  draftSettings,
  commissionerEmail,
}) => {
  const router = useRouter();
  const { userDetails } = useUserStore();
  const userFantasyPlayerId = userDetails?.FantasyPlayerId?.toString();
  const [hasJoined, setHasJoined] = useState<boolean>(false);
  const [draftStartTime, setDraftStartTime] = useState<Date | null>(null);

  const userIsCommissioner = userDetails?.email === commissionerEmail;

  useEffect(() => {
    if (draftSettings?.draftStartTime) {
      setDraftStartTime(new Date(draftSettings.draftStartTime));
    }
  }, [draftSettings]);

  const currentTime = new Date();

  const handleJoin = async () => {
    try {
      await joinDraftSession(leagueId, userFantasyPlayerId || "");
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
      {/* Render league header using the leagueName */}

      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        align="center"
        sx={{ color: "white" }}
      >
        {leagueName} Settings
      </Typography>

      {/* JOIN DRAFT NOW button */}
      {!hasJoined && (
        <Box sx={{ mt: 4, textAlign: "center" }}>
          {draftStartTime ? (
            currentTime >= draftStartTime ? (
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
            ) : (
              <Typography variant="h6" sx={{ color: "white" }}>
                Draft will start at: {draftStartTime.toLocaleString()}
              </Typography>
            )
          ) : (
            <Typography variant="h6" sx={{ color: "white" }}>
              Draft time not set.
            </Typography>
          )}
        </Box>
      )}

      {/* League Settings Section */}
      <div className="mb-4">
        {userIsCommissioner ? (
          <LeagueSettings
            leagueId={String(leagueId)}
            currentDraftStartTime={draftSettings?.draftStartTime}
            onDraftTimeUpdated={(newTime) =>
              setDraftStartTime(newTime ? new Date(newTime) : null)
            }
          />
        ) : (
          <div className="text-white">
            {draftSettings && draftSettings.draftStartTime ? (
              <p>
                Draft starts at:{" "}
                {new Date(draftSettings.draftStartTime).toLocaleString()}
              </p>
            ) : (
              <p>Draft time not scheduled.</p>
            )}
          </div>
        )}
      </div>

      {/* Draft Settings Section: Render only if the user is the commissioner */}
      {userIsCommissioner && (
        <div>
          <Typography
            variant="h5"
            sx={{ color: "white", marginBottom: "1rem" }}
          >
            Draft Settings
          </Typography>
          <DraftSettings leagueId={leagueId} draftSettings={draftSettings} />
        </div>
      )}
    </Container>
  );
};

export default LeaguePage;

/**
 * Helper function to extract values if league settings come in a DynamoDB-like format.
 */
function extractValue(value: any): any {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("S" in value) return value.S;
    if ("N" in value) return Number(value.N);
    if ("L" in value && Array.isArray(value.L))
      return value.L.map(extractValue);
  }
  return value;
}

export async function getStaticPaths() {
  return {
    paths: [], // List known league IDs here if available; otherwise, fallback to blocking
    fallback: "blocking",
  };
}

export async function getStaticProps({
  params,
}: {
  params: { leagueId: string };
}) {
  const leagueId = params.leagueId;
  let leagueName = leagueId; // Fallback to leagueId if no league name is found
  let commissionerEmail = "";
  let settings = null;
  try {
    settings = await getLeagueSettings(leagueId);
    if (settings && settings.leagueName) {
      leagueName =
        typeof settings.leagueName === "object"
          ? extractValue(settings.leagueName)
          : settings.leagueName;
    }
    commissionerEmail =
      settings && settings.commissioner
        ? extractValue(settings.commissioner)
        : "";
  } catch (error) {
    console.error("Failed to load league settings", error);
  }
  let draftSettings = null;
  try {
    draftSettings = await getDraftSettings(leagueId);
  } catch (error) {
    console.error("Failed to load draft settings", error);
  }

  return {
    props: {
      leagueId,
      leagueName,
      draftSettings,
      commissionerEmail,
    },
    // Revalidate this page every 60 seconds (adjust as needed)
    revalidate: 60,
  };
}
