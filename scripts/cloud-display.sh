#!/usr/bin/env bash
# Source this file from the repository root in the isolated Linux cloud machine.
if [ -n "${DISPLAY:-}" ] && xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
  return 0
fi
export DISPLAY=:99
if ! xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
  cat > /tmp/beasttext-xorg.conf <<'XORG'
Section "Device"
 Identifier "Dummy"
 Driver "dummy"
 VideoRam 256000
EndSection
Section "Monitor"
 Identifier "Monitor"
 HorizSync 5.0-1000.0
 VertRefresh 5.0-200.0
 Modeline "1440x1000" 119.00 1440 1488 1520 1600 1000 1003 1013 1030
EndSection
Section "Screen"
 Identifier "Screen"
 Device "Dummy"
 Monitor "Monitor"
 DefaultDepth 24
 SubSection "Display"
 Depth 24
 Modes "1440x1000"
 EndSubSection
EndSection
XORG
  Xorg :99 -config /tmp/beasttext-xorg.conf -logfile /tmp/beasttext-xorg.log -noreset -nolisten tcp >/tmp/beasttext-xorg-console.log 2>&1 &
  for beast_display_attempt in {1..50}; do
    if xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then break; fi
    sleep 0.1
  done
  if ! xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
    cat /tmp/beasttext-xorg-console.log
    return 1
  fi
fi
