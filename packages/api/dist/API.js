"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinLeague = exports.fetchDraftedPlayers = exports.fetchActiveParticipants = exports.joinDraftSession = exports.updateDraftSettings = exports.getLeagueSettings = exports.updateLeagueSettings = exports.fetchFantasyPlayersByLeague = exports.getDraftSettings = exports.fetchUserDetails = exports.fetchLeagueData = exports.draftPlayer = exports.initializeLeague = exports.fetchPlayers2025 = exports.fetchGoldenBootTable = void 0;
exports.createLeague = createLeague;
exports.updateTeamProfile = updateTeamProfile;
const axios_1 = __importDefault(require("axios"));
const BASE_URL = "https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod";
const fetchGoldenBootTable = async (leagueId) => {
    try {
        const response = await axios_1.default.get(`${BASE_URL}/golden-boot-table/${leagueId}`);
        return response.data;
    }
    catch (error) {
        console.error("Failed to fetch teams:", error);
        return [];
    }
};
exports.fetchGoldenBootTable = fetchGoldenBootTable;
const fetchPlayers2025 = async () => {
    try {
        const response = await axios_1.default.get(`${BASE_URL}/get-all-players`);
        return response.data;
    }
    catch (error) {
        console.error("Failed to fetch players", error);
        return [];
    }
};
exports.fetchPlayers2025 = fetchPlayers2025;
const initializeLeague = async (leagueId, players) => {
    try {
        const payload = {
            league_id: leagueId,
            players,
        };
        const response = await axios_1.default.post(`${BASE_URL}/league/initialize`, payload);
        return response.data;
    }
    catch (error) {
        console.error("Error initializing league:", error);
        throw error;
    }
};
exports.initializeLeague = initializeLeague;
const draftPlayer = async (leagueId, playerId, team) => {
    try {
        const payload = {
            league_id: leagueId,
            player_id: playerId,
            team_drafted_by: team,
        };
        const response = await axios_1.default.post(`${BASE_URL}/league/${leagueId}/draft`, payload);
        return response.data;
    }
    catch (error) {
        console.error("Error drafting player:", error);
        throw error;
    }
};
exports.draftPlayer = draftPlayer;
const fetchLeagueData = async (leagueId) => {
    try {
        const response = await axios_1.default.get(`${BASE_URL}/league/${leagueId}`);
        return response.data;
    }
    catch (error) {
        console.error("Error fetching league data:", error);
        throw error;
    }
};
exports.fetchLeagueData = fetchLeagueData;
const fetchUserDetails = async (email, leagueId) => {
    try {
        const params = leagueId ? { email, leagueId } : { email };
        const response = await axios_1.default.get(`${BASE_URL}/get-user-info`, { params });
        return response.data;
    }
    catch (error) {
        console.error("Error fetching user details:", error);
        throw error;
    }
};
exports.fetchUserDetails = fetchUserDetails;
// Existing function for fetching draft data using Axios.
const getDraftSettings = async (leagueId) => {
    var _a;
    const response = await axios_1.default.get(`${BASE_URL}/league/${leagueId}/draft-settings`);
    const data = response.data;
    // Convert incoming data to match DraftInfo.
    const draftInfo = {
        league_id: data.league_id || "",
        draft_status: data.draft_status || "",
        draftOrder: data.draftOrder
            ? data.draftOrder.map((item) => (item.S ? item.S : item))
            : [],
        current_turn_team: (_a = data.current_turn_team) !== null && _a !== void 0 ? _a : "",
        draftStartTime: data.draftStartTime || "",
        numberOfRounds: data.numberOfRounds || 5,
        activeParticipants: data.activeParticipants || [],
        current_team_turn_ends: data.current_team_turn_ends || "",
    };
    return draftInfo;
};
exports.getDraftSettings = getDraftSettings;
// New function for the /players/{league_id} route
const fetchFantasyPlayersByLeague = async (leagueId) => {
    try {
        const response = await axios_1.default.get(`${BASE_URL}/players/${leagueId}`);
        return response.data;
    }
    catch (error) {
        console.error("Error fetching fantasy players:", error);
        throw error;
    }
};
exports.fetchFantasyPlayersByLeague = fetchFantasyPlayersByLeague;
// New function for updating league settings
const updateLeagueSettings = async (leagueId, settings) => {
    try {
        const response = await axios_1.default.post(`${BASE_URL}/league/${leagueId}/settings`, settings);
        return response.data;
    }
    catch (error) {
        console.error("Error updating league settings:", error);
        throw error;
    }
};
exports.updateLeagueSettings = updateLeagueSettings;
// New function for fetching league settings
const getLeagueSettings = async (leagueId) => {
    try {
        const response = await axios_1.default.get(`${BASE_URL}/league/${leagueId}/settings`);
        return response.data;
    }
    catch (error) {
        console.error("Error fetching league settings:", error);
        throw error;
    }
};
exports.getLeagueSettings = getLeagueSettings;
// New function for updating draft data
const updateDraftSettings = async (leagueId, settings) => {
    try {
        const response = await axios_1.default.post(`${BASE_URL}/league/${leagueId}/draft-settings`, settings);
        return response.data;
    }
    catch (error) {
        console.error("Error updating draft data:", error);
        throw error;
    }
};
exports.updateDraftSettings = updateDraftSettings;
// New function to join a draft session
const joinDraftSession = async (leagueId, teamId) => {
    // TODO: Implement this endpoint to register a team as active in the draft session
    try {
        const response = await axios_1.default.post(`${BASE_URL}/league/${leagueId}/draft/join`, { teamId });
        return response.data;
    }
    catch (error) {
        console.error("Error joining draft session:", error);
        throw error;
    }
};
exports.joinDraftSession = joinDraftSession;
// New function to fetch active participants in a draft session
const fetchActiveParticipants = async (leagueId) => {
    // TODO: Implement this endpoint to return a list of active team IDs in the draft session
    try {
        const response = await axios_1.default.get(`${BASE_URL}/league/${leagueId}/active-participants`);
        return response.data;
    }
    catch (error) {
        console.error("Error fetching active participants:", error);
        return [];
    }
};
exports.fetchActiveParticipants = fetchActiveParticipants;
// Add this function below your other API functions
const fetchDraftedPlayers = async (leagueId) => {
    try {
        // Placeholder: update the URL once the new endpoint is ready
        const response = await axios_1.default.get(`${BASE_URL}/league/${leagueId}/draft`);
        return response.data;
    }
    catch (error) {
        console.error("Error fetching drafted players:", error);
        throw error;
    }
};
exports.fetchDraftedPlayers = fetchDraftedPlayers;
/**
 * Sends a POST request to create a new league.
 *
 * @param payload - The league information including leagueName, fantasyPlayerId, and commissionerEmail.
 * @returns A promise resolving to the response containing a success message and leagueId.
 */
async function createLeague(payload) {
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
/**
 * Submits an update to the team profile.
 * This function will create a new record if FantasyPlayerId is absent,
 * and update an existing record if FantasyPlayerId is provided.
 *
 * @param payload - The payload should conform to UpdateTeamProfileRequest.
 * @returns The updated team profile information.
 */
async function updateTeamProfile(payload) {
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
const joinLeague = async (leagueId, fantasyPlayerId) => {
    try {
        const payload = {
            FantasyPlayerId: fantasyPlayerId,
            LeagueId: Number(leagueId),
        };
        const response = await axios_1.default.post(`${BASE_URL}/league/${leagueId}/join`, payload);
        return response.data;
    }
    catch (error) {
        console.error("Error joining league:", error);
        throw error;
    }
};
exports.joinLeague = joinLeague;
