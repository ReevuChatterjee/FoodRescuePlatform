import os
import re

files_to_update = [
    "app/admin/router.py",
    "app/auth/dependencies.py",
    "app/auth/router.py",
    "app/core/envelope.py",
    "app/deliveries/router.py",
    "app/donations/router.py",
    "app/models/__init__.py",
    "app/ngos/router.py",
    "app/scripts/seed_admin.py",
    "app/scripts/seed_demo.py",
    "app/matching/router.py",
    "app/matching/service.py",
    "app/ngo/router.py"
]

for filepath in files_to_update:
    if not os.path.exists(filepath):
        continue
    with open(filepath, "r") as f:
        content = f.read()

    # If datetime.utcnow is not in the file, skip
    if "datetime.utcnow" not in content:
        continue

    # Replace datetime.utcnow with ist_now
    new_content = content.replace("datetime.utcnow", "ist_now")

    # We also need to import ist_now
    # We can inject it after the datetime import
    if "from app.core.time import ist_now" not in new_content:
        # Find 'from datetime import' or 'import datetime'
        import_stmt = "from app.core.time import ist_now\n"
        # Just insert at the top after imports, or right at the top if there's a docstring
        # Safest is to put it right after the first "import " or "from " statement
        lines = new_content.splitlines()
        inserted = False
        for i, line in enumerate(lines):
            if line.startswith("import ") or line.startswith("from "):
                lines.insert(i, import_stmt.strip())
                inserted = True
                break
        
        if not inserted:
            lines.insert(0, import_stmt.strip())

        new_content = "\n".join(lines) + "\n"

    with open(filepath, "w") as f:
        f.write(new_content)
        print(f"Updated {filepath}")
