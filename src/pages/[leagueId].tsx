import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import {
  fetchPlayers2024,
  fetchDraftData,
  draftPlayer,
} from "../../backend/API";
import useUserStore from "@/stores/useUserStore";
import { Player, DraftInfo } from "../types/DraftTypes";
import DraftAvailablePlayersTable from "../components/DraftAvailablePlayersTable";
import DraftedPlayersTable from "../components/DraftedPlayersTable";

const LeagueDraftPage: React.FC = () => {
  const router = useRouter();
  const { leagueId } = router.query;
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftInfo, setDraftInfo] = useState<DraftInfo | null>(null);
  const [timer, setTimer] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

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

        setTimer(30);
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

      // You can trigger next-turn/auto-pick logic here if desired.
    } catch (error) {
      console.error("Error drafting player:", error);
      alert("Failed to draft the player. Please try again.");
    }
  };

  return (
    <div className="flex flex-col items-center p-4 bg-black rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold text-[#B8860B] mb-6">
        Draft Players - 2024
      </h1>
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
            />
          </div>
          <div className="w-full lg:w-1/3">
            <DraftedPlayersTable players={players} draftInfo={draftInfo} />
          </div>
        </div>
      )}
    </div>
  );
};

export default LeagueDraftPage;
