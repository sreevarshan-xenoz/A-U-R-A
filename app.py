import speech_recognition as sr
import pyttsx3
import pywhatkit
import datetime
import wikipedia
import pyjokes
import webbrowser
import os
import requests
from dotenv import load_dotenv
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import torch
from flask import Flask, request, jsonify
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load environment variables
load_dotenv()

# Initialize speech recognition and text-to-speech engine
listener = sr.Recognizer()
engine = pyttsx3.init()
voices = engine.getProperty('voices')
engine.setProperty('voice', voices[0].id)

# Configuration
WAKE_WORDS = ['aura', 'ora', 'aurora']
CONVERSATION_HISTORY = []

# Initialize APIs
WEATHER_API_KEY = os.getenv('WEATHER_API_KEY')
NEWS_API_KEY = os.getenv('NEWS_API_KEY')

# Hugging Face Model Setup
MODEL_LOADED = False
try:
    print("Loading Gemma 2B model with PEFT...")
    # Get token from environment variable
    hf_token = os.getenv('HUGGINGFACE_TOKEN')
    if not hf_token:
        print("Warning: HUGGINGFACE_TOKEN not found in environment variables")
    
    # Check if CUDA is available
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    is_cpu_only = device.type == 'cpu'
    print(f"Using device: {device}")
    
    # CPU-specific optimizations if running on CPU
    if is_cpu_only:
        print("Applying CPU-specific optimizations...")
        # Use int8 quantization on CPU for better performance
        load_options = {
            "token": hf_token,
            "device_map": "auto",
            "torch_dtype": torch.float16,  # Keep half precision to save memory
            "low_cpu_mem_usage": True,
            "offload_folder": "offload_folder",
            "quantization_config": {"load_in_8bit": True} if torch.__version__ >= "2.0.0" else None,
        }
    else:
        load_options = {
            "token": hf_token,
            "device_map": "auto",
            "torch_dtype": torch.float16,
            "low_cpu_mem_usage": True,
            "offload_folder": "offload_folder"
        }
    
    # Load models with token authentication and memory optimizations
    base_model = AutoModelForCausalLM.from_pretrained(
        "google/gemma-2b", 
        **load_options
    )
    
    print("Base model loaded, applying PEFT adapter...")
    model = PeftModel.from_pretrained(
        base_model, 
        "naxwinn/A-U-R-A",
        token=hf_token,
        device_map="auto"
    )
    
    # Optimize for CPU inference
    if is_cpu_only:
        print("Optimizing model for faster CPU inference...")
        model = model.to(torch.float32)  # Sometimes float32 is faster on CPU
        
        # Try to use optimizations if available
        if hasattr(torch, 'compile') and torch.__version__ >= '2.0.0':
            print("Using torch.compile for faster inference")
            model = torch.compile(model)
    
    tokenizer = AutoTokenizer.from_pretrained(
        "google/gemma-2b",
        token=hf_token
    )
    
    MODEL_LOADED = True
    print(f"Model loaded successfully with optimizations, primary device: {device}")
except Exception as e:
    print(f"Error loading AI model: {e}")
    model = None
    tokenizer = None

# Response caching to improve performance
RESPONSE_CACHE = {}
MAX_CACHE_SIZE = 100

def get_greeting():
    """Return time-appropriate greeting"""
    current_hour = datetime.datetime.now().hour
    if 5 <= current_hour < 12:
        return "Good morning"
    elif 12 <= current_hour < 17:
        return "Good afternoon"
    elif 17 <= current_hour < 21:
        return "Good evening"
    else:
        return "Good night"

def talk(text):
    engine.say(text)
    engine.runAndWait()

def take_command():
    command = ""
    try:
        with sr.Microphone() as source:
            listener.adjust_for_ambient_noise(source, duration=1)
            print('Listening...')
            voice = listener.listen(source, timeout=5)
            command = listener.recognize_google(voice).lower()
    except (sr.UnknownValueError, sr.WaitTimeoutError):
        pass
    except Exception as e:
        print(f"Microphone error: {e}")
    return command

def detect_wake_word(command):
    return any(command.startswith(word) for word in WAKE_WORDS)

def get_weather(city):
    try:
        response = requests.get(
            f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={WEATHER_API_KEY}&units=metric"
        )
        data = response.json()
        weather = data['weather'][0]['description']
        temp = data['main']['temp']
        return f"Weather in {city}: {weather}, Temperature: {temp}°C"
    except Exception as e:
        return f"Couldn't retrieve weather: {str(e)}"

def get_news():
    try:
        response = requests.get(
            f"https://newsapi.org/v2/top-headlines?country=us&apiKey={NEWS_API_KEY}"
        )
        articles = response.json()['articles'][:3]
        return " ".join([f"{article['title']}" for article in articles])
    except Exception as e:
        return f"Couldn't retrieve news: {str(e)}"

def generate_response(query):
    if not MODEL_LOADED:
        return "My advanced AI features are currently unavailable. Please try basic commands."
    
    # Check if response is in cache
    if query.lower() in RESPONSE_CACHE:
        print(f"Using cached response for: {query}")
        return RESPONSE_CACHE[query.lower()]
    
    try:
        print(f"Generating response for: {query}")
        # With device_map="auto", we don't need to explicitly move tensors to the device
        inputs = tokenizer(query, return_tensors="pt")
        
        # Set a shorter length for faster responses
        max_tokens = 50  # Reduced from 100 for faster responses
        
        # Set up a context manager to handle CUDA out of memory errors gracefully
        try:
            with torch.inference_mode():
                # Use a timeout to prevent very long generations
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    num_return_sequences=1,
                    temperature=0.7,
                    top_k=50,
                    top_p=0.95,
                    repetition_penalty=1.2,
                    do_sample=True,
                    use_cache=True,
                    num_beams=1  # Use greedy decoding for speed
                )
        except torch.cuda.OutOfMemoryError:
            print("CUDA out of memory, falling back to CPU...")
            # If we run out of CUDA memory, try again with CPU
            torch.cuda.empty_cache()
            inputs = {k: v.cpu() for k, v in inputs.items()}
            with torch.inference_mode():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    num_return_sequences=1,
                    temperature=0.7,
                    top_k=50,
                    top_p=0.95,
                    repetition_penalty=1.2,
                    do_sample=True,
                    use_cache=True,
                    num_beams=1  # Use greedy decoding for speed
                )
        
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Gemma might repeat the input prompt in the output, so remove it if needed
        if response.startswith(query):
            response = response[len(query):].strip()
        
        # Add to cache
        if len(RESPONSE_CACHE) >= MAX_CACHE_SIZE:
            # Remove a random item from cache if full
            RESPONSE_CACHE.pop(next(iter(RESPONSE_CACHE)))
        RESPONSE_CACHE[query.lower()] = response
            
        # Keep conversation history limited
        CONVERSATION_HISTORY.append((query, response))
        if len(CONVERSATION_HISTORY) > 5:
            CONVERSATION_HISTORY.pop(0)
        return response
    except Exception as e:
        print(f"Generation error: {e}")
        return "I'm having trouble with that request. Please try another command."

def handle_command(command):
    try:
        print(f"Command received: {command}")

        if 'play' in command:
            song = command.replace('play', '').strip()
            talk(f'Playing {song}')
            pywhatkit.playonyt(song)
            return f'Playing {song}'

        elif 'time' in command:
            time = datetime.datetime.now().strftime('%I:%M %p')
            talk(f'Current time is {time}')
            return f'Current time is {time}'

        elif 'who is' in command:
            person = command.replace('who is', '').strip()
            try:
                info = wikipedia.summary(person, sentences=2)
                talk(info)
                return info
            except wikipedia.exceptions.DisambiguationError:
                response = "Multiple results found. Please be more specific."
                talk(response)
                return response
            except wikipedia.exceptions.PageError:
                response = f"Sorry, I couldn't find information about {person}"
                talk(response)
                return response

        elif 'joke' in command:
            joke = pyjokes.get_joke()
            talk(joke)
            return joke

        elif 'weather' in command:
            city = command.replace('weather', '').strip() or 'new york'
            weather_report = get_weather(city)
            talk(weather_report)
            return weather_report

        elif 'news' in command:
            news = get_news()
            talk(news)
            return news

        elif 'volume up' in command:
            os.system("nircmd.exe changesysvolume 2000")
            response = 'Increasing volume'
            talk(response)
            return response

        elif 'volume down' in command:
            os.system("nircmd.exe changesysvolume -2000")
            response = 'Decreasing volume'
            talk(response)
            return response

        elif 'open' in command:
            sites = {
                'youtube': 'https://youtube.com',
                'google': 'https://google.com',
                'gmail': 'https://mail.google.com',
                'chatgpt': 'https://chat.openai.com',
                'cults': 'https://cults3d.com',
                'kaggle': 'https://kaggle.com',
                'hianime': 'https://hianime.tv'
            }
            for site, url in sites.items():
                if site in command:
                    talk(f'Opening {site}')
                    webbrowser.open(url)
                    return f'Opening {site}'
            response = "Website not in my database"
            talk(response)
            return response

        elif 'exit' in command or 'goodbye' in command:
            response = "Goodbye!"
            talk(response)
            return response

        else:
            response = generate_response(command)
            talk(response)
            return response

    except Exception as e:
        print(f"Command error: {e}")
        error_msg = "Sorry, I encountered an error processing that request."
        talk(error_msg)
        return error_msg

def aura():
    # Initial startup greeting only
    initial_greeting = get_greeting()
    talk(f"{initial_greeting}! I'm Aura. How can I assist you today?")
    
    while True:
        command = take_command()
        if command and detect_wake_word(command):
            actual_command = command.split(' ', 1)[1] if ' ' in command else ""
            
            if actual_command:
                handle_command(actual_command)
            else:
                talk("How can I assist you?")
                follow_up_command = take_command()
                if follow_up_command:
                    handle_command(follow_up_command)

# Flask API endpoints
@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    message = data.get('message', '')
    
    if not message:
        return jsonify({'error': 'No message provided'}), 400
    
    response = handle_command(message)
    return jsonify({'response': response})

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'model_loaded': MODEL_LOADED
    })

if __name__ == "__main__":
    # Run the Flask app instead of the voice interface
    print("Starting AURA API server...")
    app.run(host='0.0.0.0', port=5000, debug=False)
    
    # If you want to use the voice interface, comment out the app.run line and uncomment the following:
    # aura()