import re

def update_file(path, replacements):
    with open(path, "r") as f:
        content = f.read()
    
    for old, new in replacements:
        content = re.sub(old, new, content, flags=re.DOTALL)
        
    with open(path, "w") as f:
        f.write(content)

# 1. LandingPage.tsx
update_file("src/pages/LandingPage.tsx", [
    (r"<div style=\{\{\s*width:\s*32,\s*height:\s*32,\s*background:\s*'var\(--moss\)',.*?\}\}>\s*<Leaf size=\{16\} style=\{\{\s*color:\s*'#aef2c4'\s*\}\} />\s*</div>", 
     r"<Leaf size={24} style={{ color: 'var(--moss)' }} />"),
    (r"<div style=\{\{\s*width:\s*28,\s*height:\s*28,\s*background:\s*'var\(--moss\)',.*?\}\}>\s*<Leaf size=\{14\} style=\{\{\s*color:\s*'#aef2c4'\s*\}\} />\s*</div>", 
     r"<Leaf size={20} style={{ color: 'var(--moss)' }} />")
])

# 2. LoginPage.tsx
update_file("src/pages/auth/LoginPage.tsx", [
    (r"<div className=\"w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center\">\s*<Leaf size=\{20\} className=\"text-primary-fixed\" />\s*</div>",
     r'<Leaf size={28} className="text-[var(--moss)]" />'),
    (r"<div className=\"w-10 h-10 bg-primary rounded-lg flex items-center justify-center\">\s*<Leaf size=\{20\} className=\"text-white\" />\s*</div>",
     r'<Leaf size={28} className="text-[var(--moss)]" />'),
    (r"\s*<div className=\"mt-auto\">\s*<div className=\"text-xs font-mono font-bold tracking-widest text-primary-fixed/50 uppercase\">\s*BUILD 2026\.4 • CIVIC VITALITY\s*</div>\s*</div>",
     r"")
])

# 3. AppLayout.tsx
update_file("src/components/layout/AppLayout.tsx", [
    (r"<div className=\"w-6 h-6 bg-\[var\(--brand\)\] rounded-sm flex items-center justify-center\">\s*<Leaf size=\{14\} className=\"text-black\" />\s*</div>",
     r'<Leaf size={20} className="text-[var(--moss)]" />')
])

# 4. DonorLayout.tsx
update_file("src/components/layout/DonorLayout.tsx", [
    (r"<div className=\"w-7 h-7 bg-primary rounded-lg flex items-center justify-center\">\s*<Leaf size=\{14\} className=\"text-on-primary\" />\s*</div>",
     r'<Leaf size={20} className="text-[var(--moss)]" />')
])

print("Replacements done.")
