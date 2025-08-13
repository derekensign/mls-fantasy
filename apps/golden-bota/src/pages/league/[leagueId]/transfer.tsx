import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useRouter } from "next/router";
import { useAuth } from "react-oidc-context";
import * as API from "@mls-fantasy/api";
import useUserStore from "../../../stores/useUserStore";
import {
  Player,
  FantasyPlayer,
  TransferWindowInfo,
  TransferAction,
} from "../../../types/DraftTypes";
import DraftAvailablePlayersTable from "../../../components/DraftAvailablePlayersTable";
import DraftedPlayersTable from "../../../components/DraftedPlayersTable";
import DraftedTableDrawer from "../../../components/DraftedTableDrawer";
import Button from "@mui/material/Button";
import { Container, Paper, Typography, Box, Alert } from "@mui/material";

const TransferWindowPage: React.FC = () => {
  const auth = useAuth();
  const router = useRouter();
  const { leagueId } = router.query;
  const [players, setPlayers] = useState<Player[]>([]);
  const [transferInfo, setTransferInfo] = useState<TransferWindowInfo | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [draftDrawerOpen, setDraftDrawerOpen] = useState<boolean>(false);
  const [fantasyPlayers, setFantasyPlayers] = useState<FantasyPlayer[]>([]);
  const [draftedPlayersFromLeague, setDraftedPlayersFromLeague] = useState<
    any[]
  >([]);
  const [userTeamPlayers, setUserTeamPlayers] = useState<any[]>([]);
  // Temporary local state management since old API doesn't return activeTransfers
  const [localTransferState, setLocalTransferState] = useState<{
    step: "drop" | "pickup";
    droppedPlayerId?: string;
  }>({ step: "drop" });

  // Reset local transfer state when league changes or component mounts
  useEffect(() => {
    console.log("🔄 Resetting local transfer state for league:", leagueId);
    setLocalTransferState({ step: "drop" });
  }, [leagueId]);

  const { userDetails, setUserDetails } = useUserStore();
  const [localUserDetails, setLocalUserDetails] = useState<any>(null);
  const [userDataLoaded, setUserDataLoaded] = useState<boolean>(false);

  // Use local user details instead of store to avoid race conditions
  const userFantasyPlayerId = (
    userDetails?.FantasyPlayerId || localUserDetails?.FantasyPlayerId
  )?.toString();

  // Use the database-derived FantasyPlayerId only
  const actualUserFantasyPlayerId = userFantasyPlayerId;

  // Debug user details
  console.log("🔍 Current userDetails from store:", userDetails);
  console.log("🔍 Extracted FantasyPlayerId:", actualUserFantasyPlayerId);
  console.log("🔍 League ID:", leagueId);

  // Use local state since old API doesn't return activeTransfers
  const transferStep = localTransferState.step;
  const selectedDropPlayerFromDB = localTransferState.droppedPlayerId || null;

  // Load transfer window data
  const loadTransferData = useCallback(async () => {
    if (!leagueId) return;

    try {
      // Always fetch transfer window info first (regardless of user status)
      console.log(
        "🚀 About to call API.getTransferWindowInfo for league:",
        leagueId
      );
      const transferData = await API.getTransferWindowInfo(String(leagueId));
      console.log("✅ Transfer window API response:", transferData);
      console.log("🔍 Setting transferInfo to:", transferData.transferWindow);
      console.log(
        "🔍 Transfer window status:",
        transferData.transferWindow?.status
      );
      setTransferInfo(transferData.transferWindow);

      // Don't load player data if we don't have user details yet
      if (!actualUserFantasyPlayerId) {
        console.log("No user fantasy player ID - skipping player data load");
        return;
      }

      // Fetch fantasy players data for team names and user info
      const fantasyData = await API.fetchFantasyPlayersByLeague(
        String(leagueId)
      );
      console.log("Fantasy players loaded:", fantasyData.length, "teams");
      setFantasyPlayers(fantasyData);

      // Fetch drafted players from League_{league_id} table (the correct ownership source)
      const draftedPlayersData = await API.fetchDraftedPlayers(
        String(leagueId)
      );
      console.log(
        "Drafted players from League table:",
        draftedPlayersData.length,
        "records"
      );
      setDraftedPlayersFromLeague(draftedPlayersData);

      // Create ownership map from drafted players data
      const playerOwnershipMap = new Map();
      console.log(
        "🔍 Processing drafted players data for ownership:",
        draftedPlayersData.length,
        "records"
      );
      draftedPlayersData.forEach((draftedPlayer: any) => {
        const playerId = draftedPlayer.player_id || draftedPlayer.playerId;
        const teamId = draftedPlayer.team_drafted_by;
        const isDropped = draftedPlayer.dropped;

        console.log("🔍 Player ownership:", {
          playerId,
          teamId,
          isDropped,
          droppedAt: draftedPlayer.dropped_at,
        });

        // Only add to ownership map if not dropped
        if (!isDropped) {
          // Find team name from fantasy data
          const owningTeam = fantasyData.find(
            (fp) => fp.FantasyPlayerId.toString() === teamId
          );
          const teamName =
            owningTeam?.TeamName ||
            owningTeam?.FantasyPlayerName ||
            `Team ${teamId}`;

          playerOwnershipMap.set(playerId, {
            ownerTeamName: teamName,
            ownerFantasyPlayerId: teamId,
            ownerFantasyPlayerName: owningTeam?.FantasyPlayerName || teamName,
          });
        }
      });
      console.log("🔍 Final ownership map size:", playerOwnershipMap.size);

      // Fetch ALL available players from the general API
      const allPlayersData = await API.fetchPlayers2025();
      console.log("All players loaded:", allPlayersData.length, "players");

      // Create available players list using all players but with ownership info from League table
      const availablePlayers: Player[] = allPlayersData.map((item: any) => {
        const playerId = item.id.S || item.id;
        const ownershipInfo = playerOwnershipMap.get(playerId);

        return {
          id: parseInt(playerId, 10),
          name: item.name.S || item.name || `Player ${playerId}`,
          team: item.team.S || item.team || "MLS",
          goals_2024: parseInt(item.goals_2025?.N || "0", 10), // Use 2025 data
          draftedBy: null,
          ownerTeamName: ownershipInfo?.ownerTeamName || null,
          ownerFantasyPlayerName: ownershipInfo?.ownerFantasyPlayerName || null,
          ownerFantasyPlayerId: ownershipInfo?.ownerFantasyPlayerId || null,
          player_dropped: false,
          drop_date: undefined,
          transfer_window_pickup: false,
          pickup_date: undefined,
          // Add debug info for ownership
          _debugOwnership: ownershipInfo ? true : false,
        };
      });

      setPlayers(availablePlayers);
      console.log(
        "Available players created:",
        availablePlayers.length,
        "total with",
        playerOwnershipMap.size,
        "owned players"
      );

      // Find user's current players using League table + Players data
      const userFantasyPlayerIdStr = actualUserFantasyPlayerId;
      console.log(
        "Looking for user team with FantasyPlayerId:",
        userFantasyPlayerIdStr
      );

      // Only update user team if we have valid user ID
      if (userFantasyPlayerIdStr) {
        // Get ALL players that were ever owned by the user from League table (including dropped)
        const userOwnedPlayerIds = draftedPlayersData
          .filter((dp: any) => {
            // Include if currently owned OR if dropped by this user
            return dp.team_drafted_by === userFantasyPlayerIdStr;
          })
          .map((dp: any) => ({
            playerId: dp.player_id || dp.playerId,
            isDropped: dp.dropped || false,
            droppedAt: dp.dropped_at || null,
            isPickedUp: dp.transfer_pickup || false,
            pickedUpAt: dp.picked_up_at || null,
          }));

        console.log(
          "User owned player IDs from League table:",
          userOwnedPlayerIds
        );

        // Cross-reference with availablePlayers to get full player data (names, goals, etc.)
        const userCurrentPlayers = availablePlayers
          .map((player) => {
            const ownedPlayer = userOwnedPlayerIds.find(
              (op: {
                playerId: string;
                isDropped: boolean;
                droppedAt: string | null;
                isPickedUp: boolean;
                pickedUpAt: string | null;
              }) => op.playerId === player.id.toString()
            );
            if (ownedPlayer) {
              return {
                ...player,
                isDropped: ownedPlayer.isDropped,
                droppedAt: ownedPlayer.droppedAt,
                isPickedUp: ownedPlayer.isPickedUp,
                pickedUpAt: ownedPlayer.pickedUpAt,
              };
            }
            return null;
          })
          .filter(Boolean);

        console.log("User current players with full data:", userCurrentPlayers);
        console.log(
          "Setting userTeamPlayers to:",
          userCurrentPlayers.length,
          "players"
        );
        setUserTeamPlayers(userCurrentPlayers);

        // Log dropped players for debugging, but don't automatically change local state
        const droppedPlayers = userOwnedPlayerIds.filter(
          (op: any) => op.isDropped
        );
        console.log("🔍 Found dropped players in database:", droppedPlayers);

        // Only auto-set pickup mode on initial load if user has dropped players AND it's their turn
        // But don't override user's explicit actions during the same session
        if (
          droppedPlayers.length > 0 &&
          transferInfo?.currentTurn === actualUserFantasyPlayerId &&
          localTransferState.step === "drop" &&
          !localTransferState.droppedPlayerId
        ) {
          const droppedPlayer = droppedPlayers[0];
          console.log(
            "🔍 Initial load: Found existing dropped player, entering pickup mode:",
            droppedPlayer
          );
          setLocalTransferState({
            step: "pickup",
            droppedPlayerId: droppedPlayer.playerId,
          });
        }
      } else {
        console.log(
          "No userFantasyPlayerId found - keeping current team state"
        );
        // Don't reset the team if we temporarily lose user ID
        // setUserTeamPlayers([]);
      }
    } catch (error) {
      console.error("Error loading transfer data:", error);
    } finally {
      setLoading(false);
    }
  }, [leagueId, actualUserFantasyPlayerId]);

  useEffect(() => {
    const loadUserDetails = async () => {
      // Wait until leagueId is available to avoid calling API with 'undefined'
      if (!leagueId || Array.isArray(leagueId)) return;

      if (auth.isAuthenticated && auth.user?.profile?.email) {
        try {
          console.log("🔄 Loading user details for league:", leagueId);
          // Normal user lookup for this specific league
          const userInfo = await API.fetchUserDetails(
            auth.user.profile.email,
            String(leagueId)
          );
          if (userInfo && userInfo.length > 0) {
            console.log("🔍 Raw user details from API:", userInfo[0]);
            console.log(
              "🔍 FantasyPlayerId from user details:",
              userInfo[0]?.FantasyPlayerId
            );
            setLocalUserDetails(userInfo[0]); // Store in local state
            setUserDetails(userInfo[0]); // Also update store
            setUserDataLoaded(true);
          } else {
            // No user details found for this league - user might not be in this league
            console.log("❌ No user found in this league");
            setLocalUserDetails(null);
            setUserDataLoaded(true);
            setLoading(false);
          }
        } catch (error) {
          console.error("Error loading user details:", error);
          setUserDataLoaded(true);
          setLoading(false); // Stop loading on error
        }
      }
    };

    loadUserDetails();
  }, [auth.isAuthenticated, auth.user, leagueId, setUserDetails]);

  // Load transfer data when we have leagueId AND user data is loaded
  useEffect(() => {
    if (leagueId && userDataLoaded) {
      console.log(
        "🔥 UseEffect triggered - calling loadTransferData for league:",
        leagueId,
        "with user ID:",
        actualUserFantasyPlayerId
      );
      setLoading(true); // Set loading to true when starting to load data
      loadTransferData();
    }
  }, [leagueId, userDataLoaded, actualUserFantasyPlayerId, loadTransferData]);

  // Polling effect to check for turn changes every 5 seconds
  useEffect(() => {
    if (!leagueId || !actualUserFantasyPlayerId || !userDataLoaded) return;

    const interval = setInterval(async () => {
      const prevCurrentTurn = transferInfo?.currentTurn;
      console.log("🔄 Polling for transfer window updates...", {
        prevTurn: prevCurrentTurn,
        myTeam: actualUserFantasyPlayerId,
      });

      try {
        await loadTransferData();
        // The state update happens after this, so we can't compare here
        // But the loadTransferData will trigger a re-render with new data
      } catch (error) {
        console.error("Error during polling:", error);
      }
    }, 3000); // Poll every 3 seconds for more responsive updates

    return () => clearInterval(interval);
  }, [leagueId, actualUserFantasyPlayerId, userDataLoaded, loadTransferData]);

  // Safety timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading && leagueId && auth.isAuthenticated && userDataLoaded) {
        console.log("Loading timeout reached, stopping loading state");
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [loading, leagueId, auth.isAuthenticated, userDataLoaded]);

  // Handle dropping a player
  const handleDropPlayer = async (playerId: string) => {
    if (!transferInfo || !actualUserFantasyPlayerId) return;

    // Double-check it's the user's turn before attempting drop
    if (transferInfo.currentTurn !== actualUserFantasyPlayerId) {
      console.warn("🚫 Not user's turn - refreshing data first");
      await loadTransferData(); // Refresh to get latest turn info

      // Check again after refresh
      if (transferInfo.currentTurn !== actualUserFantasyPlayerId) {
        alert("It's not your turn to make a transfer.");
        return;
      }
    }

    try {
      console.log(
        "🎯 Dropping player:",
        playerId,
        "for team:",
        actualUserFantasyPlayerId,
        "current turn:",
        transferInfo.currentTurn
      );

      const dropResult = await API.dropPlayer(
        String(leagueId),
        playerId,
        actualUserFantasyPlayerId
      );
      console.log("🎯 Drop result:", dropResult);

      // Update local state to pickup mode
      setLocalTransferState({
        step: "pickup",
        droppedPlayerId: playerId,
      });

      console.log("🎯 Refreshing transfer data after drop...");
      // Add a small delay to ensure backend DB is updated
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadTransferData(); // Refresh data
      console.log("🎯 Transfer data refreshed after drop");
    } catch (error: any) {
      console.error("Error dropping player:", error);
      // Check if it's a turn validation error
      if (error?.response?.status === 403 || error?.response?.status === 409) {
        alert(
          "It's not your turn or this action is not allowed. Refreshing data..."
        );
        await loadTransferData(); // Refresh to get latest state
      } else {
        alert("Failed to drop player. Please try again.");
      }
    }
  };

  // Handle picking up a player
  const handlePickupPlayer = async (player: Player) => {
    if (
      !transferInfo ||
      !actualUserFantasyPlayerId ||
      !selectedDropPlayerFromDB
    )
      return;

    // Double-check it's still the user's turn
    if (transferInfo.currentTurn !== actualUserFantasyPlayerId) {
      console.warn("🚫 Not user's turn for pickup - refreshing data first");
      await loadTransferData();

      if (transferInfo.currentTurn !== actualUserFantasyPlayerId) {
        alert("It's not your turn to make a transfer.");
        return;
      }
    }

    try {
      console.log(
        "🎯 Picking up player:",
        player.id,
        "for team:",
        actualUserFantasyPlayerId,
        "current turn:",
        transferInfo.currentTurn
      );

      // Only pick up now; drop already happened earlier
      await API.pickupPlayer(
        String(leagueId),
        String(player.id),
        actualUserFantasyPlayerId
      );

      console.log("🎯 Advancing turn after pickup...");
      // Advance the turn after successful pickup
      const advanceResult = await API.advanceTransferTurn(String(leagueId));
      console.log("🎯 Advance turn result:", advanceResult);

      // Check if transfer window completed
      if (advanceResult?.completed) {
        // Update transfer info to show completed status
        setTransferInfo((prev) =>
          prev ? { ...prev, status: "completed" } : null
        );
      }

      // Reset local state back to drop mode
      setLocalTransferState({ step: "drop" });

      console.log("🎯 Refreshing data after pickup and advance...");
      await loadTransferData(); // Refresh data
    } catch (error: any) {
      console.error("Error picking up player:", error);

      // Always refresh data when there's any pickup error to ensure UI shows current state
      console.log("🔄 Refreshing data after pickup error...");
      await loadTransferData();

      // Check for specific error types
      if (error?.response?.status === 403) {
        // Turn validation failed - not user's turn
        const errorData = error?.response?.data;
        const currentTurn = errorData?.currentTurn || "unknown";
        alert(
          `Turn validation failed: It's currently team ${currentTurn}'s turn, not yours. The page has been refreshed to show the current state.`
        );
      } else if (error?.response?.status === 409) {
        // Conditional check failed - player not available or race condition
        console.log("🔄 Race condition detected, forcing data refresh...");
        // Add a longer delay for race conditions and refresh again
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await loadTransferData();
        alert(
          "Player pickup failed due to a race condition. The page has been refreshed with the latest data. Please try again."
        );
      } else {
        // Other errors
        alert(
          "Failed to pick up player. Please try again. The page has been refreshed."
        );
      }
    }
  };

  // Handle skipping current turn
  const handleSkipTurn = async () => {
    if (!transferInfo || !leagueId) return;

    try {
      await API.advanceTransferTurn(String(leagueId));
      // setSelectedDropPlayer(null); // Removed - now tracked in database
      // setTransferStep("drop"); // This line is removed as transferStep is now derived
      await loadTransferData(); // Refresh data
      alert("Turn skipped successfully!");
    } catch (error) {
      console.error("Error skipping turn:", error);
      alert("Failed to skip turn. Please try again.");
    }
  };

  // Handle being done with transferring for the entire window
  const handleDoneTransferring = async () => {
    if (!transferInfo || !leagueId || !actualUserFantasyPlayerId) return;

    const confirmed = confirm(
      "Are you sure you want to skip all remaining rounds? You won't be able to make any more transfers this window."
    );

    if (!confirmed) return;

    try {
      // TODO: Add API call to mark user as "done" for this transfer window
      // For now, just skip the current turn
      await API.advanceTransferTurn(String(leagueId));
      // setSelectedDropPlayer(null); // Removed - now tracked in database
      // setTransferStep("drop"); // This line is removed as transferStep is now derived
      await loadTransferData();
      alert("You are now done transferring for this window!");
    } catch (error) {
      console.error("Error marking done transferring:", error);
      alert("Failed to complete action. Please try again.");
    }
  };

  // Get current turn team name
  const getCurrentTurnTeamName = () => {
    if (!transferInfo?.currentTurn) return "Unknown";
    const team = fantasyPlayers.find(
      (fp) => fp.FantasyPlayerId.toString() === transferInfo.currentTurn
    );
    return (
      team?.TeamName ||
      team?.FantasyPlayerName ||
      `Team ${transferInfo.currentTurn}`
    );
  };

  // Check if it's user's turn
  const isUserTurn = transferInfo?.currentTurn === actualUserFantasyPlayerId;

  // Handle authentication loading and redirect
  if (auth.isLoading) {
    return (
      <Container
        maxWidth="xl"
        sx={{ backgroundColor: "black", minHeight: "100vh", py: 4 }}
      >
        <Paper sx={{ p: 3, backgroundColor: "#1a1a1a", textAlign: "center" }}>
          <Typography variant="h4" sx={{ color: "#B8860B", mb: 2 }}>
            Loading...
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <Container
        maxWidth="xl"
        sx={{ backgroundColor: "black", minHeight: "100vh", py: 4 }}
      >
        <Paper sx={{ p: 3, backgroundColor: "#1a1a1a", textAlign: "center" }}>
          <Typography variant="h4" sx={{ color: "#B8860B", mb: 2 }}>
            Please Log In
          </Typography>
          <Typography variant="body1" sx={{ color: "#fff", mb: 3 }}>
            You need to be logged in to access the transfer window.
          </Typography>
          <Button
            variant="contained"
            onClick={() => {
              // Store the current URL to return to after authentication
              const returnUrl =
                window.location.pathname + window.location.search;
              localStorage.setItem("returnUrl", returnUrl);
              auth.signinRedirect();
            }}
            sx={{
              backgroundColor: "#B8860B",
              color: "black",
              "&:hover": { backgroundColor: "#996f00" },
            }}
          >
            Sign In
          </Button>
        </Paper>
      </Container>
    );
  }

  // Get player ownership info using League table data (checks for dropped status)
  const getPlayerOwnership = (playerId: string) => {
    // Find the player in the League table data (draftedPlayersData)
    const leaguePlayer = draftedPlayersFromLeague.find(
      (dp: any) => (dp.player_id || dp.playerId) === playerId
    );

    console.log("🔍 getPlayerOwnership check for player:", playerId, {
      found: !!leaguePlayer,
      dropped: leaguePlayer?.dropped,
      teamId: leaguePlayer?.team_drafted_by,
      droppedAt: leaguePlayer?.dropped_at,
    });

    // If player exists in league and is not dropped, they are owned
    if (leaguePlayer && !leaguePlayer.dropped) {
      const teamId = leaguePlayer.team_drafted_by;

      // Find team name from fantasy data
      const owningTeam = fantasyPlayers.find(
        (fp) => fp.FantasyPlayerId.toString() === teamId
      );
      const teamName =
        owningTeam?.TeamName ||
        owningTeam?.FantasyPlayerName ||
        `Team ${teamId}`;

      const result = {
        isOwned: true,
        ownerName: teamName,
        isOwnedByUser: teamId === actualUserFantasyPlayerId,
      };
      console.log("🔍 Player is owned:", result);
      return result;
    }

    // Player is either not in league or is dropped (available for pickup)
    const result = {
      isOwned: false,
      ownerName: null,
      isOwnedByUser: false,
    };
    console.log("🔍 Player is available:", result);
    return result;
  };

  if (loading) {
    return (
      <Container
        maxWidth="xl"
        sx={{ backgroundColor: "black", minHeight: "100vh", py: 4 }}
      >
        <div className="text-white">Loading transfer window...</div>
      </Container>
    );
  }

  if (
    !transferInfo ||
    transferInfo.status === "inactive" ||
    transferInfo.isActive === false
  ) {
    return (
      <Container
        maxWidth="xl"
        sx={{ backgroundColor: "black", minHeight: "100vh", py: 4 }}
      >
        <Alert severity="info" sx={{ mb: 2 }}>
          Transfer window is not currently active. Please contact the league
          administrator.
        </Alert>
      </Container>
    );
  }

  return (
    <Container
      maxWidth="xl"
      sx={{ backgroundColor: "black", minHeight: "100vh", py: 4 }}
    >
      {/* Transfer Window Header */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: "#1a1a1a" }}>
        {/* Completion Banner */}
        {transferInfo.status === "completed" && (
          <Alert
            severity="success"
            sx={{
              mb: 3,
              backgroundColor: "#2e7d2e",
              color: "white",
              "& .MuiAlert-icon": { color: "white" },
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
              🎉 Transfer Window Completed! 🎉
            </Typography>
            <Typography variant="body1">
              All {transferInfo.round} rounds have been finished. No more
              transfers are allowed.
            </Typography>
          </Alert>
        )}

        <Typography variant="h4" sx={{ color: "#B8860B", mb: 2 }}>
          {transferInfo.status === "completed"
            ? "Transfer Window - Completed"
            : `Transfer Window - Round ${transferInfo.round}`}
        </Typography>

        <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h6" sx={{ color: "white" }}>
            {transferInfo.status === "completed"
              ? "Transfer window has ended"
              : `Current Turn: ${getCurrentTurnTeamName()}`}
            {transferInfo.status !== "completed" && isUserTurn && (
              <span style={{ color: "#B8860B", marginLeft: "10px" }}>
                (Your Turn!)
              </span>
            )}
            {transferInfo.status !== "completed" && !isUserTurn && (
              <span style={{ color: "#666", marginLeft: "10px" }}>
                (Waiting...)
              </span>
            )}
          </Typography>

          <Button
            variant="outlined"
            size="small"
            disabled={transferInfo.status === "completed"}
            onClick={async () => {
              console.log("🔄 Manual refresh triggered");
              await loadTransferData();
            }}
            sx={{
              color: "#B8860B",
              borderColor: "#B8860B",
              "&:hover": {
                borderColor: "#996f00",
                backgroundColor: "rgba(184, 134, 11, 0.1)",
              },
              "&:disabled": {
                color: "#666",
                borderColor: "#666",
              },
            }}
          >
            Refresh
          </Button>

          <Button
            variant="outlined"
            size="small"
            disabled={transferInfo.status === "completed"}
            onClick={async () => {
              console.log("🔄 Force refresh from DB triggered");
              // Add delay to ensure DB consistency
              await new Promise((resolve) => setTimeout(resolve, 1000));
              await loadTransferData();
            }}
            sx={{
              color: "#FF6B6B",
              borderColor: "#FF6B6B",
              "&:hover": {
                borderColor: "#ff5252",
                backgroundColor: "rgba(255, 107, 107, 0.1)",
              },
              "&:disabled": {
                color: "#666",
                borderColor: "#666",
              },
            }}
          >
            Force Sync DB
          </Button>
        </Box>

        {/* Transfer Status */}
        {isUserTurn && (
          <Alert
            severity={transferStep === "drop" ? "warning" : "info"}
            sx={{ mb: 2 }}
          >
            {transferStep === "drop"
              ? "Step 1: Select a player from your team to drop"
              : `Step 2: Select a player to pick up (dropping: ${
                  userTeamPlayers.find(
                    (p) => p.id.toString() === selectedDropPlayerFromDB
                  )?.name || "Unknown"
                })`}
          </Alert>
        )}

        {!isUserTurn && transferInfo?.currentTurn && (
          <Alert severity="info" sx={{ mb: 2 }}>
            It&apos;s {getCurrentTurnTeamName()}&apos;s turn to make a transfer.
            The page will auto-refresh every 3 seconds, or you can click Refresh
            above.
          </Alert>
        )}

        {/* Transfer Window Timeline */}
        <Typography variant="body2" sx={{ color: "#ccc" }}>
          Window: {new Date(transferInfo.start).toLocaleDateString()} -{" "}
          {new Date(transferInfo.end).toLocaleDateString()}
        </Typography>
      </Paper>

      {/* My Current Team Section - Always show, but disable actions when not your turn */}
      {(userTeamPlayers.length > 0 || !actualUserFantasyPlayerId) && (
        <Paper sx={{ p: 3, mb: 3, backgroundColor: "#1a1a1a" }}>
          <Typography variant="h5" sx={{ color: "#B8860B", mb: 2 }}>
            My Current Team{" "}
            {isUserTurn && transferStep === "drop"
              ? "- Select Player to Drop"
              : ""}
          </Typography>

          {!actualUserFantasyPlayerId ? (
            <Typography sx={{ color: "#ccc", mb: 3 }}>
              Loading your team...
            </Typography>
          ) : userTeamPlayers.length > 0 ? (
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 3 }}
            >
              {userTeamPlayers.map((player: any) => (
                <Paper
                  key={player.id}
                  sx={{
                    p: 2,
                    backgroundColor: player.isDropped ? "#3a2a2a" : "#2a2a2a",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: player.isDropped ? 0.7 : 1,
                    border: player.isDropped ? "1px solid #ff6b6b" : "none",
                  }}
                >
                  <Box>
                    <Typography
                      variant="body1"
                      sx={{
                        color: player.isDropped ? "#ff9999" : "#fff",
                        textDecoration: player.isDropped
                          ? "line-through"
                          : "none",
                      }}
                    >
                      {player.name}
                      {player.isDropped && (
                        <span
                          style={{
                            color: "#ff6b6b",
                            fontWeight: "bold",
                            marginLeft: "8px",
                          }}
                        >
                          (DROPPED)
                        </span>
                      )}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#ccc" }}>
                      Goals: {player.goals_2024 || 0}
                      {player.isDropped && player.droppedAt && (
                        <span
                          style={{
                            color: "#ff9999",
                            fontSize: "0.8em",
                            marginLeft: "8px",
                          }}
                        >
                          • Dropped:{" "}
                          {new Date(player.droppedAt).toLocaleDateString()}
                        </span>
                      )}
                      {!player.isDropped &&
                        player.isPickedUp &&
                        player.pickedUpAt && (
                          <span
                            style={{
                              color: "#90EE90",
                              fontSize: "0.8em",
                              marginLeft: "8px",
                            }}
                          >
                            • Added:{" "}
                            {new Date(player.pickedUpAt).toLocaleDateString()}
                          </span>
                        )}
                    </Typography>
                  </Box>
                  {!player.isDropped ? (
                    <Button
                      variant="contained"
                      color="warning"
                      onClick={() => handleDropPlayer(player.id.toString())}
                      disabled={
                        !isUserTurn ||
                        transferStep !== "drop" ||
                        transferInfo.status === "completed"
                      }
                      sx={{
                        ml: 2,
                        opacity:
                          !isUserTurn ||
                          transferStep !== "drop" ||
                          transferInfo.status === "completed"
                            ? 0.5
                            : 1,
                      }}
                    >
                      {isUserTurn &&
                      transferStep === "drop" &&
                      transferInfo.status !== "completed"
                        ? "DROP PLAYER"
                        : "On Team"}
                    </Button>
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        color: "#ff6b6b",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        fontSize: "0.9em",
                        ml: 2,
                      }}
                    >
                      Dropped
                    </Typography>
                  )}
                </Paper>
              ))}
            </Box>
          ) : (
            <Typography sx={{ color: "#ccc", mb: 3 }}>
              No players on your team to drop.
            </Typography>
          )}

          {/* Skip Turn Options - Only show when it's user's turn and window is not completed */}
          {isUserTurn && transferInfo.status !== "completed" && (
            <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleSkipTurn}
              >
                Skip This Turn
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={handleDoneTransferring}
              >
                Done Transferring (Skip All Rounds)
              </Button>
            </Box>
          )}
        </Paper>
      )}

      {/* Main Transfer Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Players */}
        <div className="lg:col-span-2">
          {(() => {
            console.log("Transfer mode props:", {
              mode: "transfer",
              isUserTurn: isUserTurn && transferStep === "pickup",
              transferStep,
              fantasyPlayersCount: fantasyPlayers.length,
              rawIsUserTurn: isUserTurn,
              selectedDropPlayer: selectedDropPlayerFromDB,
            });
            return null;
          })()}
          <DraftAvailablePlayersTable
            players={players}
            draftedPlayers={[]} // For transfer window, we show all available players
            handleDraft={
              transferStep === "pickup" ? handlePickupPlayer : () => {}
            }
            draftInfo={null} // We'll handle turn logic in this component
            userFantasyPlayerId={actualUserFantasyPlayerId}
            fantasyPlayers={fantasyPlayers}
            countdown={0}
            mode="transfer" // Add mode prop
            isUserTurn={
              isUserTurn &&
              transferStep === "pickup" &&
              transferInfo.status !== "completed"
            }
            selectedDropPlayer={selectedDropPlayerFromDB}
            getPlayerOwnership={getPlayerOwnership}
          />
        </div>

        {/* Transfer Actions History */}
        <div className="hidden lg:block">
          <Paper
            sx={{ p: 2, backgroundColor: "#1a1a1a", height: "fit-content" }}
          >
            <Typography variant="h6" sx={{ color: "#B8860B", mb: 2 }}>
              Transfer Actions
            </Typography>
            <Box sx={{ maxHeight: "400px", overflow: "auto" }}>
              {transferInfo.transferActions?.map((action, index) => {
                const team = fantasyPlayers.find(
                  (fp) =>
                    fp.FantasyPlayerId.toString() === action.fantasy_team_id
                );
                return (
                  <Box
                    key={index}
                    sx={{ mb: 2, p: 1, border: "1px solid #333" }}
                  >
                    <Typography variant="body2" sx={{ color: "white" }}>
                      <strong>{team?.TeamName || "Unknown"}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#ccc" }}>
                      {action.action_type === "drop" ? "Dropped" : "Picked up"}:{" "}
                      {action.player_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#999" }}>
                      {new Date(action.action_date).toLocaleString()}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </div>
      </div>

      {/* Mobile Drawer for Transfer Actions */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <Button
          variant="contained"
          onClick={() => setDraftDrawerOpen(true)}
          sx={{
            backgroundColor: "#B8860B",
            color: "black",
            "&:hover": { backgroundColor: "#9A7209" },
          }}
        >
          Transfer History
        </Button>
      </div>

      <DraftedTableDrawer
        open={draftDrawerOpen}
        onClose={() => setDraftDrawerOpen(false)}
        players={players}
        draftInfo={null}
        fantasyPlayers={fantasyPlayers}
        draftedPlayers={[]} // We'll show transfer actions instead
        mode="transfer"
        transferActions={transferInfo.transferActions}
      />
    </Container>
  );
};

export default TransferWindowPage;
