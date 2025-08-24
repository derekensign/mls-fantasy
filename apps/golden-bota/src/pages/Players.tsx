import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TableSortLabel,
  Button,
} from "@mui/material";
import { fetchPlayers2025 } from "@mls-fantasy/api";

interface Player {
  id: string;
  name: string;
  team: string;
  goals_2024: number;
  draftedBy?: string; // Name of the team that drafted the player
}

interface LeagueInfo {
  isTransferWindowOpen: boolean;
  currentTurnTeam: string;
  userTeam: string;
}

const DraftPage: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Player | "actions";
    direction: "asc" | "desc";
  } | null>(null);

  useEffect(() => {
    const loadPlayers = async () => {
      setLoading(true);

      // Fetch players
      const rawData = await fetchPlayers2025();
      const formattedData: Player[] = rawData.map((item: any) => ({
        id: item.id.S,
        name: item.name.S,
        team: item.team.S,
        goals_2024: parseInt(item.goals_2024.N, 10),
        draftedBy: item.draftedBy?.S || null, // Fetch "draftedBy" from the backend
      }));

      // Fetch league info (e.g., transfer window, current turn)
      const leagueData: LeagueInfo = {
        isTransferWindowOpen: true, // Simulate backend response
        currentTurnTeam: "Golden Bota Boiz", // Simulate backend response
        userTeam: "Golden Bota Boiz",
      };

      setPlayers(formattedData);
      setLeagueInfo(leagueData);
      setLoading(false);
    };

    loadPlayers();
  }, []);

  const handleDraft = async (player: Player) => {
    if (
      !leagueInfo ||
      !leagueInfo.isTransferWindowOpen ||
      leagueInfo.currentTurnTeam !== leagueInfo.userTeam
    ) {
      alert("You cannot draft a player at this time.");
      return;
    }

    // Simulate drafting logic (replace with API call to draft player)

    setPlayers((prevPlayers) =>
      prevPlayers.map((p) =>
        p.id === player.id ? { ...p, draftedBy: leagueInfo.userTeam } : p
      )
    );

    // Optionally, update the backend here to lock the player as drafted.
  };

  const handleSort = (key: keyof Player | "actions") => {
    const direction =
      sortConfig?.key === key && sortConfig.direction === "asc"
        ? "desc"
        : "asc";
    setSortConfig({ key, direction });

    const sortedPlayers = [...players].sort((a, b) => {
      if (key === "actions") {
        // Sort by drafted status
        if (!a.draftedBy && b.draftedBy) return direction === "asc" ? -1 : 1;
        if (a.draftedBy && !b.draftedBy) return direction === "asc" ? 1 : -1;
        if (a.draftedBy && b.draftedBy) {
          // Sort alphabetically by drafted team name
          return direction === "asc"
            ? a.draftedBy.localeCompare(b.draftedBy)
            : b.draftedBy.localeCompare(a.draftedBy);
        }
        return 0;
      } else {
        // Sort by other columns
        const safeValA = a[key] ?? "";
        const safeValB = b[key] ?? "";
        if (safeValA < safeValB) return direction === "asc" ? -1 : 1;
        if (safeValA > safeValB) return direction === "asc" ? 1 : -1;
        return 0;
      }
    });

    setPlayers(sortedPlayers);
  };

  const filteredPlayers = players.filter((player) =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col items-center p-4 bg-black rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold text-[#B8860B] mb-6">
        Draft Players - 2024
      </h1>

      {leagueInfo && !leagueInfo.isTransferWindowOpen && (
        <p className="text-red-600 mb-4">
          The transfer window is currently closed.
        </p>
      )}

      {leagueInfo && leagueInfo.currentTurnTeam && (
        <p className="text-white mb-4">
          <strong>Current Turn:</strong> {leagueInfo.currentTurnTeam}
        </p>
      )}

      <input
        type="text"
        placeholder="Search players"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4 p-2 border border-gray-300 rounded w-full max-w-md"
      />

      {loading ? (
        <div className="flex justify-center items-center mt-10">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-gray-300"></div>
        </div>
      ) : (
        <div className="overflow-x-auto w-full">
          <TableContainer component={Paper} className="shadow rounded-lg">
            <Table className="min-w-full divide-y divide-[#B8860B]">
              <TableHead className="bg-[#B8860B] opacity-90">
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortConfig?.key === "name"}
                      direction={
                        sortConfig?.key === "name"
                          ? sortConfig.direction
                          : "asc"
                      }
                      onClick={() => handleSort("name")}
                    >
                      Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortConfig?.key === "team"}
                      direction={
                        sortConfig?.key === "team"
                          ? sortConfig.direction
                          : "asc"
                      }
                      onClick={() => handleSort("team")}
                    >
                      Team
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortConfig?.key === "goals_2024"}
                      direction={
                        sortConfig?.key === "goals_2024"
                          ? sortConfig.direction
                          : "asc"
                      }
                      onClick={() => handleSort("goals_2024")}
                    >
                      Goals (2024)
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortConfig?.key === "actions"}
                      direction={
                        sortConfig?.key === "actions"
                          ? sortConfig.direction
                          : "asc"
                      }
                      onClick={() => handleSort("actions")}
                    >
                      Actions
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody className="bg-[#FFFFF0] divide-y divide-[#B8860B]">
                {filteredPlayers.map((player) => (
                  <TableRow
                    key={player.id}
                    className="transition duration-300 ease-in-out hover:bg-[#FFD700] hover:bg-opacity-70"
                  >
                    <TableCell>{player.name}</TableCell>
                    <TableCell>{player.team}</TableCell>
                    <TableCell>{player.goals_2024}</TableCell>
                    <TableCell>
                      {player.draftedBy ? (
                        <span className="text-gray-500">
                          Drafted by {player.draftedBy}
                        </span>
                      ) : (
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => handleDraft(player)}
                          disabled={
                            !leagueInfo?.isTransferWindowOpen ||
                            leagueInfo?.currentTurnTeam !== leagueInfo?.userTeam
                          }
                        >
                          Draft
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      )}
    </div>
  );
};

export default DraftPage;
