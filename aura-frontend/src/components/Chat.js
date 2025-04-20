import React, { useState, useEffect, useRef } from 'react';
import './Chat.css';

function Chat() {
  const [message, setMessage] = useState('');
  const [responses, setResponses] = useState([
    { text: "Hello! I'm A-U-R-A. How can I assist you today?", isBot: true }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const typingSpeed = 15; // ms per character

  // Your Hugging Face Space URL - Updated to correct URL
  const HF_SPACE_URL = "https://naxwinn-aura.hf.space";
  
  // Check if the Hugging Face Space is available
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Test connection to the Hugging Face Space
        const response = await fetch(`${HF_SPACE_URL}/run/heartbeat`);
        const isAvailable = response.status === 200;
        setIsConnected(isAvailable);
        console.log('Hugging Face Space status:', isAvailable ? 'connected' : 'disconnected');
      } catch (error) {
        console.error('Hugging Face Space connection error:', error);
        setIsConnected(false);
      }
    };
    
    checkConnection();
    // Check connection status periodically
    const intervalId = setInterval(checkConnection, 30000); // Check every 30 seconds
    
    return () => clearInterval(intervalId);
  }, []);

  // Auto-scroll to the bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [responses]);

  // Simulated typing effect
  const simulateTyping = (fullResponse) => {
    setIsTyping(true);
    setCurrentResponse('');
    
    let i = 0;
    const timer = setInterval(() => {
      if (i < fullResponse.length) {
        setCurrentResponse(prev => prev + fullResponse.charAt(i));
        i++;
      } else {
        clearInterval(timer);
        setIsTyping(false);
        // Once done typing, add the response to the messages
        setResponses(prev => [...prev, { text: fullResponse, isBot: true }]);
      }
    }, typingSpeed);
    
    return () => clearInterval(timer);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Add user message to responses
    setResponses(prev => [...prev, { text: message, isBot: false }]);
    setIsLoading(true);
    
    // Clear any existing typing
    setIsTyping(false);
    setCurrentResponse('');

    try {
      if (!isConnected) {
        // Fallback if Space is not connected
        setTimeout(() => {
          const response = "Sorry, I'm currently disconnected from my brain. Please check if the Hugging Face Space is running.";
          simulateTyping(response);
          setIsLoading(false);
        }, 500);
      } else {
        // Connect to the Hugging Face API using the correct endpoint
        const response = await fetch(`${HF_SPACE_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            message: message // Updated format for the /chat endpoint
          }),
        });

        const data = await response.json();
        // The response is directly in data, not data.data
        const responseText = data || "I'm having trouble understanding that right now.";
        
        // Instead of immediately adding to responses, simulate typing
        simulateTyping(responseText);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error communicating with Hugging Face Space:', error);
      const errorMsg = "Sorry, I encountered an error processing your request.";
      simulateTyping(errorMsg);
      setIsLoading(false);
    }

    setMessage('');
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="status-indicator">
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <h3>A-U-R-A Chat</h3>
      </div>
      <div className="chat-messages">
        {responses.map((response, index) => (
          <div key={index} className={`message ${response.isBot ? 'bot' : 'user'}`}>
            {response.text}
          </div>
        ))}
        {isLoading && <div className="loading">AURA is thinking...</div>}
        {isTyping && (
          <div className="message bot typing">
            {currentResponse}
            <span className="cursor"></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="chat-input">
        <input 
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask A-U-R-A something..."
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}

export default Chat; 