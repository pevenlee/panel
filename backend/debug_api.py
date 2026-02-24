import requests
import json

base_url = "http://localhost:8000"

def test_endpoint(name, url, method="POST", data=None):
    print(f"Testing {name}: {method} {url}")
    try:
        if method == "POST":
            resp = requests.post(url, json=data)
        else:
            resp = requests.get(url)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:100]}...")
        if resp.status_code == 404:
            print("❌ Not Found")
        else:
            print("✅ OK")
    except Exception as e:
        print(f"❌ Connection Error: {e}")

# Test 1: Root
test_endpoint("Root", f"{base_url}/", "GET")

# Test 2: Identify Intent (Step 1)
test_endpoint("Identify Intent", f"{base_url}/api/identify-intent", "POST", {"text": "sales in 2024"})

# Test 3: Query Data (Step 2)
test_endpoint("Query Data", f"{base_url}/api/query", "POST", {"text": "sales in 2024", "history": []})

# Test 4: Research Tools (Check if other routes work)
test_endpoint("Research Tools", f"{base_url}/api/research/tools", "GET")
