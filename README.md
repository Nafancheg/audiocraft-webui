[![Discord](https://img.shields.io/discord/232596713892872193?logo=discord)](https://discord.gg/2JhHVh7CGu)

# audiocraft-webui (чатовый интерфейс)
Локальный веб‑интерфейс для модели Audiocraft от Facebook: <https://github.com/facebookresearch/audiocraft>

<img width="2470" height="976" alt="audiocraft-webui" src="https://github.com/user-attachments/assets/f3a686c1-36c7-49e6-bb8c-9b2bc3fda4ca" />

## Возможности (текущий чат‑ориентированный UI)

- **Чат‑процесс**: Промпты и ответы (имена файлов-ссылки) в прокручиваемом чате с сохранением в localStorage.
- **Одна активная карточка**: Всегда показывается только одна подробная карточка трека (без захламления) с параметрами и плеером.
- **Кастомный аудиоплеер**: Единый тёмный плеер (play/pause, перемотка, loop, громкость, скачивание) вместо стандартного `<audio>`.
- **Управление Seed**: Авто режим (-1) + ручной seed и кнопка Roll (в авто режиме сохраняем -1, сервер может вернуть фактический seed отдельно).
- **Artist (опционально)**: Префикс артиста в имени файла (санитизирован) для брендинга.
- **Детерминированные имена**: `Artist_Model_Seed_DDMMYYYY_HH_MM` (seed -1 опускается) и парный JSON.
- **Выбор формата и частоты**: WAV / FLAC / экспериментальный MP3 + ресемплинг (original / 48k / 32k / 16k).
- **Continuation (Append) режим**: Второй клип добавляется перед новым генератором (JSON хранит исходную длину и флаги).
- **Audio Prompt (Melody)**: Референсный аудио‑пример при выборе модели `melody`.
- **Demucs Stem Split**: Опциональное разделение (vocals / drums / bass / other / all) с прогрессом.
- **Панель микшера стемов**: Play / solo / mute / громкость по стему, синхронное воспроизведение, сведение выбранных в WAV, ZIP (выбранные или все).
- **Массовая очистка**: Диалог подтверждения для удаления всех треков, стемов и чата.
- **Удаление**: Кнопка на карточке удаляет аудио, JSON, стемы и сообщения чата.
- **База i18n**: Черновой словарь RU / EN для меток.

Старая очередь и список генераций убраны ради более чистого чат‑опыта (можно вернуть при необходимости через абстракцию очереди на бэкенде).

## Установка

Если нужна GPU‑акселерация и torch ещё не установлен, см. [PyTorch Installation Guide](https://pytorch.org/get-started/locally/).

### Вариант 1: Ручная установка
Установите зависимости:
```bash
pip install -r requirements.txt
```
(Если возникают ошибки с **audiocraft**, смотрите их [официальную документацию](https://github.com/facebookresearch/audiocraft)).

### Вариант 2: Скрипт установки (автоматически)
Для автоматизации подготовки окружения:
- **Linux/macOS:**
  ```bash
  ./install.sh
  ```
- **Windows:**
  ```cmd
  install.bat
  ```
Скрипт проверит **Python 3.10**, создаст окружение (`venv`) и установит зависимости. Если есть Conda — может быть использована.

---

## Запуск

### Вариант 1: Ручной запуск
Запустить интерфейс:
```bash
python webui.py
```

### Вариант 2: Скрипт запуска
Используйте run‑скрипт:
- **Linux/macOS:**
  ```bash
  ./run.sh
  ```
- **Windows:**
  ```cmd
  run.bat
  ```
Он активирует окружение (venv/Conda) и стартует `webui.py`. После остановки деактивирует среду.

---

Чекпойнты качать вручную не нужно — при первом использовании выбранная модель загрузится автоматически.

Для **Melody / Audio Prompt** выберите модель `melody` — появится поле загрузки.

---

## Примечания
- Аудио сохраняются в `static/audio/`; стемы — `static/stems/<basename>/`.
- К каждому файлу есть JSON (параметры, формат, SR, промпт, continuation, postprocess).
- Модель держится в памяти. Чтобы выгружать после каждой генерации:
  ```bash
  python webui.py --unload-after-gen
  ```
- История чата хранится только локально (не на сервере). Очистка удаляет файлы.
- Кастомный плеер минималистичен — PR с визуализациями приветствуется.

---

## Параметры (слайдеры и флаги)

- **Top K**: Ограничение числа кандидатов. Меньше — детерминированней, больше — разнообразнее.
- **Top P**: Порог ядровой выборки (nucleus). ~0.7 типично.
- **Duration**: Целевая длина (сек) новой части.
- **CFG**: Насколько строго следовать тексту. 3–5 — баланс.
- **Temperature**: Степень случайности. <1.0 сдержанно, >1.0 экспериментально.
- **Seed**: -1 = случайный; >=0 воспроизводимо.
- **Model**: small / medium / large / melody.
- **Audio Prompt**: Референс для melody.
- **Append continuation**: Склейка внешнего клипа перед новой генерацией.
- **Stem Split**: Demucs разделение (при включении появляются стемы).
- **Format / Sample Rate**: Формат контейнера и опциональный ресемпл (FLAC/MP3 требуют ffmpeg).
- **Artist**: Префикс в имени файла.

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

## История изменений

### 2024-02-25
- Core rewrite.
- Added generation history (audio + JSON pairing).
- Removed outdated dependencies.
- Removed deprecated parameters (`overlap`, `segments`).

### 2025-08-16
- Добавлен слайдер Seed (-1 авто / случайно).
- Нормализация параметров; единый ключ `seed`.
- Суффикс `_seed<value>` в имени если seed >=0.
- Кнопка удаления аудио + JSON.
- Исправлена загрузка локального Melody.

### 2025-08-17
- Крупный рефактор под чат (убран старый список и layout mode).
- Persist‑чат (localStorage) с единым ответом (промпт + ссылка файла).
- Кастомный плеер (loop, seek, volume, download).
- Artist toggle + интеграция в схему имени.
- Новая схема имени `Artist_Model_Seed_DDMMYYYY_HH_MM`.
- Боковая панель стемов Demucs + плейсхолдер прогресса.
- Микшер стемов (solo / mute / volume / mixdown / ZIP) в браузере.
- Модалка массовой очистки.
- Continuation UI + метаданные.
- RU/EN словарь меток.
- Авто seed + roll.
- Фикс дубликатов карточек (строго одна).
- Улучшено каскадное удаление (включая стемы и чат).
- Удалён устаревший код очереди и layout.

---
## План / Roadmap (снимок)
Полный список см. `TODO.md`.
- Multi-Band Diffusion (исследование + постпроцесс).
- Loop mode (кроссфейд, предпросмотр).
- Расширенный логгер, пресеты параметров.
- Волновая форма / мини‑визуализация стемов.
- Drag & drop (промпт и аудио).
- REST / программный endpoint.
- Светлая тема.

## Вклад
PR приветствуются: улучшение UI, новые пост‑обработки, доступность, локализация. Делайте изменения точечными и добавляйте краткую запись в историю.
