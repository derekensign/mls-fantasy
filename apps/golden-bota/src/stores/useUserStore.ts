import { create } from "zustand";
import { fetchUserDetails as fetchUserDetailsAPI } from "@mls-fantasy/api";

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
  fantasyPlayerName: string; // Changed to match API response
  leagueId: number; // Changed to match API response
  teamName: string; // Changed to match API response
  fantasyPlayerId: number; // Changed to match API response
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
  fetchUserDetails: async (email: string) => {
    try {
      const response = await fetch(
        "https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod/get-my-team",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      if (response.ok) {
        const rawData = await response.json();

        if (rawData.teams && rawData.teams.length > 0) {
          const userDetails = rawData.teams[0];
          set({ userDetails });
          return userDetails;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  },
}));

export default useUserStore;
