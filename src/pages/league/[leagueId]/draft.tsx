import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import {
  fetchPlayers2024,
  getDraftSettings,
  draftPlayer,
  fetchFantasyPlayersByLeague,
  fetchDraftedPlayers,
} from "../../../backend/API";
import useUserStore from "@/stores/useUserStore";
import {
  Player,
  DraftInfo,
  FantasyPlayer,
  DraftedPlayer,
} from "../../../types/DraftTypes";
import DraftAvailablePlayersTable from "../../../components/DraftAvailablePlayersTable";
import DraftedPlayersTable from "../../../components/DraftedPlayersTable";
import DraftedTableDrawer from "../../../components/DraftedTableDrawer";
import Button from "@mui/material/Button";
import { Container, Paper, Typography, Box } from "@mui/material";

const LeagueDraftPage: React.FC<{ leagueId: string }> = ({
  leagueId: leagueIdProp,
}) => {
  const router = useRouter();
  const { leagueId } = router.query;
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftInfo, setDraftInfo] = useState<DraftInfo | null>(null);
  const [timer, setTimer] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [round, setRound] = useState<number>(1);
  const [userSessionJoined, setUserSessionJoined] = useState<boolean>(false);
  const [draftDrawerOpen, setDraftDrawerOpen] = useState<boolean>(false);
  const [fantasyPlayers, setFantasyPlayers] = useState<FantasyPlayer[]>([]);
  const [activeParticipants, setActiveParticipants] = useState<string[]>([]);
  const [hasJoinedSession, setHasJoinedSession] = useState<boolean>(false);
  const [drafting, setDrafting] = useState<boolean>(false);
  const [draftedPlayers, setDraftedPlayers] = useState<DraftedPlayer[]>([]);

  const { userDetails } = useUserStore();
  const userFantasyPlayerId = userDetails?.FantasyPlayerId?.toString();
  const userIsAdmin = true; // TODO: Add this to the user details.

  // Load fantasy players (to translate team IDs into names)
  useEffect(() => {
    if (leagueId) {
      const loadFantasyPlayers = async () => {
        try {
          const data = await fetchFantasyPlayersByLeague(String(leagueId));
          console.log("fantasy players", data);
          setFantasyPlayers(data);
        } catch (error) {
          console.error("Error fetching fantasy players:", error);
        }
      };
      loadFantasyPlayers();
    }
  }, [leagueId]);

  // Keep a ref to always have the latest players (for auto-pick)
  const playersRef = useRef<Player[]>([]);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // Load players and draft info
  useEffect(() => {
    if (leagueId) {
      const loadDraftData = async () => {
        setLoading(true);
        try {
          const rawData = await fetchPlayers2024();
          const formattedPlayers: Player[] = rawData.map((item: any) => ({
            id: item.id.S,
            name: item.name.S,
            team: item.team.S,
            goals_2024: parseInt(item.goals_2024.N, 10),
            draftedBy: item.draftedBy?.S || null,
          }));
          setPlayers(formattedPlayers);

          const draftData = await getDraftSettings(String(leagueId));
          // Transform drafted_players from string[] to { player_id, team_drafted_by, draft_time }[]
          const fixedDraftData: DraftInfo = {
            ...(draftData || {}),
            league_id: draftData?.league_id || "",
            draft_status: draftData?.draft_status || "",
            draftOrder: draftData?.draftOrder || [],
            drafted_players: (draftData?.drafted_players || []).map(
              (playerId: string) => ({
                player_id: Number(playerId),
                team_drafted_by: "",
                draft_time: "",
              })
            ),
            current_turn_team: draftData?.draftOrder[0] || "",
            draftStartTime: draftData?.draftStartTime || "",
            numberOfRounds: draftData?.numberOfRounds || 5,
            activeParticipants: draftData?.activeParticipants || [],
          };
          console.log("draft data", fixedDraftData);
          setDraftInfo(fixedDraftData);
          const draftedPlayersData = await fetchDraftedPlayers(
            String(leagueId)
          );
          setDraftedPlayers(draftedPlayersData);
          console.log("drafted players", draftedPlayersData);
          setTimer(0);
        } catch (error) {
          console.error("Error loading draft data:", error);
        } finally {
          setLoading(false);
        }
      };
      loadDraftData();
    }
  }, [leagueId]);

  // -----------------------
  // Computed Derived Values
  // -----------------------
  const totalTeams =
    draftInfo?.draftOrder?.length || fantasyPlayers.length || 1;
  const totalRounds = draftInfo?.numberOfRounds || 5;
  const totalPicks = totalTeams * totalRounds;
  const overallPickNumber = (draftedPlayers.length ?? 0) + 1;
  const draftOver = draftedPlayers.length >= totalPicks;
  const computedRound = Math.floor((overallPickNumber - 1) / totalTeams) + 1;

  const currentTeamFantasy = fantasyPlayers.find(
    (fp) => fp.FantasyPlayerId.toString() === draftInfo?.current_turn_team
  );
  const currentTeamName = currentTeamFantasy
    ? currentTeamFantasy.TeamName
    : draftInfo?.current_turn_team;

  // ------------------------------
  // Timer Update Logic (useEffect)
  // ------------------------------
  // Make sure this useEffect comes after the computed values are declared.
  const handleAutoDraft = useCallback(async () => {
    if (!draftInfo || draftOver) return;
    const availablePlayers = playersRef.current.filter(
      (p) =>
        !draftedPlayers.some((drafted) => drafted.player_id === p.id.toString())
    );
    if (availablePlayers.length === 0) return;
    const sorted = availablePlayers.sort((a, b) => b.goals_2024 - a.goals_2024);
    const nextPlayer = sorted[0];
    if (!nextPlayer) return;

    try {
      await draftPlayer(
        String(leagueId),
        String(nextPlayer.id),
        draftInfo.current_turn_team
      );
      const draftedPlayersData = await fetchDraftedPlayers(String(leagueId));
      setDraftedPlayers(draftedPlayersData);
      console.log("drafted players", draftedPlayersData);
      nextTurn(draftInfo.current_turn_team);
    } catch (error) {
      console.error("Auto-draft error:", error);
    }
  }, [draftInfo, leagueId, nextTurn, draftedPlayers, draftOver]);

  useEffect(() => {
    let timeoutId: number | null = null;

    const updateTimer = () => {
      const storedDeadline = localStorage.getItem("draftTimerDeadline");
      if (!storedDeadline) {
        setTimer(0);
        return;
      }
      const deadline = new Date(storedDeadline);
      const now = new Date();
      const remainingMs = deadline.getTime() - now.getTime();

      if (remainingMs <= 0) {
        localStorage.removeItem("draftTimerDeadline");
        setTimer(0);
        if (!draftOver) {
          handleAutoDraft();
        }
        return;
      }

      const remainingSeconds = Math.floor(remainingMs / 1000);
      setTimer(remainingSeconds);

      // Calculate delay until the next full second.
      const delay = remainingMs - remainingSeconds * 1000 || 1;
      timeoutId = window.setTimeout(updateTimer, delay);
    };

    updateTimer();

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [draftOver, handleAutoDraft]);

  const startTimer = (seconds: number) => {
    const deadline = new Date(Date.now() + seconds * 1000);
    localStorage.setItem("draftTimerDeadline", deadline.toISOString());
    setTimer(seconds);
  };

  // Define nextTurn before using it in any dependency arrays.
  const nextTurn = useCallback(
    (currentTeam: string) => {
      if (!draftInfo) return;
      const now = new Date();
      const startTime = new Date(draftInfo.draftStartTime);
      if (now < startTime) {
        console.warn("Draft has not started yet.");
        return;
      }
      const isOddRound = round % 2 === 1;
      const order = isOddRound
        ? draftInfo.draftOrder
        : [...draftInfo.draftOrder].reverse();
      const currentIndex = order.indexOf(currentTeam);
      let nextTeam: string;
      let newRound = round;
      if (currentIndex === order.length - 1) {
        newRound = round + 1;
        if (draftInfo.maxRounds && newRound > draftInfo.maxRounds) {
          setDraftInfo((prev) =>
            prev ? { ...prev, sessionEnded: true } : prev
          );
          return;
        }
        const nextOrder =
          newRound % 2 === 1
            ? draftInfo.draftOrder
            : [...draftInfo.draftOrder].reverse();
        nextTeam = nextOrder[0];
      } else {
        nextTeam = order[currentIndex + 1];
      }
      setRound(newRound);
      setDraftInfo((prev) =>
        prev ? { ...prev, current_turn_team: nextTeam } : prev
      );
      startTimer(10);
    },
    [draftInfo, round]
  );

  useEffect(() => {
    // Your effect code that uses nextTurn...
  }, [draftInfo, leagueId, nextTurn, draftedPlayers, draftOver]);

  // Polling active participants every 10 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (leagueId) {
        try {
          const draftData: DraftInfo | null = await getDraftSettings(
            String(leagueId)
          );
          const active = (draftData && draftData.activeParticipants) || [];
          setActiveParticipants(Array.from(new Set(active)));
        } catch (error) {
          console.error("Error fetching active participants:", error);
        }
      }
    }, 10000); // poll every 10 sec
    return () => clearInterval(interval);
  }, [leagueId]);

  return (
    <Container
      maxWidth="xl"
      sx={{
        backgroundColor: "black",
        minHeight: "100vh",
        py: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div className="relative flex flex-col items-center p-4 bg-black shadow-xl h-screen">
        <h1 className="text-3xl font-bold text-[#B8860B] mb-6">
          Draft Players - 2024
        </h1>

        <>
          <div className="mb-4 text-white">
            {draftInfo && (
              <>
                {draftOver ? (
                  <h2 className="text-3xl font-bold">Draft is Over</h2>
                ) : (
                  <>
                    <p>
                      <strong>Current Turn:</strong> {currentTeamName}
                    </p>
                    <p>
                      <strong>Timer:</strong> {timer} seconds
                    </p>
                    <p>
                      <strong>Round:</strong> {computedRound}
                    </p>
                    <p>
                      <strong>Overall Pick #:</strong> {overallPickNumber}
                    </p>
                  </>
                )}
              </>
            )}
          </div>
          {loading ? (
            <div className="flex justify-center items-center mt-10">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-gray-300"></div>
            </div>
          ) : (
            <>
              {draftOver ? (
                // Draft is over: render only the drafted players table
                <DraftedPlayersTable
                  players={players}
                  draftInfo={draftInfo}
                  fantasyPlayers={fantasyPlayers}
                  draftedPlayers={draftedPlayers}
                />
              ) : (
                <>
                  <div className="w-full flex flex-col lg:flex-row gap-4">
                    <div className="w-full lg:w-3/5">
                      <DraftAvailablePlayersTable
                        players={players}
                        handleDraft={/* your handleDraft function */}
                        draftInfo={draftInfo}
                        userFantasyPlayerId={userFantasyPlayerId || ""}
                        timer={timer}
                        fantasyPlayers={fantasyPlayers}
                        draftedPlayers={draftedPlayers}
                      />
                    </div>
                    <div className="hidden lg:block lg:w-2/5">
                      <DraftedPlayersTable
                        players={players}
                        draftInfo={draftInfo}
                        fantasyPlayers={fantasyPlayers}
                        draftedPlayers={draftedPlayers}
                      />
                    </div>
                  </div>
                  <div className="lg:hidden fixed bottom-4 right-4 z-50">
                    <Button
                      variant="contained"
                      onClick={() => setDraftDrawerOpen(true)}
                      sx={{
                        backgroundColor: "#B8860B !important",
                        color: "#000",
                        "&:hover": { backgroundColor: "#a07807" },
                        fontWeight: "bold",
                        paddingX: 2,
                        paddingY: 1,
                      }}
                    >
                      Show Drafted Players
                    </Button>
                  </div>
                  <div className={draftDrawerOpen ? "" : "inert-container"}>
                    <DraftedTableDrawer
                      open={draftDrawerOpen}
                      onClose={() => setDraftDrawerOpen(false)}
                      players={players}
                      draftInfo={draftInfo}
                      fantasyPlayers={fantasyPlayers}
                      draftedPlayers={draftedPlayers}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </>
      </div>
    </Container>
  );
};

export default LeagueDraftPage;
