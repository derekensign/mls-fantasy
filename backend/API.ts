import axios, { AxiosResponse } from "axios";

const BASE_URL = "https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod";

// Define types for the responses and payloads
interface GoldenBootTableResponse {
  // Define the structure of the response if known
}

interface Player {
  id: string;
  name: string;
  team: string;
  // Add more fields as per your data structure
}

interface InitializeLeaguePayload {
  league_id: string;
  players: Player[];
}

interface DraftPlayerPayload {
  league_id: string;
  player_id: string;
  team_drafted_by: string;
}

interface UserDetailsResponse {
  email: string;
  FantasyPlayerName: string;
  LeagueId: string;
  TeamName: string;
  FantasyPlayerId: number;
}

export const fetchGoldenBootTable = async (): Promise<
  GoldenBootTableResponse[]
> => {
  try {
    const response: AxiosResponse<GoldenBootTableResponse[]> = await axios.get(
      `${BASE_URL}/golden-boot-table`
    );
    console.log("Response", response);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch teams:", error);
    return [];
  }
};

export const fetchPlayers2024 = async (): Promise<Player[]> => {
  try {
    const response: AxiosResponse<Player[]> = await axios.get(
      `${BASE_URL}/get-all-players`
    );
    console.log("Response for Players 2024:", response);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch players 2024:", error);
    return [];
  }
};

export const initializeLeague = async (
  leagueId: string,
  players: Player[]
): Promise<any> => {
  try {
    const payload: InitializeLeaguePayload = {
      league_id: leagueId,
      players,
    };
    const response: AxiosResponse<any> = await axios.post(
      `${BASE_URL}/league/initialize`,
      payload
    );
    return response.data;
  } catch (error) {
    console.error("Error initializing league:", error);
    throw error;
  }
};

export const draftPlayer = async (
  leagueId: string,
  playerId: string,
  team: string
): Promise<any> => {
  try {
    const payload: DraftPlayerPayload = {
      league_id: leagueId,
      player_id: playerId,
      team_drafted_by: team,
    };
    const response: AxiosResponse<any> = await axios.post(
      `${BASE_URL}/league/draft`,
      payload
    );
    return response.data;
  } catch (error) {
    console.error("Error drafting player:", error);
    throw error;
  }
};

export const fetchLeagueData = async (leagueId: string): Promise<any> => {
  console.log("Fetching league data for league ID:", leagueId);
  try {
    const response: AxiosResponse<any> = await axios.get(
      `${BASE_URL}/league/${leagueId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching league data:", error);
    throw error;
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
    console.log("User details response:", response);
    return response.data;
  } catch (error) {
    console.error("Error fetching user details:", error);
    throw error;
  }
};

export const fetchDraftData = async (leagueId: string) => {
  try {
    const response = await axios.get(`${BASE_URL}/league/${leagueId}/draft`);
    return response.data;
  } catch (error) {
    console.error("Error fetching draft data:", error);
    return null;
  }
};
