from .model_hijack import HijackedMusicGen
from audiocraft.data.audio import audio_write
import torch, re, os, json

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
    # Append seed in filename if provided (-1 means random, omit)
    seed = audio_gen_params.get('seed') or audio_gen_params.get('sid') or audio_gen_params.get('cfg_seed')
    if seed is not None and str(seed) != '-1':
        base_filename = f"static/audio/{sanitize_filename(prompt)}_seed{seed}"
    else:
        base_filename = f"static/audio/{sanitize_filename(prompt)}"
    output_filename = f"{base_filename}.wav"
    absolute_path = os.path.abspath(output_filename)
    
    audio_tensors = audio.detach().cpu().float()
    sample_rate = MODEL.sample_rate
    
    max_length = 255
    if len(absolute_path) > max_length:
        base_filename = base_filename[:max_length - len(os.path.abspath(f"static/audio/")) - 15]
        output_filename = f"{base_filename}.wav"
    
    i = 1
    while os.path.exists(output_filename):
        output_filename = f"{base_filename}({i}).wav"
        i += 1
    
    audio_write(
        output_filename, audio_tensors.squeeze(), sample_rate, strategy="loudness",
        loudness_headroom_db=18, loudness_compressor=True, add_suffix=False)
    
    json_filename = write_paired_json(model_type, output_filename.rsplit('.', 1)[0], prompt, audio_gen_params)
    
    return output_filename, json_filename

def generate_audio(socketio, model_type, prompt, audio_gen_params, melody_data):
    global MODEL
    # Сид для повторяемости: применяем перед генерацией, -1 = случайно
    seed = int(audio_gen_params.get('seed', audio_gen_params.get('sid', audio_gen_params.get('cfg_seed', -1))))
    if seed != -1:
        torch.manual_seed(seed)

    # Отдельная копия параметров только для set_generation_params (без cfg_seed)
    gen_params = dict(audio_gen_params)
    for drop_key in ('seed','sid','cfg_seed'):
        if drop_key in gen_params:
            del gen_params[drop_key]

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
    
    return write_audio(model_type, prompt, output, audio_gen_params)