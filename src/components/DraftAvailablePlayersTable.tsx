import React, { useState, useEffect } from "react";
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

type SortKey = keyof Player | "actions";

interface SortConfig {
  key: SortKey;
  direction: "asc" | "desc";
}

interface DraftAvailablePlayersTableProps {
  players: Player[];
  handleDraft: (player: Player) => void;
  draftInfo: DraftInfo | null;
  timer: number;
  userFantasyPlayerId?: string;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const DraftAvailablePlayersTable: React.FC<DraftAvailablePlayersTableProps> = ({
  players,
  handleDraft,
  draftInfo,
  timer,
  userFantasyPlayerId,
  searchTerm,
  setSearchTerm,
}) => {
  // Sorting state and logic
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "actions",
    direction: "asc",
  });

  // Filter players based on search term
  const filteredPlayers = players.filter((player) =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort the filtered list based on sorting config
  let sortedPlayers = [...filteredPlayers];
  sortedPlayers.sort((a, b) => {
    if (sortConfig.key === "actions") {
      // Sort by the drafted status and then by goals descending if same status.
      const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;
      const aDrafted = a.draftedBy ? 1 : 0;
      const bDrafted = b.draftedBy ? 1 : 0;
      const statusDiff = (aDrafted - bDrafted) * directionMultiplier;
      if (statusDiff !== 0) return statusDiff;
      return b.goals_2024 - a.goals_2024;
    } else {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    }
  });

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

  // Determine if the draft button should be disabled.
  const isDraftDisabled = (player: Player) =>
    draftInfo?.current_turn_team !== userFantasyPlayerId;

  // Common SX style for the Draft button.
  const draftButtonSX = {
    backgroundColor: "black !important",
    color: "white",
    backgroundImage: "none !important",
    fontWeight: "bold",
    "&:hover": { backgroundColor: "#333 !important" },
    "&.Mui-disabled": {
      backgroundColor: "black",
      color: "white",
      opacity: 1,
      cursor: "not-allowed",
    },
  };

  // Mobile-specific draft button styling: slightly smaller dimensions.
  const mobileDraftButtonSX = {
    ...draftButtonSX,
    padding: "4px 8px", // Reduced padding
    fontSize: "0.75rem", // Smaller font size
    minWidth: "auto",
  };

  /*
   * Mobile View: Uses a grid layout with a header (with sorting controls) rendered once.
   * The grid ensures a consistent column width with some extra right padding for the Actions column.
   */
  const renderMobileView = () => (
    <div className="block lg:hidden">
      {/* Mobile header with sorting controls */}
      <div className="grid grid-cols-4 gap-2 p-2 border-b border-gray-300 bg-white text-sm font-bold">
        <div className="text-center">
          <TableSortLabel
            active={sortConfig.key === "name"}
            direction={sortConfig.key === "name" ? sortConfig.direction : "asc"}
            onClick={() => handleSort("name")}
          >
            Name
          </TableSortLabel>
        </div>
        <div className="text-center">
          <TableSortLabel
            active={sortConfig.key === "team"}
            direction={sortConfig.key === "team" ? sortConfig.direction : "asc"}
            onClick={() => handleSort("team")}
          >
            Team
          </TableSortLabel>
        </div>
        <div className="text-center">
          <TableSortLabel
            active={sortConfig.key === "goals_2024"}
            direction={
              sortConfig.key === "goals_2024" ? sortConfig.direction : "asc"
            }
            onClick={() => handleSort("goals_2024")}
          >
            Goals
          </TableSortLabel>
        </div>
        <div className="text-center pr-4">Actions</div>
      </div>
      {/* Player rows */}
      {sortedPlayers.map((player) => (
        <div
          key={player.id}
          className="grid grid-cols-4 gap-2 p-2 border-b border-gray-300 bg-white text-sm"
        >
          <div className="text-center">{player.name}</div>
          <div className="text-center">{player.team}</div>
          <div className="text-center">{player.goals_2024}</div>
          <div className="text-center pr-4">
            {(!player.draftedBy || player.draftedBy === "") && (
              <Button
                variant="contained"
                onClick={() => handleDraft(player)}
                sx={mobileDraftButtonSX}
                disabled={isDraftDisabled(player)}
              >
                Draft
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // Desktop View: Uses the existing Material‑UI Table layout with sorting controls.
  const renderDesktopView = () => (
    <div className="hidden lg:block">
      <TableContainer component={Paper} className="shadow rounded-lg">
        <Table className="min-w-full divide-y divide-[#B8860B]">
          <TableHead className="bg-[#B8860B] opacity-90">
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortConfig.key === "name"}
                  direction={
                    sortConfig.key === "name" ? sortConfig.direction : "asc"
                  }
                  onClick={() => handleSort("name")}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortConfig.key === "team"}
                  direction={
                    sortConfig.key === "team" ? sortConfig.direction : "asc"
                  }
                  onClick={() => handleSort("team")}
                >
                  Team
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortConfig.key === "goals_2024"}
                  direction={
                    sortConfig.key === "goals_2024"
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
                  active={sortConfig.key === "actions"}
                  direction={
                    sortConfig.key === "actions" ? sortConfig.direction : "asc"
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
                    <span>Drafted by {player.draftedBy}</span>
                  ) : (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleDraft(player)}
                      sx={draftButtonSX}
                      disabled={isDraftDisabled(player)}
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

  return (
    <div className="w-full">
      {/* Search Input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search players"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-4 p-2 border border-gray-300 rounded w-full max-w-md"
        />
      </div>
      {renderMobileView()}
      {renderDesktopView()}
    </div>
  );
};

export default DraftAvailablePlayersTable;
