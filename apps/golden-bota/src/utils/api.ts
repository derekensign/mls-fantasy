import axios, { AxiosResponse } from "axios";

const BASE_URL = "https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod";

export interface FantasyPlayer {
  FantasyPlayerId: number;
  EmailAddress: string;
  LeagueId: number;
  FantasyPlayerName: string;
  TotalGoals: number;
  TeamName: string;
  Players: any[];
}

export interface UserDetailsResponse {
  email: string;
  FantasyPlayerName: string;
  LeagueId: string;
  TeamName: string;
  FantasyPlayerId: number;
}

export interface Player {
  id: string;
  name: string;
  team: string;
  goals_2026: number;
}

// Transfer Window Functions
export const getTransferWindowInfo = async (leagueId: string): Promise<any> => {
  try {
    const response = await axios.get(`${BASE_URL}/league/${leagueId}/transfer`);
    return response.data;
  } catch (error) {
    console.error("Error getting transfer window info:", error);
    throw error;
  }
};

export const fetchFantasyPlayersByLeague = async (
  leagueId: string
): Promise<FantasyPlayer[]> => {
  try {
    const response: AxiosResponse<FantasyPlayer[]> = await axios.get(
      `${BASE_URL}/players/${leagueId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching fantasy players:", error);
    throw error;
  }
};

export const fetchDraftedPlayers = async (leagueId: string): Promise<any> => {
  try {
    const response = await axios.get(`${BASE_URL}/league/${leagueId}/draft`);
    return response.data;
  } catch (error) {
    console.error("Error fetching drafted players:", error);
    throw error;
  }
};

export const fetchPlayers2025 = async (): Promise<Player[]> => {
  try {
    const response: AxiosResponse<Player[]> = await axios.get(
      `${BASE_URL}/get-all-players`
    );
    return response.data;
  } catch (error) {
    console.error("Failed to fetch players", error);
    return [];
  }
};

export const fetchUserDetails = async (
  email: string,
  leagueId?: string
): Promise<UserDetailsResponse[]> => {
  try {
    const params = leagueId ? { email, leagueId } : { email };
    const response: AxiosResponse<UserDetailsResponse[]> = await axios.get(
      `${BASE_URL}/get-user-info`,
      { params }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching user details:", error);
    throw error;
  }
};

export const dropPlayer = async (
  leagueId: string,
  playerId: string,
  teamId: string
) => {
  try {
    const payload = {
      player_id: playerId,
      team_id: teamId,
    };
    const response = await axios.post(
      `${BASE_URL}/league/${leagueId}/transfer/drop`,
      payload
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw error;
    }
    throw new Error("Failed to drop player");
  }
};

export const pickupPlayer = async (
  leagueId: string,
  playerId: string,
  teamId: string,
  droppedPlayerId: string
) => {
  try {
    const payload = {
      player_id: playerId,
      team_id: teamId,
      dropped_player_id: droppedPlayerId,
    };
    const response = await axios.post(
      `${BASE_URL}/league/${leagueId}/transfer/pickup`,
      payload
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw error;
    }
    throw new Error("Failed to pick up player");
  }
};

export const advanceTransferTurn = async (leagueId: string) => {
  try {
    const response = await axios.post(
      `${BASE_URL}/league/${leagueId}/transfer/advance-turn`
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw error;
    }
    throw new Error("Failed to advance transfer turn");
  }
};
