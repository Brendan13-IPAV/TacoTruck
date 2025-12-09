import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app)  # This allows your HTML file to talk to this script

# 1. SETUP GEMINI
# Ideally set this in your terminal: export GEMINI_API_KEY="your_key_here"
# For a quick test, you can paste it below (but don't commit to GitHub!)
API_KEY = os.environ.get("GEMINI_API_KEY", "PASTE_YOUR_KEY_HERE_IF_TESTING_LOCALLY")
genai.configure(api_key=API_KEY)

model = genai.GenerativeModel("gemini-2.5-flash")

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_text = data.get('message', '')

    if not user_text:
        return jsonify({"error": "No message provided"}), 400

    try:
        # 2. CALL GEMINI
        response = model.generate_content(user_text)
        
        # 3. SEND BACK TEXT
        return jsonify({"reply": response.text})
    
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"reply": "Sorry, I'm having trouble connecting right now."}), 500

if __name__ == '__main__':
    print("🌮 TacoTruck Server is running on http://127.0.0.1:5000")
    app.run(port=5000, debug=True)
