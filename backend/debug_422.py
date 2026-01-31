import requests
import json

url = "http://localhost:8000/api/query"

# Payload 1: Minimal valid payload
payload1 = {
    "text": "test"
}

# Payload 2: Payload with module
payload2 = {
    "text": "test research",
    "module": "research",
    "history": []
}

# Payload 3: Payload with bad history (simulate potential issue)
payload3 = {
    "text": "test bad history",
    "history": [{"role": "user"}] # Missing content?
}

def test(name, p):
    print(f"--- Testing {name} ---")
    try:
        r = requests.post(url, json=p)
        print(f"Status: {r.status_code}")
        if r.status_code != 200:
            print(f"Response: {r.text}")
        else:
            print("Success")
    except Exception as e:
        print(f"Error: {e}")

test("Minimal", payload1)
test("With Module", payload2)
test("Bad History", payload3)
