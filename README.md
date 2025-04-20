# A-U-R-A: Augmented User Response Assistant

A powerful AI virtual assistant with beautiful Spline 3D interface and TinyLlama-powered responses.

## Features

- **Interactive 3D Interface**: Layered Spline animations create an immersive experience
- **Natural Language Understanding**: TinyLlama 1.1B Chat model with custom fine-tuning
- **Real-time Commands**: Get weather, news, time, jokes, and more
- **Optimized Performance**: Automatic CPU/GPU detection with memory-efficient inference

## Demo

You can try A-U-R-A directly through this Hugging Face Space, or connect your React frontend to it.

## React Frontend Setup

1. Update your React app with the Space URL:
   ```javascript
   const HF_SPACE_URL = "https://naxwinn-a-u-r-a.hf.space";
   ```

2. Use the `/api/predict` endpoint for requests:
   ```javascript
   const response = await fetch(`${HF_SPACE_URL}/api/predict`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ 
       data: [message, []] // Message and empty history array
     }),
   });
   ```

## Setup Your Own Space

1. Fork this Space
2. Add your Hugging Face token as a secret
3. (Optional) Add your Weather API key and News API key

## Available Commands

- "What time is it?" - Shows the current time
- "Tell me a joke" - Shares a random programming joke 
- "Weather in [city]" - Provides weather information 
- "Who is [person]?" - Searches Wikipedia for information
- "Open [website]" - Provides links to popular websites
- "Latest news" - Shows recent headlines
- General questions - Answered by the AI model

## Model Details

- Base: TinyLlama/TinyLlama-1.1B-Chat-v1.0
- Adapter: naxwinn/tinyllama-1.1b-jarvis-qlora
- Optimization: 8-bit quantization for CPU efficiency

## Local Development

To run this locally:

1. Clone the repository
2. Install dependencies: `pip install -r requirements.txt`
3. Create a `.env` file with your API keys
4. Run with `python app.py`

## License

MIT 