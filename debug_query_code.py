import requests
import json
import time

url = "http://localhost:8000/api/query"
payload = {
    "text": "康缘的市场份额是多少",
    "history": [],
    "module": "dashboard"
}
headers = {"Content-Type": "application/json"}

print(f"Sending query: {payload['text']} to {url}")
try:
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        print("Response received.")
        # The code might be in the response or logs. 
        # API doesn't strictly return the code in the 'data' field usually, but let's see.
        # It usually returns 'data', 'title', 'config'. 
        # The logs are the most reliable way to see the EXACT code executed.
    else:
        print(f"Error: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
