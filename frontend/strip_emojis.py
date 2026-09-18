import re

def remove_emojis_from_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Let's remove the span wrappers completely if they just contain an emoji
    content = re.sub(r"<span[^>]*>\s*[\U00010000-\U0010ffff]+\s*</span>\n?", "", content)
    content = re.sub(r"<span[^>]*>\s*[\U00010000-\U0010ffff]+\ufe0f?\s*</span>\n?", "", content)
    
    # Remove standalone emojis
    content = re.sub(r"[\U00010000-\U0010ffff]\ufe0f?", "", content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

remove_emojis_from_file('src/pages/LandingPage.tsx')
remove_emojis_from_file('src/pages/donor/DonationDetails.tsx')
print("Emojis removed.")
