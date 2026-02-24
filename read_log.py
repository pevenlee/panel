
import os

log_paths = [
    r"c:\Users\heiyu\Documents\GitHub\panel\backend\backend.log",
    r"c:\Users\heiyu\Documents\GitHub\panel\backend\debug.log"
]

for log_path in log_paths:
    print(f"--- Reading {log_path} ---")
    try:
        if os.path.exists(log_path):
            content = ""
            try:
                with open(log_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except:
                try:
                    with open(log_path, 'r', encoding='utf-16') as f:
                        content = f.read()
                except:
                    try:
                        with open(log_path, 'r', encoding='gbk') as f:
                            content = f.read() 
                    except Exception as e:
                        print(f"Failed to read log: {e}")
            
            # Print last 2000 chars
            print(content[-3000:])
        else:
            print("Log file not found")

    except Exception as e:
        print(f"Error: {e}")
