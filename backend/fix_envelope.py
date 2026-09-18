import os
filepath = "app/core/envelope.py"
with open(filepath, "r") as f:
    content = f.read()

content = content.replace('return dt.isoformat() + "Z"', 'return dt.replace(tzinfo=IST).isoformat() if dt.tzinfo is None else dt.astimezone(IST).isoformat()')

with open(filepath, "w") as f:
    f.write(content)
