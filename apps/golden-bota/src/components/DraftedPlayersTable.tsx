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
}

const DraftedPlayersTable: React.FC<DraftedPlayersTableProps> = ({
  players,
  draftInfo,
  fantasyPlayers,
  draftedPlayers,
  isMobile = false,
  transferActions,
}) => {
  // Determine the total number of teams.
  // Prefer the draft order array from draftInfo; otherwise, use the number of fantasy players.
  const totalTeams =
    draftInfo?.draftOrder?.length || fantasyPlayers.length || 1;

  // Determine if we're in transfer mode based on transfer actions
  const isTransferMode = transferActions && transferActions.length > 0;

  return (
    <div className={isMobile ? "drawer-table" : ""}>
      {/* Transfer Actions Section */}
      {isTransferMode && (
        <div className="p-4 bg-[#FFFFF0]">
          <div className="space-y-2">
            {transferActions
              .filter(
                (action) =>
                  action.action_type === "drop" ||
                  action.action_type === "pickup"
              )
              .map((action, index) => {
                const team = fantasyPlayers.find(
                  (fp) =>
                    fp.FantasyPlayerId.toString() === action.fantasy_team_id
                );
                return (
                  <div
                    key={index}
                    className="p-2 border border-[#B8860B] rounded"
                  >
                    <div className="font-medium text-sm">
                      {team?.TeamName || "Unknown Team"}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span
                        className={`font-bold ${
                          action.action_type === "drop"
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {action.action_type === "drop"
                          ? "Dropped"
                          : "Picked up"}
                      </span>
                      : {action.player_name} on{" "}
                      {action.action_date
                        ? new Date(action.action_date).toLocaleDateString()
                        : "Invalid Date"}
                    </div>
                  </div>
                );
              })}
          </div>
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
            <TableBody className="bg-[#FFFFF0] divide-y divide-[#B8860B]">
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
