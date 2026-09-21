import re

with open('tailwind.config.js', 'r') as f:
    content = f.read()

# Fix the incorrect mappings
fixes = {
    "'surface-bright':             'var(--color-surface)',": "'surface-bright':             'var(--color-surface-bright)',",
    "'on-primary':                 'var(--color-surface-container-lowest)',": "'on-primary':                 'var(--color-on-primary)',",
    "'inverse-primary':            'var(--color-on-primary-container)',": "'inverse-primary':            'var(--color-inverse-primary)',",
    "'on-secondary':               'var(--color-surface-container-lowest)',": "'on-secondary':               'var(--color-on-secondary)',",
    "'on-tertiary':                'var(--color-surface-container-lowest)',": "'on-tertiary':                'var(--color-on-tertiary)',",
    "'on-error':                   'var(--color-surface-container-lowest)',": "'on-error':                   'var(--color-on-error)',",
    "'background-cv':              'var(--color-surface)',": "'background-cv':              'var(--color-background-cv)',",
    "'on-background':              'var(--color-on-surface)',": "'on-background':              'var(--color-on-background)',",
    "'surface-variant':            'var(--color-surface-container-highest)',": "'surface-variant':            'var(--color-surface-variant)',",
}

for k, v in fixes.items():
    content = content.replace(k, v)

with open('tailwind.config.js', 'w') as f:
    f.write(content)
