import { create } from "zustand";
import { fetchUserDetails as fetchUserDetailsAPI } from "../backend/API";

// Define the shape of each team in the raw API response.
interface RawUserDetails {
  emailAddress: string;
  fantasyPlayerName: string;
  teamName: string;
  fantasyPlayerId: string | number;
  leagueId?: string;
}

// Define the overall raw API response which contains a 'teams' key.
interface RawUserDetailsResponse {
  teams: RawUserDetails[];
}

interface UserDetails {
  email: string;
  FantasyPlayerName: string;
  LeagueId: string;
  TeamName: string;
  FantasyPlayerId: number;
}

interface UserStore {
  userDetails: UserDetails | null;
  setUserDetails: (details: UserDetails) => void;
  clearUserDetails: () => void;
  fetchUserDetails: (email: string, leagueId?: string) => Promise<void>;
}

const useUserStore = create<UserStore>((set) => ({
  userDetails: null,
  setUserDetails: (details) => set({ userDetails: details }),
  clearUserDetails: () => set({ userDetails: null }),
  fetchUserDetails: async (email: string, leagueId?: string) => {
    try {
      // Cast the response to our RawUserDetailsResponse type.
      const rawResponse = (await fetchUserDetailsAPI(
        email,
        leagueId
      )) as unknown as RawUserDetailsResponse;

      if (rawResponse && rawResponse.teams && rawResponse.teams.length > 0) {
        const rawData = rawResponse.teams[0]; // get the first team

        // Normalize the API response into a flat structure.
        const normalizedDetails: UserDetails = {
          email: rawData.emailAddress,
          FantasyPlayerName: rawData.fantasyPlayerName,
          LeagueId: leagueId ?? rawData.leagueId ?? "",
          TeamName: rawData.teamName,
          FantasyPlayerId: Number(rawData.fantasyPlayerId),
        };

        set({ userDetails: normalizedDetails });
      } else {
        console.warn(
          "No user details found for the given email and league ID."
        );
        set({ userDetails: null });
      }
    } catch (error) {
      console.error("Failed to fetch user details:", error);
      set({ userDetails: null });
    }
  },
}));

export default useUserStore;
