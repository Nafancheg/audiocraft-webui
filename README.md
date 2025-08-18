[![Discord](https://img.shields.io/discord/232596713892872193?logo=discord)](https://discord.gg/2JhHVh7CGu)

# audiocraft-webui v.3
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
 - **Rerun**: Повтор генерации с теми же параметрами одной кнопкой.
 - **Экспорт чата**: Выгрузка истории диалога (.json / .txt).
 - **Компактный режим чата**: Сжатое отображение сообщений.
 - **Прогресс генерации в чате**: Единое динамическое системное сообщение (устранён нижний дублирующий индикатор).
 - **Guard от двойной отправки**: Блок повторного Submit пока задача не завершена.
 - **TopK / TopP взаимоисключение**: Автоотключение второго параметра при изменении одного (во избежание конфликтов).
- **База i18n**: Черновой словарь RU / EN для меток.
 - **Auto-Tune параметров**: Опциональная авто‑подстройка `temperature`, `cfg_coef`, предельной `duration` на основе диапазона разнообразия (top_p или нормализованный top_k) и размера модели (small/medium/large). Не изменяет значения, если пользователь уже вручную отошёл от дефолтов.
 - **Inline Multi-Band Diffusion Decode**: Чекбокс «Diffusion Decode (MBD)» — при включении дополнительно декодирует токены через `MultiBandDiffusion` (без отдельного прогресс‑бара) и подменяет аудио.
 - **Demucs: Arbitrary File**: Отдельная панель загрузки любого внешнего аудио для разделения на стемы без генерации нового трека.
 - **Loudness Match в Append Mode**: При склейке continuation производится RMS‑выравнивание и контролируемый clamp (gain 0.25–4.0) с откатом при слишком низком пике.
 - **Авто-дублирование моно -> стерео**: Одноканальный вывод дублируется (планируется переключатель).
 - **Language Selector**: Быстрое переключение RU / EN (черновая локализация).
 - **last_run.json**: Сохранение последнего набора параметров (UI restore кнопка в планах).
 - **Серверное взаимное исключение top_k/top_p**: Бэкенд гарантирует, что в модель уйдёт только один параметр.

Старая очередь и список генераций убраны ради более чистого чат‑опыта (можно вернуть при необходимости через абстракцию очереди на бэкенде).

### Архитектура фронтенда (ES Modules)

Код разделён на самостоятельные ES‑модули без inline‑скриптов:

| Модуль | Назначение |
|--------|------------|
| `static/js/main.js` | Инициализация Socket.IO, сбор параметров формы, отправка, маршрутизация событий прогресса и завершения |
| `static/js/chat.js` | Рендер и хранение чата (localStorage), экспорт, компактный режим, системное сообщение прогресса |
| `static/js/render.js` | Построение карточки текущего трека (Copy Seed / Rerun / Delete) |
| `static/js/player.js` | Кастомный аудиоплеер (play/pause, seek, loop, volume, download) |
| `static/js/stems.js` | Demucs стемы: микшер, solo/mute, offline mix/ZIP |
| `static/js/settings.js` | Логика seed (auto / roll) и взаимное исключение top_k / top_p |
| `static/js/modules-init.js` | Отложенная инициализация модулей после готовности сокета |

Временные глобали `window.*` используются как мост совместимости; план — удалить их после внедрения внутренней event‑шины.

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
 - **Auto-Tune**: Если включён, система может немного скорректировать `temperature`, `cfg_coef`, сократить `duration` (перекладываясь на diversity‑зону: low/mid/high). В JSON фиксируются внесённые изменения в блоке `auto_tune.changes`.
 - **Diffusion Decode (MBD)**: Inline decode через `MultiBandDiffusion`; увеличивает время и может слегка менять текстуру / сглаживать артефакты.
 - **Demucs Arbitrary File**: Панель в разделе Advanced — позволяет прогнать любой файл через Demucs (стемы появляются внизу без генерации нового JSON трека).

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

### 2025-08-18
- Полный переход на модульную архитектуру фронтенда (ES modules) без inline JS.
- Прогресс генерации унифицирован в одно системное сообщение чата (нормализация форматов `progress` или `step/total`).
- Исправлен баг двойной генерации (удалён inline `onclick`, добавлен in‑flight guard).
- Восстановлена функция Delete после рефактора (очистка аудио, JSON, стемов и связанных сообщений).
- Добавлены: Rerun, экспорт чата (JSON/TXT), компактный режим.
- Внедрено взаимоисключение top_k / top_p в отдельном модуле.
- Улучшена устойчивость (ранний 0% прогресс, защита от дубликатов сообщений прогресса).
 - Итерация 5: опциональный inline Multi-Band Diffusion decode (без прогресс-бара): при включении чекбокса декодирование токенов делается через MultiBandDiffusion и заменяет исходный wav.
 - Добавлен чекбокс Auto-Tune (настроен включённым по умолчанию).
 - Реализована серверная логика авто‑тюна (`auto_tune` в JSON: содержит выбранную зону, модельный bucket и список изменений либо `disabled`).
 - В JSON убрано дублирование top_k/top_p при генерации (взаимоисключение подтверждено сервером).
 - Inline MBD теперь отражается в JSON как `multi_band_diffusion.status=applied` и `impl=audiocraft_mbd`.
 - Подготовка к добавлению избранных треков (favorites) и защит от удаления (lock) — UI ещё не реализован.

### 2025-08-19
- Документация дополнена (Demucs arbitrary file, авто-дублирование моно, loudness match, JSON блоки).
- Добавлен раздел JSON Schema и уточнены метаданные.
- Расширено описание Auto-Tune и MBD inline.

---
## JSON Schema (упрощённый обзор)

Пример (усечённый):
```json
{
  "model": "large",
  "prompt": "...",
  "parameters": {
    "top_k": 190,
    "temperature": 1.05,
    "cfg_coef": 3.6,
    "duration": 25,
    "seed": 1234567,
    "format": "wav",
    "sample_rate": 48000,
    "audio_prompt": null,
    "continuation_source": null,
    "append_mode": false,
    "channels": 2,
    "channels_original": 1,
    "multi_band_diffusion": { "requested": true, "status": "applied", "impl": "audiocraft_mbd" },
    "auto_tune": {
      "applied": true,
      "band": "mid",
      "model_bucket": "large",
      "source": "top_k",
      "diversity_metric": 0.76,
      "changes": { "temperature": { "old": 1.2, "new": 1.05 }, "cfg_coef": { "old": 4.0, "new": 3.6 }, "duration": { "old": 30, "new": 25, "cap_reason": "diversity_high" } },
      "user_locked": { "temperature": false, "cfg_coef": false, "duration": false }
    },
    "stem_split": { "requested": "all", "status": "queued" },
    "continuation_loudness_gain_applied": 1.12
  },
  "postprocess": {
    "status": "running",
    "tasks": [ { "type": "stem_split", "status": "running" } ]
  }
}
```

Ключевые блоки:
- `parameters`: исходные и модифицированные параметры генерации + служебные поля.
  - `multi_band_diffusion`: `{ requested, status, impl, error? }`.
  - `auto_tune`: детали авто‑подстройки (или `{ applied:false, disabled:true }`).
  - `stem_split`: объект с `requested` и итоговыми полями (`stems` в postprocess).
  - `continuation_*`: метрики loudness и длительность исходного фрагмента.
  - `format_requested` и возможный `format_note` при откате.
  - `channels` / `channels_original` (после дублирования моно).
- `postprocess`: статус очереди и массив `tasks` (каждая с `type`, `status`, опционально `stems`, `error`).

Будущие расширения: `loop_mode`, `locked`, `favorite`, подробные loudness / peak метрики.


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
