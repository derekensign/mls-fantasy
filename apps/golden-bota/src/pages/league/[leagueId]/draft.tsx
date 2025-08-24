import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useRouter } from "next/router";
import {
  fetchPlayers2025,
  draftPlayer,
  fetchFantasyPlayersByLeague,
  fetchDraftedPlayers,
  updateDraftSettings,
  getDraftSettings,
} from "@mls-fantasy/api";
import useUserStore from "../../../stores/useUserStore";
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
  // Simple mode flag: if true, there is no timer, no auto-draft; all picks are manual with unlimited time.
  const simpleMode = true;

  const router = useRouter();
  const { leagueId } = router.query;
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftInfo, setDraftInfo] = useState<DraftInfo | null>(null);
  const [turnEndsAt, setTurnEndsAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [round, setRound] = useState<number>(1);
  const [userSessionJoined, setUserSessionJoined] = useState<boolean>(false);
  const [draftDrawerOpen, setDraftDrawerOpen] = useState<boolean>(false);
  const [fantasyPlayers, setFantasyPlayers] = useState<FantasyPlayer[]>([]);
  const [activeParticipants, setActiveParticipants] = useState<string[]>([]);
  const [hasJoinedSession, setHasJoinedSession] = useState<boolean>(false);
  const [drafting, setDrafting] = useState<boolean>(false);
  const [draftedPlayers, setDraftedPlayers] = useState<DraftedPlayer[]>([]);
  const [draftOver, setDraftOver] = useState<boolean>(false);
  const { userDetails } = useUserStore();
  const userFantasyPlayerId = userDetails?.FantasyPlayerId?.toString();
  const userIsAdmin = true; // TODO: Add this to the user details.

  // This ref will ensure that we run initialization only once.
  const initializedRef = useRef(false);

  // Load fantasy players (to translate team IDs into names)
  useEffect(() => {
    if (leagueId) {
      const loadFantasyPlayers = async () => {
        try {
          const data = await fetchFantasyPlayersByLeague(String(leagueId));
          setFantasyPlayers(data);
        } catch (error) {
          console.error("Error fetching fantasy players:", error);
        } finally {
          setLoading(false);
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

  // Wrap your loadDraftData function in useCallback.
  const loadDraftData = useCallback(async () => {
    // Only set loading on initial fetch.
    if (!draftInfo) setLoading(true);
    try {
      // Fetch and format players.
      const rawData = await fetchPlayers2025();
      const formattedPlayers: Player[] = rawData.map((item: any) => ({
        id: item.id.S,
        name: item.name.S,
        team: item.team.S,
        goals_2024: parseInt(item.goals_2024.N, 10),
        draftedBy: item.draftedBy?.S || null,
      }));
      // Update players only if they have changed.
      setPlayers((prev) =>
        JSON.stringify(prev) === JSON.stringify(formattedPlayers)
          ? prev
          : formattedPlayers
      );

      if (!leagueId) return;
      // Fetch and process draft settings.
      const draftData = await getDraftSettings(String(leagueId));
      const plainDraftOrder: string[] = draftData?.draftOrder || [];

      // Ensure current_turn_team is always a string by using nullish coalescing
      const fixedDraftData: DraftInfo = {
        ...draftData,
        draftOrder: plainDraftOrder,
        league_id: draftData?.league_id || "",
        draft_status: draftData?.draft_status || "",
        current_turn_team:
          (draftData?.current_turn_team ?? plainDraftOrder[0]) || "",
        draftStartTime: draftData?.draftStartTime || "",
        numberOfRounds: draftData?.numberOfRounds || 5,
        activeParticipants: draftData?.activeParticipants || [],
      };

      // Update draftInfo only if changed.
      setDraftInfo(fixedDraftData);

      // Fetch and sort drafted players.
      const draftedPlayersData = await fetchDraftedPlayers(String(leagueId));
      draftedPlayersData.sort(
        (
          a: { draft_time: string | number | Date },
          b: { draft_time: string | number | Date }
        ) => new Date(a.draft_time).getTime() - new Date(b.draft_time).getTime()
      );
      setDraftedPlayers((prev) =>
        JSON.stringify(prev) === JSON.stringify(draftedPlayersData)
          ? prev
          : draftedPlayersData
      );

      // Update turn ending and countdown.
      const turnEnds = draftData?.current_team_turn_ends || null;
      setTurnEndsAt((prev) => (prev === turnEnds ? prev : turnEnds));
      if (!simpleMode && turnEnds) {
        const remainingMilliseconds = new Date(turnEnds).getTime() - Date.now();
        const newCountdown = Math.max(
          Math.ceil(remainingMilliseconds / 1000),
          0
        );
        setCountdown((prev) => (prev === newCountdown ? prev : newCountdown));
      } else {
        setCountdown((prev) => (prev === 0 ? prev : 0));
      }
    } catch (error) {
      console.error("Error loading draft data:", error);
    } finally {
      setLoading(false);
    }
  }, [leagueId, simpleMode, draftInfo]);

  // This effect simply loads the draft settings on mount.
  useEffect(() => {
    if (!leagueId) return;

    loadDraftData();
  }, [leagueId, loadDraftData]);

  // Auto-draft countdown effect: Only runs in advanced mode.
  useEffect(() => {
    if (simpleMode) return; // Disable auto-draft when in simple mode.
    if (loading) return;

    if (turnEndsAt) {
      const interval = setInterval(() => {
        const diff = new Date(turnEndsAt).getTime() - Date.now();
        setCountdown(Math.max(Math.ceil(diff / 1000), 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [turnEndsAt, simpleMode, loading]);

  // Derived values using useMemo (these always run)
  const totalTeams = useMemo(
    () =>
      draftInfo ? draftInfo.draftOrder.length : fantasyPlayers.length || 1,
    [draftInfo, fantasyPlayers]
  );
  const totalRounds = useMemo(
    () => (draftInfo ? draftInfo.numberOfRounds : 5),
    [draftInfo]
  );
  const totalPicks = totalTeams * (totalRounds || 5);
  const overallPickNumber = (draftedPlayers.length ?? 0) + 1;

  useEffect(() => {
    setDraftOver(draftedPlayers.length >= totalPicks);
  }, [draftedPlayers, totalPicks]);

  const computedRound =
    overallPickNumber > 0
      ? Math.floor((overallPickNumber - 1) / totalTeams) + 1
      : 0;

  const currentTeamFantasy = useMemo(() => {
    return fantasyPlayers.find(
      (fp) => fp.FantasyPlayerId.toString() === draftInfo?.current_turn_team
    );
  }, [fantasyPlayers, draftInfo]);

  const currentTeamName = currentTeamFantasy
    ? currentTeamFantasy.TeamName
    : draftInfo?.current_turn_team;

  // nextTurn uses the database to compute the next turn, round, and overall pick.
  const nextTurn = useCallback(async () => {
    if (!draftInfo) return;

    const totalTeams = draftInfo.draftOrder.length;

    // Use overall_pick from the database if it exists; otherwise, default (first pick).
    const currentOverallPick =
      typeof draftInfo.overall_pick === "number"
        ? draftInfo.overall_pick
        : draftedPlayers.length + 1;
    const newOverallPick = currentOverallPick + 1;

    // Compute the new round based on the new overall pick.
    // For example, if there are three teams:
    // picks 1-3: round 1, picks 4-6: round 2, etc.
    const newRound = Math.floor((newOverallPick - 1) / totalTeams) + 1;
    const isEvenRound = newRound % 2 === 0;

    // Compute the index within the round (0-indexed)
    const indexInRound = (newOverallPick - 1) % totalTeams;

    // Reverse the order if even round (snake mode) or use the natural order if odd.
    const order = isEvenRound
      ? [...draftInfo.draftOrder].reverse()
      : draftInfo.draftOrder;
    const nextTeam = order[indexInRound];

    await updateDraftSettings(String(leagueId), {
      overall_pick: newOverallPick,
      current_round: newRound,
      current_turn_team: nextTeam,
    });

    const updatedDraftInfo = await getDraftSettings(String(leagueId));
    setDraftInfo(updatedDraftInfo);
  }, [draftInfo, draftedPlayers, leagueId]);

  const handleDraft = async (player: Player) => {
    if (!draftInfo) {
      alert("Draft info not loaded yet.");
      return;
    }

    const now = new Date();
    const startTime = new Date(draftInfo.draftStartTime);
    if (now < startTime) {
      alert("Draft session has not started yet.");
      return;
    }

    if (draftInfo.current_turn_team !== userFantasyPlayerId) {
      alert("It's not your turn to draft.");
      return;
    }

    try {
      // Call the API to draft the player.
      await draftPlayer(
        String(leagueId),
        String(player.id),
        draftInfo.current_turn_team
      );

      // Re-fetch the updated draft state from the DB.
      const draftedPlayersData = await fetchDraftedPlayers(String(leagueId));
      // Sort drafted_players by time (oldest first).
      draftedPlayersData.sort(
        (
          a: { draft_time: string | number | Date },
          b: { draft_time: string | number | Date }
        ) => new Date(a.draft_time).getTime() - new Date(b.draft_time).getTime()
      );
      setDraftedPlayers(draftedPlayersData);

      const rawData = await fetchPlayers2025();
      const formattedPlayers: Player[] = rawData.map((item: any) => ({
        id: item.id.S,
        name: item.name.S,
        team: item.team.S,
        goals_2024: parseInt(item.goals_2024.N, 10),
        draftedBy: item.draftedBy?.S || null,
      }));
      setPlayers(formattedPlayers);

      // Now update turn: update DB and re-fetch using nextTurn.
      await nextTurn();
    } catch (error) {
      console.error("Error drafting player:", error);
      alert("Failed to draft the player. Please try again.");
    }
  };

  // Only render when draftInfo has been loaded.
  if (!draftInfo) {
    return (
      <Container
        maxWidth="xl"
        sx={{ backgroundColor: "black", minHeight: "100vh", py: 4 }}
      >
        <div>Loading draft settings...</div>
      </Container>
    );
  }

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
            {draftOver ? (
              <h2 className="text-3xl font-bold">Draft is Over</h2>
            ) : (
              <>
                <p>
                  <strong>Current Turn:</strong> {currentTeamName}
                </p>
                <p>
                  <strong>{simpleMode ? "Time Limit:" : "Countdown:"}</strong>{" "}
                  {simpleMode ? "None (Manual Mode)" : `${countdown} seconds`}
                </p>
                <p>
                  <strong>Round:</strong> {computedRound}
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
                        handleDraft={handleDraft}
                        draftInfo={draftInfo}
                        userFantasyPlayerId={userFantasyPlayerId || ""}
                        countdown={countdown}
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
