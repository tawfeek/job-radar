#!/bin/bash
# Build a polished commercial-style edit from the raw recording.
#
# v2 — captions redesigned to sync with Adam's narration. Fewer, shorter,
# heavier. Outro trimmed by 2s. Top-positioned kickers on light background.

set -euo pipefail

cd "$(dirname "$0")/.."

SRC=docs/videos/jobradar-demo-original.webm
OUT_DIR=docs/videos
WORK=$(mktemp -d)
trap "rm -rf $WORK" EXIT

# Apple's San Francisco — clean, modern, "tech product demo" energy.
FONT="/System/Library/Fonts/SFNS.ttf"
FONT_DISPLAY="/System/Library/Fonts/SFNS.ttf"

# ── 1. INTRO CARD (2.5s) ───────────────────────────────────────────────
ffmpeg -y -loglevel error \
  -f lavfi -i "color=c=0x0f172a:s=1280x720:d=2.5:r=30" \
  -vf "
    drawtext=fontfile=$FONT_DISPLAY:text='JobRadar':fontsize=110:fontcolor=0xa5b4fc:x=(w-text_w)/2:y=(h-text_h)/2-30,
    drawtext=fontfile=$FONT:text='An AI agent that hunts jobs while you sleep':fontsize=30:fontcolor=0x94a3b8:x=(w-text_w)/2:y=(h-text_h)/2+80,
    fade=t=in:st=0:d=0.4,fade=t=out:st=2.0:d=0.5
  " \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -preset slow -r 30 \
  "$WORK/intro.mp4"

# ── 2. MAIN BODY: speed-up + 5 sync'd captions ─────────────────────────
# Caption design:
#   - SF font, heavier weight via fontsize bump
#   - Bottom-center, ~70px from bottom (above any UI element)
#   - Indigo-on-white inverted block: white bg @ 95%, indigo text
#     for kicker/headline feel — much more "premium tech ad" than the
#     previous dark box.
#   - 0.4s fade-in via `enable` timing tightening
#   - All caption windows tightened to 2.5–3s (punchy, not lingering)
#
# Audio note: voiceover is offset +1.2s in the final mix. Caption times
# below are VIDEO times; subtract 1.2 to get audio cue time.
ffmpeg -y -loglevel error -i "$SRC" \
  -filter_complex "
    [0:v]trim=0:19,setpts=PTS-STARTPTS,fps=30[v1];
    [0:v]trim=19:47,setpts=(PTS-STARTPTS)/4,fps=30[v2];
    [0:v]trim=47,setpts=PTS-STARTPTS,fps=30[v3];
    [v1][v2][v3]concat=n=3:v=1[main];
    [main]
      drawtext=fontfile=$FONT_DISPLAY:text='Claude searches the web — live.':fontsize=52:fontcolor=white:box=1:boxcolor=0x6366f1@0.92:boxborderw=22:x=(w-text_w)/2:y=h-160:enable='between(t,22.5,28.0)',
      drawtext=fontfile=$FONT_DISPLAY:text='Scored. Verified. Deduped.':fontsize=52:fontcolor=white:box=1:boxcolor=0x10b981@0.92:boxborderw=22:x=(w-text_w)/2:y=h-160:enable='between(t,30.0,34.0)',
      fade=t=in:st=0:d=0.4
  " \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset slow -r 30 -an \
  "$WORK/main.mp4"

# ── 3. OUTRO CARD (2s — trimmed from 3.5s) ─────────────────────────────
ffmpeg -y -loglevel error \
  -f lavfi -i "color=c=0x0f172a:s=1280x720:d=2.0:r=30" \
  -vf "
    drawtext=fontfile=$FONT_DISPLAY:text='Open source. Bring your own key.':fontsize=44:fontcolor=0xa5b4fc:x=(w-text_w)/2:y=(h-text_h)/2-50,
    drawtext=fontfile=$FONT:text='github.com/tawfeek/job-radar':fontsize=32:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+30,
    fade=t=in:st=0:d=0.3,fade=t=out:st=1.4:d=0.6
  " \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -preset slow -r 30 \
  "$WORK/outro.mp4"

# ── 4. CONCAT all three (silent video) ─────────────────────────────────
cat > "$WORK/concat.txt" <<EOF
file '$WORK/intro.mp4'
file '$WORK/main.mp4'
file '$WORK/outro.mp4'
EOF

ffmpeg -y -loglevel error -f concat -safe 0 -i "$WORK/concat.txt" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset slow -movflags +faststart \
  "$WORK/silent.mp4"

# ── 5. MIX VOICEOVER ───────────────────────────────────────────────────
# Voiceover starts at 1.2s, runs ~41s. Outro card carries the last
# silence since the full video is now ~51s.
ffmpeg -y -loglevel error \
  -i "$WORK/silent.mp4" \
  -i "$OUT_DIR/voiceover.mp3" \
  -filter_complex "[1:a]adelay=1200|1200,apad,volume=1.0[narration]" \
  -map 0:v -map "[narration]" \
  -c:v copy -c:a aac -b:a 192k \
  -t $(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$WORK/silent.mp4") \
  "$OUT_DIR/jobradar-demo.mp4"

# ── 6. GIF (silent — gifs don't carry audio) ───────────────────────────
ffmpeg -y -loglevel error -i "$OUT_DIR/jobradar-demo.mp4" \
  -vf "fps=15,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" \
  -loop 0 \
  "$OUT_DIR/jobradar-demo.gif"

# ── 7. Stats ───────────────────────────────────────────────────────────
echo
echo "Output:"
ls -lh "$OUT_DIR/jobradar-demo.mp4" "$OUT_DIR/jobradar-demo.gif"
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUT_DIR/jobradar-demo.mp4")
echo "Duration: ${DURATION}s"
