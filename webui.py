from flask_socketio import SocketIO, emit
from flask import Flask, render_template, request, jsonify, send_from_directory
import logging, os, queue, threading, json, secrets, warnings, shutil, subprocess, time, uuid
import torchaudio
from urllib.parse import urlparse, unquote
from mechanisms.generator_backend import generate_audio
import torchaudio.functional as F

app = Flask(__name__)
pending_queue = queue.Queue()
postprocess_queue = queue.Queue()
socketio = SocketIO(app, cors_allowed_origins="*")
logging.getLogger().setLevel(logging.ERROR)
logging.getLogger('engineio').setLevel(logging.ERROR)
logging.getLogger('socketio').setLevel(logging.ERROR)

def worker_process_queue():
    while True:
        item = pending_queue.get()
        try:
            # Поддержка старого формата (без continuation)
            if len(item) == 4:
                model_type, prompt, slider_data, melody_data = item
                continuation_data = None
            else:
                model_type, prompt, slider_data, melody_data, continuation_data = item
            result = generate_audio(socketio, model_type, prompt, slider_data, melody_data, continuation_data)
            if result:
                filename, json_filename = result
                socketio.emit('on_finish_audio', {"prompt": prompt, "filename": filename, "json_filename": json_filename})
                # Планируем постпроцесс при наличии placeholder-флагов
                try:
                    with open(json_filename, 'r', encoding='utf-8') as jf:
                        meta = json.load(jf)
                    params = meta.get('parameters', {})
                    mbd_req = params.get('multi_band_diffusion', {}).get('requested')
                    stem_req = params.get('stem_split', {}).get('requested')
                    tasks = []
                    if mbd_req:
                        tasks.append({'type': 'mbd', 'status': 'queued'})
                    if stem_req:
                        tasks.append({'type': 'stem_split', 'status': 'queued'})
                    if tasks:
                        post_block = meta.get('postprocess') or {}
                        post_block['tasks'] = tasks
                        post_block['status'] = 'queued'
                        meta['postprocess'] = post_block
                        with open(json_filename, 'w', encoding='utf-8') as jf:
                            json.dump(meta, jf, indent=4)
                        postprocess_queue.put({'json': json_filename, 'tasks': tasks, 'prompt': prompt})
                        socketio.emit('postprocess_queued', {'prompt': prompt, 'tasks': [t['type'] for t in tasks]})
                except Exception as e:
                    print(f"Failed to enqueue postprocess: {e}")
            else:
                socketio.emit('on_finish_audio', {"prompt": prompt, "filename": None, "json_filename": None, "error": "generation_failed"})
        except Exception as e:
            logging.exception("Generation failed")
            socketio.emit('on_finish_audio', {"prompt": prompt, "error": str(e)})
        finally:
            pending_queue.task_done()

@socketio.on('request_stems')
def handle_request_stems(data):
    """Queue stem split for an existing track (JSON metadata already on disk)."""
    try:
        json_path = data.get('json') if isinstance(data, dict) else None
        target = (data.get('target') or 'all') if isinstance(data, dict) else 'all'
        if not json_path or not json_path.endswith('.json'):
            return
        norm = os.path.normpath(json_path)
        # Ограничиваем область: только под static/audio
        base_dir = os.path.normpath(os.path.join(os.getcwd(), 'static', 'audio'))
        if not os.path.exists(norm):
            return
        if not os.path.commonpath([base_dir, os.path.abspath(norm)]) == base_dir:
            return
        with open(norm, 'r', encoding='utf-8') as jf:
            meta = json.load(jf)
        params = meta.setdefault('parameters', {})
        # Проверка: уже есть готовые stems
        pp = meta.get('postprocess') or {}
        existing_tasks = pp.get('tasks') or []
        for t in existing_tasks:
            if t.get('type') == 'stem_split' and t.get('status') in ('queued','running','done') and t.get('stems'):
                # Уже есть стемы — не дублируем
                return
        # Добавляем/обновляем параметр stem_split
        params['stem_split'] = {'requested': target, 'status': 'not_implemented'}
        # Добавляем задачу если ещё нет
        need_add = True
        for t in existing_tasks:
            if t.get('type') == 'stem_split' and t.get('status') in ('queued','running'):
                need_add = False
                break
        if need_add:
            existing_tasks.append({'type': 'stem_split', 'status': 'queued'})
        pp['tasks'] = existing_tasks
        pp['status'] = 'queued'
        meta['postprocess'] = pp
        with open(norm, 'w', encoding='utf-8') as jf:
            json.dump(meta, jf, indent=4)
        postprocess_queue.put({'json': norm, 'tasks': existing_tasks, 'prompt': meta.get('prompt')})
        socketio.emit('postprocess_queued', {'prompt': meta.get('prompt'), 'tasks': ['stem_split']})
    except Exception as e:
        print(f"request_stems failed: {e}")

def _run_stem_split(meta, json_path, task, socketio):
    """Execute Demucs stem split; update metadata & emit progress events."""
    try:
        from demucs.separate import main as demucs_main
    except Exception as e:
        task['status'] = 'error'
        task['error'] = f"demucs_import_failed: {e}"
        return
    # Determine requested stems (vocals/drums/bass/other/all)
    parameters = meta.get('parameters', {})
    stem_req_obj = parameters.get('stem_split', {})
    target = stem_req_obj.get('requested') or 'all'
    audio_file = None
    # Paired audio file name is meta json filename w/o .json and with extension stored in parameters['format']
    base_no_ext = os.path.splitext(json_path)[0]
    fmt = parameters.get('format', 'wav')
    # We can't be 100% sure of extension; try existing files in same folder
    possible = [base_no_ext + ext for ext in ('.wav', '.flac', '.mp3')]
    for p in possible:
        if os.path.exists(p):
            audio_file = p
            break
    if not audio_file:
        task['status'] = 'error'
        task['error'] = 'audio_file_missing'
        return
    # Prepare output directory
    stem_dir = os.path.join('static', 'stems', os.path.basename(base_no_ext))
    os.makedirs(stem_dir, exist_ok=True)
    task['output_dir'] = stem_dir
    # Build demucs CLI args
    # We'll capture progress by monitoring output files; Demucs itself doesn't expose incremental callback here.
    stems_map = ['vocals','drums','bass','other']
    expected = stems_map if target == 'all' else [target]
    # Execute demucs programmatically via subprocess for simpler isolation
    try:
        # demucs -n htdemucs --two-stems=vocals INPUT -o OUTPUTDIR
        # If splitting all, no --two-stems; we will move produced folder
        model_name = os.environ.get('DEMUCS_MODEL','htdemucs')
        cmd = ['demucs', '-n', model_name]
        if target != 'all' and target in stems_map:
            cmd += [f'--two-stems={target}']
        cmd += ['-o', stem_dir, audio_file]
        socketio.emit('stem_progress', {'prompt': meta.get('prompt'), 'progress': 0.01, 'stage':'start'})
        start = time.time()
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
        # Parse stdout for simple progress heuristics
        while True:
            line = proc.stdout.readline()
            if not line and proc.poll() is not None:
                break
            if line:
                ll = line.lower()
                # Heuristic: percent tokens
                for token in ('100%','90%','80%','70%','60%','50%','40%','30%','20%','10%'):
                    if token in ll:
                        try:
                            pct = float(token.strip('%'))/100.0
                            socketio.emit('stem_progress', {'prompt': meta.get('prompt'), 'progress': pct, 'stage':'demucs'})
                            break
                        except Exception:
                            pass
            # Periodic file count progress
            produced = [f for f in os.listdir(stem_dir) if f.lower().endswith('.wav')]
            if produced:
                pct_est = min(0.95, len(produced)/max(1,len(expected)))
                socketio.emit('stem_progress', {'prompt': meta.get('prompt'), 'progress': pct_est, 'stage':'files'})
        ret = proc.poll()
        if ret != 0:
            task['status'] = 'error'
            task['error'] = f'demucs_exit_{ret}'
            return
        # Move nested folder if Demucs created subdir structure
        # Demucs typically outputs OUT/model_name/filename/stem.wav -> flatten into stem_dir
        for root, dirs, files in os.walk(stem_dir):
            for f in files:
                if f.lower().endswith('.wav') and root != stem_dir:
                    src = os.path.join(root, f)
                    dst = os.path.join(stem_dir, f)
                    if not os.path.exists(dst):
                        shutil.move(src, dst)
        # Filter only expected stems if target != all
        if target != 'all':
            for f in os.listdir(stem_dir):
                if f.lower().endswith('.wav') and target not in f.lower():
                    # remove other stems
                    try:
                        os.remove(os.path.join(stem_dir,f))
                    except Exception:
                        pass
        produced_files = [os.path.join(stem_dir,f).replace('\\','/') for f in os.listdir(stem_dir) if f.lower().endswith('.wav')]
        task['status'] = 'done'
        task['stems'] = produced_files
        socketio.emit('stem_progress', {'prompt': meta.get('prompt'), 'progress': 1.0, 'stage':'complete', 'stems': produced_files})
    except FileNotFoundError:
        task['status'] = 'error'
        task['error'] = 'demucs_not_found_in_path'
    except Exception as e:
        task['status'] = 'error'
        task['error'] = str(e)

def worker_postprocess():
    while True:
        job = postprocess_queue.get()
        try:
            json_path = job['json']
            if not os.path.exists(json_path):
                continue
            with open(json_path, 'r', encoding='utf-8') as jf:
                meta = json.load(jf)
            tasks = meta.get('postprocess', {}).get('tasks', [])
            if not tasks:
                continue
            meta['postprocess']['status'] = 'running'
            with open(json_path, 'w', encoding='utf-8') as jf:
                json.dump(meta, jf, indent=4)
            any_running = False
            for t in tasks:
                if t.get('status') == 'queued':
                    if t['type'] == 'stem_split':
                        t['status'] = 'running'
                        with open(json_path, 'w', encoding='utf-8') as jf:
                            json.dump(meta, jf, indent=4)
                        _run_stem_split(meta, json_path, t, socketio)
                    else:
                        # Placeholder for future mbd etc.
                        for p in range(0,101,25):
                            socketio.emit('postprocess_progress', {'prompt': job.get('prompt'), 'progress': p/100.0})
                            threading.Event().wait(0.05)
                        t['status'] = 'not_implemented'
                any_running = True
            meta['postprocess']['status'] = 'done'
            with open(json_path, 'w', encoding='utf-8') as jf:
                json.dump(meta, jf, indent=4)
            socketio.emit('postprocess_done', {'prompt': job.get('prompt'), 'tasks': [t['type'] for t in tasks]})
        except Exception as e:
            print(f"Postprocess worker error: {e}")
        finally:
            postprocess_queue.task_done()

# ---------------- Arbitrary Demucs (demucs_any) -----------------
def _run_demucs_any(audio_path, job_id, display_name):
    """Run Demucs on an arbitrary uploaded file, emitting progress via dedicated events."""
    try:
        from demucs.separate import main as demucs_main  # noqa: F401 (import check)
    except Exception as e:
        socketio.emit('demucs_any_done', {
            'id': job_id, 'display_name': display_name,
            'error': f'demucs_import_failed: {e}'
        })
        return
    if not os.path.exists(audio_path):
        socketio.emit('demucs_any_done', {
            'id': job_id, 'display_name': display_name,
            'error': 'audio_file_missing'
        })
        return
    # Security: only allow inside static/
    abs_base = os.path.abspath(os.path.join(os.getcwd(), 'static'))
    abs_path = os.path.abspath(audio_path)
    if os.path.commonpath([abs_base, abs_path]) != abs_base:
        socketio.emit('demucs_any_done', {
            'id': job_id, 'display_name': display_name,
            'error': 'path_outside_static'
        })
        return
    out_dir = os.path.join('static', 'stems_any', job_id)
    os.makedirs(out_dir, exist_ok=True)
    model_name = os.environ.get('DEMUCS_MODEL','htdemucs')
    cmd = ['demucs', '-n', model_name, '-o', out_dir, audio_path]
    socketio.emit('demucs_any_progress', {'id': job_id, 'display_name': display_name, 'progress': 0.01, 'stage': 'start'})
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
        while True:
            line = proc.stdout.readline()
            if not line and proc.poll() is not None:
                break
            if line:
                ll = line.lower()
                for token in ('100%','90%','80%','70%','60%','50%','40%','30%','20%','10%'):
                    if token in ll:
                        try:
                            pct = float(token.strip('%'))/100.0
                            socketio.emit('demucs_any_progress', {'id': job_id, 'display_name': display_name, 'progress': pct, 'stage': 'demucs'})
                            break
                        except Exception:
                            pass
            # simple file-based heuristic
            produced = [f for f in os.listdir(out_dir) if f.lower().endswith('.wav')]
            if produced:
                socketio.emit('demucs_any_progress', {'id': job_id, 'display_name': display_name, 'progress': min(0.95, len(produced)/4.0), 'stage': 'files'})
        ret = proc.poll()
        if ret != 0:
            socketio.emit('demucs_any_done', {'id': job_id, 'display_name': display_name, 'error': f'demucs_exit_{ret}'})
            return
        # Flatten nested dirs
        for root, dirs, files in os.walk(out_dir):
            for f in files:
                if f.lower().endswith('.wav') and root != out_dir:
                    src = os.path.join(root,f)
                    dst = os.path.join(out_dir,f)
                    if not os.path.exists(dst):
                        shutil.move(src,dst)
        stems = [os.path.join(out_dir,f).replace('\\','/') for f in os.listdir(out_dir) if f.lower().endswith('.wav')]
        socketio.emit('demucs_any_done', {'id': job_id, 'display_name': display_name, 'stems': stems})
    except FileNotFoundError:
        socketio.emit('demucs_any_done', {'id': job_id, 'display_name': display_name, 'error': 'demucs_not_found_in_path'})
    except Exception as e:
        socketio.emit('demucs_any_done', {'id': job_id, 'display_name': display_name, 'error': str(e)})
        
def save_last_gen_settings(model_type, prompt, audio_gen_params):
    os.makedirs("settings", exist_ok=True)
    output_filename = "settings/last_run.json"
    write_data = {"model":model_type, "prompt":prompt, "parameters":audio_gen_params}
    
    with open(output_filename, 'w') as outfile:
        json.dump(write_data, outfile, indent=4)
        
def load_last_gen_settings():
    input_filename = "settings/last_run.json"
    if not os.path.exists(input_filename):
        return None, None, None

    with open(input_filename, 'r') as infile:
        settings = json.load(infile)
        model = settings.get("model")
        prompt = settings.get("prompt", "")
        params = settings.get("parameters", {})
        topp = float(params.get("top_p", 0.67))
        duration = int(params.get("duration", 30))
        cfg_coef = float(params.get("cfg_coef", 4.0))
        topk = int(params.get("top_k", 250))
        temperature = float(params.get("temperature", 1.2))
        seed = int(params.get("seed", -1))
    fmt = params.get("format", "wav")
    sr = params.get("sample_rate", "original")
    return model, prompt, topp, duration, cfg_coef, topk, temperature, seed, fmt, sr
    
    
ALLOWED_SAMPLE_RATES = {"original", "48000", "32000", "16000"}
ALLOWED_FORMATS = {"wav", "flac", "mp3"}

def detect_ffmpeg():
    for name in ("ffmpeg", "ffmpeg.exe"):
        p = shutil.which(name)
        if p:
            return p
    env_path = os.environ.get('FFMPEG_PATH')
    if env_path and os.path.exists(env_path):
        return env_path
    try:
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
        return "ffmpeg"
    except Exception:
        return None

FFMPEG_PATH = detect_ffmpeg()

def _validate_numeric(converted):
    # Clamps / validation ranges per TODO
    if 'duration' in converted:
        converted['duration'] = max(1, min(120, int(converted['duration'])))
    if 'top_k' in converted:
        converted['top_k'] = max(0, min(250, int(converted['top_k'])))
    if 'temperature' in converted:
        converted['temperature'] = max(0.1, min(2.0, float(converted['temperature'])))
    if 'cfg_coef' in converted:
        converted['cfg_coef'] = max(0.0, min(10.0, float(converted['cfg_coef'])))
    return converted

@socketio.on('submit_sliders')
def handle_submit_sliders(json):
    slider_data = json['values']
    prompt = json['prompt']
    model_type = json['model']
    artist_name = (json.get('artist') or '').strip() if isinstance(json.get('artist'), str) else ''
    if not prompt:
        return

    # Преобразуем значения: seed как int, остальные float
    converted = {}
    for k, v in slider_data.items():
        if k in ('seed', 'cfg_seed', 'sid'):
            try:
                converted['seed'] = int(float(v))  # нормализуем ключ к 'seed'
            except:
                converted['seed'] = -1
        else:
            try:
                # duration, top_k ожидаем как int — приведём без потери
                if k in ('duration', 'top_k'):
                    converted[k] = int(float(v))
                else:
                    converted[k] = float(v)
            except:
                pass

    # Если seed == -1, генерируем фиксированный случайный seed (0..99_999_999)
    if converted.get('seed', -1) == -1:
        converted['seed'] = secrets.randbelow(100_000_000)
        # Сообщим фронту обновлённое значение
        socketio.emit('update_seed', {'seed': converted['seed']})

    slider_data = converted

    slider_data = _validate_numeric(slider_data)

    # Доп. параметры формата / sample rate
    req_format = json.get('format', 'wav').lower()
    if req_format not in ALLOWED_FORMATS:
        req_format = 'wav'
    req_sr = str(json.get('sample_rate', 'original')).lower()
    if req_sr not in ALLOWED_SAMPLE_RATES:
        req_sr = 'original'
    slider_data['format'] = req_format
    slider_data['sample_rate'] = req_sr

    melody_data = None
    continuation_data = None

    audio_prompt_url = json.get('audioPromptUrl', None)
    if audio_prompt_url:
        parsed = urlparse(audio_prompt_url)
        if parsed.scheme in ('http', 'https'):
            local_path = unquote(parsed.path.lstrip('/'))
        else:
            local_path = unquote(audio_prompt_url)
        if not local_path.startswith('static/'):
            local_path = os.path.join('static', local_path)
        # Доп. валидация: должен быть файл с расширением аудио
        valid_exts = {'.wav', '.mp3', '.flac', '.ogg', '.m4a'}
        ext = os.path.splitext(local_path)[1].lower()
        if not (os.path.isfile(local_path) and ext in valid_exts):
            # Игнорируем некорректный путь (например 'static/' или директория)
            slider_data['audio_prompt'] = None
            melody_data = None
        else:
            try:
                melody_data = torchaudio.load(local_path)
                slider_data['audio_prompt'] = local_path
            except Exception as e:
                print(f"Failed to load melody file '{local_path}': {e}")
                melody_data = None
                slider_data['audio_prompt'] = None
    else:
        slider_data['audio_prompt'] = None

    # Continuation (Append Mode)
    append_flag = bool(json.get('appendContinuation'))
    continuation_url = json.get('continuationUrl') if append_flag else None
    if continuation_url:
        parsed = urlparse(continuation_url)
        if parsed.scheme in ('http','https'):
            local_path = unquote(parsed.path.lstrip('/'))
        else:
            local_path = unquote(continuation_url)
        if not local_path.startswith('static/'):
            local_path = os.path.join('static', local_path)
        valid_exts = {'.wav', '.mp3', '.flac', '.ogg', '.m4a'}
        ext = os.path.splitext(local_path)[1].lower()
        if not (os.path.isfile(local_path) and ext in valid_exts):
            slider_data['continuation_source'] = None
            continuation_data = None
        else:
            try:
                continuation_data = torchaudio.load(local_path)
                slider_data['continuation_source'] = local_path
            except Exception as e:
                print(f"Failed to load continuation file '{local_path}': {e}")
                continuation_data = None
                slider_data['continuation_source'] = None
    else:
        slider_data['continuation_source'] = None

    # Placeholders (Iteration 3)
    mbd_flag = bool(json.get('mbd'))
    stem_split = json.get('stem_split') or ''
    slider_data['multi_band_diffusion'] = {
        'requested': mbd_flag,
        'status': 'not_implemented'
    }
    if stem_split:
        slider_data['stem_split'] = {
            'requested': stem_split,
            'status': 'not_implemented'
        }

    if artist_name:
        slider_data['artist'] = artist_name
    save_last_gen_settings(model_type, prompt, slider_data)
    socketio.emit('add_to_queue', {"prompt": prompt})
    pending_queue.put((model_type, prompt, slider_data, melody_data, continuation_data))
    
@socketio.on('connect')
def handle_connect():
    audio_json_pairs = get_audio_json_pairs("static/audio")
    socketio.emit('audio_json_pairs', audio_json_pairs)
    
def get_audio_json_pairs(directory):
    files = os.listdir(directory)
    audio_exts = ('.wav', '.flac', '.mp3')
    audio_files = [f for f in files if f.lower().endswith(audio_exts)]
    json_files = {f for f in files if f.endswith('.json')}

    pairs = []
    for audio_file in audio_files:
        base_name = os.path.splitext(audio_file)[0]
        json_file = f"{base_name}.json"
        if json_file in json_files:
            full_audio_path = os.path.join(directory, audio_file)
            full_json_path = os.path.join(directory, json_file)
            pairs.append((full_audio_path, full_json_path))

    pairs.sort(key=lambda pair: os.path.getmtime(pair[0]), reverse=True)
    return pairs
    
@app.route('/upload_melody', methods=['POST'])
def upload_audio():
    dir = "static/temp"
    for filename in os.listdir(dir):
        file_path = os.path.join(dir, filename)
        if os.path.isfile(file_path) or os.path.islink(file_path):
            os.unlink(file_path)
            
    if 'melody' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['melody']
    if not file or file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file.content_type.startswith('audio/'):
        filename = file.filename
        file_path = os.path.join(dir, filename)
        file.save(file_path)
        return jsonify({'filePath': file_path}), 200

@app.route('/upload_continuation', methods=['POST'])
def upload_continuation():
    dir = 'static/temp'
    os.makedirs(dir, exist_ok=True)
    if 'continuation' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['continuation']
    if not file or file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file.content_type.startswith('audio/'):
        filename = file.filename
        file_path = os.path.join(dir, filename)
        file.save(file_path)
        return jsonify({'filePath': file_path}), 200
    return jsonify({'error': 'Unsupported type'}), 400

@app.route('/')
def index():
    try:
        loaded = load_last_gen_settings()
        if loaded and loaded[0] is not None and len(loaded) == 10:
            model, prompt, topp, duration, cfg_coef, topk, temperature, seed, fmt, sr = loaded
            return render_template(
                'index.html',
                topk=topk,
                duration=duration,
                cfg_coef=cfg_coef,
                topp=topp,
                temperature=temperature,
                default_model=model,
                default_text=prompt,
                seed=seed if seed >= 0 else -1,
                ffmpeg_available=bool(FFMPEG_PATH),
                ffmpeg_path=FFMPEG_PATH
            )
    except Exception as e:
        print(f"Failed to load last settings: {e}")

    # Значения по умолчанию
    defaults = dict(topk=250, duration=30, cfg_coef=4.0, topp=0.67, temperature=1.2, default_model="large", default_text="", seed=-1, ffmpeg_available=bool(FFMPEG_PATH), ffmpeg_path=FFMPEG_PATH)
    return render_template('index.html', **defaults)

@app.route('/save_override_css', methods=['POST'])
def save_override_css():
    try:
        data = request.get_json(silent=True) or {}
        css = data.get('css','')
        if len(css) > 200_000:  # simple size guard
            return jsonify({'success': False, 'error': 'too_large'}), 400
        path = os.path.join('static','override.css')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(css)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/upload_demucs_any', methods=['POST'])
def upload_demucs_any():
    """Upload arbitrary audio for Demucs-only separation."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    f = request.files['file']
    if not f or f.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if not f.content_type.startswith('audio/'):
        return jsonify({'error': 'Unsupported type'}), 400
    os.makedirs('static/demucs_any', exist_ok=True)
    safe_name = f.filename.replace('..','_').replace('/','_').replace('\\','_')
    path = os.path.join('static','demucs_any', safe_name)
    f.save(path)
    job_id = uuid.uuid4().hex[:12]
    return jsonify({'filePath': path, 'displayName': safe_name, 'id': job_id})


@socketio.on('demucs_any')
def handle_demucs_any(data):
    try:
        path = data.get('path')
        job_id = data.get('id') or uuid.uuid4().hex[:12]
        display_name = data.get('display_name') or os.path.basename(path)
        if not path or not os.path.exists(path):
            emit('demucs_any_done', {'id': job_id, 'display_name': display_name, 'error': 'file_not_found'})
            return
        threading.Thread(target=_run_demucs_any, args=(path, job_id, display_name), daemon=True).start()
    except Exception as e:
        emit('demucs_any_done', {'id': data.get('id'), 'display_name': data.get('display_name'), 'error': str(e)})
@app.route('/delete_audio', methods=['POST'])
def delete_audio():
    data = request.get_json(silent=True) or {}
    wav_path = data.get('wav')
    if not wav_path:
        return jsonify({'success': False, 'error': 'No wav specified'}), 400
    norm = os.path.normpath(wav_path)
    if not norm.startswith('static'+os.sep+'audio'):
        return jsonify({'success': False, 'error': 'Invalid path'}), 400
    removed = []
    if os.path.exists(norm):
        try:
            os.remove(norm)
            removed.append(norm)
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    json_path = os.path.splitext(norm)[0] + '.json'
    if os.path.exists(json_path):
        try:
            os.remove(json_path)
            removed.append(json_path)
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    # Удаляем папку со стемами Demucs если есть
    try:
        base_no_ext = os.path.splitext(norm)[0]
        stems_dir = os.path.join('static','stems', os.path.basename(base_no_ext))
        if os.path.isdir(stems_dir):
            shutil.rmtree(stems_dir, ignore_errors=True)
            if not os.path.exists(stems_dir):
                removed.append(stems_dir)
    except Exception as e:
        # Не критично — продолжаем
        pass
    # Удаляем временные stems_any связанные по имени (по display basename)
    try:
        # stems_any/<job_id> не имеет прямой связи, но можно чистить пустые старые каталоги по времени (опционально)
        # Здесь пропускаем чтобы избежать агрессивного удаления не связанных задач
        pass
    except Exception:
        pass
    return jsonify({'success': True, 'deleted': removed})

@app.route('/delete_all_audio', methods=['POST'])
def delete_all_audio():
    base_dir = os.path.join('static','audio')
    if not os.path.isdir(base_dir):
        return jsonify({'success': True, 'deleted': []})
    audio_exts = ('.wav','.flac','.mp3')
    deleted = []
    errors = []
    for fname in os.listdir(base_dir):
        lower = fname.lower()
        if lower.endswith(audio_exts):
            wav_path = os.path.join(base_dir, fname)
            json_path = os.path.splitext(wav_path)[0] + '.json'
            try:
                if os.path.exists(wav_path):
                    os.remove(wav_path); deleted.append(wav_path)
            except Exception as e:
                errors.append(f"remove_audio:{fname}:{e}")
            try:
                if os.path.exists(json_path):
                    os.remove(json_path); deleted.append(json_path)
            except Exception as e:
                errors.append(f"remove_json:{fname}:{e}")
            # stems dir
            try:
                stems_dir = os.path.join('static','stems', os.path.splitext(fname)[0])
                if os.path.isdir(stems_dir):
                    shutil.rmtree(stems_dir, ignore_errors=True)
                    if not os.path.exists(stems_dir):
                        deleted.append(stems_dir)
            except Exception as e:
                errors.append(f"remove_stems:{fname}:{e}")
    return jsonify({'success': True, 'deleted': deleted, 'errors': errors})

if __name__ == '__main__':
    # Подавляем предупреждение о deprecated weight_norm
    warnings.filterwarnings("ignore", message=r"torch.nn.utils.weight_norm is deprecated")
    if not os.path.exists('static/audio'):
        os.makedirs('static/audio')
    if not os.path.exists('static/temp'):
        os.makedirs('static/temp')
    threading.Thread(target=worker_process_queue, daemon=True).start()
    threading.Thread(target=worker_postprocess, daemon=True).start()
    # Глушим стандартный access log Werkzeug
    werk_log = logging.getLogger('werkzeug')
    # Оставляем WARNING (стартовые сообщения) и выше, но скрываем INFO access логи
    werk_log.setLevel(logging.WARNING)
    # Ручной вывод типовых dev сообщений (socketio.run не печатает их как app.run)
    try:
        host = '127.0.0.1'
        port = 5000
        print('WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.')
        print(f' * Running on http://{host}:{port}')
        print('Press CTRL+C to quit')
    except Exception:
        pass
    socketio.run(app, host='127.0.0.1', port=5000, log_output=True)