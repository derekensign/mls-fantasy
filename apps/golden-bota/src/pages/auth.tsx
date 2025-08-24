import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/router";

export default function Auth() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      const redirectUrl = (router.query.redirect as string) || "/";
      router.push(redirectUrl);
    }
  }, [auth.isAuthenticated, auth.user, router]);

  if (auth.isAuthenticated && auth.user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Welcome!</h1>
          <p>Redirecting you...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
        <p>Please complete the authentication process.</p>
      </div>
    </div>
  );
};
