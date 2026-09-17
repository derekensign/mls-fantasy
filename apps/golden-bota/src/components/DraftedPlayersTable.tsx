import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import {
  DraftedPlayer,
  Player,
  DraftInfo,
  TransferAction,
} from "../types/DraftTypes";

// Define an interface for your league data based on what fetchLeagueData returns:
interface LeagueData {
  // For example, fantasyPlayers might be an array of objects with an id, teamName, and firstName.
  fantasyPlayers: { id: string; teamName?: string; firstName: string }[];
}

// Define the FantasyPlayer type based on the sample object
export interface FantasyPlayer {
  LeagueId: number;
  FantasyPlayerId: number;
  TotalGoals: number;
  TeamName: string;
  FantasyPlayerName: string;
  Players: {
    Goals: number;
    playerId: number;
    PlayerName: string;
  }[];
}

interface DraftedPlayersTableProps {
  players: Player[];
  draftInfo: DraftInfo | null;
  fantasyPlayers: FantasyPlayer[];
  draftedPlayers: DraftedPlayer[];
  isMobile?: boolean;
  transferActions?: TransferAction[];
  // "transfer" renders the pickup/drop history; anything else renders the preseason draft table.
  mode?: string;
}

const DraftedPlayersTable: React.FC<DraftedPlayersTableProps> = ({
  players,
  draftInfo,
  fantasyPlayers,
  draftedPlayers,
  isMobile = false,
  transferActions,
  mode,
}) => {
  // Determine the total number of teams.
  // Prefer the draft order array from draftInfo; otherwise, use the number of fantasy players.
  const totalTeams =
    draftInfo?.draftOrder?.length || fantasyPlayers.length || 1;

  // Transfer mode is decided by the caller. It used to be inferred from whether any actions
  // existed, so before the first pick of a window the drawer fell through to an empty draft table.
  const isTransferMode =
    mode === "transfer" || (transferActions && transferActions.length > 0);
  const playerMoves = (transferActions || []).filter(
    (action) =>
      action.action_type === "drop" || action.action_type === "pickup"
  );

  return (
    <div className={isMobile ? "drawer-table" : ""}>
      {/* Transfer Actions Section (newest first) */}
      {isTransferMode && (
        <div className="p-4 bg-[var(--pitch-raised)]">
          {playerMoves.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-8">
              No transfers yet. Picks will appear here as they happen.
            </div>
          ) : (
            <div className="space-y-2">
              {[...playerMoves].reverse().map((action, index) => {
                const team = fantasyPlayers.find(
                  (fp) =>
                    fp.FantasyPlayerId.toString() === action.fantasy_team_id
                );
                const when = action.action_date
                  ? new Date(action.action_date).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "";
                return (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-[#1a1a1a] border border-[#B8860B]/50"
                  >
                    <div className="text-white font-semibold text-sm">
                      {team?.TeamName || "Unknown Team"}
                    </div>
                    <div className="text-sm text-gray-300 mt-0.5">
                      <span
                        className={`font-bold ${
                          action.action_type === "drop"
                            ? "text-red-400"
                            : "text-green-400"
                        }`}
                      >
                        {action.action_type === "drop"
                          ? "Dropped"
                          : "Picked up"}
                      </span>{" "}
                      {action.player_name}
                    </div>
                    {when && (
                      <div className="text-xs text-gray-500 mt-0.5">{when}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Only show the drafted players table for draft mode, not transfer mode */}
      {!isTransferMode && (
        <TableContainer
          component={Paper}
          className={`shadow ${
            !isMobile ? "my-[96px] rounded-lg " : "my-0 rounded-none"
          }`}
          sx={{ overflowX: "auto" }}
        >
          <Table
            className="divide-y divide-[#B8860B]"
            sx={{ tableLayout: "fixed", width: "100%" }}
          >
            <TableHead className="bg-[#B8860B] opacity-90 h-[58px] ">
              <TableRow>
                <TableCell>Pick</TableCell>
                {!isMobile && <TableCell>Round</TableCell>}
                <TableCell
                  sx={{
                    width: "150px",
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  }}
                >
                  Player
                </TableCell>
                <TableCell
                  style={{
                    minWidth: "150px",
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  }}
                >
                  Team
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody className="bg-[var(--pitch-raised)] divide-y divide-[#B8860B]">
              {draftedPlayers.map((draftedPlayer, index) => {
                const player = players.find(
                  (p) => p.id.toString() === draftedPlayer.player_id
                );
                const fantasyPlayer = fantasyPlayers.find(
                  (fp) =>
                    fp.FantasyPlayerId.toString() ===
                    draftedPlayer.team_drafted_by
                );
                const displayedName =
                  fantasyPlayer?.TeamName?.trim() ||
                  fantasyPlayer?.FantasyPlayerName ||
                  fantasyPlayer?.FantasyPlayerId;
                // Calculate round number using the overall pick number (index + 1)
                // Round = floor((pickNumber -1)/ totalTeams) + 1
                const roundNumber = !isMobile
                  ? Math.floor(index / totalTeams) + 1
                  : null;
                return (
                  <TableRow
                    key={`${draftedPlayer.player_id}-${index}`}
                    className="transition duration-300 ease-in-out hover:bg-[#FFD700] hover:bg-opacity-70"
                  >
                    <TableCell>{index + 1}</TableCell>
                    {!isMobile && <TableCell>{roundNumber}</TableCell>}
                    <TableCell
                      sx={{
                        width: "150px",
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                      }}
                    >
                      {player?.name || draftedPlayer.player_id}
                    </TableCell>
                    <TableCell
                      style={{
                        minWidth: "300px",
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                      }}
                    >
                      {displayedName}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
};

export default DraftedPlayersTable;
