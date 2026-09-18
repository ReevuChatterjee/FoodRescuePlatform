import re

with open("src/pages/LandingPage.tsx", "r") as f:
    content = f.read()

# Replace the micro-strip on the left and the dispatch visual on the right
hero_pattern = re.compile(
    r'\{/\* Metric micro-strip — live data from API \*/\}.*?\{/\* ── Section A: Closed Loop Workflow ── \*/\}',
    re.DOTALL
)

new_hero = '''
              {/* Right: Live Data Grid */}
            </div>
            <div className="lg:col-span-6 w-full">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                  <span className="section-label block mb-2 text-moss">Active Deliveries</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--moss)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {stats?.active_deliveries != null ? stats.active_deliveries : '—'}
                  </span>
                </div>
                <div className="p-6 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                  <span className="section-label block mb-2 text-terracotta">Active Donations</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--terracotta)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {stats?.active_donations != null ? stats.active_donations : '—'}
                  </span>
                </div>
                <div className="p-6 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                  <span className="section-label block mb-2 text-text-primary">Rescued (kg)</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {stats?.total_food_rescued_kg != null ? stats.total_food_rescued_kg.toFixed(0) : '—'}
                  </span>
                </div>
                <div className="p-6 rounded-xl" style={{ background: '#ffffff', border: '1px solid var(--border-hair)', boxShadow: '0 2px 4px rgba(24,29,26,0.04)' }}>
                  <span className="section-label block mb-2 text-text-secondary">Network Nodes</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-secondary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {stats?.registered_donors != null ? stats.registered_donors : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section A: Closed Loop Workflow ── */}'''

content = hero_pattern.sub(new_hero.strip(), content)

# Remove Section C
dispatch_pattern = re.compile(
    r'\{/\* ── Section C: Manifest Dispatch Console ── \*/\}.*?\{/\* ── Section D: Traceability & Legal Trust ── \*/\}',
    re.DOTALL
)

content = dispatch_pattern.sub('{/* ── Section D: Traceability & Legal Trust ── */}', content)

with open("src/pages/LandingPage.tsx", "w") as f:
    f.write(content)

print("Updated LandingPage.tsx")
