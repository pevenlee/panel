
import os

def count_lines(directory, extensions, excludes):
    total = 0
    file_count = 0
    # normalize excludes
    excludes = set(excludes)
    
    for root, dirs, files in os.walk(directory):
        # Update dirs in-place to skip excluded directories
        dirs[:] = [d for d in dirs if d not in excludes and not d.startswith('.')]
        
        for f in files:
            if f.endswith(extensions):
                path = os.path.join(root, f)
                try:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                        lines = sum(1 for _ in fp)
                        total += lines
                        file_count += 1
                except Exception as e:
                    pass
    return total, file_count

backend_lines, backend_files = count_lines(
    r'c:\Users\heiyu\Documents\GitHub\panel\backend', 
    ('.py',), 
    ['venv', '__pycache__', '.git', '.idea', 'data']
)

frontend_lines, frontend_files = count_lines(
    r'c:\Users\heiyu\Documents\GitHub\panel\frontend\src', 
    ('.js', '.jsx', '.css'), 
    ['node_modules', '.git', 'dist', 'build']
)

print(f"Backend (Python): {backend_lines} lines ({backend_files} files)")
print(f"Frontend (JS/JSX/CSS): {frontend_lines} lines ({frontend_files} files)")
print(f"Total: {backend_lines + frontend_lines} lines")
