"""Multi-Band Diffusion (MBD) integration helper.

This module attempts to load a real Multi-Band Diffusion refinement model (if
available inside the installed `audiocraft` / external packages). If the real
model or weights are unavailable, callers can fall back to a lighter heuristic.

Design goals:
 - Lazy singleton load (so normal generations without MBD pay zero cost).
 - Graceful degradation: failure -> returns None and raises no fatal errors.
 - Progress callback support (chunk wise) so UI can reflect advancement.

Environment variables:
 - MBD_MODEL_NAME   override model name (default: auto / internal default)
 - MBD_DEVICE       e.g. cuda, cuda:0, cpu (default: auto cuda if available)

To plug a real implementation later, adjust `_real_infer` body.
"""
from __future__ import annotations

import os
import threading
from typing import Callable, Optional

import torch

_MODEL_LOCK = threading.Lock()
_MBD_MODEL = None
_MBD_DEVICE = None


def _select_device():
    dev_env = os.environ.get('MBD_DEVICE')
    if dev_env:
        return torch.device(dev_env)
    if torch.cuda.is_available():
        return torch.device('cuda')
    return torch.device('cpu')


def _load_model_internal():
    """Attempt to load a real MBD model; return (model, device) or (None, device)."""
    global _MBD_MODEL, _MBD_DEVICE
    if _MBD_MODEL is not None:
        return _MBD_MODEL, _MBD_DEVICE
    with _MODEL_LOCK:
        if _MBD_MODEL is not None:
            return _MBD_MODEL, _MBD_DEVICE
        device = _select_device()
        model = None
        model_name = os.environ.get('MBD_MODEL_NAME') or 'auto'
        try:
            # Heuristic attempt: try audiocraft internal API first
            from audiocraft.models import MultiBandDiffusion  # type: ignore
            get_fn = getattr(MultiBandDiffusion, 'get_pretrained', None)
            if callable(get_fn):
                candidate_names = []
                if model_name == 'auto':
                    candidate_names = ['mbd_10bands', 'mbd', 'multiband_diffusion']
                else:
                    candidate_names = [model_name]
                for name in candidate_names:
                    try:
                        model = get_fn(name)
                        if model:
                            break
                    except Exception:
                        continue
            if model is None:
                try:
                    model = MultiBandDiffusion()
                except Exception:
                    pass
            if model is not None:
                model.to(device)
                model.eval()
        except Exception:
            model = None
        _MBD_MODEL, _MBD_DEVICE = model, device
        return _MBD_MODEL, _MBD_DEVICE


def is_available() -> bool:
    m, _ = _load_model_internal()
    return m is not None


def _real_infer(model, device, waveform: torch.Tensor, sample_rate: int, strength: float, progress: Callable[[float], None]) -> torch.Tensor:
    """Placeholder for *real* inference.

    A genuine implementation would:
      - Possibly chunk waveform into overlapping windows.
      - For each chunk, run diffusion refinement (denoise / super-resolution).
      - Stitch back with crossfades.

    For now we simulate chunk steps + allow hooking a future real call.
    """
    with torch.no_grad():
        x = waveform.clone()
        total_chunks = 8
        chunk_len = max(1, x.shape[-1] // total_chunks)
        for i in range(total_chunks):
            start = i * chunk_len
            end = x.shape[-1] if i == total_chunks - 1 else (i + 1) * chunk_len
            seg = x[..., start:end]
            if seg.numel():
                k = int(5 * (0.2 + strength))
                if k > 1:
                    kernel = torch.ones(1, 1, k, device=seg.device) / k
                    seg_f = torch.nn.functional.pad(seg.unsqueeze(0), (k//2, k - k//2 - 1), mode='reflect')
                    seg_lp = torch.nn.functional.conv1d(seg_f, kernel).squeeze(0)
                    seg.mul_(1 - strength).add_(seg_lp * strength)
            progress((i + 1) / total_chunks * 0.9)
        progress(0.95)
    return x


def process_with_mbd(waveform, sample_rate: int, strength: float, progress_cb: Callable[[float], None]) -> Optional[torch.Tensor]:
    """Run MBD if available; returns processed tensor or None on failure.

    progress_cb receives values in [0,1]. We'll map internal steps.
    """
    model, device = _load_model_internal()
    if model is None:
        return None
    try:
        strength = float(strength)
    except Exception:
        strength = 0.5
    strength = max(0.0, min(1.0, strength))
    wf = waveform.to(device)
    progress_cb(0.02)
    with torch.inference_mode():
        refined = _real_infer(model, device, wf, sample_rate, strength, progress_cb)
    progress_cb(1.0)
    return refined.detach().cpu()
