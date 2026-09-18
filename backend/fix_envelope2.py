import os
filepath = "app/core/envelope.py"
with open(filepath, "r") as f:
    content = f.read()

# Replace datetime.utcnow with ist_now in docstring just to be clean
content = content.replace("datetime.utcnow", "ist_now")

if "from app.core.time import IST" not in content:
    content = "from app.core.time import IST, ist_now\n" + content

with open(filepath, "w") as f:
    f.write(content)
