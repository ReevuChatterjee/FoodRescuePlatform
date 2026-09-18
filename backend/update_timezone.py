import os
import re

files_to_update = [
    "app/core/health.py",
    "app/dispatch/service.py",
    "app/routing/providers.py",
    "app/routing/router.py",
    "app/routing/service.py",
    "app/routing/traffic.py",
    "app/services/matching_service.py",
    "app/matching/router.py",
    "app/matching/service.py",
    "app/matching_engine/api.py",
    "app/matching_engine/optimizer.py",
    "app/core/envelope.py"
]

for filepath in files_to_update:
    if not os.path.exists(filepath):
        continue
    with open(filepath, "r") as f:
        content = f.read()

    # Replace timezone.utc with IST
    if "timezone.utc" in content:
        new_content = content.replace("timezone.utc", "IST")
        
        # Add import for IST if not there
        if "from app.core.time import IST" not in new_content:
            import_stmt = "from app.core.time import IST\n"
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
