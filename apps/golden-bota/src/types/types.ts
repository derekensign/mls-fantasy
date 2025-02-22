export interface ProjectedScores {
  [date: string]: number;
}

export interface Prices {
  [tier: string]: number;
}

export interface Stats {
  scores: number[];
  match_scores: number[];
  round_rank: number;
  season_rank: number;
  games_played: number;
  total_points: number;
  avg_points: number;
  last_match_points: number;
  high_score: number;
  low_score: number;
  last_3_avg: number;
  last_5_avg: number;
  selections: number;
  owned_by: number;
  projected_scores: ProjectedScores;
  prices: Prices;
}

export interface SeasonStats {
  GL: number;
  ASS: number;
  PE: number;
  PS: number;
  BT: number;
}

export interface Player {
  id: number;
  sportec_id: string;
  first_name: string;
  last_name: string;
  known_name: string;
  squad_id: number;
  cost: number;
  status: "playing" | "not playing"; // Adjust based on actual possible values
  stats: Stats;
  positions: number[];
  is_bye: number; // Consider changing to boolean if it represents a binary state
  locked: number; // Consider changing to boolean if it represents a binary state
  season_stats: SeasonStats;
}

// Assuming the response is an array of players
type PlayersResponse = Player[];
