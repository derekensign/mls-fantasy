import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/router";
import useUserStore from "../stores/useUserStore";
import { useTransferWindowStatus } from "../hooks/useTransferWindowStatus";

function Navbar({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { isTransferWindowActive } = useTransferWindowStatus();
  const { userDetails } = useUserStore();

  const handleLogin = () => auth.signinRedirect();
  const handleLogout = () => {
    const clientId = "7b2ljliksvl2pn7gadjrn90e1a";
    const logoutUri = window.location.origin;
    const cognitoDomain =
      "https://us-east-1d6opuwwml.auth.us-east-1.amazoncognito.com";
    const logoutUrl = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      logoutUri
    )}`;
    auth.removeUser();
    window.location.href = logoutUrl;
  };

  const leagueLink =
    auth.isAuthenticated && userDetails?.leagueId
      ? `/league/${userDetails.leagueId}`
      : "/league";

  // Nav destinations. Signed-out visitors see none (the hero carries the CTA);
  // signed-in users without a profile yet get nudged to complete it.
  const links = !auth.isAuthenticated
    ? []
    : userDetails
    ? [
        { href: leagueLink, label: "League" },
        { href: "/MyTeam", label: "My Team" },
        { href: `/league/${userDetails.leagueId}/table`, label: "Table" },
        { href: `/league/${userDetails.leagueId}/draft`, label: "Draft" },
        ...(isTransferWindowActive
          ? [
              {
                href: `/league/${userDetails.leagueId}/transfer`,
                label: "Transfer",
              },
            ]
          : []),
      ]
    : [{ href: "/MyTeam", label: "Complete Your Profile" }];

  const isActive = (href: string) =>
    router.asPath === href || router.asPath.startsWith(href + "/");

  const NavLink = ({
    href,
    label,
    onClick,
  }: {
    href: string;
    label: string;
    onClick?: () => void;
  }) => (
    <Link
      href={href}
      onClick={onClick}
      className="font-score transition-colors duration-200"
      style={{
        color: isActive(href) ? "var(--bota-gold)" : "var(--bone-dim)",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        fontSize: "0.8rem",
        paddingBottom: 2,
        borderBottom: isActive(href)
          ? "1px solid var(--bota-gold)"
          : "1px solid transparent",
      }}
    >
      {label}
    </Link>
  );

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: "rgba(10,10,11,0.82)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(212,175,55,0.22)",
      }}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Wordmark */}
        <Link
          href="/"
          className="font-engrave text-gold shrink-0"
          style={{ fontSize: "1.15rem", fontWeight: 700, letterSpacing: "0.08em" }}
        >
          Golden&nbsp;Bota
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} label={l.label} />
          ))}
        </div>

        {/* Right side: auth */}
        <div className="flex items-center gap-3">
          {auth.isAuthenticated ? (
            <>
              <span
                className="hidden text-sm sm:inline"
                style={{ color: "var(--bone-dim)" }}
              >
                Hi,{" "}
                <span style={{ color: "var(--bota-gold)" }}>
                  {userDetails?.fantasyPlayerName?.split(" ")[0] || "manager"}
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="font-score px-3 py-1.5 text-xs transition-colors duration-200"
                style={{
                  color: "var(--bone)",
                  border: "1px solid rgba(212,175,55,0.4)",
                  borderRadius: 4,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Log Out
              </button>
            </>
          ) : (
            <button
              onClick={handleLogin}
              className="font-score px-4 py-1.5 text-xs transition-transform duration-200 hover:-translate-y-0.5"
              style={{
                color: "var(--pitch)",
                background:
                  "linear-gradient(180deg, var(--gold-bright), var(--bota-gold) 60%, var(--gold-deep))",
                borderRadius: 4,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Log In
            </button>
          )}

          {/* Hamburger */}
          <button
            className="text-gold md:hidden"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((v) => !v)}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 7h16M4 12h16M4 17h16"}
              />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {isOpen && (
        <div
          className="md:hidden"
          style={{
            background: "rgba(10,10,11,0.97)",
            borderTop: "1px solid rgba(212,175,55,0.18)",
          }}
        >
          <div className="flex flex-col gap-1 px-4 py-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setIsOpen(false)}
                className="font-score py-2"
                style={{
                  color: isActive(l.href) ? "var(--bota-gold)" : "var(--bone)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontSize: "0.9rem",
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;
