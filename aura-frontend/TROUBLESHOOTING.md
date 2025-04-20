# Troubleshooting Guide for A-U-R-A Hugging Face Integration

If you're experiencing issues connecting to the Hugging Face Spaces or the chat is not working as expected, follow these troubleshooting steps:

## Backend Server Not Running

**Symptoms:** 
- "Disconnected" status in the chat UI
- Console error: "Failed to fetch" or "Backend server test failed"

**Solution:**
1. Open a new terminal window
2. Navigate to the project directory:
   ```bash
   cd path/to/aura-frontend
   ```
3. Start the backend server:
   ```bash
   npm run server
   ```
4. Verify the server is running by visiting: `http://localhost:3001/api/test` in your browser

## Missing API Key

**Symptoms:**
- Server logs showing: "Using API key: YOUR..."
- API calls failing with authentication errors

**Solution:**
1. Get your Hugging Face API key from: https://huggingface.co/settings/tokens
2. Update the `.env` file with your key:
   ```
   HF_API_KEY=your_actual_api_key_here
   ```
3. Restart the backend server

## CORS Issues

**Symptoms:**
- Console errors containing "CORS policy" or "Access-Control-Allow-Origin"
- API calls failing even though the server is running

**Solution:**
1. Make sure the frontend is calling the correct backend URL (`http://localhost:3001/api`)
2. Check that CORS is properly enabled in the server.js file
3. If using a production setup, ensure your server is configured to accept requests from your frontend domain

## Using the Wrong Model

**Symptoms:**
- Error messages containing "Model not found" or similar
- Failed API calls with 404 or 400 status codes

**Solution:**
1. Check the MODEL_ID in server.js to ensure it matches a valid model on Hugging Face
2. For the QwQ-32B demo, use: `Qwen/QwQ-32B-Demo` as the model ID
3. If still not working, try a different model that supports text generation or chat completion

## API Quotas or Rate Limits

**Symptoms:**
- Working initially but then failing
- Error messages about quota or rate limits

**Solution:**
1. Check your Hugging Face account for any quota limitations
2. Consider upgrading your Hugging Face account if needed
3. Implement rate limiting in your application to stay within limits

## Running Both Frontend and Backend

**Symptoms:**
- One part works, but not the other
- Confusion about starting both servers

**Solution:**
Use the combined script to run both:
```bash
npm run dev
```

This will start both the React frontend and the Express backend.

## Debugging Hugging Face API Calls

If you need to debug the specific API calls:

1. Check the server console logs for detailed request and response information
2. Look for any error messages related to the Hugging Face API
3. Try using the Hugging Face Inference API directly with a tool like Postman to test

## Common Error Messages

### "Cannot read properties of undefined (reading 'generated_text')"

This indicates the API response is not in the expected format. Solutions:
- Check the MODEL_ID to ensure it's a text generation model
- Look at server logs to see the actual API response format
- Modify the server.js code to handle the specific response format of your model

### "Error: Model [model_name] doesn't exist"

The model ID is incorrect or the model is not accessible with your API key:
- Double-check the MODEL_ID spelling
- Make sure your API key has access to the model
- Try a different public model

## Still Having Issues?

If you've tried everything and still can't connect:

1. Check if the Hugging Face API is operational
2. Verify your internet connection isn't blocking API calls
3. Try a simple test using the Hugging Face Inference API in a separate tool
4. Consider using a different LLM provider if Hugging Face integration continues to fail 