# TODO / Roadmap

## Iteration 1 (Format + Sample Rate + Audio Prompt rename)
- [ ] UI: Add select `Format` (WAV | FLAC | MP3*) (default: WAV). Mark MP3 experimental.
- [ ] UI: Add select `Sample Rate` (Original | 48000 | 32000 | 16000) (default: Original).
- [ ] UI: Rename current Melody upload to `Audio Prompt` (id: `audio_prompt`).
- [ ] Backend: Parse `format`, `sample_rate`, `audio_prompt` from submit payload.
- [ ] Backend: Resample output if requested SR differs (torchaudio.functional.resample).
- [ ] Backend: Write file:
      - WAV: existing audio_write path.
      - FLAC: torchaudio.save(..., format='FLAC').
      - MP3: attempt (torchaudio.save or fallback to WAV with warning if unsupported).
- [ ] Metadata JSON: add `format`, `sample_rate`, `audio_prompt` (filename or null).
- [ ] Validation: duration (1..120), top_k (0..250), temperature (0.1..2.0), cfg_coef (0..10), sample_rate whitelist.

## Iteration 2 (Continuation Append Mode)
- [ ] UI: Add Continuation upload input + checkbox `Append continuation`.
- [ ] Backend: Load continuation audio (resample if needed).
- [ ] Append Mode: concatenate original audio + generated segment (duration = new part only).
- [ ] JSON: `continuation_source`, `continuation_original_seconds`.
- [ ] SocketIO event: `continuation_applied` after concat.

## Iteration 3 (Placeholders for Advanced Features)
- [ ] UI: Checkbox `Multi-Band Diffusion` (disabled placeholder initially).
- [ ] UI: Select `Stem Split` (disabled; options: vocals, drums, bass, other, all).
- [ ] Backend: Accept flags; write to JSON with status `not_implemented`.
- [ ] Structure: Post-processing queue scaffold.

## Iteration 4 (Stem Split Implementation)
- [ ] Dependency: integrate Demucs (document install).
- [ ] Async stem separation task after generation.
- [ ] Progress events: `stem_progress` (0-100).
- [ ] Output path: `static/stems/<basename>/<stem>.wav`.
- [ ] UI: Toggle to show/hide stems under card.

## Iteration 5 (Multi-Band Diffusion / Quality Pass)
- [ ] Research available MBD model/checkpoint (VRAM requirements).
- [ ] Add flag `mbd_strength`.
- [ ] Async pass producing improved file (either replace or `_mbd.wav`).
- [ ] JSON: `postprocess.mbd = { enabled, status, output }`.

## Iteration 6 (UX Enhancements)
- [ ] Button `Random Seed` (sets seed = -1 or random int).
- [ ] Button `Rerun` on each card (re-enqueue same params).
- [ ] Persist format, sample_rate, seed, model in `last_run.json`.
- [ ] Filter panel (by seed, model, format).
- [ ] Truncated prompt with expand/collapse.

## Iteration 7 (Loop Mode – seamless looping)
- [ ] UI: Checkbox `Loop mode` + numeric `loop_crossfade_ms` (e.g. 50–500ms).
- [ ] Backend: If enabled, post-process generated audio to ensure seamless loop.
- [ ] Backend Algorithm (v1):
      1. Ensure min duration > crossfade * 2.
      2. Take last N ms and first N ms segments.
      3. Apply linear (or equal-power) fade-out to tail, fade-in to head.
      4. Overlap-add -> produce blended ring segment.
      5. Replace first N ms with blend head, trim/overwrite last N ms accordingly.
- [ ] Optional advanced (v2): FFT spectral match to correct DC offset / boundary energy.
- [ ] JSON metadata: `loop_mode: { enabled: true, crossfade_ms: N }`.
- [ ] Validation: crossfade_ms < duration*500 (ms) / 4; fallback disable if too short.
- [ ] Add small loop preview button in UI (play 3 cycle repeats).
- [ ] Tests: verify RMS difference between boundary frames < threshold.

## Refactor / Code Quality
- [ ] Centralize parameter normalization in a util.
- [ ] Extract file ops (upload/delete) to `utils/files.py`.
- [ ] Add unit tests (sanitize_filename, param mapper, resample function).
- [ ] Replace print with structured logger (levels, timestamps).
- [ ] MAX_QUEUE limit + rejection message.

## Validation & Safety
- [ ] Max upload size check (audio_prompt / continuation).
- [ ] Graceful fallback if resample fails.
- [ ] Sanitize stem & mbd output filenames.

## Documentation
- [ ] README: update with new parameters & examples.
- [ ] CHANGELOG: entries per iteration.
- [ ] Table of formats vs dependencies (FFmpeg / libsndfile).
- [ ] Add usage notes for continuation & stem split.

## Optional Future
- [ ] Drag & drop for prompt & audio.
- [ ] Preset management (settings/presets/*.json).
- [ ] REST endpoint `/generate` (JSON -> async job id).
- [ ] Dark / light theme toggle.

---
Legend: `*` experimental feature.
