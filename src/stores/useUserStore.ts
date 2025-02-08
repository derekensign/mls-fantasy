import { create } from "zustand";
import { fetchUserDetails as fetchUserDetailsAPI } from "../../backend/API";

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
      // Fetch raw user details from the API
      const userDetails = await fetchUserDetailsAPI(email, leagueId);
      console.log("Raw Response for User Details:", userDetails);

      if (userDetails.length > 0) {
        const rawData = userDetails[0]; // Assuming the first object is the relevant one

        // Normalize the DynamoDB response into a flat structure
        const normalizedDetails: UserDetails = {
          email: rawData.EmailAddress.S,
          FantasyPlayerName: rawData.FantasyPlayerName.S,
          LeagueId: rawData.LeagueId.N,
          TeamName: rawData.TeamName.S,
          FantasyPlayerId: parseInt(rawData.FantasyPlayerId.N, 10), // Convert number strings to actual numbers
        };

        console.log("Normalized User Details:", normalizedDetails);
        set({ userDetails: normalizedDetails }); // Set the normalized data in Zustand store
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
