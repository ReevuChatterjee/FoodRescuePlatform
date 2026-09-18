import os
filepath = "app/routing/providers.py"
with open(filepath, "r") as f:
    content = f.read()

content = content.replace('strftime("%Y-%m-%dT%H:%M:%S+00:00")', 'isoformat()')

with open(filepath, "w") as f:
    f.write(content)
