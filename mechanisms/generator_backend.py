from .model_hijack import HijackedMusicGen
from audiocraft.data.audio import audio_write
import torch, re, os, json, torchaudio, torchaudio.functional as AF, shutil, subprocess, tempfile
from datetime import datetime

MODEL = None

def load_model(version, socketio):
    global MODEL
    print("Loading model", version)
    try:
        MODEL = HijackedMusicGen.get_pretrained(socketio, version)
    except Exception as e:
        print(f"Failed to load model due to error: {e}, you probably need to pick a smaller model.")
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
        return None
    return MODEL

def sanitize_filename(filename):
    """
    Takes a filename and returns a sanitized version safe for filesystem operations.
    """
    return re.sub(r'[^\w\d-]', ' ', filename)

def write_paired_json(model_type, filename, prompt, audio_gen_params):
    output_filename = f"{filename}.json"
    
    write_data = {"model":model_type, "prompt":prompt, "parameters":audio_gen_params}
    
    with open(output_filename, 'w') as outfile:
        json.dump(write_data, outfile, indent=4)
        
    return output_filename

def write_audio(model_type, prompt, audio, audio_gen_params):
    global MODEL
    # Всегда включаем seed в имя, если он определён и не отрицателен
    seed = audio_gen_params.get('seed') or audio_gen_params.get('sid') or audio_gen_params.get('cfg_seed')
    try:
        seed_int = int(seed)
    except (TypeError, ValueError):
        seed_int = None
    # Новая схема имени файла: Model_Seed_DDMMYYYY_HH_MM
    # Всегда используем сгенерированный/переданный seed (к этому моменту он уже финализирован в handle_submit_sliders)
    if seed_int is None or seed_int < 0:
        seed_int = 0  # fallback, не должен встречаться обычно
    now = datetime.now()
    ts = now.strftime('%d%m%Y_%H_%M')  # DDMMYYYY_HH_MM
    artist = audio_gen_params.get('artist')
    if isinstance(artist, str) and artist.strip():
        safe_artist = sanitize_filename(artist.strip())
        base_filename = f"static/audio/{safe_artist}_{model_type}_{seed_int}_{ts}"
    else:
        base_filename = f"static/audio/{model_type}_{seed_int}_{ts}"
    # Базовый WAV путь (до уникализации)
    output_wav = f"{base_filename}.wav"
    absolute_path = os.path.abspath(output_wav)
    
    audio_tensors = audio.detach().cpu().float()
    sample_rate = MODEL.sample_rate

    # Нормализуем форму: ожидаем (channels, samples)
    # Возможные случаи: (B, C, T), (B, T), (C, T), (T,)
    if audio_tensors.dim() == 3:
        # Берём первую в batch
        audio_tensors = audio_tensors[0]
    if audio_tensors.dim() == 2 and audio_tensors.shape[0] > audio_tensors.shape[1]:
        # Иногда может быть (T, C) — транспонируем
        audio_tensors = audio_tensors.transpose(0,1)
    if audio_tensors.dim() == 1:
        # (T,) -> (1, T)
        audio_tensors = audio_tensors.unsqueeze(0)

    original_channels = audio_tensors.shape[0]
    # Опция: простое дублирование моно в псевдо-стерео (не создаёт настоящей сцены, но увеличивает каналовость и bitrate)
    duplicate_mono = True
    if duplicate_mono and original_channels == 1:
        audio_tensors = audio_tensors.repeat(2, 1)
    export_channels = audio_tensors.shape[0]

    # Ресемпл если требуется
    target_sr = audio_gen_params.get('sample_rate', 'original')
    if isinstance(target_sr, str) and target_sr.lower() == 'original':
        target_sr_int = sample_rate
    else:
        try:
            target_sr_int = int(target_sr)
        except:
            target_sr_int = sample_rate
    if target_sr_int != sample_rate:
        try:
            audio_tensors = AF.resample(audio_tensors, sample_rate, target_sr_int)
            sample_rate = target_sr_int
        except Exception as e:
            print(f"Resample failed ({sample_rate}->{target_sr_int}): {e}")

    requested_format = str(audio_gen_params.get('format', 'wav')).lower()
    if requested_format not in ('wav','flac','mp3'):
        requested_format = 'wav'
    
    max_length = 255
    if len(absolute_path) > max_length:
        # Обрезаем base_filename чтобы итоговый путь не превосходил max_length
        static_prefix_len = len(os.path.abspath("static/audio/")) + 1  # +sep
        allowed_name_len = max(10, max_length - static_prefix_len - 8)  # запас под _seed и расширения
        base_filename = base_filename[:allowed_name_len]
        output_wav = f"{base_filename}.wav"
    
    # Уникализация имени
    i = 1
    while os.path.exists(output_wav):
        output_wav = f"{base_filename}({i}).wav"
        i += 1

    # Пишем WAV через audio_write: принимает (T,) или (C, T)
    wav_for_write = audio_tensors
    if wav_for_write.dim() == 2 and wav_for_write.shape[0] == 1:
        wav_for_write = wav_for_write.squeeze(0)  # моно
    audio_write(
        output_wav, wav_for_write, sample_rate, strategy="loudness",
        loudness_headroom_db=18, loudness_compressor=True, add_suffix=False)

    final_filename = output_wav
    actual_format = 'wav'
    if requested_format != 'wav':
        ffmpeg_path = shutil.which('ffmpeg')
        target_file = f"{base_filename}.{requested_format}"
        if ffmpeg_path:
            # Конвертируем через ffmpeg
            cmd = [ffmpeg_path, '-y', '-i', output_wav]
            if requested_format == 'mp3':
                # 320k CBR для максимального качества
                cmd += ['-codec:a', 'libmp3lame', '-b:a', '320k']
            elif requested_format == 'flac':
                cmd += ['-compression_level', '5']
            cmd.append(target_file)
            try:
                subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if os.path.exists(target_file) and os.path.getsize(target_file) > 0:
                    final_filename = target_file
                    actual_format = requested_format
                else:
                    print(f"ffmpeg produced no output for {requested_format}, keeping wav")
            except Exception as e:
                print(f"ffmpeg conversion failed ({requested_format}): {e}, keeping wav")
        else:
            print("ffmpeg not found in PATH, cannot convert format; keeping wav")

    # Обновим метаданные
    audio_gen_params['sample_rate'] = sample_rate
    audio_gen_params['format_requested'] = requested_format
    audio_gen_params['format'] = actual_format
    audio_gen_params['channels'] = export_channels
    audio_gen_params['channels_original'] = original_channels
    if actual_format != requested_format:
        audio_gen_params['format_note'] = 'fallback_to_wav'
    
    json_filename = write_paired_json(model_type, final_filename.rsplit('.', 1)[0], prompt, audio_gen_params)
    return final_filename, json_filename

def generate_audio(socketio, model_type, prompt, audio_gen_params, melody_data, continuation_data=None):
    global MODEL
    # Seed уже должен быть финализирован на этапе приёма запроса
    seed_val = audio_gen_params.get('seed', audio_gen_params.get('sid', audio_gen_params.get('cfg_seed')))
    try:
        torch.manual_seed(int(seed_val))
    except (TypeError, ValueError):
        pass  # не удалось интерпретировать seed — оставляем как есть (случайный)

    # Формируем только допустимые параметры генерации
    allowed_gen_keys = { 'top_k', 'top_p', 'temperature', 'duration', 'cfg_coef' }
    gen_params = {k: v for k, v in audio_gen_params.items() if k in allowed_gen_keys}
    # Взаимоисключение: если задан top_p > 0, игнорируем top_k; иначе если top_p == 0 или отсутствует, используем top_k
    try:
        tp = float(gen_params.get('top_p', 0) or 0)
    except Exception:
        tp = 0
    if tp > 0:
        gen_params.pop('top_k', None)
    else:
        # Если top_p не используется, убираем его чтобы не передавать 0 в модель (иногда это даёт деградацию)
        gen_params.pop('top_p', None)

    if not MODEL or MODEL.name != f"facebook/musicgen-{model_type}":
        load_model(model_type, socketio)
    if not MODEL:
        print("Couldn't load model.")
        return
    
    MODEL.set_generation_params(use_sampling=True, **gen_params)
    
    if melody_data is not None:
        melody, melody_sr = melody_data
        output = MODEL.generate_with_chroma(
            descriptions=[prompt],
            melody_wavs=melody,
            melody_sample_rate=melody_sr,
            progress=True
        )
    else:
        output = MODEL.generate(descriptions=[prompt], progress=True)
    # Append continuation (присоединяем оригинал перед новым сегментом)
    if continuation_data is not None:
        try:
            cont_wave, cont_sr = continuation_data
            # Приводим к sample_rate модели
            if cont_sr != MODEL.sample_rate:
                cont_wave = AF.resample(cont_wave, cont_sr, MODEL.sample_rate)
            # Подготовка output
            gen_wave = output
            if gen_wave.dim() == 3:
                gen_wave = gen_wave[0]
            if gen_wave.dim() == 2 and gen_wave.shape[0] > gen_wave.shape[1]:
                gen_wave = gen_wave.transpose(0,1)
            if gen_wave.dim() == 1:
                gen_wave = gen_wave.unsqueeze(0)
            if cont_wave.dim() == 1:
                cont_wave = cont_wave.unsqueeze(0)
            # Перевод континуации на девайс генерированного тензора (обычно CUDA)
            gen_device = gen_wave.device
            cont_wave = cont_wave.to(gen_device)
            # Сведение каналов
            if cont_wave.size(0) != gen_wave.size(0):
                if cont_wave.size(0) == 1:
                    cont_wave = cont_wave.repeat(gen_wave.size(0),1)
                elif gen_wave.size(0) == 1:
                    gen_wave = gen_wave.repeat(cont_wave.size(0),1)
                else:
                    c = min(cont_wave.size(0), gen_wave.size(0))
                    cont_wave = cont_wave[:c]
                    gen_wave = gen_wave[:c]
            # Выравнивание громкости (простое RMS match)
            try:
                # RMS по всем сэмплам (можно ограничить хвост/начало, но пока глобально)
                eps = 1e-9
                rms_cont = (cont_wave.pow(2).mean().sqrt()).item()
                rms_gen_before = (gen_wave.pow(2).mean().sqrt()).item()
                gen_wave_raw = gen_wave  # для возможного отката
                gain = 1.0
                if rms_cont > eps and rms_gen_before > eps:
                    target = rms_cont
                    gain = target / rms_gen_before
                    # Ограничим экстремальные значения 
                    gain = max(0.25, min(4.0, gain))
                    gen_wave = (gen_wave * gain).clamp(-1.0, 1.0)
                # Контроль качества: если после масштабирования пик слишком мал (почти тишина) — откатываем
                peak_after = float(gen_wave.abs().max().item()) if gen_wave.numel() else 0.0
                if peak_after < 1e-3:
                    gen_wave = gen_wave_raw  # откат
                    audio_gen_params['continuation_loudness_reverted'] = True
                else:
                    audio_gen_params['continuation_loudness_reverted'] = False
                audio_gen_params['continuation_loudness_rms_cont'] = round(rms_cont, 6)
                audio_gen_params['continuation_loudness_rms_gen_before'] = round(rms_gen_before, 6)
                audio_gen_params['continuation_loudness_gain_applied'] = round(gain, 4)
            except Exception as le:
                print(f"Loudness match failed: {le}")
                audio_gen_params['continuation_loudness_gain_applied'] = None
            combined = torch.cat([cont_wave, gen_wave], dim=1)
            output = combined.unsqueeze(0)  # (B,C,T) на исходном девайсе
            # Метаданные
            continuation_seconds = round(cont_wave.shape[1] / MODEL.sample_rate, 3)
            audio_gen_params['continuation_original_seconds'] = continuation_seconds
            audio_gen_params['append_mode'] = True
            try:
                socketio.emit('continuation_applied', {
                    'prompt': prompt,
                    'continuation_source': audio_gen_params.get('continuation_source'),
                    'continuation_original_seconds': continuation_seconds
                })
            except Exception as ee:
                print(f"Emit continuation_applied failed: {ee}")
        except Exception as e:
            print(f"Continuation append failed: {e}")
            audio_gen_params['append_mode'] = False
            audio_gen_params['continuation_error'] = str(e)
            try:
                socketio.emit('continuation_applied', {
                    'prompt': prompt,
                    'error': str(e),
                    'continuation_source': audio_gen_params.get('continuation_source')
                })
            except Exception as ee:
                print(f"Emit continuation_applied (error) failed: {ee}")
    else:
        audio_gen_params['append_mode'] = False

    return write_audio(model_type, prompt, output, audio_gen_params)