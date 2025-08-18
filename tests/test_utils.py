import os, json
from mechanisms.generator_backend import sanitize_filename

def test_sanitize_filename_basic():
    assert sanitize_filename('Artist Name!!') == 'Artist Name  '

def test_sanitize_filename_unicode():
    out = sanitize_filename('Имя-Артиста?*')
    assert ' ' in out

def test_seed_normalization():
    # Simulate slider data mapping
    from webui import _validate_numeric
    data = {'duration': 9999, 'top_k': 9999, 'temperature': 99, 'cfg_coef': 999}
    norm = _validate_numeric(data)
    assert norm['duration'] <= 120
    assert norm['top_k'] <= 250
    assert norm['temperature'] <= 2.0
    assert norm['cfg_coef'] <= 10.0
