export interface Player {
  id: number;
  name: string;
  team: string;
  goals_2024: number;
  draftedBy?: string | null;
}

export interface DraftedPlayer {
  player_id: string;
  team_drafted_by: string;
  draft_time: string;
}

export interface DraftInfo {
  league_id: string;
  draft_status: string;
  draftOrder: string[];
  current_turn_team: string;
  draftStartTime: string;
  activeParticipants?: string[];
  numberOfRounds?: number;
  current_team_turn_ends?: string;
}

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
