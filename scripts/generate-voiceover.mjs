// Generate the demo voiceover via ElevenLabs.
//
// Voice: Adam (pNInz6obpgDQGcFmaJgB) — deep, narrator-style American
// male. Best fit for a tech product commercial.
// Model: eleven_multilingual_v2 — current best-quality TTS.
//
// Output: docs/videos/voiceover.mp3, ~45–50 seconds, intended to be
// mixed under the edited video by edit-demo.sh.
//
// Run:
//   node scripts/generate-voiceover.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..');
dotenv.config({ path: path.join(repoRoot, '.env') });

const API_KEY = process.env.ELEVEN_LABS_API_KEY;
if (!API_KEY) {
  console.error('ELEVEN_LABS_API_KEY missing in .env');
  process.exit(1);
}

const VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam
const MODEL_ID = 'eleven_multilingual_v2';

// Hand-tuned to roughly match the 52s edited video. Pauses are encoded
// as actual ellipses + double-spaces so ElevenLabs' prosody handler
// inserts natural breathing room — better than baking silences via
// ffmpeg later.
const SCRIPT = `Meet JobRadar.

The old way? Five job boards every morning. The same listings, day after day. Recruitment-agency reposts. Ghost listings.

JobRadar flips that.

Define what you want once. Keywords, location, your filters. Then let it run.

Claude searches the web in real time. Career pages. Job boards. Aggregators. And brings back scored, verified postings.

Triage with one click. Saved. Applied. Interview. Your notes survive every re-run.

Open source. Bring your own key. JobRadar — on GitHub.`;

console.log(`Generating voiceover (${SCRIPT.length} chars)…`);

const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
  {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: SCRIPT,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
  }
);

if (!response.ok) {
  const text = await response.text();
  console.error(`ElevenLabs ${response.status}: ${text.slice(0, 400)}`);
  process.exit(1);
}

const buffer = Buffer.from(await response.arrayBuffer());
const outPath = path.join(repoRoot, 'docs/videos/voiceover.mp3');
fs.writeFileSync(outPath, buffer);
console.log(`saved: ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
