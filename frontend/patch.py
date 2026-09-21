import re

with open('src/pages/LandingPage.tsx', 'r') as f:
    content = f.read()

# 1. Fix ProcessStep alignment
# Replace ProcessStep definition container classes
process_step_search = r'<div className="flex gap-4 md:gap-10 relative z-10 pb-10[^"]*">'
process_step_replace = r'<div className="flex relative z-10 pb-10 last:pb-0">'
content = re.sub(process_step_search, process_step_replace, content)

process_step_num_search = r'<div className="w-5 md:w-10 shrink-0 text-right font-mono-data pt-1[^"]*">'
process_step_num_replace = r'<div className="w-8 md:w-12 shrink-0 text-right font-mono-data pt-1 text-primary">'
content = re.sub(process_step_num_search, process_step_num_replace, content)

# But wait, there are two versions of ProcessStep (disableMotion and normal). 
# Let's just use string replacement carefully.
