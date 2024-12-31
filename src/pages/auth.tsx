import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/router";

export default function Auth() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.isAuthenticated) {
      console.log("User authenticated:", auth.user);

      // Redirect to the team page after successful login
      router.replace("/home");
    } else if (auth.error) {
      console.error("Authentication error:", auth.error.message);

      // Redirect to the home page if there is an authentication error
      router.replace("/");
    }
  }, [auth.isAuthenticated, auth.error, auth.user, router]);

  return (
    <div>
      <h1>Authenticating...</h1>
    </div>
  );
}
