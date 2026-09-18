import os
import re

# Simple regex to catch most common emojis, excluding basic ASCII and standard symbols
emoji_pattern = re.compile(r'[\U00010000-\U0010ffff]', flags=re.UNICODE)

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.css')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                matches = emoji_pattern.findall(content)
                if matches:
                    print(f"{path}: {set(matches)}")
