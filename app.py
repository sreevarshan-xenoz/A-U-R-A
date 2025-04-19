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
import torch

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
    model = AutoModelForCausalLM.from_pretrained("naxwinn/qlora-jarvis-output")
    tokenizer = AutoTokenizer.from_pretrained("naxwinn/qlora-jarvis-output")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    MODEL_LOADED = True
except Exception as e:
    print(f"Error loading AI model: {e}")
    model = None
    tokenizer = None

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
    
    try:
        inputs = tokenizer.encode(query, return_tensors="pt").to(device)
        outputs = model.generate(
            inputs,
            max_length=100,
            num_return_sequences=1,
            temperature=0.7,
            top_k=50,
            top_p=0.95,
            repetition_penalty=1.2
        )
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        CONVERSATION_HISTORY.append((query, response))
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

        elif 'time' in command:
            time = datetime.datetime.now().strftime('%I:%M %p')
            talk(f'Current time is {time}')

        elif 'who is' in command:
            person = command.replace('who is', '').strip()
            try:
                info = wikipedia.summary(person, sentences=2)
                talk(info)
            except wikipedia.exceptions.DisambiguationError:
                talk("Multiple results found. Please be more specific.")
            except wikipedia.exceptions.PageError:
                talk(f"Sorry, I couldn't find information about {person}")

        elif 'joke' in command:
            talk(pyjokes.get_joke())

        elif 'weather' in command:
            city = command.replace('weather', '').strip() or 'new york'
            weather_report = get_weather(city)
            talk(weather_report)

        elif 'news' in command:
            news = get_news()
            talk(news)

        elif 'volume up' in command:
            os.system("nircmd.exe changesysvolume 2000")
            talk('Increasing volume')

        elif 'volume down' in command:
            os.system("nircmd.exe changesysvolume -2000")
            talk('Decreasing volume')

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
                    return
            talk("Website not in my database")

        elif 'exit' in command or 'goodbye' in command:
            talk("Goodbye!")
            exit()

        else:
            response = generate_response(command)
            talk(response)

    except Exception as e:
        print(f"Command error: {e}")
        talk("Sorry, I encountered an error processing that request.")

def aura():
    # Initial startup greeting
    initial_greeting = get_greeting()
    talk(f"{initial_greeting}! I'm Aura. How can I assist you today?")
    
    while True:
        command = take_command()
        if command and detect_wake_word(command):
            actual_command = command.split(' ', 1)[1] if ' ' in command else ""
            
            # Time-based greeting for wake word activation
            current_greeting = get_greeting()
            talk(f"{current_greeting}! How can I assist you?")
            
            if actual_command:
                handle_command(actual_command)
            else:
                follow_up_command = take_command()
                if follow_up_command:
                    handle_command(follow_up_command)

if __name__ == "__main__":
    aura()