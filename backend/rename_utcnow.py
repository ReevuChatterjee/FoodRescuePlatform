with open("app/dispatch/service.py", "r") as f:
    content = f.read()

new_content = content.replace("utcnow", "now_ist")

with open("app/dispatch/service.py", "w") as f:
    f.write(new_content)
