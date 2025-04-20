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

  // Your Hugging Face Space URL
  const HF_SPACE_URL = "https://naxwinn-aura.hf.space";
  
  // Check if the Hugging Face Space is available
  useEffect(() => {
    const checkConnection = async () => {
      try {
        console.log("Checking connection to Hugging Face Space...");
        // Try to fetch the standard Gradio heartbeat endpoint
        const response = await fetch(`${HF_SPACE_URL}/run/heartbeat`, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          mode: 'cors',
          cache: 'no-cache'
        });
        
        const isAvailable = response.ok;
        
        if (isAvailable) {
          // Try to parse the response for more details
          try {
            const data = await response.json();
            console.log('Heartbeat response:', data);
          } catch (e) {
            console.log('Heartbeat OK but not JSON format');
          }
        }
        
        setIsConnected(isAvailable);
        console.log('Hugging Face Space status:', isAvailable ? 'connected' : 'disconnected');
        
        // If not connected, let's also try the alternative endpoint format
        if (!isAvailable) {
          try {
            console.log("Trying alternative endpoint...");
            const altResponse = await fetch(`${HF_SPACE_URL}/api/chat`, {
              method: 'OPTIONS',
              headers: { 'Content-Type': 'application/json' }
            });
            
            if (altResponse.ok || altResponse.status === 204) {
              console.log("Alternative endpoint available, setting connected");
              setIsConnected(true);
            }
          } catch (e) {
            console.error("Alternative endpoint also failed:", e);
          }
        }
      } catch (error) {
        console.error('Error connecting to Hugging Face Space:', error);
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
        // First try the standard Gradio format
        console.log("Trying standard Gradio format...");
        let response;
        
        try {
          response = await fetch(`${HF_SPACE_URL}/run/predict`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              data: [message, []], // [message, history] format
              fn_index: 0
            }),
            mode: 'cors'
          });
        } catch (e) {
          console.error("Standard format failed:", e);
          // Try the API endpoint with /chat
          console.log("Trying /api/chat endpoint...");
          response = await fetch(`${HF_SPACE_URL}/api/chat`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json' 
            },
            body: JSON.stringify({ message: message }),
            mode: 'cors'
          });
        }
        
        if (response?.ok) {
          const result = await response.json();
          console.log("API response:", result);
          
          let responseText = "I'm having trouble understanding that right now.";
          
          // Try different result formats
          if (result && result.data && Array.isArray(result.data) && result.data.length > 0) {
            // Standard Gradio format
            responseText = result.data[0];
          } else if (typeof result === 'string') {
            // Direct string response
            responseText = result;
          } else if (result && result.data && typeof result.data === 'string') {
            // Object with data string
            responseText = result.data;
          } else if (result && result.response) {
            // Object with response field
            responseText = result.response;
          } else {
            console.warn("Unexpected response format:", result);
          }
          
          console.log("Final response text:", responseText);
          simulateTyping(responseText);
        } else {
          // Log more detailed error information
          console.error("API returned error:", response?.status, response?.statusText);
          const errorText = await response?.text().catch(e => "Could not read error response");
          console.error("Error details:", errorText);
          
          // One final attempt with a different format
          console.log("Trying last fallback format...");
          try {
            const lastAttempt = await fetch(`${HF_SPACE_URL}/run/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                data: [message],
                session_hash: new Date().getTime().toString()
              })
            });
            
            if (lastAttempt.ok) {
              const lastResult = await lastAttempt.json();
              console.log("Last attempt response:", lastResult);
              let finalText = "I'm having trouble understanding that right now.";
              
              if (lastResult && typeof lastResult.data === 'string') {
                finalText = lastResult.data;
              } else if (lastResult && Array.isArray(lastResult.data)) {
                finalText = lastResult.data[0] || finalText;
              }
              
              simulateTyping(finalText);
              return; // Exit early if this worked
            }
          } catch (finalError) {
            console.error("Final attempt also failed:", finalError);
          }
          
          throw new Error(`API returned error: ${response?.status || "unknown"}`);
        }
      }
    } catch (innerError) {
      console.error("API call failed:", innerError);
      const errorMsg = "Sorry, I encountered an error processing your request.";
      simulateTyping(errorMsg);
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