import React from "react";
import Link from "next/link";
import { useAuth } from "react-oidc-context";
import useUserStore from "@/stores/useUserStore"; // Import the user store

function Navbar({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const handleLogin = () => auth.signinRedirect();
  const handleLogout = () => {
    const clientId = "7b2ljliksvl2pn7gadjrn90e1a"; // Your Cognito App Client ID
    const logoutUri = "http://localhost:3000?logout=true"; // Your post-logout redirect URI
    const cognitoDomain =
      "https://us-east-1d6opuwwml.auth.us-east-1.amazoncognito.com";

    // Construct the Cognito logout URL
    const logoutUrl = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      logoutUri
    )}`;

    auth.removeUser();

    // Redirect the user to the Cognito logout endpoint
    window.location.href = logoutUrl;
  };

  // Access user details from the store
  const { userDetails } = useUserStore();

  // If the user is authenticated and has a LeagueId, link to /league/[LeagueId]/draft
  // Otherwise, link to the join/create page at /league
  const leagueLink =
    auth.isAuthenticated && userDetails?.LeagueId
      ? `/league/${userDetails.LeagueId}`
      : "/league";

  return (
    <header className="bg-[#B8860B] text-white p-3 sm:p-4 shadow-md">
      <nav className="container mx-auto flex justify-between items-center px-4">
        {/* App Name */}
        <Link href="/" legacyBehavior>
          <a className="text-2xl font-bold">Golden Bota Boiz</a>
        </Link>

        {/* Navigation Links */}
        <div className="flex space-x-2 sm:space-x-4">
          {userDetails && (
            <>
              <Link href="/Players" legacyBehavior>
                <a className="hover:underline">Players</a>
              </Link>
              <Link href={leagueLink} legacyBehavior>
                <a className="hover:underline">League</a>
              </Link>
              <Link href="/MyTeam" legacyBehavior>
                <a className="hover:underline">My Team</a>
              </Link>
            </>
          )}
        </div>

        {/* Authentication Buttons */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {auth.isAuthenticated ? (
            <>
              {console.log("user details", userDetails)}
              <div className="flex items-center space-x-2 sm:space-x-4">
                <span className="font-semibold text-sm sm:text-base">
                  Hi, {userDetails?.FantasyPlayerName.split(" ")[0] || "User"}!
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-white text-black px-2 py-1 sm:px-4 sm:py-2 rounded hover:bg-opacity-80"
                >
                  Log Out
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={handleLogin}
              className="bg-white text-black px-2 py-1 sm:px-4 sm:py-2 rounded hover:bg-opacity-80"
            >
              Log In
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
