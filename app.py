import speech_recognition as sr
import datetime
import wikipedia
import pyjokes
import os
import requests
from dotenv import load_dotenv
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import torch
import gradio as gr

# Load environment variables
load_dotenv()

# Initialize speech recognition - note that this won't be used in the web interface
# but we keep the import for potential future use
listener = sr.Recognizer()

# Configuration
WAKE_WORDS = ['aura', 'ora', 'aurora']
CONVERSATION_HISTORY = []

# Initialize APIs
WEATHER_API_KEY = os.getenv('WEATHER_API_KEY')
NEWS_API_KEY = os.getenv('NEWS_API_KEY')

# Hugging Face Model Setup
MODEL_LOADED = False
try:
    print("Loading TinyLlama 1.1B model with PEFT...")
    # Get token from environment variable or use fallback
    hf_token = os.getenv('HUGGINGFACE_TOKEN')
    if not hf_token:
        print("HUGGINGFACE_TOKEN not found in environment variables, using fallback token")
        # Fallback token - note this is less secure but ensures the model can load
        hf_token = "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"
    
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
            "torch_dtype": torch.float16,
            "low_cpu_mem_usage": True,
            # Use 8-bit quantization to dramatically reduce memory usage
            "load_in_8bit": True
        }
    else:
        load_options = {
            "token": hf_token,
            "device_map": "auto",
            "torch_dtype": torch.float16,
            "low_cpu_mem_usage": True
        }
    
    # Load TinyLlama base model with reduced precision
    print("Loading base model with reduced precision...")
    base_model = AutoModelForCausalLM.from_pretrained(
        "TinyLlama/TinyLlama-1.1B-Chat-v1.0", 
        **load_options
    )
    
    print("Base model loaded, applying PEFT adapter...")
    model = PeftModel.from_pretrained(
        base_model, 
        "naxwinn/tinyllama-1.1b-jarvis-qlora",
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
        "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
        token=hf_token
    )
    
    MODEL_LOADED = True
    print(f"Model loaded successfully with optimizations, primary device: {device}")
except Exception as e:
    print(f"Error loading AI model: {e}")
    model = None
    tokenizer = None
    print("Continuing in fallback mode without AI model")
    # We'll still be able to use the basic functions like time, weather, etc.

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
        return "I'm running in basic mode without my AI features. Try asking about time, weather, news, or jokes."
    
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
        
        # TinyLlama might repeat the input prompt in the output, so remove it if needed
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
            # In a web environment, we can't play songs directly
            return f"I would play '{song}' for you, but I can't play music in this web interface."

        elif 'time' in command:
            time = datetime.datetime.now().strftime('%I:%M %p')
            return f'Current time is {time}'

        elif 'who is' in command:
            person = command.replace('who is', '').strip()
            try:
                info = wikipedia.summary(person, sentences=2)
                return info
            except wikipedia.exceptions.DisambiguationError:
                return "Multiple results found. Please be more specific."
            except wikipedia.exceptions.PageError:
                return f"Sorry, I couldn't find information about {person}"

        elif 'joke' in command:
            joke = pyjokes.get_joke()
            return joke

        elif 'weather' in command:
            city = command.replace('weather', '').strip() or 'new york'
            return get_weather(city)

        elif 'news' in command:
            return get_news()

        elif 'exit' in command or 'goodbye' in command:
            return "Goodbye!"

        else:
            return generate_response(command)

    except Exception as e:
        print(f"Command error: {e}")
        return "Sorry, I encountered an error processing that request."

# Gradio interface
def respond(message, history):
    return handle_command(message)

# Create Gradio interface with a simpler theme
initial_greeting = f"{get_greeting()}! I'm AURA, an AI assistant powered by TinyLlama. How can I help you today?"

demo = gr.ChatInterface(
    fn=respond,
    title="A-U-R-A: AI Virtual Assistant",
    description="Powered by TinyLlama with QLora fine-tuning",
    theme="default",  # Simpler theme
    examples=[
        "What time is it?",
        "Tell me a joke",
        "Weather in London"
    ],
    cache_examples=False,  # Disable caching to save memory
    analytics_enabled=False,
)

# Launch the app with smaller queue size for faster startup
if __name__ == "__main__":
    demo.launch(
        share=False,  # Don't create a public share link
        debug=True,   # Enable debug info in logs
        max_threads=4  # Limit threads to avoid resource exhaustion
    )