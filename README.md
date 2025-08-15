[![Discord](https://img.shields.io/discord/232596713892872193?logo=discord)](https://discord.gg/2JhHVh7CGu)

# audiocraft-webui v2.0!
Local web UI for Facebook's Audiocraft model: <https://github.com/facebookresearch/audiocraft>

<img width="2470" height="976" alt="audiocraft-webui" src="https://github.com/user-attachments/assets/35aee0b5-8829-48ec-b850-0482b6ce1086" />

## Features

- **Long Audio (chunked)**: Queue up long prompts; audio segments processed sequentially (practical GPU limits still apply).
- **Processing Queue**: Add multiple prompts; they auto-run in FIFO order.
- **Generation History**: Each audio file is stored with a paired JSON (parameters + prompt).
- **Seed (reproducibility)**: Use -1 for random or set a positive integer to reproduce a result.
- **Melody / Audio Prompt mode**: Supply a guiding melody (Melody model) to steer generation.
- **Deletion**: Remove generated audio + its metadata directly from the UI (X button).

## Install

If you'd like GPU acceleration and do not have torch installed, visit [PyTorch Installation Guide](https://pytorch.org/get-started/locally/) for instructions on installing GPU-enabled torch correctly.

### Option 1: Manual Installation
If you prefer manual installation, install dependencies using:
```bash
pip install -r requirements.txt
```
(If you encounter errors with **audiocraft**, please refer to their [official documentation](https://github.com/facebookresearch/audiocraft)).

### Option 2: Install Script (Automated)
To automate installation and environment setup, use the provided script:
- **Linux/macOS:**
  ```bash
  ./install.sh
  ```
- **Windows:**
  ```cmd
  install.bat
  ```
This will check for **Python 3.10**, create a virtual environment (`venv`), and install all required dependencies automatically. If Conda is available, it can be used instead of venv.

---

## Run

### Option 1: Manual
Start the web UI manually using:
```bash
python webui.py
```

### Option 2: Run Script
Alternatively, use the run script for easier execution:
- **Linux/macOS:**
  ```bash
  ./run.sh
  ```
- **Windows:**
  ```cmd
  run.bat
  ```
This will automatically activate the appropriate environment (virtualenv or Conda) and start `webui.py`. Once the script is stopped, it ensures the environment is properly deactivated.

---

No need to manually download the checkpoints—pick a model from the dropdown; on first use it will auto-download via Audiocraft.

To use **Melody / Audio Prompt** guidance choose the `melody` model; an upload input will appear for a short reference audio clip.

---

## Notes
- Generated files are saved in the `static/audio/` directory.
- The currently active model remains loaded in memory by default. To unload it after each generation, launch with:
  ```bash
  python webui.py --unload-after-gen
  ```
- The UI could use an improved design—contributors are welcome!

---

## Parameters

- **Top K**: Restricts candidate tokens. Lower = more deterministic, higher = more variety.
- **Top P**: Nucleus sampling threshold (probability mass). ~0.7 is a common starting point.
- **Duration**: Target length (seconds) per generation request.
- **CFG (Classifier-Free Guidance)**: Strength of adherence to text. 3–5 typically balances fidelity and creativity.
- **Temperature**: Randomness scaler. <1.0 = conservative, >1.0 = more exploratory.
- **Seed**: -1 = random each run; any non-negative integer gives reproducible output.
- **Model**: small / medium / large / melody (melody enables audio prompt input).
- **Audio Prompt**: (Melody model only) A guiding reference (timbre / contour).

---

## Troubleshooting
- **Torch Installation Issues:**
  Ensure you have the correct **CPU/GPU version** installed ([PyTorch Guide](https://pytorch.org/get-started/locally/)).
- **Virtual Environment Issues:**
  If activation fails, try:
  ```bash
  source venv/bin/activate  # Linux/macOS
  venv\Scripts\activate    # Windows
  ```
- **Conda Not Found?**
  Ensure Conda is installed and added to `PATH`. Verify by running:
  ```bash
  conda --version
  ```
- **Installation Script Issues?**
  Ensure scripts have execution permissions:
  ```bash
  chmod +x install.sh run.sh
  ```

---

## Changelog

### 2024-02-25
- Core rewrite.
- Added generation history (audio + JSON pairing).
- Removed outdated dependencies.
- Removed deprecated parameters (`overlap`, `segments`).

### 2025-08-16
- Added Seed slider (reproducibility, -1 random).
- Added parameter normalization; unified key `seed`.
- Added filename suffix `_seed<value>` when seed >= 0.
- Added delete button to remove audio + metadata.
- Fixed melody (audio prompt) local path loading.

---
## Planned / Roadmap (short extract)
See `TODO.md` for full details.
- Format & sample rate selection.
- Continuation (append) mode.
- Stem split (Demucs) & multi-band diffusion post-process.
- Loop mode (seamless crossfade loop creation).
- MP3 / FLAC export.

## Contributing
PRs for UI polish, performance optimizations, and new parameter support are welcome. Please keep changes focused and documented in the Changelog section.
