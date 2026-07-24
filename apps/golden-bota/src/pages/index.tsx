import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/router";
import Image from "next/image";
import FiligreeDivider from "../components/FiligreeDivider";

function TeamHome() {
  const auth = useAuth();
  const router = useRouter();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    if (auth.isAuthenticated && !redirected) {
      setRedirected(true);
      router.push("/MyTeam");
    }
  }, [auth.isAuthenticated, redirected, router]);

  // ---- Loading / error / post-auth states --------------------------------
  if (auth.isLoading) {
    return (
      <CenterStage>
        <p
          className="font-score"
          style={{ color: "var(--bone-dim)", letterSpacing: "0.24em" }}
        >
          POLISHING THE TROPHY…
        </p>
      </CenterStage>
    );
  }

  if (auth.isAuthenticated) {
    return (
      <CenterStage>
        <p
          className="font-score"
          style={{ color: "var(--bone-dim)", letterSpacing: "0.24em" }}
        >
          TAKING YOU TO YOUR SQUAD…
        </p>
      </CenterStage>
    );
  }

  // ---- Signed-out hero -----------------------------------------------------
  const signUp = () => {
    const signupUrl = process.env.NEXT_PUBLIC_COGNITO_SIGNUP_URL;
    if (signupUrl) window.location.href = signupUrl;
    else console.error("NEXT_PUBLIC_COGNITO_SIGNUP_URL is not defined");
  };

  return (
    <main className="relative overflow-hidden">
      <section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-4xl flex-col items-center justify-center px-5 py-16 text-center">
        <div className="rise-in">
          <Image
            src="/golden-bota-boiz.png"
            alt="Golden Bota Boiz crest"
            width={190}
            height={190}
            priority
            className="drop-shadow-[0_10px_40px_rgba(212,175,55,0.28)]"
          />
        </div>

        <p
          className="eyebrow rise-in mt-6"
          style={{ fontSize: "0.72rem", animationDelay: "80ms" }}
        >
          MLS Fantasy · Goals only · Winner takes the boot
        </p>

        <h1
          className="font-engrave rise-in mt-3"
          style={{
            animationDelay: "140ms",
            fontWeight: 800,
            lineHeight: 1.02,
            fontSize: "clamp(2.6rem, 9vw, 5.5rem)",
          }}
        >
          <span
            className="block"
            style={{
              backgroundImage:
                "linear-gradient(180deg, var(--gold-bright), var(--bota-gold) 55%, var(--gold-deep))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            GOLDEN BOTA
          </span>
        </h1>

        <p
          className="rise-in mt-5 max-w-xl text-base sm:text-lg"
          style={{ color: "var(--bone-dim)", animationDelay: "200ms" }}
        >
          One rule: your strikers score, you climb the plate. Draft a squad,
          chase the transfer window, and settle — once and for all — who owns
          the Golden Boot.
        </p>

        {auth.error && (
          <p
            className="rise-in mt-5 text-sm"
            style={{ color: "var(--bone-dim)", animationDelay: "230ms" }}
          >
            Your session expired — sign in again to pick up where you left off.
          </p>
        )}

        <div
          className="rise-in mt-9 flex flex-col items-center gap-3 sm:flex-row"
          style={{ animationDelay: "260ms" }}
        >
          <button
            onClick={() => auth.signinRedirect()}
            className="font-score px-8 py-3 text-sm transition-transform duration-200 hover:-translate-y-0.5"
            style={{
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--pitch)",
              background:
                "linear-gradient(180deg, var(--gold-bright), var(--bota-gold) 60%, var(--gold-deep))",
              borderRadius: 4,
              fontWeight: 600,
              boxShadow: "0 8px 24px rgba(212,175,55,0.3)",
            }}
          >
            Sign In
          </button>
          <button
            onClick={signUp}
            className="font-score px-8 py-3 text-sm transition-colors duration-200"
            style={{
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--bota-gold)",
              border: "1px solid rgba(212,175,55,0.5)",
              borderRadius: 4,
              fontWeight: 500,
            }}
          >
            Create Account
          </button>
        </div>

        <FiligreeDivider className="mt-14 w-full" />

        {/* Three-step "how it works" — a real sequence, so numbering earns its place */}
        <ol className="rise-in mt-10 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3" style={{ animationDelay: "320ms" }}>
          {[
            {
              n: "I",
              title: "Join a league",
              body: "Create one for your group or join with an invite.",
            },
            {
              n: "II",
              title: "Draft your strikers",
              body: "Snake draft the MLS players you think will bang in goals.",
            },
            {
              n: "III",
              title: "Climb the boot",
              body: "Every real goal your players score lifts you up the table.",
            },
          ].map((step) => (
            <li key={step.n} className="plaque p-5">
              <span
                className="font-engrave text-gold"
                style={{ fontSize: "1.4rem", fontWeight: 700 }}
              >
                {step.n}
              </span>
              <h3
                className="font-engrave mt-1"
                style={{ color: "var(--bone)", fontSize: "1.05rem" }}
              >
                {step.title}
              </h3>
              <p className="mt-1 text-sm" style={{ color: "var(--bone-dim)" }}>
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function CenterStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-5">
      {children}
    </div>
  );
}

export default TeamHome;
