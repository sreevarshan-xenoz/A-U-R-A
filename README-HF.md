---
title: A-U-R-A
emoji: 🧠
colorFrom: indigo
colorTo: blue
sdk: gradio
sdk_version: 3.50.2
app_file: app.py
pinned: true
license: mit
---

# A-U-R-A: Augmented User Response Assistant

Try out the demo above, or connect your frontend using the API. See full documentation in the [GitHub repository](https://github.com/sreevarshan-xenoz/A-U-R-A).

## API Usage

The API is accessible at `/api/predict` with this format:

```javascript
// Request
{
  "data": [
    "Your question here",  // The message
    []                     // Empty history array
  ]
}

// Response
{
  "data": "AI response here"
}
``` 