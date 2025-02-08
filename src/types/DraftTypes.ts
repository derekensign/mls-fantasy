export interface Player {
  id: string;
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
  draft_order: string[];
  current_turn_team: string;
  drafted_players: DraftedPlayer[];
}
