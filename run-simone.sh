# run_simone.sh — launch the Simone attractor shader fullscreen on the primary monitor.
# Requires: glslViewer (yay -S glslviewer) and X support.
set -euo pipefail
SCRIPT_DIR="$(pwd)"
SHADER="$SCRIPT_DIR/simone.frag"
echo "Running frag: $SHADER"

# Try to guess resolution; fallback to 1920x1080
W=${XDG_SESSION_TYPE:-}
if command -v hyprctl >/dev/null 2>&1; then
  # Hyprland: query active monitor
  RES=$(hyprctl monitors -j | jq -r '.[0].width|tostring + "x" + (.[0].height|tostring)')
elif command -v swaymsg >/dev/null 2>&1; then
  RES=$(swaymsg -r -t get_outputs | jq -r '.[0].current_mode.width|tostring + "x" + (.[0].current_mode.height|tostring)')
elif command -v xrandr >/dev/null 2>&1; then
  RES=$(xrandr | awk -F'[ +]' '/\*/{print $1; exit}')
else
  RES="1920x1080"
fi

W=${RES%x*}
H=${RES#*x}

exec glslViewer "$SHADER" -w "$W" -h "$H" --fullscreen --nocursor
