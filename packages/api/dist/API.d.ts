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
}
export interface GoldenBootTableResponse {
    TeamName: string;
    FantasyPlayerName: string;
    TotalGoals: number;
    Players: Player[];
}
export interface Player {
    id: string;
    name: string;
    team: string;
    goals_2025: number;
}
export interface InitializeLeaguePayload {
    league_id: string;
    players: Player[];
}
export interface DraftPlayerPayload {
    league_id: string;
    player_id: string;
    team_drafted_by: string;
}
export interface UserDetailsResponse {
    email: string;
    FantasyPlayerName: string;
    LeagueId: string;
    TeamName: string;
    FantasyPlayerId: number;
}
export interface FantasyPlayer {
    FantasyPlayerId: number;
    EmailAddress: string;
    LeagueId: number;
    FantasyPlayerName: string;
    TotalGoals: number;
    TeamName: string;
    Players: any[];
}
export interface DraftData {
    league_id: string;
    current_turn_team?: string;
    draftOrder: string[];
    draft_status: string;
    drafted_players: string[];
    draftStartTime?: string;
    numberOfRounds?: number;
    activeParticipants?: string[];
}
export declare const fetchGoldenBootTable: (leagueId: string) => Promise<GoldenBootTableResponse[]>;
export declare const fetchPlayers2025: () => Promise<Player[]>;
export declare const initializeLeague: (leagueId: string, players: Player[]) => Promise<any>;
export declare const draftPlayer: (leagueId: string, playerId: string, team: string) => Promise<any>;
export declare const fetchLeagueData: (leagueId: string) => Promise<any>;
export declare const fetchUserDetails: (email: string, leagueId?: string) => Promise<UserDetailsResponse[]>;
export declare const getDraftSettings: (leagueId: string) => Promise<DraftInfo>;
export declare const fetchFantasyPlayersByLeague: (leagueId: string) => Promise<FantasyPlayer[]>;
export declare const updateLeagueSettings: (leagueId: string, settings: {
    leagueName: string;
    commissioner: {
        name: string;
        email: string;
    };
}) => Promise<any>;
export declare const getLeagueSettings: (leagueId?: string) => Promise<any>;
export declare const updateDraftSettings: (leagueId: string, settings: {
    draftStartTime?: string;
    numberOfRounds?: number;
    draftOrder?: string[];
    current_turn_team?: string;
    current_team_turn_ends?: string;
    overall_pick?: number;
    current_round?: number;
}) => Promise<DraftInfo | null>;
export declare const joinDraftSession: (leagueId: string, teamId: string) => Promise<any>;
export declare const fetchActiveParticipants: (leagueId: string) => Promise<string[]>;
export declare const fetchDraftedPlayers: (leagueId: string) => Promise<any>;
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
export declare function createLeague(payload: CreateLeagueRequest): Promise<CreateLeagueResponse>;
export interface UpdateTeamProfileRequest {
    FantasyPlayerId?: number;
    TeamName: string;
    TeamLogo?: string;
}
export interface UpdateTeamProfileResponse {
    FantasyPlayerId: number;
    TeamName: string;
    TeamLogo?: string;
}
/**
 * Submits an update to the team profile.
 * This function will create a new record if FantasyPlayerId is absent,
 * and update an existing record if FantasyPlayerId is provided.
 *
 * @param payload - The payload should conform to UpdateTeamProfileRequest.
 * @returns The updated team profile information.
 */
export declare function updateTeamProfile(payload: UpdateTeamProfileRequest): Promise<UpdateTeamProfileResponse>;
export declare const joinLeague: (leagueId: string, fantasyPlayerId: number) => Promise<any>;
export declare const getTransferWindowInfo: (leagueId: string) => Promise<any>;
export declare const pickupPlayer: (leagueId: string, playerId: string, teamId: string) => Promise<any>;
export declare const dropPlayer: (leagueId: string, playerId: string, teamId: string) => Promise<any>;
export declare const advanceTransferTurn: (leagueId: string) => Promise<any>;
export declare const getDraftedPlayersByLeague: (leagueId: string) => Promise<any>;
