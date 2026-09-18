import re

with open("src/pages/LandingPage.tsx", "r") as f:
    content = f.read()

# Replace LIFECYCLE_STEPS
old_lifecycle = r"const LIFECYCLE_STEPS = \[\s*\{.*?\}\s*\];"
new_lifecycle = """const LIFECYCLE_STEPS = [
  {
    step: '01',
    icon: 'inventory_2',
    label: 'Donor Registers Surplus',
    desc: 'Donors log food type, quantity, preparation time, availability window, and expiry/use-by time directly into the real-time system.',
    tag: 'Real-time surplus registration',
  },
  {
    step: '02',
    icon: 'alt_route',
    label: 'Constraint-Based Matching',
    desc: 'The engine evaluates feasible NGOs by weighing storage capacity, shelf life, transit time, current demand, and route efficiency.',
    tag: 'Explainable 5-factor scoring',
  },
  {
    step: '03',
    icon: 'local_shipping',
    label: 'Live Routing & Dispatch',
    desc: 'Upon NGO acceptance, an available driver is assigned and routed using live traffic data, distance, and estimated travel time.',
    tag: 'WebSocket real-time updates',
  },
  {
    step: '04',
    icon: 'history_edu',
    label: 'Digital Handover & Audit',
    desc: 'Immutable digital sign-off from both parties at handover, ensuring documentation for FSSAI and Solid Waste Management Rules compliance.',
    tag: 'Immutable audit record',
  },
];"""
content = re.sub(old_lifecycle, new_lifecycle, content, flags=re.DOTALL)

# Replace TRUST_PILLARS
old_trust = r"const TRUST_PILLARS = \[\s*\{.*?\}\s*\];"
new_trust = """const TRUST_PILLARS = [
  {
    icon: <ShieldCheck size={26} />,
    iconColor: 'text-[#004527]',
    iconBg: 'bg-[#004527]/10',
    title: 'FSSAI Traceability Record',
    desc: 'Maintains documentation and traceability records required under the FSSAI Surplus Food Regulations, 2019 without granting unwarranted legal immunity.',
    badge: 'FSSAI Traceability Compliant',
    badgeColor: 'text-[#181d1a]',
  },
  {
    icon: <Thermometer size={26} />,
    iconColor: 'text-[#a23e18]',
    iconBg: 'bg-[#a23e18]/10',
    title: 'Time-Sensitive Optimisation',
    desc: 'Mandatory shelf-life and transit-time calculations. The system evaluates whether food can be securely delivered and consumed before the expiry window closes.',
    badge: 'Zero Tolerance Spoilage Protocol',
    badgeColor: 'text-[#a23e18]',
  },
  {
    icon: <FileText size={26} />,
    iconColor: 'text-[#004527]',
    iconBg: 'bg-[#004527]/10',
    title: 'SWM Rules 2026 Compliance',
    desc: 'Every step — intake scan, driver custody transfer, and recipient kitchen verification — is timestamped, geolocated, and digitally signed, ensuring bulk waste generator accountability.',
    badge: 'Automated Audit Export Ready',
    badgeColor: 'text-[#181d1a]',
  },
];"""
content = re.sub(old_trust, new_trust, content, flags=re.DOTALL)

replacements = {
    "Bill Emerson Act Protected": "FSSAI Traceability Compliant",
    "Tax Deduction', val: 'IRC 170(e)(3)'": "Regulatory Compliance', val: 'SWM Rules 2026'",
    "USDA thermal log verified": "FSSAI guidelines compliant",
    "adherence to federal safe harbor statutes": "digital documentation and traceability",
    "Aligned with FDA Food Code standards": "Aligned with FSSAI Surplus Food Regulations",
    "Certified Good Samaritan Food Donation Act Compliant": "FSSAI Surplus Food Regulations 2019 Traceability",
    "tax compliance documentation and eliminate commercial food waste hauling fees": "Solid Waste Management Rules 2026 compliance documentation",
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open("src/pages/LandingPage.tsx", "w") as f:
    f.write(content)

print("Rewritten LandingPage.tsx")
