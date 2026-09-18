import re

with open("src/pages/LandingPage.tsx", "r") as f:
    content = f.read()

# 1. Remove blinking dot
content = re.sub(
    r"<span style=\{\{\s*display:\s*'inline-block',\s*width:\s*8,\s*height:\s*8,\s*borderRadius:\s*'50%',\s*background:\s*'var\(--terracotta\)',\s*animation:\s*'pulse 2s infinite'\s*\}\}\s*/>\s*",
    "",
    content
)

# 2. Remove backgrounds from Role tags
content = re.sub(
    r"(<span className=\"px-2 py-1 rounded text-xs font-bold uppercase\" style=\{\{\s*)background:\s*'[^']+',\s*color:\s*('[^']+')(\s*\}\}>Role \d+</span>)",
    r"\1color: \2\3",
    content
)

with open("src/pages/LandingPage.tsx", "w") as f:
    f.write(content)

print("Highlights removed.")
