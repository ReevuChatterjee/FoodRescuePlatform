import json

def read_file(filepath):
    with open(filepath, 'r') as f:
        return f.read()

def write_file(filepath, content):
    with open(filepath, 'w') as f:
        f.write(content)

tailwind_config = read_file('tailwind.config.js')
index_css = read_file('src/index.css')

# We want to replace the hardcoded M3 colors in tailwind.config.js with var(--color-*)
# And then append the definitions to index.css :root and html.dark

import re

# Extract colors from tailwind.config.js
colors_match = re.search(r'colors:\s*\{([\s\S]*?)// ── Legacy', tailwind_config)
if not colors_match:
    print("Could not find colors block")
    exit(1)

colors_block = colors_match.group(1)

# Find all 'name': 'hex' pairs
pattern = re.compile(r"'([^']+)':\s*'([^']+)',")
m3_colors = pattern.findall(colors_block)

light_vars = []
dark_vars = []

for name, hex_val in m3_colors:
    if name in ['background-cv', 'on-background', 'surface-variant', 'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container', 'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container', 'primary-fixed', 'primary-fixed-dim', 'on-primary-fixed', 'on-primary-fixed-variant', 'secondary-fixed', 'secondary-fixed-dim', 'on-secondary-fixed', 'on-secondary-fixed-variant']:
        light_vars.append(f"    --color-{name}: {hex_val};")
        dark_vars.append(f"    --color-{name}: {hex_val};") # Keep same for now or approximate
    else:
        light_vars.append(f"    --color-{name}: {hex_val};")

# Let's approximate dark mode colors for the core ones
dark_map = {
    'surface': '#1a1f1c',
    'surface-dim': '#141715',
    'surface-bright': '#222820',
    'surface-container-lowest': '#0f1210',
    'surface-container-low': '#161a18',
    'surface-container': '#1a1f1c',
    'surface-container-high': '#222820',
    'surface-container-highest': '#2c332e',
    'on-surface': '#e8f0e9',
    'on-surface-variant': '#9ab09b',
    'inverse-surface': '#e8f0e9',
    'inverse-on-surface': '#1a1f1c',
    'outline': '#8b998c',
    'outline-variant': '#404942',
    'surface-tint': '#4a9e70',
    'primary': '#92d5a9',
    'on-primary': '#00381f',
    'primary-container': '#00522f',
    'on-primary-container': '#aef2c4',
    'inverse-primary': '#1b5e3b',
    'error': '#ffb4ab',
    'on-error': '#690005',
    'error-container': '#93000a',
    'on-error-container': '#ffdad6',
}

for name, hex_val in m3_colors:
    if name in dark_map:
        # replace in dark_vars if it was added
        for i, v in enumerate(dark_vars):
            if v.startswith(f"    --color-{name}:"):
                dark_vars[i] = f"    --color-{name}: {dark_map[name]};"
                break
        else:
            dark_vars.append(f"    --color-{name}: {dark_map[name]};")

# Replace in tailwind.config.js
new_colors_block = colors_block
for name, hex_val in m3_colors:
    new_colors_block = new_colors_block.replace(f"'{hex_val}'", f"'var(--color-{name})'")

new_tailwind = tailwind_config.replace(colors_block, new_colors_block)
write_file('tailwind.config.js', new_tailwind)

# Inject into index.css
light_str = "\n    /* M3 Tokens */\n" + "\n".join(light_vars) + "\n"
dark_str = "\n    /* M3 Tokens Dark */\n" + "\n".join(dark_vars) + "\n"

# Insert light after color-scheme: light;
index_css = index_css.replace("color-scheme: light;", "color-scheme: light;" + light_str)
# Insert dark after color-scheme: dark;
index_css = index_css.replace("color-scheme: dark;", "color-scheme: dark;" + dark_str)

write_file('src/index.css', index_css)
print("Done.")
