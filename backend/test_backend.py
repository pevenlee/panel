import requests
import json

url = "http://localhost:8001/api/query"
payload = {
    "text": "计算康缘所有定义市场的份额",  # Query content
    "history": [],
    "module": "dashboard"
}
headers = {
    "Content-Type": "application/json"
}

try:
    print(f"Sending request to {url}...")
    response = requests.post(url, json=payload, headers=headers, timeout=120)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print("Success!")
        data = response.json()
        if "error" in data:
            print(f"API Error: {data['error']}")
        else:
            print("Data received.")
            if "code" in data:
                print("Generated Code Preview:")
                print(data["code"][:200] + "...")
    else:
        print(f"Error Response: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
