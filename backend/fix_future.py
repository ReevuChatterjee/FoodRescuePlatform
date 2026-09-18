import os
import glob

# Collect all .py files in app/
files_to_check = []
for root, _, files in os.walk("app"):
    for f in files:
        if f.endswith(".py"):
            files_to_check.append(os.path.join(root, f))

for filepath in files_to_check:
    with open(filepath, "r") as f:
        content = f.read()
    
    if "from __future__ import" in content:
        lines = content.splitlines()
        future_idx = -1
        time_import_idx = -1
        
        for i, line in enumerate(lines):
            if "from __future__ import" in line:
                future_idx = i
            if line.strip() == "from app.core.time import ist_now" or line.strip() == "from app.core.time import IST":
                time_import_idx = i
                
        if time_import_idx != -1 and future_idx != -1 and time_import_idx < future_idx:
            # We need to swap or move __future__ to the top
            future_line = lines.pop(future_idx)
            lines.insert(0, future_line)
            
            with open(filepath, "w") as f:
                f.write("\n".join(lines) + "\n")
            print(f"Fixed {filepath}")
