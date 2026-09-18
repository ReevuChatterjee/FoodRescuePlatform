replacements = {
    "Bill Emerson Act Protected": "FSSAI Traceability Compliant",
    "Tax Deduction', val: 'IRC 170(e)(3)'": "Regulatory Compliance', val: 'SWM Rules 2026'",
    "USDA thermal log verified": "FSSAI guidelines compliant",
    "adherence to federal safe harbor statutes": "digital documentation and traceability",
    "Aligned with FDA Food Code standards": "Aligned with FSSAI Surplus Food Regulations",
    "Certified Good Samaritan Food Donation Act Compliant": "FSSAI Surplus Food Regulations 2019 Traceability",
    "tax compliance documentation and eliminate commercial food waste hauling fees": "Solid Waste Management Rules 2026 compliance documentation",
}

with open("src/pages/LandingPage.tsx", "r") as f:
    content = f.read()

count = 0
for old, new in replacements.items():
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"Replaced: {old}")
    else:
        print(f"Not found: {old}")

if count > 0:
    with open("src/pages/LandingPage.tsx", "w") as f:
        f.write(content)
    print(f"Saved {count} replacements.")
else:
    print("No changes made.")

