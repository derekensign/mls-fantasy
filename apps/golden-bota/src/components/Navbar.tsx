import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "react-oidc-context";
import useUserStore from "../stores/useUserStore"; // Import the user store
import { useRouter } from "next/router";

function Navbar({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { leagueId } = router.query;

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

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <header className="bg-[#B8860B] text-white p-3 sm:p-4 shadow-md sticky top-0 z-50 w-full">
      <nav className="container flex justify-between items-center px-4 w-full max-w-7xl mx-auto">
        {/* App Name */}

        {/* Hamburger button */}
        <button
          className="md:hidden text-white focus:outline-none mr-4"
          onClick={toggleMenu}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>

        <Link href="/" className="text-white font-bold text-xl">
          Golden Bota
        </Link>

        {/* Desktop menu */}
        <div className="hidden md:flex space-x-4 ml-auto">
          {userDetails && (
            <>
              <Link
                href={leagueLink}
                className="text-white hover:text-gray-300"
              >
                League
              </Link>
              <Link href="/MyTeam" className="text-white hover:text-gray-300">
                My Team
              </Link>
              <Link
                href={`/league/${userDetails.LeagueId}/table`}
                className="text-white hover:text-gray-300"
              >
                Table
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu */}
        <div
          className={`${
            isOpen ? "block" : "hidden"
          } md:hidden fixed left-0 w-full top-16 bg-gray-800 min-h-fit max-h-[1/4] z-40`}
        >
          {userDetails && (
            <div className="flex flex-col space-y-4 p-4 w-full">
              <Link
                href={leagueLink}
                className="text-white hover:text-gray-300 text-lg py-2 w-full"
                onClick={() => setIsOpen(false)}
              >
                League
              </Link>
              <Link
                href="/MyTeam"
                className="text-white hover:text-gray-300 text-lg py-2 w-full"
                onClick={() => setIsOpen(false)}
              >
                My Team
              </Link>
              <Link
                href={`/league/${userDetails.LeagueId}/table`}
                className="text-white hover:text-gray-300 text-lg py-2 w-full"
                onClick={() => setIsOpen(false)}
              >
                Table
              </Link>
            </div>
          )}
        </div>

        {/* Authentication Buttons */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {auth.isAuthenticated ? (
            <>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <span className="font-semibold text-sm sm:hidden lg:block">
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
