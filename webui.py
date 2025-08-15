from flask_socketio import SocketIO, emit
from flask import Flask, render_template, request, jsonify, send_from_directory
import logging, os, queue, threading, json
import torchaudio
from urllib.parse import urlparse, unquote
from mechanisms.generator_backend import generate_audio

app = Flask(__name__)
pending_queue = queue.Queue()
socketio = SocketIO(app, cors_allowed_origins="*")
logging.getLogger().setLevel(logging.ERROR)
logging.getLogger('engineio').setLevel(logging.ERROR)
logging.getLogger('socketio').setLevel(logging.ERROR)

def worker_process_queue():
    while True:
        model_type, prompt, slider_data, melody_data = pending_queue.get()
        filename, json_filename = generate_audio(socketio, model_type, prompt, slider_data, melody_data)
        socketio.emit('on_finish_audio', {"prompt":prompt, "filename":filename, "json_filename":json_filename})
        pending_queue.task_done()
        
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
        model = settings["model"]
        prompt = settings["prompt"]
        topp = float(settings["parameters"]["top_p"])
        duration = int(settings["parameters"]["duration"])
        cfg_coef = float(settings["parameters"]["cfg_coef"])
        topk = int(settings["parameters"]["top_k"])
        temperature = float(settings["parameters"]["temperature"])
        return model, prompt, topp, duration, cfg_coef, topk, temperature
    
    
@socketio.on('submit_sliders')
def handle_submit_sliders(json):
    slider_data = json['values']
    prompt = json['prompt']
    model_type = json['model']
    if not prompt:
        return
    
    # Преобразуем значения: seed как int, остальные float
    converted = {}
    for k,v in slider_data.items():
        if k in ('seed','cfg_seed','sid'):
            try:
                converted['seed'] = int(float(v))  # нормализуем ключ к 'seed'
            except:
                converted['seed'] = -1
        else:
            try:
                converted[k] = float(v)
            except:
                pass
    slider_data = converted
    
    melody_data = None
    
    melody_url = json.get('melodyUrl', None)
    if melody_url:
        # Может прийти как абсолютный http://127.0.0.1:5000/static/temp/xxx.wav
        # Преобразуем в локальный путь.
        parsed = urlparse(melody_url)
        if parsed.scheme in ('http', 'https'):
            local_path = unquote(parsed.path.lstrip('/'))  # убираем начальный '/' и декодируем %20
        else:
            local_path = unquote(melody_url)
        # Безопасность: не позволяем выходить за корень static
        if not local_path.startswith('static/'):
            local_path = os.path.join('static', local_path)
        if os.path.exists(local_path):
            try:
                melody_data = torchaudio.load(local_path)
            except Exception as e:
                print(f"Failed to load melody file '{local_path}': {e}")
                melody_data = None
        else:
            print(f"Melody file does not exist: {local_path}")
            melody_data = None

    save_last_gen_settings(model_type, prompt, slider_data)
    socketio.emit('add_to_queue', {"prompt":prompt})
    pending_queue.put((model_type, prompt, slider_data, melody_data))
    
@socketio.on('connect')
def handle_connect():
    audio_json_pairs = get_audio_json_pairs("static/audio")
    socketio.emit('audio_json_pairs', audio_json_pairs)
    
def get_audio_json_pairs(directory):
    files = os.listdir(directory)
    wav_files = [f for f in files if f.endswith('.wav')]
    json_files = [f for f in files if f.endswith('.json')]
    
    pairs = []
    for wav_file in wav_files:
        base_name = os.path.splitext(wav_file)[0]
        json_file = f"{base_name}.json"
        if json_file in json_files:
            full_wav_path = os.path.join(directory, wav_file)
            full_json_path = os.path.join(directory, json_file)
            pairs.append((full_wav_path, full_json_path))
            
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

@app.route('/')
def index():
    try:
        model, prompt, topp, duration, cfg_coef, topk, temperature = load_last_gen_settings()
        if model is not None:
            return render_template('index.html', 
                                topk=topk, 
                                duration=duration, 
                                cfg_coef=cfg_coef, 
                                topp=topp, 
                                temperature=temperature, 
                                default_model=model,
                                default_text=prompt,
                                seed=-1)
    except:
        pass
    
    topk = 250
    duration = 30
    cfg_coef = 4.0
    topp = .67
    temperature = 1.2
    default_model = "large"
    default_text = ""
    return render_template('index.html', 
                           topk=topk, 
                           duration=duration, 
                           cfg_coef=cfg_coef, 
                           topp=topp, 
                           temperature=temperature, 
                           default_model=default_model,
                           default_text=default_text,
                           seed=-1)
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
    return jsonify({'success': True, 'deleted': removed})

if __name__ == '__main__':
    if not os.path.exists('static/audio'):
        os.makedirs('static/audio')
    if not os.path.exists('static/temp'):
        os.makedirs('static/temp')
    threading.Thread(target=worker_process_queue, daemon=True).start()
    socketio.run(app)