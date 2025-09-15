import os
import base64
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

# --- Basic Configuration ---
app = Flask(__name__)
CORS(app) # Enable Cross-Origin Resource Sharing

# It's highly recommended to set your API key as an environment variable
# for better security rather than hardcoding it.
# You can get your key from Google AI Studio.
API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyBUphkuKmfqF0NaBSWx8bI-25_MuiT9Xhw")
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"

# --- Helper Function ---
def get_gemini_response(image_data, image_mime_type, detect_table):
    """
    Calls the Gemini API with the image data and returns the extracted content.
    """
    if detect_table == 'true':
        prompt = "Extract the table from this image. Respond with a JSON array of arrays, where each inner array represents a row. Make the first row the header. Ensure all rows have the same number of columns. Do not include markdown formatting in your response."
    else:
        prompt = "Extract all text from this image, line by line. Respond with a JSON array of strings, where each string is a line of text. Do not include markdown formatting in your response."

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": image_mime_type,
                            "data": image_data
                        }
                    }
                ]
            }
        ],
        "generation_config": {
            "response_mime_type": "application/json",
        },
    }

    try:
        response = requests.post(API_URL, json=payload, timeout=60)
        response.raise_for_status() # Raises an HTTPError for bad responses (4xx or 5xx)
        
        result = response.json()
        
        # Navigate through the Gemini API's response structure
        if (result.get("candidates") and
            result["candidates"][0].get("content") and
            result["candidates"][0]["content"].get("parts")):
            
            return result["candidates"][0]["content"]["parts"][0]["text"]
        else:
            return None # Or raise an exception for no content

    except requests.exceptions.RequestException as e:
        print(f"Error calling Gemini API: {e}")
        # You might want to return a more specific error message based on the exception
        return None

# --- API Endpoint ---
@app.route("/api/convert", methods=["POST"])
def convert_image():
    """
    API endpoint to receive an image, process it with Gemini, 
    and return the structured data.
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    detect_table = request.form.get('detectTable', 'true')

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file:
        # Securely get filename and MIME type
        filename = secure_filename(file.filename)
        mime_type = file.mimetype
        
        # Convert image to base64
        image_bytes = file.read()
        base64_image_data = base64.b64encode(image_bytes).decode('utf-8')

        # Get response from Gemini
        extracted_text = get_gemini_response(base64_image_data, mime_type, detect_table)

        if extracted_text:
            return jsonify({"data": extracted_text})
        else:
            return jsonify({"error": "Failed to extract data from the image. The API might have returned an empty response or an error."}), 500
            
    return jsonify({"error": "An unexpected error occurred"}), 500

# --- Run the App ---
if __name__ == '__main__':
    # For development, you can run it like this.
    # For production, use a proper WSGI server like Gunicorn or Waitress.

    app.run(debug=True, port=5001)
