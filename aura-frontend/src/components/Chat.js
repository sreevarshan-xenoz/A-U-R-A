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

  // New Hugging Face Space URL
  const HF_SPACE_URL = "https://hadadrjt-ai.hf.space";
  
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
        setIsConnected(isAvailable);
        console.log('Hugging Face Space status:', isAvailable ? 'connected' : 'disconnected');
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
        // Use the standard predict endpoint with correct format for this Space
        console.log("Sending message to Hugging Face Space:", message);
        
        try {
          // First set the model to JARVIS
          await fetch(`${HF_SPACE_URL}/run/change_model`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: ["JARVIS: 2.1.2"]
            })
          });
          
          // Now send the actual message
          const response = await fetch(`${HF_SPACE_URL}/run/api`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: [{
                "text": message,
                "files": []
              }]
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log("API response:", result);
            
            let responseText = "I'm having trouble understanding that right now.";
            
            // Extract response from the chat history array
            if (result.data && Array.isArray(result.data) && result.data.length > 0) {
              const chatHistory = result.data[0];
              console.log("Chat history:", chatHistory);
              
              if (Array.isArray(chatHistory) && chatHistory.length > 0) {
                // Get the last message (which should be the bot's response)
                const lastMessage = chatHistory[chatHistory.length - 1];
                console.log("Last message:", lastMessage);
                
                if (Array.isArray(lastMessage) && lastMessage.length > 1) {
                  responseText = lastMessage[1]; // Bot response is at index 1
                }
              }
            }
            
            console.log("Final response text:", responseText);
            simulateTyping(responseText);
          } else {
            console.error("API error:", response.status, response.statusText);
            
            // Try the alternative endpoint
            console.log("Trying respond_async endpoint...");
            const altResponse = await fetch(`${HF_SPACE_URL}/run/respond_async`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                data: [{
                  "text": message,
                  "files": []
                }]
              })
            });
            
            if (altResponse.ok) {
              const altResult = await altResponse.json();
              console.log("Alternative endpoint response:", altResult);
              
              let altResponseText = "I'm having trouble understanding that right now.";
              
              if (altResult.data && Array.isArray(altResult.data) && altResult.data.length > 0) {
                const chatHistory = altResult.data[0];
                
                if (Array.isArray(chatHistory) && chatHistory.length > 0) {
                  const lastMessage = chatHistory[chatHistory.length - 1];
                  
                  if (Array.isArray(lastMessage) && lastMessage.length > 1) {
                    altResponseText = lastMessage[1];
                  }
                }
              }
              
              console.log("Alternative response text:", altResponseText);
              simulateTyping(altResponseText);
            } else {
              throw new Error(`All API endpoints failed`);
            }
          }
        } catch (innerError) {
          console.error("API call failed:", innerError);
          const errorMsg = "Sorry, I encountered an error processing your request.";
          simulateTyping(errorMsg);
        }
      }
    } catch (error) {
      console.error('Error communicating with Hugging Face Space:', error);
      const errorMsg = "Sorry, I encountered an error processing your request.";
      simulateTyping(errorMsg);
    } finally {
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