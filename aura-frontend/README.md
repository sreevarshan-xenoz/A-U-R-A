# A-U-R-A Chat Application

A chat interface for the Qwen 32B language model using Hugging Face's API.

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- NPM (v7 or higher)
- A Hugging Face API key (get one from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens))

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd aura-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Configure your Hugging Face API key:
   - Open the `.env` file in the root directory
   - Replace `hf_dummy_key_replace_with_your_actual_key` with your actual Hugging Face API key

### Running the Application

#### Development Mode (with hot reloading)

Run both the React frontend and the API proxy server:
```bash
npm run dev
```

This will start:
- React development server on http://localhost:3000
- API proxy server on http://localhost:3001

#### Production Build

1. Build the React application:
```bash
npm run build
```

2. Start the server (which will serve both the API and the static files):
```bash
npm run server
```

The application will be available at http://localhost:3001

## How It Works

The application consists of:

1. **Frontend**: A React application with a chat interface.
2. **Proxy Server**: A Node.js/Express server that:
   - Serves as an intermediary between the frontend and Hugging Face API
   - Manages chat sessions
   - Handles API key security (keeping it on the server, not exposed to client)

## API Endpoints

The proxy server provides these endpoints:

- `POST /api/create_chat`: Create a new chat session
- `POST /api/submit`: Send a message to the chat
- `POST /api/regenerate`: Regenerate the last AI response

## Customization

To customize the model parameters, edit the `server.js` file:

```javascript
// Change model parameters in the textGeneration call
const response = await hf.textGeneration({
  model: 'Qwen/QwQ-32B',  // Change to any Hugging Face model
  inputs: history.map(msg => `${msg.role}: ${msg.content}`).join('\n') + '\nassistant:',
  parameters: {
    max_new_tokens: 500,   // Adjust token limit
    temperature: 0.7,      // Adjust randomness (0.0-1.0)
    top_p: 0.9,            // Adjust diversity
    return_full_text: false
  }
});
```

## Security Notes

- Never expose your Hugging Face API key in client-side code
- In production, use proper environment variable management
- Consider adding rate limiting to prevent abuse
