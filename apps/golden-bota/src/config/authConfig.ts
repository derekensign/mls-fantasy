export const COGNITO_CONFIG = {
  // The authority MUST be the Cognito IDP issuer URL (not the hosted UI domain).
  // This is used for OIDC discovery and must match the `iss` claim in JWT tokens.
  authority:
    "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_D6OPuwWML",
  clientId:
    process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "7b2ljliksvl2pn7gadjrn90e1a",
  redirectUri:
    process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000/auth",
};
