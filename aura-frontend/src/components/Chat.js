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
  const [chatId, setChatId] = useState(null);

  // Local proxy server URL
  const API_URL = "http://localhost:3001";
  
  // Initialize the connection and create a new chat session
  useEffect(() => {
    const initializeClient = async () => {
      try {
        console.log("Connecting to API server...");
        
        // Check connection by sending a request to create a new chat
        const response = await fetch(`${API_URL}/api/create_chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: [] })
        });
        
        if (response.ok) {
          const result = await response.json();
          setIsConnected(true);
          console.log('Connected to API server successfully');
          
          if (result.data) {
            setChatId(result.data);
            console.log('Created new chat with ID:', result.data);
          }
        } else {
          throw new Error(`Connection failed with status: ${response.status}`);
        }
      } catch (error) {
        console.error('Error connecting to API server:', error);
        setIsConnected(false);
      }
    };
    
    initializeClient();
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
      if (!isConnected || !chatId) {
        // Fallback if not connected
        setTimeout(() => {
          const response = "Sorry, I'm currently disconnected from my brain. Please wait a moment and try again.";
          simulateTyping(response);
          setIsLoading(false);
        }, 500);
      } else {
        console.log("Sending message to API server:", message);
        
        try {
          // Use the submit endpoint to send the message
          const response = await fetch(`${API_URL}/api/submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: [
                chatId,        // chat_id
                message,       // message
                null,          // stream (using null for non-streaming)
                null,          // temperature
                null,          // max_tokens
                null,          // top_p 
                null           // top_k
              ]
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log("API response:", result);
            if (result.data && result.data.response) {
              const responseText = result.data.response;
              console.log("Response text:", responseText);
              simulateTyping(responseText);
            } else {
              throw new Error('No response data received');
            }
          } else {
            throw new Error(`API call failed with status: ${response.status}`);
          }
        } catch (innerError) {
          console.error("API call failed:", innerError);
          
          // Try to recreate the chat if it might have expired
          try {
            console.log("Attempting to create a new chat session...");
            const newChatResponse = await fetch(`${API_URL}/api/create_chat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ data: [] })
            });
            
            if (newChatResponse.ok) {
              const newChatResult = await newChatResponse.json();
              if (newChatResult.data) {
                setChatId(newChatResult.data);
                console.log('Created new chat with ID:', newChatResult.data);
                
                // Try sending the message again with the new chat ID
                const retryResponse = await fetch(`${API_URL}/api/submit`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    data: [
                      newChatResult.data, // new chat_id
                      message,            // message
                      null,               // stream
                      null,               // temperature
                      null,               // max_tokens
                      null,               // top_p
                      null                // top_k
                    ]
                  })
                });
                
                if (retryResponse.ok) {
                  const retryResult = await retryResponse.json();
                  if (retryResult.data && retryResult.data.response) {
                    const responseText = retryResult.data.response;
                    simulateTyping(responseText);
                  } else {
                    throw new Error('No response data received on retry');
                  }
                } else {
                  throw new Error(`Retry API call failed with status: ${retryResponse.status}`);
                }
              }
            }
          } catch (retryError) {
            console.error("Retry failed:", retryError);
            const errorMsg = "Sorry, I encountered an error processing your request.";
            simulateTyping(errorMsg);
          }
        }
      }
    } catch (error) {
      console.error('Error communicating with API server:', error);
      const errorMsg = "Sorry, I encountered an error processing your request.";
      simulateTyping(errorMsg);
    } finally {
      setIsLoading(false);
    }

    setMessage('');
  };

  const handleRegenerateResponse = async () => {
    if (!isConnected || !chatId || isLoading) return;
    
    setIsLoading(true);
    try {
      console.log("Regenerating last response...");
      const response = await fetch(`${API_URL}/api/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: [
            chatId,  // chat_id
            null,    // stream
            null,    // temperature
            null,    // max_tokens
            null,    // top_p
            null     // top_k
          ]
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.data && result.data.response) {
          // Remove the last bot message if it exists
          const lastBotIndex = [...responses].reverse().findIndex(r => r.isBot);
          if (lastBotIndex !== -1) {
            const newResponses = [...responses];
            newResponses.splice(responses.length - 1 - lastBotIndex, 1);
            setResponses(newResponses);
          }
          
          const responseText = result.data.response;
          simulateTyping(responseText);
        }
      } else {
        throw new Error(`Regenerate API call failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error regenerating response:', error);
      const errorMsg = "Sorry, I couldn't regenerate a response.";
      simulateTyping(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!isConnected) return;
    
    try {
      console.log("Clearing chat history...");
      const response = await fetch(`${API_URL}/api/create_chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: [] })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          setChatId(result.data);
          console.log('Created new chat with ID:', result.data);
          setResponses([
            { text: "Hello! I'm A-U-R-A. How can I assist you today?", isBot: true }
          ]);
        }
      }
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="status-indicator">
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <h3>A-U-R-A Chat</h3>
        <div className="chat-actions">
          <button 
            onClick={handleRegenerateResponse} 
            disabled={isLoading || !isConnected}
            className="action-button"
          >
            Regenerate
          </button>
          <button 
            onClick={handleClearChat} 
            disabled={isLoading || !isConnected}
            className="action-button"
          >
            Clear Chat
          </button>
        </div>
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