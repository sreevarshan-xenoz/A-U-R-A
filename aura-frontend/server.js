const express = require('express');
const cors = require('cors');
const { HfInference } = require('@huggingface/inference');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));

// Initialize Hugging Face inference with API key
// Note: Replace 'YOUR_API_KEY_HERE' with your actual Hugging Face API key
// or set it as an environment variable in a .env file
const HF_API_KEY = process.env.HF_API_KEY || 'YOUR_API_KEY_HERE';
console.log(`Using API key: ${HF_API_KEY.substring(0, 4)}...${HF_API_KEY.substring(HF_API_KEY.length - 4)}`);

const hf = new HfInference(HF_API_KEY);

// Based on the URL in your screenshot, use the exact model name from the Hugging Face Space
const MODEL_ID = 'Qwen/QwQ-32B-Demo';
console.log(`Using model: ${MODEL_ID}`);

// Add a test endpoint to verify the backend is running
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

// Store chat sessions
const chatSessions = new Map();

// Create a new chat session
app.post('/api/create_chat', (req, res) => {
  try {
    const sessionId = 'session_' + Math.random().toString(36).substring(2, 15);
    chatSessions.set(sessionId, {
      messages: []
    });
    console.log(`Created new chat session: ${sessionId}`);
    res.json({ data: sessionId });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Submit a message to the chat
app.post('/api/submit', async (req, res) => {
  try {
    console.log('Received submit request:', req.body);
    const [chatId, message, stream, temperature, maxTokens, topP, topK] = req.body.data;
    
    if (!chatSessions.has(chatId)) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    const session = chatSessions.get(chatId);
    
    // Add user message to the session
    session.messages.push({ role: 'user', content: message });
    
    // Format messages for the Hugging Face API
    const formattedMessages = session.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    console.log(`Sending message to Hugging Face: ${message}`);
    console.log('Formatted messages:', JSON.stringify(formattedMessages));
    
    try {
      // Call Hugging Face API using text-generation
      const response = await hf.textGeneration({
        model: MODEL_ID,
        inputs: formattedMessages.map(m => `${m.role}: ${m.content}`).join('\n'),
        parameters: {
          max_new_tokens: maxTokens || 1024,
          temperature: temperature || 0.7,
          top_p: topP || 0.9,
          top_k: topK || 50,
          return_full_text: false
        }
      });
      
      console.log('Raw API response:', response);
      
      const aiResponse = response.generated_text.trim();
      console.log(`Received response: ${aiResponse}`);
      
      // Add AI response to the session
      session.messages.push({ role: 'assistant', content: aiResponse });
      
      res.json({ data: { response: aiResponse } });
    } catch (apiError) {
      console.error('Error calling Hugging Face API:', apiError);
      
      // Try using the chat completion endpoint instead
      try {
        console.log('Trying chat completion endpoint instead...');
        const chatResponse = await hf.chatCompletion({
          model: MODEL_ID,
          messages: formattedMessages,
          temperature: temperature || 0.7,
          max_tokens: maxTokens || 1024,
          top_p: topP || 0.9,
          top_k: topK || 50
        });
        
        console.log('Chat completion response:', chatResponse);
        
        const aiResponse = chatResponse.generated_text || chatResponse.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
        console.log(`Received chat response: ${aiResponse}`);
        
        // Add AI response to the session
        session.messages.push({ role: 'assistant', content: aiResponse });
        
        res.json({ data: { response: aiResponse } });
      } catch (chatError) {
        console.error('Error calling chat completion API:', chatError);
        throw apiError; // Re-throw the original error
      }
    }
  } catch (error) {
    console.error('Error with chat submission:', error);
    res.status(500).json({ error: error.message });
  }
});

// Regenerate the last response
app.post('/api/regenerate', async (req, res) => {
  try {
    const [chatId, stream, temperature, maxTokens, topP, topK] = req.body.data;
    
    if (!chatSessions.has(chatId)) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    const session = chatSessions.get(chatId);
    
    // Remove the last assistant message if it exists
    if (session.messages.length > 0 && session.messages[session.messages.length - 1].role === 'assistant') {
      session.messages.pop();
    }
    
    // Make sure there's at least one user message
    if (session.messages.length === 0 || session.messages[session.messages.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'No message to regenerate' });
    }
    
    // Format messages for the Hugging Face API
    const formattedMessages = session.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    console.log('Regenerating with messages:', JSON.stringify(formattedMessages));
    
    try {
      // Call Hugging Face API
      const response = await hf.textGeneration({
        model: MODEL_ID,
        inputs: formattedMessages.map(m => `${m.role}: ${m.content}`).join('\n'),
        parameters: {
          max_new_tokens: maxTokens || 1024,
          temperature: temperature || 0.7,
          top_p: topP || 0.9,
          top_k: topK || 50,
          return_full_text: false
        }
      });
      
      const aiResponse = response.generated_text.trim();
      console.log(`Regenerated response: ${aiResponse}`);
      
      // Add the new AI response to the session
      session.messages.push({ role: 'assistant', content: aiResponse });
      
      res.json({ data: { response: aiResponse } });
    } catch (apiError) {
      console.error('Error calling Hugging Face API for regeneration:', apiError);
      
      // Try using the chat completion endpoint instead
      try {
        console.log('Trying chat completion endpoint for regeneration...');
        const chatResponse = await hf.chatCompletion({
          model: MODEL_ID,
          messages: formattedMessages,
          temperature: temperature || 0.7,
          max_tokens: maxTokens || 1024,
          top_p: topP || 0.9,
          top_k: topK || 50
        });
        
        const aiResponse = chatResponse.generated_text || chatResponse.choices[0]?.message?.content || 'Sorry, I couldn\'t regenerate a response.';
        console.log(`Received regenerated chat response: ${aiResponse}`);
        
        // Add AI response to the session
        session.messages.push({ role: 'assistant', content: aiResponse });
        
        res.json({ data: { response: aiResponse } });
      } catch (chatError) {
        console.error('Error calling chat completion API for regeneration:', chatError);
        throw apiError; // Re-throw the original error
      }
    }
  } catch (error) {
    console.error('Error regenerating response:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve the React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Test the server: http://localhost:${port}/api/test`);
}); 