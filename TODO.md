# TODO / Дорожная карта

## Итерация 1 (Формат + Частота + Переименование Audio Prompt)
- [x] UI: селект `Format` (WAV | FLAC | MP3*) (по умолчанию WAV), MP3 помечен экспериментальным.
- [x] UI: селект `Sample Rate` (Original | 48000 | 32000 | 16000).
- [x] UI: переименовать Melody upload -> `Audio Prompt`.
- [x] Backend: парсинг `format`, `sample_rate`, `audio_prompt`.
- [x] Backend: ресемплинг при отличии SR.
- [x] Backend: запись как WAV -> конверсия ffmpeg (FLAC / MP3, fallback WAV).
- [x] JSON: поля `format`, `sample_rate`, `audio_prompt` + метаданные.
- [x] Валидация: duration, top_k, temperature, cfg_coef, sample_rate whitelist.

## Итерация 2 (Continuation / Append)
- [x] UI: загрузка continuation + чекбокс.
- [x] Backend: загрузка и ресемпл.
- [x] Склейка: оригинал + новая часть.
- [x] JSON: `continuation_source`, `continuation_original_seconds`, `append_mode`.
- [x] SocketIO: `continuation_applied`.

## Итерация 3 (Заглушки Advanced)
- [x] UI: `Multi-Band Diffusion` (плейсхолдер, изначально отключён; заменён рабочим inline decode в Итерации 5).
- [x] UI: `Stem Split` селект.
- [x] Backend: принимает флаги, пишет в JSON статус `not_implemented`.
- [x] Каркас очереди пост‑обработок.

## Итерация 4 (Реализация Stem Split)
- [x] Demucs интеграция.
- [x] Асинхронное разделение.
- [x] Прогресс `stem_progress`.
- [x] Путь `static/stems/<basename>/<stem>.wav`.
- [x] Боковая панель стемов (кнопка исчезает без стемов).

## Итерация 5 (Multi-Band Diffusion / Quality) — ЧАСТИЧНО
- [ ] (Paused) Исследовать альтернативные веса / VRAM профили.
- [ ] (Paused) Подключить внешний weight (вне встроенного Audiocraft).
- [ ] (Paused) Обработка OOM (graceful fallback + освобождение CUDA).
- [ ] (Paused) Тест спектра (до/после MBD: SNR, high‑freq energy delta).
- [x] Inline decode через встроенный `MultiBandDiffusion` (чекбокс MBD) — без прогресс-бара.
- [x] JSON отражает `multi_band_diffusion.status=applied` и `impl=audiocraft_mbd`.

## Итерация 6 (UX улучшения)
- [x] Кнопка `Roll` seed.
- [x] Тоггл авто-seed.
 - [x] Кнопка `Rerun` на карточке.
 - [ ] Сохранение последнего набора параметров (`last_run.json`). (частично: базовая запись есть, требуется UI restore кнопка)
 - [ ] Панель фильтров (seed / model / format / artist).
 - [ ] Сворачивание длинных промптов.
- [ ] Взаимоисключение `top_k` / `top_p` (автоотключение одного параметра при изменении другого + подсказка).
 - [x] Взаимоисключение `top_k` / `top_p` (автоотключение одного параметра при изменении другого + подсказка).

## Итерация 7 (Loop Mode – бесшовный цикл)
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

## Рефактор / Качество
- [ ] Централизовать нормализацию параметров.
- [ ] Вынести файловые операции в `utils/files.py`.
- [ ] Тесты: sanitize_filename, маппер параметров, ресемпл.
- [ ] Логгер (уровни, таймстемпы).
- [ ] Ограничение MAX_QUEUE.
- [ ] Разделить `main.js` на модули (render, stems, chat, player).
 - [x] Разделить `main.js` на модули (render, stems, chat, player, settings, modules-init, player) — завершено.
 - [ ] Удалить временные `window.*` экспорты (полный переход на импорт).
 - [ ] Ввести внутреннюю шину событий (event bus) вместо прямых window вызовов.
 - [ ] Модуль `i18n` (расширить словарь + динамическая локаль).
 - [ ] Прогресс: добавить мини прогресс‑бар или визуальную шкалу внутри системного сообщения.
 - [ ] Кнопка Cancel / Abort generation (требует backend события отмены).
 - [ ] Ленивая загрузка модулей стемов (динамический import при первом появлении стемов).
 - [ ] Избранное (отметка трека как Favorite) с отдельным фильтром.
 - [ ] Блокировка удаления (Lock): флаг в JSON `locked: true` предотвращает удаление / массовую очистку (нужно подтверждение override).
 - [x] Auto-Tune параметров (серверный модуль с флагом в UI).

## Валидация и Безопасность
- [ ] Лимит размера загрузки.
- [ ] Мягкий fallback при ошибке ресемпла.
- [ ] Санитайз имен стемов / mbd.
- [ ] Ограничение длины промпта + предупреждение.

## Документация
- [x] README обновлён.
- [ ] CHANGELOG по итерациям.
- [ ] Таблица форматов vs зависимости.
- [ ] Примечания по continuation & stem split.
- [ ] Раздел про Artist и схему имени.

## Опционально (Future)
- [ ] Drag & drop (промпт и аудио).
- [ ] Пресеты (settings/presets/*.json).
- [ ] REST `/generate`.
- [ ] Переключение темы.
- [ ] Визуализация волны (стемы + мастер).
- [ ] Прогресс‑волна в реальном времени.

## Итерация 8 (Chat UI & Плеер)
- [x] Замена списка на чат.
- [x] Сохранение истории в localStorage.
- [x] Единое сообщение (промпт + файл).
- [x] Одна активная карточка.
- [x] Кастомный плеер.
- [x] Префикс Artist.
- [x] Массовая очистка.
- [x] Микшер стемов (solo/mute/volume/mix/ZIP).
- [x] Фикс дубликатов карточек.
- [x] Скрытие кнопки стемов при их отсутствии.
 - [x] Guard на повторный рендер того же файла.
 - [x] Компактный режим чата.
 - [x] Экспорт чата (.json / .txt).
 - [ ] Расширение i18n (полный RU перевод подсказок).
      - [ ] UI: Прогресс‑бар вместо одного процента (fallback процентный текст остаётся).
      - [ ] Cancel кнопка в сообщении прогресса.

## Новые мелкие задачи
- [ ] UI кнопка "Восстановить последний запуск" (чтение `last_run.json`).
- [ ] Переключатель моно/стерео дублирования (сейчас всегда дублируем моно -> стерео).
- [ ] Отображение peak/RMS в карточке.
- [ ] Кнопка запросить стемы повторно (если не были получены / ошибка).
 - [ ] UI индикация применённых авто‑тюн изменений (tooltip или expandable).
 - [ ] Кнопка пометить трек избранным (toggle звезды) + фильтр «Показать только избранные».
 - [ ] Кнопка Lock / Unlock (предотвращает удаление и массовый wipe для трека).
 - [ ] Переключатель моно‑дублирования (отключить автодублирование mono->stereo).
 - [ ] Отдельный экспорт метаданных (CSV) по выбранным трекам.
 - [ ] REST endpoint `/metadata` с фильтрами (model, artist, favorite, locked).

## Итерация 9 (Metadata / Favorites / Locks)
- [ ] Добавить поле `favorite` в JSON + UI toggle (звезда в actions bar).
- [ ] Добавить поле `locked` в JSON + UI toggle (иконка замка) + защита в /delete.
- [ ] Фильтр отображения (All / Favorites / Unlocked / Locked).
- [ ] UI restore кнопка для `last_run.json`.
- [ ] JSON расширить peak / RMS / integrated LUFS (анализ после генерации).
- [ ] Документация схемы loudness и обновление README.

---
Legend: `*` experimental feature.
