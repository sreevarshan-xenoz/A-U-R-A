// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { HfInference } = require('@huggingface/inference');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));

// Initialize Hugging Face client 
console.log("Initializing Hugging Face client...");
const HF_API_KEY = process.env.HF_API_KEY || "hf_dummy_key_for_testing";

if (HF_API_KEY === "hf_dummy_key_for_testing" || !HF_API_KEY) {
  console.warn("\nWARNING: Using dummy API key. The application will not work properly.");
  console.warn("Please set a valid API key in the .env file.\n");
}

const hf = new HfInference(HF_API_KEY);

// Chat conversation history store (in-memory for simplicity)
// In production, use a database
const chatSessions = new Map();

// Create a new chat session
app.post('/api/create_chat', (req, res) => {
  try {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    chatSessions.set(sessionId, []);
    console.log(`Created new chat session: ${sessionId}`);
    res.json({ data: sessionId });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
});

// Submit a message to chat
app.post('/api/submit', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data || !Array.isArray(data) || data.length < 2) {
      return res.status(400).json({ error: 'Invalid request data format' });
    }
    
    const [chatId, message] = data;
    
    if (!chatSessions.has(chatId)) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    // Get chat history
    const history = chatSessions.get(chatId);
    
    // Add user message to history
    history.push({ role: 'user', content: message });
    
    console.log(`Processing message for chat ${chatId}: "${message}"`);
    
    try {
      // Call Hugging Face API for text generation
      const response = await hf.textGeneration({
        model: 'Qwen/QwQ-32B',  // Specify the exact model
        inputs: history.map(msg => `${msg.role}: ${msg.content}`).join('\n') + '\nassistant:',
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          top_p: 0.9,
          return_full_text: false
        }
      });
      
      // Extract AI response
      const aiResponse = response.generated_text.trim();
      console.log(`Generated response: "${aiResponse.substring(0, 50)}${aiResponse.length > 50 ? '...' : ''}"`);
      
      // Add AI response to history
      history.push({ role: 'assistant', content: aiResponse });
      
      // Update chat history
      chatSessions.set(chatId, history);
      
      // Send response to client
      res.json({ data: { response: aiResponse } });
    } catch (error) {
      console.error('Error calling Hugging Face API:', error);
      
      // Check if it's an API key issue
      if (error.message && error.message.includes('Authorization')) {
        return res.status(401).json({ 
          error: 'Invalid API key or authorization issue with Hugging Face API',
          details: error.message 
        });
      }
      
      res.status(500).json({ 
        error: error.message || 'Failed to generate response',
        suggestion: 'Check your API key in the .env file'
      });
    }
  } catch (error) {
    console.error('Error in submit endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to process request' });
  }
});

// Regenerate last response
app.post('/api/regenerate', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid request data format' });
    }
    
    const [chatId] = data;
    
    if (!chatSessions.has(chatId)) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    // Get chat history
    const history = chatSessions.get(chatId);
    
    // Remove last AI response if it exists
    if (history.length > 0 && history[history.length - 1].role === 'assistant') {
      history.pop();
    }
    
    console.log(`Regenerating response for chat ${chatId}`);
    
    // Re-generate with remaining history
    try {
      const response = await hf.textGeneration({
        model: 'Qwen/QwQ-32B',
        inputs: history.map(msg => `${msg.role}: ${msg.content}`).join('\n') + '\nassistant:',
        parameters: {
          max_new_tokens: 500,
          temperature: 0.8, // Slightly higher temperature for variation
          top_p: 0.9,
          return_full_text: false
        }
      });
      
      // Extract AI response
      const aiResponse = response.generated_text.trim();
      console.log(`Regenerated response: "${aiResponse.substring(0, 50)}${aiResponse.length > 50 ? '...' : ''}"`);
      
      // Add new AI response to history
      history.push({ role: 'assistant', content: aiResponse });
      
      // Update chat history
      chatSessions.set(chatId, history);
      
      // Send response to client
      res.json({ data: { response: aiResponse } });
    } catch (error) {
      console.error('Error calling Hugging Face API for regeneration:', error);
      res.status(500).json({ error: error.message || 'Failed to regenerate response' });
    }
  } catch (error) {
    console.error('Error in regenerate endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to process request' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Serve React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API proxy for Hugging Face is set up`);
  console.log(`Visit http://localhost:${PORT} in your browser`);
}); 