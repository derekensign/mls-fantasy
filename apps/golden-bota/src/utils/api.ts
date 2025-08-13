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
  goals_2025: number;
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
): Promise<any> => {
  try {
    const payload = {
      player_id: playerId,
      team_id: teamId,
    };
    console.log("🚀 Calling dropPlayer API:", {
      url: `${BASE_URL}/league/${leagueId}/transfer/drop`,
      payload,
    });
    const response = await axios.post(
      `${BASE_URL}/league/${leagueId}/transfer/drop`,
      payload
    );
    console.log("✅ dropPlayer response:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error dropping player:", error);
    if (axios.isAxiosError(error)) {
      console.error("API Error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
      });
    }
    throw error;
  }
};

export const pickupPlayer = async (
  leagueId: string,
  playerId: string,
  teamId: string
): Promise<any> => {
  try {
    const payload = {
      player_id: playerId,
      team_id: teamId,
    };
    console.log("🚀 Calling pickupPlayer API:", {
      url: `${BASE_URL}/league/${leagueId}/transfer/pickup`,
      payload,
    });
    const response = await axios.post(
      `${BASE_URL}/league/${leagueId}/transfer/pickup`,
      payload
    );
    console.log("✅ pickupPlayer response:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error picking up player:", error);
    if (axios.isAxiosError(error)) {
      console.error("API Error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
      });
    }
    throw error;
  }
};

export const advanceTransferTurn = async (leagueId: string): Promise<any> => {
  try {
    console.log("🚀 Calling advanceTransferTurn API:", {
      url: `${BASE_URL}/league/${leagueId}/transfer/advance`,
    });
    const response = await axios.post(
      `${BASE_URL}/league/${leagueId}/transfer/advance`
    );
    console.log("✅ advanceTransferTurn response:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error advancing transfer turn:", error);
    if (axios.isAxiosError(error)) {
      console.error("API Error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
      });
    }
    throw error;
  }
};
