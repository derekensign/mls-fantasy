import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/router";

export default function Auth() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log("Auth state in /auth page:", auth);
    // Wait until loading is finished
    if (!auth.isLoading) {
      if (auth.isAuthenticated) {
        console.log("User is authenticated:", auth.user);
        router.replace("/");
      } else if (auth.error) {
        console.error("Authentication error:", auth.error);
        router.replace("/");
      } else {
        console.log("Authentication not completed yet.");
      }
    }
  }, [auth, router]);

  return (
    <div>
      <h1>Authenticating...</h1>
    </div>
  );
}
