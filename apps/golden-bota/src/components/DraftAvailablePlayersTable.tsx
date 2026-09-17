import React, { useState, useEffect, useMemo } from "react";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from "@mui/material";
import {
  Player,
  DraftInfo,
  DraftedPlayer,
  FantasyPlayer,
} from "../types/DraftTypes";

type SortKey = keyof Player | "actions";

interface SortConfig {
  key: SortKey;
  direction: "asc" | "desc";
}

interface DraftAvailablePlayersTableProps {
  players: Player[];
  draftedPlayers: DraftedPlayer[];
  handleDraft: (player: Player) => void;
  draftInfo: DraftInfo | null;
  userFantasyPlayerId?: string;
  fantasyPlayers: FantasyPlayer[];
  countdown: number;
  mode?: "draft" | "transfer"; // Add mode prop
  isUserTurn?: boolean; // Add isUserTurn prop
  selectedDropPlayer?: string | null; // Add selectedDropPlayer prop
  transferStatus?: string; // Add transfer status prop for completion check
  getPlayerOwnership?: (playerId: string) => {
    isOwned: boolean;
    ownerName: string | null;
    isOwnedByUser: boolean;
  }; // Add getPlayerOwnership prop
  isPickingUp?: boolean; // Add loading state for pickup button
  testMode?: boolean; // Test mode: allows drafting as any team
  isAddOnlyMode?: boolean; // Add-only transfer mode: pick up without a prior drop
}

const DraftAvailablePlayersTable: React.FC<DraftAvailablePlayersTableProps> = ({
  players,
  draftedPlayers,
  handleDraft,
  draftInfo,
  userFantasyPlayerId,
  fantasyPlayers,
  countdown,
  mode = "draft", // Default to draft mode
  isUserTurn = false, // Default to false
  selectedDropPlayer = null, // Default to null
  transferStatus, // Add transfer status prop
  getPlayerOwnership, // Add getPlayerOwnership prop
  isPickingUp = false, // Default to false
  testMode = false, // Default to false
  isAddOnlyMode = false, // Default to false (standard drop-then-pickup)
}) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [showNewOnly, setShowNewOnly] = useState<boolean>(false);
  const [showNewToTeamOnly, setShowNewToTeamOnly] = useState<boolean>(false);

  // Get unique teams for filter dropdown
  const uniqueTeams = useMemo(() => {
    const teams = new Set(players.map((p) => p.team).filter(Boolean));
    return Array.from(teams).sort();
  }, [players]);

  // Filter players based on search term, team, and new status
  const filteredPlayers = players.filter((player) => {
    const playerName = typeof player.name === 'string' ? player.name : String(player.name || '');
    const matchesSearch = playerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTeam = teamFilter === "all" || player.team === teamFilter;
    const matchesNew = !showNewOnly || player.isNew;
    const matchesNewToTeam = !showNewToTeamOnly || player.isNewToTeam;
    return matchesSearch && matchesTeam && matchesNew && matchesNewToTeam;
  });

  // Then filter out any player whose id appears in draftedPlayers.
  const availablePlayers = filteredPlayers.filter(
    (player) =>
      !draftedPlayers.some(
        (drafted) => drafted.player_id === player.id.toString()
      )
  );

  // Sorting state and logic
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "actions",
    direction: "asc",
  });

  // Sort the filtered list based on sorting config
  let sortedPlayers = [...filteredPlayers];
  sortedPlayers.sort((a, b) => {
    if (sortConfig.key === "actions") {
      // Ensure non-drafted players come first
      const aDrafted = a.draftedBy ? 1 : 0;
      const bDrafted = b.draftedBy ? 1 : 0;

      if (aDrafted !== bDrafted) {
        return aDrafted - bDrafted;
      }
      // For players with the same drafted status, sort by 2024 goals descending.
      // Use 0 as default if goals_2024 is falsy.
      return (b.goals_2024 ?? 0) - (a.goals_2024 ?? 0);
    } else {
      // Fallback for other sort keys.
      const valA = a[sortConfig.key] ?? "";
      const valB = b[sortConfig.key] ?? "";
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

  const isDraftDisabled = (player: Player) => {
    // In test mode, never disable the draft button
    if (testMode) {
      return false;
    }
    if (mode === "transfer") {
      // In transfer mode, disable if it's not the user's turn
      return !isUserTurn;
    }
    // In draft mode, use original logic
    return draftInfo?.current_turn_team !== userFantasyPlayerId;
  };

  const getActionButtonText = (player: Player) => {
    if (isPickingUp) {
      return "PICKING UP...";
    }

    if (mode === "transfer" && getPlayerOwnership) {
      const ownership = getPlayerOwnership(player.id.toString());

      if (ownership.isOwned) {
        return ownership.ownerName || "Unknown Team";
      }

      return isAddOnlyMode ? "ADD" : "PICK UP";
    }

    if (mode === "transfer") {
      // Fallback to old logic if getPlayerOwnership is not available
      const isPlayerOwned = fantasyPlayers.some(
        (fp) =>
          fp.Players &&
          fp.Players.some(
            (p: any) => p.id && p.id.toString() === player.id.toString()
          )
      );

      if (isPlayerOwned) {
        const ownerTeam = fantasyPlayers.find(
          (fp) =>
            fp.Players &&
            fp.Players.some(
              (p: any) => p.id && p.id.toString() === player.id.toString()
            )
        );
        return `Owned by ${ownerTeam?.TeamName || "Unknown"}`;
      }

      return isAddOnlyMode ? "ADD" : "PICK UP";
    }
    // In draft mode, always show DRAFT
    return "DRAFT";
  };

  const isActionButtonDisabled = (player: Player) => {
    // In test mode (draft), never disable the button
    if (testMode && mode === "draft") {
      return false;
    }

    // Always disable if transfer window is completed
    if (mode === "transfer" && transferStatus === "completed") {
      return true;
    }

    if (mode === "transfer" && getPlayerOwnership) {
      const ownership = getPlayerOwnership(player.id.toString());

      if (ownership.isOwned) {
        return true; // Can't pick up owned players - show as text instead
      }

      // For available players, only enable if:
      // 1. It's user's turn AND
      // 2. In standard mode, the user has already dropped a player
      //    (selectedDropPlayer exists). Add-only mode has no drop, so a
      //    dropped player is not required.
      const needsDrop = !isAddOnlyMode && !selectedDropPlayer;
      return !isUserTurn || needsDrop || isPickingUp;
    }

    if (mode === "transfer") {
      // Fallback to old logic if getPlayerOwnership is not available
      const isPlayerOwned = fantasyPlayers.some(
        (fp) =>
          fp.Players &&
          fp.Players.some(
            (p: any) => p.id && p.id.toString() === player.id.toString()
          )
      );

      if (isPlayerOwned) {
        return true; // Can't pick up owned players
      }

      return !isUserTurn || isPickingUp; // Can only pick up if it's user's turn and not currently picking up
    }
    // In draft mode, use original logic
    return draftInfo?.current_turn_team !== userFantasyPlayerId;
  };

  const shouldShowButton = (player: Player) => {
    if (mode === "transfer" && getPlayerOwnership) {
      const ownership = getPlayerOwnership(player.id.toString());
      return !ownership.isOwned; // Only show button for unowned players
    }

    if (mode === "transfer") {
      // Fallback logic
      const isPlayerOwned = fantasyPlayers.some(
        (fp) =>
          fp.Players &&
          fp.Players.some(
            (p: any) => p.id && p.id.toString() === player.id.toString()
          )
      );
      return !isPlayerOwned;
    }

    // In draft mode, always show button (disabled state handled separately)
    return true;
  };

  const draftButtonSX = {
    backgroundColor: "black !important",
    color: "white",
    backgroundImage: "none !important",
    fontWeight: "bold",
    "&:hover": { backgroundColor: "#333 !important" },
    "&.Mui-disabled": {
      backgroundColor: "#666 !important",
      color: "#999 !important",
      opacity: 0.6,
      cursor: "not-allowed",
    },
  };

  const mobileDraftButtonSX = {
    ...draftButtonSX,
    padding: "4px 8px",
    fontSize: "0.75rem",
    minWidth: "auto",
    "&.Mui-disabled": {
      backgroundColor: "#666 !important",
      color: "#999 !important",
      opacity: 0.6,
      cursor: "not-allowed",
    },
  };

  const estimatedActionsColumnWidth = useMemo(() => {
    if (fantasyPlayers && fantasyPlayers.length > 0) {
      const longestName = fantasyPlayers.reduce((prev, curr) =>
        curr.TeamName.trim().length > prev.TeamName.trim().length ? curr : prev
      ).TeamName;
      const width = longestName.length * 10 + 20;
      return `${Math.max(width, 150)}px`;
    }
    return "150px";
  }, [fantasyPlayers]);

  // Add safe number conversion for goals
  const formatGoals = (goals: number | undefined | null): string => {
    if (goals === undefined || goals === null || isNaN(goals)) {
      return "0";
    }
    return goals.toString();
  };

  /*
   * The goals column carries a different season depending on the mode, and the two callers feed it
   * different data: the preseason draft passes goals_2025 (there is no current-season form yet) while
   * a mid-season transfer window passes goals_2026. Labelling it by mode is the only way a picker can
   * tell which season they are looking at — an unqualified "Goals" reads as current-season and a
   * hardcoded "(2025)" is simply wrong once the window opens.
   */
  const goalsColumnLabel = mode === "transfer" ? "Goals (2026)" : "Goals (2025)";

  /*
   * Mobile View: Uses a grid layout with a header (with sorting controls) rendered once.
   * The grid ensures a consistent column width with some extra right padding for the Actions column.
   */
  /*
   * Mobile View: one dark card per player instead of a four-column grid. The old grid used
   * bg-white rows while the page's text colour is bone, so names, teams and goals rendered
   * white-on-white and were unreadable; it also squeezed a 30-character team name into a
   * quarter of a 390px screen. Sorting lives in a compact bar above the list.
   */
  const mobileSortLabelSX = {
    color: "#B8860B !important",
    fontSize: "0.8rem",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    "& .MuiTableSortLabel-icon": { color: "#B8860B !important" },
    "&.Mui-active": { color: "#FFD700 !important" },
  };

  const renderMobileView = (players: Player[]) => (
    <div className="block lg:hidden">
      {/* Sort bar */}
      <div className="flex items-center gap-4 px-3 py-2 mb-2 rounded-lg bg-[#1a1a1a] border border-[#B8860B]/40">
        <span className="text-xs text-gray-400 uppercase tracking-wide">
          Sort
        </span>
        <TableSortLabel
          active={sortConfig.key === "name"}
          direction={sortConfig.key === "name" ? sortConfig.direction : "asc"}
          onClick={() => handleSort("name")}
          sx={mobileSortLabelSX}
        >
          Name
        </TableSortLabel>
        <TableSortLabel
          active={sortConfig.key === "team"}
          direction={sortConfig.key === "team" ? sortConfig.direction : "asc"}
          onClick={() => handleSort("team")}
          sx={mobileSortLabelSX}
        >
          Team
        </TableSortLabel>
        <TableSortLabel
          active={sortConfig.key === "goals_2024"}
          direction={
            sortConfig.key === "goals_2024" ? sortConfig.direction : "asc"
          }
          onClick={() => handleSort("goals_2024")}
          sx={mobileSortLabelSX}
        >
          {goalsColumnLabel}
        </TableSortLabel>
      </div>

      {/* Player cards */}
      {players.map((player) => {
        // Convert player.id to string for comparison
        const draftedRecord = draftedPlayers.find(
          (drafted) => drafted.player_id === player.id.toString()
        );
        const draftedByName = draftedRecord
          ? fantasyPlayers.find(
              (fp) =>
                fp.FantasyPlayerId.toString() === draftedRecord.team_drafted_by
            )?.TeamName || draftedRecord.team_drafted_by
          : null;
        const showButton = !draftedRecord && shouldShowButton(player);
        const ownership =
          mode === "transfer" && getPlayerOwnership
            ? getPlayerOwnership(player.id.toString())
            : null;
        const ownedLabel = ownership?.isOwned
          ? ownership.isOwnedByUser
            ? "On your team"
            : `Owned by ${ownership.ownerName}`
          : getActionButtonText(player);
        return (
          <div
            key={player.id}
            className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg bg-[#1a1a1a] border border-[#333]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-white font-semibold text-[0.95rem] leading-tight">
                  {player.name}
                </span>
                {player.isNew && (
                  <Chip
                    label="New"
                    size="small"
                    color="success"
                    sx={{ fontSize: "0.6rem", height: "18px" }}
                  />
                )}
                {player.isNewToTeam && (
                  <Chip
                    label="New to Team"
                    size="small"
                    color="info"
                    sx={{ fontSize: "0.55rem", height: "18px" }}
                  />
                )}
              </div>
              <div className="text-gray-400 text-xs truncate mt-0.5">
                {player.team}
              </div>
              {draftedByName && (
                <div className="text-gray-500 text-xs truncate mt-0.5">
                  Drafted by {draftedByName}
                </div>
              )}
              {!draftedByName && !showButton && (
                <div className="text-gray-500 text-xs truncate mt-0.5">
                  {ownedLabel}
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[#B8860B] font-bold text-xl leading-none tabular-nums">
                {formatGoals(player.goals_2024)}
              </div>
              <div className="text-[0.6rem] text-gray-500 uppercase tracking-wide">
                goals
              </div>
            </div>
            {showButton && (
              <div className="shrink-0">
                <Button
                  variant="contained"
                  onClick={() => handleDraft(player)}
                  sx={{
                    ...mobileDraftButtonSX,
                    ...(isActionButtonDisabled(player) &&
                      mode === "transfer" && {
                        backgroundColor: "#666 !important",
                        color: "#999 !important",
                        opacity: 0.6,
                        cursor: "not-allowed",
                        "&:hover": {
                          backgroundColor: "#666 !important",
                        },
                      }),
                  }}
                  disabled={isActionButtonDisabled(player)}
                >
                  {getActionButtonText(player)}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Desktop View: Uses the existing Material‑UI Table layout with sorting controls.
  const renderDesktopView = (players: Player[]) => (
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
                  {goalsColumnLabel}
                </TableSortLabel>
              </TableCell>
              <TableCell
                style={{
                  maxWidth: "150px",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                }}
              >
                <TableSortLabel
                  active={draftInfo?.draftOrder?.includes("actions") || false}
                  direction={"asc"}
                  onClick={() => handleSort("actions")}
                >
                  Actions
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody className="bg-[var(--pitch-raised)] divide-y divide-[#B8860B]">
            {players.map((player) => {
              // Check if the player has been drafted using the draftedPlayers prop.
              const draftedRecord = draftedPlayers.find(
                (drafted) => drafted.player_id === player.id.toString()
              );
              return (
                <TableRow
                  key={player.id}
                  className="transition duration-300 ease-in-out hover:bg-[#FFD700] hover:bg-opacity-70"
                >
                  <TableCell>
                    <span className="flex items-center gap-2 flex-wrap">
                      {player.name}
                      {player.isNew && (
                        <Chip label="New" size="small" color="success" sx={{ fontSize: '0.65rem', height: '20px' }} />
                      )}
                      {player.isNewToTeam && (
                        <Chip label="New to Team" size="small" color="info" sx={{ fontSize: '0.6rem', height: '20px' }} />
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{player.team}</TableCell>
                  <TableCell>{formatGoals(player.goals_2024)}</TableCell>
                  <TableCell
                    style={{
                      maxWidth: "150px",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                    }}
                  >
                    {draftedRecord ? (
                      <span className="text-gray-500">
                        Drafted by{" "}
                        {fantasyPlayers.find(
                          (fp) =>
                            fp.FantasyPlayerId.toString() ===
                            draftedRecord.team_drafted_by
                        )?.TeamName || draftedRecord.team_drafted_by}
                      </span>
                    ) : shouldShowButton(player) ? (
                      <Button
                        variant="contained"
                        onClick={() => handleDraft(player)}
                        sx={{
                          ...draftButtonSX,
                          ...(isActionButtonDisabled(player) &&
                            mode === "transfer" && {
                              backgroundColor: "#666 !important",
                              color: "#999 !important",
                              opacity: 0.6,
                              cursor: "not-allowed",
                              "&:hover": {
                                backgroundColor: "#666 !important",
                              },
                            }),
                        }}
                        disabled={isActionButtonDisabled(player)}
                      >
                        {getActionButtonText(player)}
                      </Button>
                    ) : (
                      <span className="text-gray-500">
                        {getActionButtonText(player)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );

  return (
    <div className="w-full">
      {/*
        Filter bar. Inputs are styled dark on purpose: the page text colour is bone, and a
        white input inherits it, so anything typed (and the selected team) was white-on-white.
      */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search players"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="p-2 rounded w-full max-w-xs bg-[#1a1a1a] text-white placeholder-gray-500 border border-[#B8860B]/60 focus:border-[#B8860B] focus:outline-none"
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            displayEmpty
            sx={{
              bgcolor: "#1a1a1a",
              color: "white",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(184, 134, 11, 0.6)",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "#B8860B",
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "#B8860B",
              },
              "& .MuiSvgIcon-root": { color: "#B8860B" },
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  bgcolor: "#1a1a1a",
                  color: "white",
                  border: "1px solid rgba(184, 134, 11, 0.6)",
                  "& .MuiMenuItem-root.Mui-selected": {
                    bgcolor: "rgba(184, 134, 11, 0.25)",
                  },
                  "& .MuiMenuItem-root:hover": {
                    bgcolor: "rgba(184, 134, 11, 0.15)",
                  },
                },
              },
            }}
          >
            <MenuItem value="all">All Teams</MenuItem>
            {uniqueTeams.map((team) => (
              <MenuItem key={team} value={team}>
                {team}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <div className="flex items-center gap-4">
          <label
            className="flex items-center gap-2 cursor-pointer text-white whitespace-nowrap"
            title={
              mode === "transfer"
                ? "Joined MLS from outside the league on or after Jul 13, 2026 (summer window)"
                : "New to MLS this season"
            }
          >
            <input
              type="checkbox"
              checked={showNewOnly}
              onChange={(e) => setShowNewOnly(e.target.checked)}
              className="w-4 h-4"
            />
            New to MLS
          </label>
          <label
            className="flex items-center gap-2 cursor-pointer text-white whitespace-nowrap"
            title={
              mode === "transfer"
                ? "Joined their current club on or after Jul 13, 2026 (summer window), from anywhere"
                : "Changed MLS club this season"
            }
          >
            <input
              type="checkbox"
              checked={showNewToTeamOnly}
              onChange={(e) => setShowNewToTeamOnly(e.target.checked)}
              className="w-4 h-4"
            />
            New to Team
          </label>
        </div>
        {mode === "transfer" && (showNewOnly || showNewToTeamOnly) && (
          <span className="text-xs text-gray-400 w-full">
            &ldquo;New&rdquo; means a move on or after Jul 13, 2026, when the
            summer window opened. New to Team includes arrivals from abroad, so
            it contains everyone in New to MLS.
          </span>
        )}
      </div>
      {renderMobileView(sortedPlayers)}
      {renderDesktopView(sortedPlayers)}
    </div>
  );
};

export default DraftAvailablePlayersTable;
