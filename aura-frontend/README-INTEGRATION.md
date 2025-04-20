# A-U-R-A Chat Integration with Hugging Face

This document explains how to set up the A-U-R-A chat component to use the Qwen/QwQ-32B model from Hugging Face.

## Prerequisites

- Node.js and npm installed
- A Hugging Face account with an API key

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Your API Key

Create a `.env` file in the project root (if it doesn't exist) and add your Hugging Face API key:

```
PORT=3001
HF_API_KEY=your_huggingface_api_key_here
```

Replace `your_huggingface_api_key_here` with your actual Hugging Face API key, which you can get from [Hugging Face Settings](https://huggingface.co/settings/tokens).

### 3. Start the Development Server

```bash
npm run dev
```

This will start both the React app and the backend server concurrently.

- React frontend will run on http://localhost:3000
- Express backend will run on http://localhost:3001

## How It Works

The integration uses a two-part system:

1. **Backend Server (server.js)**:
   - Acts as a proxy between your frontend and Hugging Face API
   - Handles chat session management
   - Makes actual API calls to Hugging Face
   - Provides API endpoints that match the format expected by the frontend

2. **Frontend Chat Component (src/components/Chat.js)**:
   - Provides the user interface for the chat
   - Communicates with the backend server
   - Handles message display, typing animations, etc.

## Endpoints

The backend server provides these endpoints:

- `POST /api/create_chat`: Creates a new chat session
- `POST /api/submit`: Sends a message to the AI and gets a response
- `POST /api/regenerate`: Regenerates the last AI response

## Deploying to Production

When deploying to production:

1. Build the React app:
   ```bash
   npm run build
   ```

2. Set up environment variables on your hosting platform:
   - `PORT`: The port for your server
   - `HF_API_KEY`: Your Hugging Face API key

3. Deploy both the build folder and server.js to your hosting platform

4. Start the server:
   ```bash
   node server.js
   ```

## Customization

### Model Selection

You can change the Hugging Face model by modifying the `MODEL_ID` variable in `server.js`:

```javascript
const MODEL_ID = 'Qwen/QwQ-32B'; // Change to your preferred model
```

### Generation Parameters

You can adjust parameters like temperature, max tokens, etc. in the backend API endpoints in `server.js`. 