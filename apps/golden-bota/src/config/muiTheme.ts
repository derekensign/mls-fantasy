import { createTheme } from "@mui/material/styles";

// "Bota de Oro" MUI theme — maps the trophy palette (see globals.css) onto
// Material-UI so every MUI-built page (league, draft, transfer) inherits the
// engraved dark-gold look without per-component overrides.
const PITCH = "#0a0a0b";
const PITCH_RAISED = "#16130c";
const PITCH_LINE = "#241f14";
const GOLD = "#d4af37";
const GOLD_BRIGHT = "#f4d77e";
const BONE = "#ede6d6";
const BONE_DIM = "#a49d8c";

const botaTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: GOLD, contrastText: PITCH },
    secondary: { main: GOLD_BRIGHT },
    background: { default: PITCH, paper: PITCH_RAISED },
    text: { primary: BONE, secondary: BONE_DIM },
    divider: PITCH_LINE,
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: "Inter, system-ui, sans-serif",
    h1: { fontFamily: "Cinzel, Georgia, serif", fontWeight: 700 },
    h2: { fontFamily: "Cinzel, Georgia, serif", fontWeight: 700 },
    h3: { fontFamily: "Cinzel, Georgia, serif", fontWeight: 700 },
    h4: { fontFamily: "Cinzel, Georgia, serif", fontWeight: 600, color: GOLD },
    h5: { fontFamily: "Cinzel, Georgia, serif", fontWeight: 600, color: GOLD },
    h6: { fontFamily: "Cinzel, Georgia, serif", fontWeight: 600 },
    button: { textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(212,175,55,0.28)",
          backgroundColor: PITCH_RAISED,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        outlined: {
          borderColor: "rgba(212,175,55,0.5)",
          color: GOLD,
          "&:hover": { borderColor: GOLD, backgroundColor: "rgba(212,175,55,0.08)" },
        },
        contained: {
          backgroundImage: `linear-gradient(180deg, ${GOLD_BRIGHT}, ${GOLD} 60%, #8c6a1a)`,
          color: PITCH,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: BONE_DIM,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          "&.Mui-selected": { color: GOLD },
        },
      },
    },
    MuiTabs: {
      styleOverrides: { indicator: { backgroundColor: GOLD } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: PITCH,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(212,175,55,0.4)" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: GOLD },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: GOLD },
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { color: BONE_DIM } } },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: PITCH_LINE, color: BONE },
        head: {
          color: GOLD,
          fontFamily: "Oswald, sans-serif",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        },
      },
    },
    MuiLink: { styleOverrides: { root: { color: GOLD } } },
  },
});

export default botaTheme;
