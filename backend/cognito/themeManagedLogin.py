#!/usr/bin/env python3
"""Apply the "Bota de Oro" trophy theme to the Cognito Managed Login branding.

Reads the current branding settings from the backup document, rewrites the
color values (for BOTH light and dark modes, so the login card matches the app
regardless of the visitor's OS preference), and writes an updated settings JSON
ready to hand to `aws cognito-idp update-managed-login-branding`.

Colors are 8-digit RRGGBBAA hex strings (no leading '#'), matching Cognito's
format. Palette mirrors apps/golden-bota/src/styles/globals.css.
"""
import copy
import json
from pathlib import Path

# --- Trophy palette (RRGGBBAA, matches globals.css) -------------------------
PITCH = "0a0a0bff"        # near-black case / page background
PITCH_RAISED = "16130cff"  # card background
PITCH_HOVER = "241f14ff"   # subtle raised hover
GOLD = "d4af37ff"          # metallic gold — primary
GOLD_BRIGHT = "f4d77eff"   # specular highlight (hover)
GOLD_DEEP = "8c6a1aff"     # engraving shadow / borders
BONE = "ede6d6ff"          # body text on dark
BONE_DIM = "a49d8cff"      # secondary text
GOLD_BORDER = "d4af3747"   # translucent gold hairline (~28% alpha)

BACKUP = Path(__file__).with_name("managed-login-branding.backup.json")
OUT = Path(__file__).with_name("managed-login-settings.themed.json")


def theme(settings: dict) -> dict:
    s = copy.deepcopy(settings)
    c = s["components"]
    cc = s["componentClasses"]

    # Page background — trophy black in both modes, so the white card is gone.
    c["pageBackground"]["lightMode"]["color"] = PITCH
    c["pageBackground"]["darkMode"]["color"] = PITCH

    # Page text
    for mode in ("lightMode", "darkMode"):
        c["pageText"][mode]["headingColor"] = BONE
        c["pageText"][mode]["bodyColor"] = BONE_DIM
        c["pageText"][mode]["descriptionColor"] = BONE_DIM

    # The card ("form") — raised panel with a gold hairline
    for mode in ("lightMode", "darkMode"):
        c["form"][mode]["backgroundColor"] = PITCH_RAISED
        c["form"][mode]["borderColor"] = GOLD_BORDER

    # Header / footer bars
    for comp in ("pageHeader", "pageFooter"):
        for mode in ("lightMode", "darkMode"):
            c[comp][mode]["background"]["color"] = PITCH
            c[comp][mode]["borderColor"] = GOLD_BORDER

    # Primary button — the gold "Sign in" plate
    for mode in ("lightMode", "darkMode"):
        pb = c["primaryButton"][mode]
        pb["defaults"] = {"backgroundColor": GOLD, "textColor": PITCH}
        pb["active"] = {"backgroundColor": GOLD_DEEP, "textColor": PITCH}
        pb["hover"] = {"backgroundColor": GOLD_BRIGHT, "textColor": PITCH}
        pb["disabled"] = {"backgroundColor": PITCH_HOVER, "borderColor": PITCH_HOVER}

    # Secondary button — outlined gold
    for mode in ("lightMode", "darkMode"):
        sb = c["secondaryButton"][mode]
        sb["defaults"] = {"backgroundColor": PITCH_RAISED, "borderColor": GOLD, "textColor": GOLD}
        sb["hover"] = {"backgroundColor": PITCH_HOVER, "borderColor": GOLD_BRIGHT, "textColor": GOLD_BRIGHT}
        sb["active"] = {"backgroundColor": PITCH_HOVER, "borderColor": GOLD_BRIGHT, "textColor": GOLD_BRIGHT}

    # Inputs
    for mode in ("lightMode", "darkMode"):
        cc["input"][mode]["defaults"] = {"backgroundColor": PITCH, "borderColor": GOLD_DEEP}
        cc["input"][mode]["placeholderColor"] = BONE_DIM
        cc["inputLabel"][mode]["textColor"] = BONE
        cc["inputDescription"][mode]["textColor"] = BONE_DIM

    # Links ("Forgot your password?", "Create an account")
    for mode in ("lightMode", "darkMode"):
        cc["link"][mode]["defaults"]["textColor"] = GOLD
        cc["link"][mode]["hover"]["textColor"] = GOLD_BRIGHT

    # Checkbox / radio (Show password)
    for mode in ("lightMode", "darkMode"):
        oc = cc["optionControls"][mode]
        oc["defaults"] = {"backgroundColor": PITCH, "borderColor": GOLD_DEEP}
        oc["selected"] = {"backgroundColor": GOLD, "foregroundColor": PITCH}

    # Focus ring + dividers
    for mode in ("lightMode", "darkMode"):
        cc["focusState"][mode]["borderColor"] = GOLD_BRIGHT
        cc["divider"][mode]["borderColor"] = GOLD_BORDER

    return s


def main() -> None:
    doc = json.loads(BACKUP.read_text())
    settings = doc["ManagedLoginBranding"]["Settings"]
    OUT.write_text(json.dumps(theme(settings)))
    print(f"Wrote themed settings to {OUT}")


if __name__ == "__main__":
    main()
