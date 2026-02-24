import requests
import time

url = "http://localhost:8000/api/research/tools"

def verify_tools():
    for _ in range(10):  # Retry for 10s
        try:
            response = requests.get(url)
            if response.status_code == 200:
                data = response.json()
                tools = data.get("tools", [])
                print(f"Tools registered: {len(tools)}")
                print(f"Tool IDs: {[t.get('tool_id') for t in tools]}")
                if len(tools) == 0:
                    print("SUCCESS: No tools registered.")
                else:
                    print("FAILURE: Tools still present.")
                return
        except Exception as e:
            print(f"Waiting for backend... ({e})")
            time.sleep(1)
    print("Timeout waiting for backend.")

if __name__ == "__main__":
    verify_tools()
