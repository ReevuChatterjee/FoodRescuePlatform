import re

with open("src/pages/driver/DriverDashboard.tsx", "r") as f:
    content = f.read()

# Replace inline old CSS vars with tailwind equivalents
replacements = {
    'var(--sp-5)': '1.25rem',
    'var(--sp-6)': '1.5rem',
    'var(--brand)': 'var(--moss)',
    'var(--text-muted)': 'var(--text-muted)',
    'var(--border-strong)': 'var(--border-hair)',
    'var(--bg-page)': 'var(--bg-base)',
    'var(--error)': 'var(--error)',
    'var(--warning)': 'var(--warning)',
    'btn-driver': 'btn-primary'
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open("src/pages/driver/DriverDashboard.tsx", "w") as f:
    f.write(content)

print("Updated DriverDashboard.tsx")
