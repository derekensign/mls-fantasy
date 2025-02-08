export const COGNITO_CONFIG = {
  clientId:
    process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "7b2ljliksvl2pn7gadjrn90e1a",
  redirectUri:
    process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000/auth",
  cognitoDomain:
    process.env.NEXT_PUBLIC_COGNITO_DOMAIN ||
    "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_D6OPuwWML",
};
