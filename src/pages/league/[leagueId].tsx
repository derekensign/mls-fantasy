import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import {
  fetchPlayers2024,
  fetchDraftData,
  draftPlayer,
} from "../../../backend/API";
import useUserStore from "@/stores/useUserStore";
import { Player, DraftInfo } from "../../types/DraftTypes";
import DraftAvailablePlayersTable from "../../components/DraftAvailablePlayersTable";
import DraftedPlayersTable from "../../components/DraftedPlayersTable";
import Drawer from "@mui/material/Drawer";
import Button from "@mui/material/Button";

const LeagueDraftPage: React.FC = () => {
  const router = useRouter();
  const { leagueId } = router.query;
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftInfo, setDraftInfo] = useState<DraftInfo | null>(null);
  const [timer, setTimer] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [draftDrawerOpen, setDraftDrawerOpen] = useState<boolean>(false);

  const { userDetails } = useUserStore();
  const userFantasyPlayerId = userDetails?.FantasyPlayerId?.toString();

  // Ref for latest players (if needed for auto-pick logic)
  const playersRef = useRef<Player[]>([]);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
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
        console.log("Draft Data:", draftData);
        setDraftInfo(draftData);

        setTimer(5);
      } catch (error) {
        console.error("Error loading draft data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (leagueId) {
      loadDraftData();
    }
  }, [leagueId]);

  // Handle drafting a player
  const handleDraft = async (player: Player) => {
    if (!draftInfo) {
      alert("Draft info not loaded yet.");
      return;
    }
    if (draftInfo.current_turn_team !== userFantasyPlayerId) {
      alert("It's not your turn to draft.");
      return;
    }
    try {
      await draftPlayer(
        String(leagueId),
        player.id,
        draftInfo.current_turn_team
      );
      console.log("Drafting player:", player.name);

      // Update local players state
      setPlayers((prevPlayers) =>
        prevPlayers.map((p) =>
          p.id === player.id
            ? { ...p, draftedBy: draftInfo.current_turn_team }
            : p
        )
      );

      // Append new drafted player to draftInfo state
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

      // After a successful draft, move to the next turn.
      nextTurn(draftInfo.current_turn_team);
    } catch (error) {
      console.error("Error drafting player:", error);
      alert("Failed to draft the player. Please try again.");
    }
  };

  const handleAutoDraft = useCallback(async () => {
    if (!draftInfo) return;
    const availablePlayers = playersRef.current.filter((p) => !p.draftedBy);
    if (availablePlayers.length === 0) return;
    // Auto-pick logic: choose the player with the highest goals_2024.
    const sorted = [...availablePlayers].sort(
      (a, b) => b.goals_2024 - a.goals_2024
    );
    const nextPlayer = sorted[0];
    try {
      await draftPlayer(leagueId, nextPlayer.id, draftInfo.current_turn_team);
      console.log("Auto drafting player:", nextPlayer.name);

      // Update players state so that the drafted player is marked as drafted.
      setPlayers((prevPlayers) =>
        prevPlayers.map((p) =>
          p.id === nextPlayer.id
            ? { ...p, draftedBy: draftInfo.current_turn_team }
            : p
        )
      );

      // Append the auto-drafted player's record to the draftInfo state.
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

      // Then change turn.
      nextTurn(draftInfo.current_turn_team);
    } catch (error) {
      console.error("Auto-draft error:", error);
    }
  }, [draftInfo]);

  useEffect(() => {
    if (loading) return;

    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      // Timer has reached 0, trigger auto-draft regardless of whose turn it is.
      if (draftInfo) {
        handleAutoDraft();
      }
    }
  }, [timer, loading, draftInfo, handleAutoDraft]);

  const nextTurn = (currentTeam: string) => {
    if (!draftInfo) return;
    const currentIndex = draftInfo.draft_order.indexOf(currentTeam);
    const nextIndex = (currentIndex + 1) % draftInfo.draft_order.length;
    const nextTeam = draftInfo.draft_order[nextIndex];
    setDraftInfo((prev) =>
      prev ? { ...prev, current_turn_team: nextTeam } : prev
    );
    // If no one is logged in for the next team, set timer to 3 seconds, else 30 seconds.
    if (userFantasyPlayerId !== nextTeam) {
      setTimer(3);
    } else {
      setTimer(30);
    }
  };

  return (
    <div className="relative flex flex-col items-center p-4 bg-black shadow-xl">
      <h1 className="text-3xl font-bold text-[#B8860B] mb-6">
        Draft Players - 2024
      </h1>
      {draftInfo && (
        <div className="mb-4 text-white">
          <p>
            <strong>Current Turn:</strong> {draftInfo.current_turn_team}
          </p>
          <p>
            <strong>Timer:</strong> {timer} seconds
          </p>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center items-center mt-10">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-gray-300"></div>
        </div>
      ) : (
        <div className="w-full flex flex-col lg:flex-row gap-4">
          <div className="w-full lg:w-2/3">
            <DraftAvailablePlayersTable
              players={players}
              handleDraft={handleDraft}
              draftInfo={draftInfo}
              userFantasyPlayerId={userFantasyPlayerId}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              timer={timer}
            />
          </div>
          <div className="hidden lg:block lg:w-1/3">
            <DraftedPlayersTable players={players} draftInfo={draftInfo} />
          </div>
        </div>
      )}

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

      <Drawer
        anchor="right"
        open={draftDrawerOpen}
        onClose={() => setDraftDrawerOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: "#FFFFF0",
            color: "black",
          },
        }}
      >
        <div className="w-72 p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Drafted Players</h2>
            <Button
              variant="text"
              color="inherit"
              onClick={() => setDraftDrawerOpen(false)}
            >
              Close
            </Button>
          </div>
          <DraftedPlayersTable players={players} draftInfo={draftInfo} />
        </div>
      </Drawer>
    </div>
  );
};

export default LeagueDraftPage;
