# Changes: Sid parameter integration & audio deletion

Date: 2025-08-16

## Key additions
- Parameter renamed everywhere: Seed -> Sid (UI, backend, filenames).
- Added `Sid` slider (`id="sid"`) with range -1 (random) to 99,999,999.
- Backend normalizes any legacy keys (seed / cfg_seed / sid) into unified `sid`.
- If sid >= 0 we call `torch.manual_seed(sid)` for reproducible generation.
- Output `.wav` filename now appends suffix `_sid<value>` when sid >= 0.
- Sid shown among parameters in each generated audio card.
- Added delete button `X` (class `delete-audio`) to remove audio (and paired JSON) from UI and disk.
- New HTTP endpoint: `POST /delete_audio` with JSON `{ "wav": "static/audio/<name>.wav" }`.
- Fixed melody loading: HTTP URL converted to local path before `torchaudio.load`.

## Touched files
- `templates/index.html`: added `sid` slider.
- `static/main-style.css`: width style for `sid` input and delete button styles.
- `static/main.js`: display Sid in parameters, delete button & `deleteAudio` function.
- `webui.py`: key normalization to `sid`, `/delete_audio` endpoint, seed fixation, proper melody path resolution.
- `mechanisms/generator_backend.py`: uses `sid` for RNG seeding and filename suffix.

## Filename format
```
<prompt_sanitized>_sid<sid>.wav
```
If sid = -1 the suffix is omitted.

## Deletion API
Request:
```
POST /delete_audio
Content-Type: application/json
{"wav": "static/audio/Example_sid123.wav"}
```
Success response:
```
{"success": true, "deleted": ["static/audio/Example_sid123.wav", "static/audio/Example_sid123.json"]}
```

## Possible future improvements
- Persist last `sid` in `last_run.json` and preload to UI.
- "Regenerate" button using same Sid.
- Quick random Sid button near the slider.
- Backend range validation (clamp > 99,999,999).
