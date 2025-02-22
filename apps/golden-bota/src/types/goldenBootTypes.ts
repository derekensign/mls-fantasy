export interface Player {
  playerId: number;
  PlayerName: string;
  Goals: number;
}

export interface Team {
  rank: number;
  TeamName: string;
  FantasyPlayerName: string;
  TotalGoals: number;
  Players: Player[];
}

export interface GoldenBootTableResponse {
  TeamName: string;
  FantasyPlayerName: string;
  TotalGoals: number;
  Players: Player[];
}