import React, { ComponentType, useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/router";

const withAuth = <P extends object>(
  WrappedComponent: ComponentType<P & { auth: ReturnType<typeof useAuth> }>
) => {
  return function WithAuthComponent(props: P) {
    const auth = useAuth();
    const router = useRouter();
    const [redirecting, setRedirecting] = useState(false);

    useEffect(() => {
      const isLogoutRedirect = router.query?.logout === "true"; // Detect logout
      if (
        !auth.isLoading &&
        !auth.isAuthenticated &&
        !redirecting &&
        !isLogoutRedirect
      ) {
        if (router.pathname !== "/") {
          setRedirecting(true);
          router
            .push("/")
            .catch((error) =>
              console.error("Error during redirection:", error)
            );
        }
      }
    }, [auth.isLoading, auth.isAuthenticated, redirecting, router]);

    if (auth.isLoading || redirecting) {
      console.log("Auth state: ", auth);
      return <div>Loading...</div>;
    }

    if (auth.error) {
      return <div>Error: {auth.error.message}</div>;
    }

    if (!auth.isAuthenticated) {
      return null; // Avoid rendering during redirection
    }

    return <WrappedComponent {...props} auth={auth} />;
  };
};

export default withAuth;
