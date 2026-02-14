export interface Player {
  id: number;
  name: string;
  team: string;
  goals_2024: number;
  draftedBy?: string | null;
  isNew?: boolean; // True if player is new to MLS (from outside league)
  isNewToTeam?: boolean; // True if player transferred within MLS (new to current team)
  // Transfer window fields
  player_dropped?: boolean;
  drop_date?: string;
  transfer_window_pickup?: boolean;
  pickup_date?: string;
}

export interface DraftedPlayer {
  player_id: string;
  team_drafted_by: string;
  draft_time: string;
  // Transfer fields
  dropped?: boolean;
  drop_date?: string;
  transfer_window_pickup?: boolean;
  pickup_date?: string;
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
  overall_pick?: number;
  current_round?: number;
  // Transfer window fields
  transfer_window_status?: string;
  transfer_window_start?: string;
  transfer_window_end?: string;
  transfer_current_turn_team?: string;
  transfer_round?: number;
  transfer_max_rounds?: number;
  transfer_snake_order?: boolean;
  transferOrder?: string[];
  // 2025 standings for draft order display
  goals2025?: { [fantasyPlayerId: string]: number };
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
    // Transfer tracking
    dropped?: boolean;
    drop_date?: string;
    goals_at_drop?: number; // Goals when player was dropped
    transfer_window_pickup?: boolean;
    pickup_date?: string;
    goals_before_pickup?: number; // Goals before being picked up
  }[];
}

// New transfer-specific interfaces
export interface TransferAction {
  fantasy_team_id: string;
  action_type: "drop" | "pickup";
  player_id: string;
  player_name: string;
  action_date: string;
  goals_at_action: number;
  transfer_round?: number;
}

export interface TransferWindowInfo {
  status: "inactive" | "active" | "completed";
  start: string;
  end: string;
  currentTurn?: string;
  round: number;
  transferOrder: string[];
  transferActions: TransferAction[];
  isActive: boolean;
  timeRemaining?: number;
  // Track which teams are in pickup mode (have dropped a player and need to pick up)
  activeTransfers?: {
    [teamId: string]: {
      step: "drop" | "pickup";
      droppedPlayerId?: string;
      droppedPlayerName?: string;
      dropTimestamp?: string;
    };
  };
  // Track which teams have marked themselves as done transferring
  finishedTransferringTeams?: Set<string> | string[];
}
