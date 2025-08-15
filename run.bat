@echo off
call venv\Scripts\activate
python webui.py
call venv\Scripts\deactivate

echo Script completed.
