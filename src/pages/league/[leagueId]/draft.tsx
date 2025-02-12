import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import {
  fetchPlayers2024,
  fetchDraftData,
  draftPlayer,
  fetchFantasyPlayersByLeague,
  fetchActiveParticipants,
} from "../../../backend/API";
import useUserStore from "@/stores/useUserStore";
import { Player, DraftInfo, FantasyPlayer } from "../../../types/DraftTypes";
import DraftAvailablePlayersTable from "../../../components/DraftAvailablePlayersTable";
import DraftedPlayersTable from "../../../components/DraftedPlayersTable";
import DraftedTableDrawer from "../../../components/DraftedTableDrawer";
import Button from "@mui/material/Button";
import LeagueSettings from "../../../components/LeagueSettings";
import Drawer from "@mui/material/Drawer";

const LeagueDraftPage: React.FC<{ leagueId: string }> = ({
  leagueId: leagueIdProp,
}) => {
  const router = useRouter();
  const { leagueId } = router.query;
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftInfo, setDraftInfo] = useState<DraftInfo | null>(null);
  const [timer, setTimer] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(true);
  const [round, setRound] = useState<number>(1);
  const [userSessionJoined, setUserSessionJoined] = useState<boolean>(false);
  const [draftDrawerOpen, setDraftDrawerOpen] = useState<boolean>(false);
  const [fantasyPlayers, setFantasyPlayers] = useState<FantasyPlayer[]>([]);
  const [activeParticipants, setActiveParticipants] = useState<string[]>([]);
  const [hasJoinedSession, setHasJoinedSession] = useState<boolean>(false);

  const { userDetails } = useUserStore();
  const userFantasyPlayerId = userDetails?.FantasyPlayerId?.toString();
  const userIsAdmin = true; // TODO: Add this to the user details.

  // Load fantasy players (to translate team IDs into names)
  useEffect(() => {
    if (leagueId) {
      const loadFantasyPlayers = async () => {
        try {
          const data = await fetchFantasyPlayersByLeague(String(leagueId));
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

          const draftData = await fetchDraftData(String(leagueId));
          setDraftInfo(draftData);
          setTimer(30);
        } catch (error) {
          console.error("Error loading draft data:", error);
        } finally {
          setLoading(false);
        }
      };
      loadDraftData();
    }
  }, [leagueId]);

  // Compute current turn team name using fantasyPlayers data
  const currentTeamFantasy = fantasyPlayers.find(
    (fp) => fp.FantasyPlayerId.toString() === draftInfo?.current_turn_team
  );
  const currentTeamName = currentTeamFantasy
    ? currentTeamFantasy.TeamName
    : draftInfo?.current_turn_team;

  // Overall pick # is just the drafted count + 1
  const overallPickNumber = draftInfo
    ? draftInfo.drafted_players.length + 1
    : 1;

  // Compute the next turn using snake draft order.
  const nextTurn = useCallback(
    (currentTeam: string) => {
      if (!draftInfo) return;

      // Check if the draft has started: if current time is before draftStartTime, do nothing.
      const now = new Date();
      const startTime = new Date(draftInfo.draftStartTime);
      if (now < startTime) {
        console.warn("Draft has not started yet.");
        return;
      }

      const isOddRound = round % 2 === 1;
      const order = isOddRound
        ? draftInfo.draft_order
        : [...draftInfo.draft_order].reverse();
      const currentIndex = order.indexOf(currentTeam);
      let nextTeam: string;
      let newRound = round;
      if (currentIndex === order.length - 1) {
        newRound = round + 1;
        // Check if maximum rounds reached
        if (draftInfo.maxRounds && newRound > draftInfo.maxRounds) {
          setDraftInfo((prev) =>
            prev ? { ...prev, sessionEnded: true } : prev
          );
          console.info("Draft session ended after max rounds reached.");
          return; // Session has ended; you could display a message here.
        }
        const nextOrder =
          newRound % 2 === 1
            ? draftInfo.draft_order
            : [...draftInfo.draft_order].reverse();
        nextTeam = nextOrder[0];
      } else {
        nextTeam = order[currentIndex + 1];
      }
      setRound(newRound);
      setDraftInfo((prev) =>
        prev ? { ...prev, current_turn_team: nextTeam } : prev
      );
      setTimer(userFantasyPlayerId !== nextTeam ? 3 : 30);
    },
    [draftInfo, round, userFantasyPlayerId]
  );

  const handleAutoDraft = useCallback(async () => {
    if (!draftInfo) return;
    const availablePlayers = playersRef.current.filter((p) => !p.draftedBy);
    if (availablePlayers.length === 0) return;
    const sorted = [...availablePlayers].sort(
      (a, b) => b.goals_2024 - a.goals_2024
    );
    const nextPlayer = sorted[0];
    if (!nextPlayer) return;
    try {
      await draftPlayer(
        String(leagueId),
        String(nextPlayer.id),
        draftInfo.current_turn_team
      );
      setPlayers((prevPlayers) =>
        prevPlayers.map((p) =>
          p.id === nextPlayer.id
            ? { ...p, draftedBy: draftInfo.current_turn_team }
            : p
        )
      );
      setDraftInfo((prev) =>
        prev
          ? {
              ...prev,
              drafted_players: [
                ...prev.drafted_players,
                {
                  player_id: nextPlayer.id,
                  team_drafted_by: draftInfo.current_turn_team,
                  draft_time: new Date().toISOString(),
                },
              ],
            }
          : null
      );
      nextTurn(draftInfo.current_turn_team);
    } catch (error) {
      console.error("Auto-draft error:", error);
    }
  }, [draftInfo, leagueId, nextTurn]);

  const handleDraft = async (player: Player) => {
    if (!draftInfo) {
      alert("Draft info not loaded yet.");
      return;
    }

    // Prevent drafting if the draft hasn't started yet.
    const now = new Date();
    const startTime = new Date(draftInfo.draftStartTime);
    if (now < startTime) {
      alert("Draft session has not started yet.");
      return;
    }

    // Prevent drafting if the session already ended.
    if (draftInfo.sessionEnded) {
      alert("Draft session is over.");
      return;
    }

    if (draftInfo.current_turn_team !== userFantasyPlayerId) {
      alert("It's not your turn to draft.");
      return;
    }
    try {
      await draftPlayer(
        String(leagueId),
        String(player.id),
        draftInfo.current_turn_team
      );
      setPlayers((prevPlayers) =>
        prevPlayers.map((p) =>
          p.id === player.id
            ? { ...p, draftedBy: draftInfo.current_turn_team }
            : p
        )
      );
      setDraftInfo((prev) =>
        prev
          ? {
              ...prev,
              drafted_players: [
                ...prev.drafted_players,
                {
                  player_id: player.id,
                  team_drafted_by: draftInfo.current_turn_team,
                  draft_time: new Date().toISOString(),
                },
              ],
            }
          : null
      );
      nextTurn(draftInfo.current_turn_team);
    } catch (error) {
      console.error("Error drafting player:", error);
      alert("Failed to draft the player. Please try again.");
    }
  };

  // Polling active participants every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const active = await fetchActiveParticipants(leagueId);
        setActiveParticipants(active);
      } catch (error) {
        console.error("Error fetching active participants:", error);
      }
    }, 5000); // Poll every 5 sec – adjust as needed.
    return () => clearInterval(interval);
  }, [leagueId]);

  useEffect(() => {
    if (loading) return;
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      // When timer reaches 0, check if the current team is active.
      // If not active (i.e. not in activeParticipants), trigger auto-draft.
      if (
        draftInfo &&
        !activeParticipants.includes(draftInfo.current_turn_team)
      ) {
        handleAutoDraft();
      }
    }
  }, [timer, loading, draftInfo, activeParticipants, userFantasyPlayerId]);

  return (
    <div className="relative flex flex-col items-center p-4 bg-black shadow-xl h-screen">
      <h1 className="text-3xl font-bold text-[#B8860B] mb-6">
        Draft Players - 2024
      </h1>

      <>
        <div className="mb-4 text-white">
          {draftInfo && (
            <>
              <p>
                <strong>Current Turn:</strong> {currentTeamName}
              </p>
              <p>
                <strong>Timer:</strong> {timer} seconds
              </p>
              <p>
                <strong>Round:</strong> {round}
              </p>
              <p>
                <strong>Overall Pick #:</strong> {overallPickNumber}
              </p>
            </>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center items-center mt-10">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-gray-300"></div>
          </div>
        ) : (
          <>
            <div className="w-full flex flex-col lg:flex-row gap-4">
              <div className="w-full lg:w-2/3">
                <DraftAvailablePlayersTable
                  players={players}
                  handleDraft={handleDraft}
                  draftInfo={draftInfo}
                  userFantasyPlayerId={userFantasyPlayerId || ""}
                  timer={timer}
                  fantasyPlayers={fantasyPlayers}
                />
              </div>
              <div className="hidden lg:block lg:w-1/3">
                <DraftedPlayersTable
                  players={players}
                  draftInfo={draftInfo}
                  fantasyPlayers={fantasyPlayers}
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
              />
            </div>
          </>
        )}
      </>
    </div>
  );
};

export default LeagueDraftPage;
