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
import { Player, DraftInfo } from "../types/DraftTypes";

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
  isMobile?: boolean;
}

const DraftedPlayersTable: React.FC<DraftedPlayersTableProps> = ({
  players,
  draftInfo,
  fantasyPlayers,
  isMobile = false,
}) => {
  return (
    <div {...{ inert: "true" }}>
      <TableContainer component={Paper} className="shadow rounded-lg">
        <Table className="min-w-full divide-y divide-[#B8860B]">
          <TableHead className="bg-[#B8860B] opacity-90 h-[73px]">
            <TableRow>
              <TableCell>Pick</TableCell>
              {!isMobile && <TableCell>Round</TableCell>}
              <TableCell
                style={{
                  width: "120px",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                }}
              >
                Player
              </TableCell>
              <TableCell
                style={{
                  minWidth: isMobile ? "80px" : undefined,
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                }}
              >
                Team
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody className="bg-[#FFFFF0] divide-y divide-[#B8860B]">
            {draftInfo?.drafted_players.map((draftedPlayer, index) => {
              const player = players.find(
                (p) => p.id === draftedPlayer.player_id
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
              console.log(displayedName);
              const roundNumber =
                !isMobile && draftInfo
                  ? Math.ceil((index + 1) / draftInfo.draft_order.length)
                  : null;
              return (
                <TableRow
                  key={`${draftedPlayer.player_id}-${index}`}
                  className="transition duration-300 ease-in-out hover:bg-[#FFD700] hover:bg-opacity-70"
                >
                  <TableCell>{index + 1}</TableCell>
                  {!isMobile && <TableCell>{roundNumber}</TableCell>}
                  <TableCell
                    style={{
                      width: "120px",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                    }}
                  >
                    {player?.name || "Unknown"}
                  </TableCell>
                  <TableCell
                    style={{
                      minWidth: isMobile ? "80px" : undefined,
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
    </div>
  );
};

export default DraftedPlayersTable;
