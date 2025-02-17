import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TableSortLabel,
} from "@mui/material";
import { Player, DraftInfo } from "../types/DraftTypes";

interface PlayersTableProps {
  players: Player[];
  handleDraft: (player: Player) => void;
  draftInfo: DraftInfo | null;
  userFantasyPlayerId?: string;
}

type SortKey = keyof Player | "actions";

interface SortConfig {
  key: SortKey;
  direction: "asc" | "desc";
}

const PlayersTable: React.FC<PlayersTableProps> = ({
  players,
  handleDraft,
  draftInfo,
  userFantasyPlayerId,
}) => {
  // Local state for search and sort configuration
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Filter players based on search term
  const filteredPlayers = players.filter((player) =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort the filtered players based on sortConfig
  let sortedPlayers = [...filteredPlayers];
  if (sortConfig !== null) {
    sortedPlayers.sort((a, b) => {
      if (sortConfig.key === "actions") {
        // Sorting based on drafted status
        if (!a.draftedBy && b.draftedBy)
          return sortConfig.direction === "asc" ? -1 : 1;
        if (a.draftedBy && !b.draftedBy)
          return sortConfig.direction === "asc" ? 1 : -1;
        if (a.draftedBy && b.draftedBy) {
          return sortConfig.direction === "asc"
            ? a.draftedBy.localeCompare(b.draftedBy)
            : b.draftedBy.localeCompare(a.draftedBy);
        }
        return 0;
      } else {
        // For other columns (name, team, goals_2024)
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        // Use nullish coalescing to guarantee that a value is provided:
        const safeValA = valA ?? "";
        const safeValB = valB ?? "";

        if (safeValA < safeValB) return sortConfig.direction === "asc" ? -1 : 1;
        if (safeValA > safeValB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      }
    });
  }

  // Update sort configuration when a header is clicked
  const handleSort = (key: SortKey) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search players"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-4 p-2 border border-gray-300 rounded w-full max-w-md"
        />
      </div>
      <TableContainer component={Paper} className="shadow rounded-lg">
        <Table className="min-w-full divide-y divide-[#B8860B]">
          <TableHead className="bg-[#B8860B] opacity-90">
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortConfig?.key === "name"}
                  direction={
                    sortConfig?.key === "name" ? sortConfig.direction : "asc"
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
                    sortConfig?.key === "team" ? sortConfig.direction : "asc"
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
                    sortConfig?.key === "actions" ? sortConfig.direction : "asc"
                  }
                  onClick={() => handleSort("actions")}
                >
                  Actions
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody className="bg-[#FFFFF0] divide-y divide-[#B8860B]">
            {sortedPlayers.map((player) => (
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
                        draftInfo?.current_turn_team !== userFantasyPlayerId
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
  );
};

export default PlayersTable;
