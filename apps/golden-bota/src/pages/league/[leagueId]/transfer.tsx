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

  // Loading states for drop and pickup buttons
  const [isDropping, setIsDropping] = useState<boolean>(false);
  const [isPickingUp, setIsPickingUp] = useState<boolean>(false);

  // Reset local transfer state when league changes or component mounts
  useEffect(() => {
    setLocalTransferState({ step: "drop" });
    setIsDropping(false);
    setIsPickingUp(false);
  }, [leagueId]);

  const { userDetails, setUserDetails } = useUserStore();
  const [localUserDetails, setLocalUserDetails] = useState<any>(null);
  const [userDataLoaded, setUserDataLoaded] = useState<boolean>(false);

  // Use local user details instead of store to avoid race conditions
  const userFantasyPlayerId = (
    userDetails?.fantasyPlayerId || localUserDetails?.fantasyPlayerId
  )?.toString();

  // Use the database-derived FantasyPlayerId only
  const actualUserFantasyPlayerId = userFantasyPlayerId;

  // Reset local transfer state when it's a new user's turn
  useEffect(() => {
    if (transferInfo?.currentTurn && actualUserFantasyPlayerId) {
      const isUserTurn = transferInfo.currentTurn === actualUserFantasyPlayerId;
      if (isUserTurn) {
        setLocalTransferState({ step: "drop" });
        setIsDropping(false);
        setIsPickingUp(false);
      }
    }
  }, [transferInfo?.currentTurn, actualUserFantasyPlayerId]);

  // Use local state since old API doesn't return activeTransfers
  const transferStep = localTransferState.step;
  const selectedDropPlayerFromDB = localTransferState.droppedPlayerId || null;

  // Load transfer window data
  const loadTransferData = useCallback(async () => {
    if (!leagueId) return;

    try {
      // Always fetch transfer window info first (regardless of user status)
      const transferData = await API.getTransferWindowInfo(String(leagueId));
      setTransferInfo(transferData.transferWindow);

      // Always fetch drafted players data for the UI
      // (User-specific logic will be handled later)

      // Fetch fantasy players data for team names and user info
      const fantasyData = await API.fetchFantasyPlayersByLeague(
        String(leagueId)
      );
      setFantasyPlayers(fantasyData);

      // Fetch drafted players from League_{league_id} table (the correct ownership source)
      const draftedPlayersData = await API.fetchDraftedPlayers(
        String(leagueId)
      );
      setDraftedPlayersFromLeague(draftedPlayersData);

      // Create ownership map from drafted players data
      const playerOwnershipMap = new Map();

      draftedPlayersData.forEach((draftedPlayer: any) => {
        const playerId = draftedPlayer.player_id || draftedPlayer.playerId;
        const teamId = draftedPlayer.team_drafted_by;
        const isDropped = draftedPlayer.dropped;

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

      // Fetch ALL available players from the general API
      const allPlayersData = await API.fetchPlayers2025();

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

      // Find user's current players using League table + Players data
      const userFantasyPlayerIdStr = actualUserFantasyPlayerId;

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
            isPickedUp: !!dp.picked_up_at, // True if picked_up_at has a value
            pickedUpAt: dp.picked_up_at || null,
            goalsBeforePickup: dp.goals_before_pickup || 0,
            goalsAtDrop: dp.goals_at_drop || 0,
          }));

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
                goalsBeforePickup: number;
                goalsAtDrop: number;
              }) => op.playerId === player.id.toString()
            );
            if (ownedPlayer) {
              return {
                ...player,
                isDropped: ownedPlayer.isDropped,
                droppedAt: ownedPlayer.droppedAt,
                isPickedUp: ownedPlayer.isPickedUp,
                pickedUpAt: ownedPlayer.pickedUpAt,
                goalsBeforePickup: ownedPlayer.goalsBeforePickup,
                goalsAtDrop: ownedPlayer.goalsAtDrop,
              };
            }
            return null;
          })
          .filter(Boolean);

        setUserTeamPlayers(userCurrentPlayers);

        // Only auto-set pickup mode if user has more drops than pickups (incomplete transfer)
        // Count actual transfer actions for this user from the transfer history
        const transferActions = transferInfo?.transferActions || [];
        const userDrops = transferActions.filter(
          (action: any) =>
            action.fantasy_team_id === actualUserFantasyPlayerId &&
            action.action_type === "drop"
        ).length;

        const userPickups = transferActions.filter(
          (action: any) =>
            action.fantasy_team_id === actualUserFantasyPlayerId &&
            action.action_type === "pickup"
        ).length;

        const hasUncompletedDrop = userDrops > userPickups;

        if (
          hasUncompletedDrop &&
          transferInfo?.currentTurn === actualUserFantasyPlayerId &&
          localTransferState.step === "drop" &&
          !localTransferState.droppedPlayerId
        ) {
          // Find the most recent dropped player to set as the selected drop
          const lastDropAction = transferActions
            .filter(
              (action: any) =>
                action.fantasy_team_id === actualUserFantasyPlayerId &&
                action.action_type === "drop"
            )
            .sort(
              (a: any, b: any) =>
                new Date(b.action_date).getTime() -
                new Date(a.action_date).getTime()
            )[0];

          setLocalTransferState({
            step: "pickup",
            droppedPlayerId: lastDropAction?.player_id || undefined,
          });
        }
      }
    } catch (error) {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  }, [
    leagueId,
    actualUserFantasyPlayerId,
    localTransferState.step,
    localTransferState.droppedPlayerId,
    transferInfo?.currentTurn,
  ]);

  useEffect(() => {
    const loadUserDetails = async () => {
      // Wait until leagueId is available to avoid calling API with 'undefined'
      if (!leagueId || Array.isArray(leagueId)) return;

      if (auth.isAuthenticated && auth.user?.profile?.email) {
        try {
          const userInfo = await API.fetchUserDetails(
            auth.user.profile.email,
            String(leagueId)
          );
          if (userInfo && userInfo.length > 0) {
            setLocalUserDetails(userInfo[0]); // Store in local state
            // Transform API response to match UserDetails interface
            setUserDetails({
              email: auth.user.profile.email || "",
              fantasyPlayerName: userInfo[0].FantasyPlayerName,
              leagueId: Number(userInfo[0].LeagueId),
              teamName: userInfo[0].TeamName,
              fantasyPlayerId: Number(userInfo[0].FantasyPlayerId),
            }); // Also update store
            setUserDataLoaded(true);
          } else {
            // No user details found for this league - user might not be in this league
            setLocalUserDetails(null);
            setUserDataLoaded(true);
            setLoading(false);
          }
        } catch (error) {
          // Handle error silently
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
      setLoading(true); // Set loading to true when starting to load data
      loadTransferData();
    }
  }, [leagueId, userDataLoaded, actualUserFantasyPlayerId, loadTransferData]);

  // Polling effect to check for turn changes every 5 seconds
  useEffect(() => {
    if (!leagueId || !actualUserFantasyPlayerId || !userDataLoaded) return;

    const interval = setInterval(async () => {
      const prevCurrentTurn = transferInfo?.currentTurn;
      try {
        await loadTransferData();
        // The state update happens after this, so we can't compare here
        // But the loadTransferData will trigger a re-render with new data
      } catch (error) {
        // Handle error silently
      }
    }, 3000); // Poll every 3 seconds for more responsive updates

    return () => clearInterval(interval);
  }, [
    leagueId,
    actualUserFantasyPlayerId,
    userDataLoaded,
    loadTransferData,
    transferInfo?.currentTurn,
  ]);

  // Safety timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading && leagueId && auth.isAuthenticated && userDataLoaded) {
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [loading, leagueId, auth.isAuthenticated, userDataLoaded]);

  // Handle dropping a player
  const handleDropPlayer = async (playerId: string) => {
    if (!transferInfo || !actualUserFantasyPlayerId || isDropping) return;

    setIsDropping(true);

    // Double-check it's the user's turn before attempting drop
    if (transferInfo.currentTurn !== actualUserFantasyPlayerId) {
      await loadTransferData(); // Refresh to get latest turn info

      // Get fresh transfer info after the refresh
      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        const freshTransferData = await API.getTransferWindowInfo(
          String(leagueId)
        );

        if (
          freshTransferData.transferWindow?.currentTurn !==
          actualUserFantasyPlayerId
        ) {
          alert(
            "It's not your turn to make a transfer. Please wait for your turn."
          );
          setIsDropping(false);
          return;
        }
      } catch (error) {
        // Handle error silently
        alert("Unable to verify turn status. Please try again.");
        setIsDropping(false);
        return;
      }
    }

    try {
      const dropResult = await API.dropPlayer(
        String(leagueId),
        playerId,
        actualUserFantasyPlayerId
      );

      // Update local state to pickup mode
      setLocalTransferState({
        step: "pickup",
        droppedPlayerId: playerId,
      });

      await loadTransferData(); // Refresh data
    } catch (error: any) {
      // Handle error
      if (error?.response?.status === 403 || error?.response?.status === 409) {
        alert(
          "It's not your turn or this action is not allowed. Refreshing data..."
        );
        await loadTransferData(); // Refresh to get latest state
      } else {
        alert("Failed to drop player. Please try again.");
      }
    } finally {
      setIsDropping(false);
    }
  };

  // Handle picking up a player
  const handlePickupPlayer = async (player: Player) => {
    if (
      !transferInfo ||
      !actualUserFantasyPlayerId ||
      !selectedDropPlayerFromDB ||
      isPickingUp
    )
      return;

    setIsPickingUp(true);

    // For pickup, be less strict about turn checking since user just successfully dropped
    // The user should be able to pick up immediately after dropping in the same turn
    if (
      transferInfo.currentTurn !== actualUserFantasyPlayerId &&
      transferStep !== "pickup"
    ) {
      await loadTransferData();

      // Get fresh transfer info after the refresh
      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        const freshTransferData = await API.getTransferWindowInfo(
          String(leagueId)
        );

        if (
          freshTransferData.transferWindow?.currentTurn !==
          actualUserFantasyPlayerId
        ) {
          alert(
            "It's not your turn to make a transfer. Please wait for your turn."
          );
          setIsPickingUp(false);
          return;
        }
      } catch (error) {
        // Handle error silently
        alert("Unable to verify turn status. Please try again.");
        setIsPickingUp(false);
        return;
      }
    } else if (transferStep === "pickup") {
      // No strict turn check needed for pickup in this mode
    }

    try {
      await API.pickupPlayer(
        String(leagueId),
        String(player.id),
        actualUserFantasyPlayerId
      );

      // Advance the turn after successful pickup
      const advanceResult = await API.advanceTransferTurn(String(leagueId));

      // Check if transfer window completed
      if (advanceResult?.completed) {
        // Update transfer info to show completed status
        setTransferInfo((prev) =>
          prev ? { ...prev, status: "completed" } : null
        );
      }

      // Reset local state back to drop mode
      setLocalTransferState({ step: "drop" });

      await loadTransferData(); // Refresh data
    } catch (error: any) {
      // Handle error
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
        alert(
          "Player pickup failed due to a race condition. The page has been refreshed with the latest data. Please try again."
        );
      } else {
        alert(
          "Failed to pick up player. Please try again. The page has been refreshed."
        );
      }
    } finally {
      setIsPickingUp(false);
    }
  };

  // Handle skipping current turn
  const handleSkipTurn = async () => {
    if (!transferInfo || !leagueId) return;

    try {
      const advanceResult = await API.advanceTransferTurn(String(leagueId));

      // Check if transfer window completed
      if (advanceResult?.completed) {
        // Update transfer info to show completed status
        setTransferInfo((prev) =>
          prev ? { ...prev, status: "completed" } : null
        );
        alert("Transfer window completed! All rounds finished.");
        return;
      }

      await loadTransferData(); // Refresh data
      alert("Turn skipped successfully!");
    } catch (error) {
      // Handle error
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
      // Mark user as done with transfers for this window
      const result = await API.markUserDoneTransferring(
        String(leagueId),
        String(actualUserFantasyPlayerId)
      );

      // Reload transfer data to reflect the change
      await loadTransferData();
      alert("You are now done transferring for this window!");
    } catch (error) {
      // Handle error
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

  // Check if user has marked themselves as done transferring
  const isUserDoneTransferring = transferInfo?.finishedTransferringTeams
    ? Array.from(transferInfo.finishedTransferringTeams).includes(
        String(actualUserFantasyPlayerId)
      )
    : false;

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
      return result;
    }

    // Player is either not in league or is dropped (available for pickup)
    const result = {
      isOwned: false,
      ownerName: null,
      isOwnedByUser: false,
    };
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
    (transferInfo.isActive === false && transferInfo.status !== "completed")
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

        {/* User Done Transferring Banner */}
        {isUserDoneTransferring && transferInfo.status !== "completed" && (
          <Alert
            severity="info"
            sx={{
              mb: 3,
              backgroundColor: "#B8860B",
              color: "black",
              "& .MuiAlert-icon": { color: "black" },
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
              ✅ You&apos;re Done Transferring!
            </Typography>
            <Typography variant="body1">
              You have opted out of all remaining transfer rounds. You can still
              view the results as other teams complete their transfers.
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
            The page will auto-refresh every 3 seconds.
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
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                      </Typography>

                      {/* Transfer Status Badge */}
                      {player.isDropped && (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "0.7rem",
                            fontWeight: "bold",
                            color: "white",
                            backgroundColor: "#dc2626", // Red
                          }}
                        >
                          DROPPED
                        </span>
                      )}
                      {!player.isDropped && player.isPickedUp && (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "0.7rem",
                            fontWeight: "bold",
                            color: "white",
                            backgroundColor: "#16a34a", // Green
                          }}
                        >
                          PICKED UP
                        </span>
                      )}
                    </Box>
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
                      onClick={() => handleDropPlayer(player.id.toString())}
                      disabled={
                        !isUserTurn ||
                        transferStep !== "drop" ||
                        transferInfo.status === "completed" ||
                        isUserDoneTransferring ||
                        isDropping
                      }
                      sx={{
                        ml: 2,
                        backgroundColor: "#B8860B",
                        color: "black",
                        "&:hover": {
                          backgroundColor: "#996f00",
                        },
                        "&:disabled": {
                          backgroundColor: "#666",
                          color: "#999",
                        },
                        opacity:
                          !isUserTurn ||
                          transferStep !== "drop" ||
                          transferInfo.status === "completed" ||
                          isUserDoneTransferring ||
                          isDropping
                            ? 0.5
                            : 1,
                      }}
                    >
                      {isDropping
                        ? "DROPPING..."
                        : isUserDoneTransferring
                        ? "Done Transferring"
                        : isUserTurn &&
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

          {/* Skip Turn Options - Only show when it's user's turn, window is not completed, and user hasn't marked themselves as done */}
          {isUserTurn &&
            transferInfo.status !== "completed" &&
            !isUserDoneTransferring && (
              <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
                <Button
                  variant="outlined"
                  onClick={handleDoneTransferring}
                  sx={{
                    color: "#B8860B",
                    borderColor: "#B8860B",
                    "&:hover": {
                      borderColor: "#996f00",
                      backgroundColor: "rgba(184, 134, 11, 0.1)",
                    },
                  }}
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
            transferStatus={transferInfo.status} // Add transfer status for completion check
            getPlayerOwnership={getPlayerOwnership}
            isPickingUp={isPickingUp}
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
            <Box>
              {transferInfo.transferActions
                ?.filter((action) => {
                  // Filter out "turn_advanced" actions - only show actual player transfers
                  const isPlayerTransfer =
                    action.action_type === "drop" ||
                    action.action_type === "pickup";
                  return isPlayerTransfer;
                })
                ?.map((action, index) => {
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
                        <span
                          style={{
                            color:
                              action.action_type === "drop"
                                ? "#ff4444"
                                : "#44ff44",
                            fontWeight: "bold",
                          }}
                        >
                          {action.action_type === "drop"
                            ? "Dropped"
                            : "Picked up"}
                        </span>
                        : {action.player_name}
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
        transferActions={transferInfo?.transferActions}
      />
    </Container>
  );
};

export default TransferWindowPage;
