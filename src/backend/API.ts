import axios, { AxiosResponse } from "axios";
import { DraftInfo } from "../types/DraftTypes";

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

// New interface for the fantasy players returned by the /players/{league_id} endpoint.
export interface FantasyPlayer {
  FantasyPlayerId: number;
  EmailAddress: string;
  LeagueId: number;
  FantasyPlayerName: string;
  TotalGoals: number;
  TeamName: string;
  Players: any[]; // Update this if you wish to define a specific type for Players.
}

// New interface for Draft data from the /league/{leagueId}/draft endpoint.
export interface DraftData {
  league_id: string;
  current_turn_team?: string;
  draftOrder: string[];
  draft_status: string;
  drafted_players: string[];
  // If you add these fields via the update endpoint...
  draftStartTime?: string;
  numberOfRounds?: number;
  activeParticipants?: string[];
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
      `${BASE_URL}/league/${leagueId}/draft`,
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

// Existing function for fetching draft data using Axios.
export const getDraftSettings = async (
  leagueId: string
): Promise<DraftData | null> => {
  try {
    const response: AxiosResponse<DraftData> = await axios.get(
      `${BASE_URL}/league/${leagueId}/draft-settings`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching draft data:", error);
    return null;
  }
};

// New function for the /players/{league_id} route
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

// New function for updating league settings
export const updateLeagueSettings = async (
  leagueId: string,
  settings: {
    leagueName: string;
    commissioner: { name: string; email: string };
  }
): Promise<any> => {
  try {
    const response = await axios.post(
      `${BASE_URL}/league/${leagueId}/settings`,
      settings
    );
    return response.data;
  } catch (error) {
    console.error("Error updating league settings:", error);
    throw error;
  }
};

// New function for fetching league settings
export const getLeagueSettings = async (leagueId?: string): Promise<any> => {
  try {
    const response = await axios.get(`${BASE_URL}/league/${leagueId}/settings`);
    return response.data;
  } catch (error) {
    console.error("Error fetching league settings:", error);
    throw error;
  }
};

// New function for updating draft data
export const updateDraftSettings = async (
  leagueId: string,
  {
    draftStartTime,
    numberOfRounds = 5,
    draftOrder,
  }: { draftStartTime: string; numberOfRounds?: number; draftOrder: string[] }
): Promise<any> => {
  try {
    const response: AxiosResponse<any> = await axios.post(
      `${BASE_URL}/league/${leagueId}/draft-settings`,
      { draftStartTime, numberOfRounds, draftOrder }
    );
    return response.data;
  } catch (error) {
    console.error("Error updating draft data:", error);
    throw error;
  }
};

// New function to join a draft session
export const joinDraftSession = async (
  leagueId: string,
  teamId: string
): Promise<any> => {
  // TODO: Implement this endpoint to register a team as active in the draft session
  try {
    const response: AxiosResponse<any> = await axios.post(
      `${BASE_URL}/league/${leagueId}/draft/join`,
      { teamId }
    );
    return response.data;
  } catch (error) {
    console.error("Error joining draft session:", error);
    throw error;
  }
};

// New function to fetch active participants in a draft session
export const fetchActiveParticipants = async (
  leagueId: string
): Promise<string[]> => {
  // TODO: Implement this endpoint to return a list of active team IDs in the draft session
  try {
    const response: AxiosResponse<string[]> = await axios.get(
      `${BASE_URL}/league/${leagueId}/active-participants`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching active participants:", error);
    return [];
  }
};

// Add this function below your other API functions
export const fetchDraftedPlayers = async (leagueId: string): Promise<any> => {
  try {
    // Placeholder: update the URL once the new endpoint is ready
    const response = await axios.get(`${BASE_URL}/league/${leagueId}/draft`);
    return response.data;
  } catch (error) {
    console.error("Error fetching drafted players:", error);
    throw error;
  }
};

export interface CreateLeagueRequest {
  leagueName: string;
  fantasyPlayerId: string;
  commissionerEmail: string;
}

export interface CreateLeagueResponse {
  message: string;
  leagueId?: string;
}

/**
 * Sends a POST request to create a new league.
 *
 * @param payload - The league information including leagueName, fantasyPlayerId, and commissionerEmail.
 * @returns A promise resolving to the response containing a success message and leagueId.
 */
export async function createLeague(
  payload: CreateLeagueRequest
): Promise<CreateLeagueResponse> {
  console.log("Creating league with payload:", payload);
  const response = await fetch(`${BASE_URL}/league/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // Attempt to parse the error message from the response.
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to create league");
  }

  return response.json();
}

export interface UpdateTeamProfileRequest {
  // If provided, this is used to update an existing profile.
  // If omitted, the backend will generate a new, unique FantasyPlayerId.
  FantasyPlayerId?: number;
  TeamName: string;
  // TeamLogo is optional.
  TeamLogo?: string;
}

export interface UpdateTeamProfileResponse {
  FantasyPlayerId: number;
  TeamName: string;
  TeamLogo?: string;
  // You can add additional return properties as needed.
}

/**
 * Submits an update to the team profile.
 * This function will create a new record if FantasyPlayerId is absent,
 * and update an existing record if FantasyPlayerId is provided.
 *
 * @param payload - The payload should conform to UpdateTeamProfileRequest.
 * @returns The updated team profile information.
 */
export async function updateTeamProfile(
  payload: UpdateTeamProfileRequest
): Promise<UpdateTeamProfileResponse> {
  const response = await fetch(`${BASE_URL}/update-team`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // Attempt to parse the error message from the response.
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to update team profile");
  }

  return response.json();
}

export const joinLeague = async (
  leagueId: string,
  fantasyPlayerId: number
): Promise<any> => {
  try {
    const payload = {
      FantasyPlayerId: fantasyPlayerId,
      LeagueId: Number(leagueId),
    };
    const response = await axios.post(
      `${BASE_URL}/league/${leagueId}/join`,
      payload
    );
    return response.data;
  } catch (error) {
    console.error("Error joining league:", error);
    throw error;
  }
};
