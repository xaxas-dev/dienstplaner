// Variant A — "Atelier"
// Warm editorial: Newsreader serif headings + Geist sans UI.
// Pastel shift chips, generous spacing, rounded soft cards.
// Top-bar nav (no sidebar) to keep mouse travel short.

const A_PALETTE = {
  paper:   '#F6F1E6',  // page bg
  card:    '#FFFCF5',  // card bg
  ink:     '#26221C',
  ink2:    '#5C544A',
  ink3:    '#8A8275',
  line:    '#E8E0CF',
  line2:   '#D6CCB6',
  accent:  '#C66A3D',  // terracotta accent
  warn:    '#B85B22',
  ok:      '#5A7A3A',
};

// ────────────────────────────────────────────────────────────
// Shared bits
// ────────────────────────────────────────────────────────────
function A_TopBar({ active }) {
  const items = ['Heute', 'Plan', 'Ärzte', 'Stationen', 'Schichten', 'Regeln'];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '14px 28px', borderBottom: `1px solid ${A_PALETTE.line}`,
      background: A_PALETTE.paper, position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginRight: 36 }}>
        <span style={{
          fontFamily: 'Newsreader, serif', fontStyle: 'italic',
          fontSize: 22, fontWeight: 500, color: A_PALETTE.ink, letterSpacing: '-0.01em',
        }}>Dienstplaner</span>
        <span style={{ fontSize: 11, color: A_PALETTE.ink3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Neurologie · UKSH Lübeck
        </span>
      </div>
      <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
        {items.map(label => (
          <div key={label} style={{
            padding: '7px 14px', borderRadius: 999, fontSize: 14,
            color: label === active ? A_PALETTE.ink : A_PALETTE.ink2,
            background: label === active ? '#FFFCF5' : 'transparent',
            border: label === active ? `1px solid ${A_PALETTE.line2}` : '1px solid transparent',
            fontWeight: label === active ? 500 : 400,
            cursor: 'default',
          }}>{label}</div>
        ))}
      </nav>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px 6px 10px',
        borderRadius: 999, background: '#FFFCF5', border: `1px solid ${A_PALETTE.line2}`,
        fontSize: 13, color: A_PALETTE.ink2, minWidth: 220,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <span style={{ flex: 1 }}>Suchen oder Befehl…</span>
        <span style={{ fontSize: 11, color: A_PALETTE.ink3, fontFamily: 'monospace' }}>⌘K</span>
      </div>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', marginLeft: 12,
        background: '#E8DCC4', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: A_PALETTE.ink, fontWeight: 500,
      }}>SW</div>
    </div>
  );
}

function A_ShiftChip({ code, size = 'md' }) {
  const D = window.DP_DATA;
  if (!code || code === 'FR') {
    return <span style={{ color: '#CFC7B0' }}>—</span>;
  }
  const st = D.shiftTypes[code];
  if (!st) return null;
  const p = D.shiftPalette[st.color];
  const compact = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: compact ? '2px 7px' : '3px 9px',
      borderRadius: 999, background: p.bg, color: p.fg,
      fontSize: compact ? 11 : 12, fontWeight: 500,
      lineHeight: 1.2, fontVariantNumeric: 'tabular-nums',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.dot }} />
      {st.code}
    </span>
  );
}

function A_Avatar({ doc, size = 36 }) {
  const bg = `oklch(0.86 0.08 ${doc.hue})`;
  const fg = `oklch(0.32 0.12 ${doc.hue})`;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 600, letterSpacing: '0.02em',
      flexShrink: 0,
    }}>{doc.initials}</div>
  );
}

// ────────────────────────────────────────────────────────────
// A1 — Dashboard / Heute
// ────────────────────────────────────────────────────────────
function VariantA_Dashboard() {
  const D = window.DP_DATA;
  // Today = day index 7 (Mo 11.05.2026)
  const today = D.days[7];
  const todayAssignments = Object.entries(D.schedule).map(([id, arr]) => ({
    doc: D.doctors.find(d => d.id === Number(id)),
    code: arr[today.idx],
  })).filter(a => a.code && a.code !== 'U' && a.code !== 'FR');

  // Group today by shift
  const byShift = todayAssignments.reduce((acc, a) => {
    (acc[a.code] = acc[a.code] || []).push(a.doc);
    return acc;
  }, {});
  const shiftOrder = ['F','S','N','I','B','A','K'];

  return (
    <div style={{
      width: 1440, height: 900, background: A_PALETTE.paper,
      fontFamily: 'Geist, ui-sans-serif, sans-serif', color: A_PALETTE.ink,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <A_TopBar active="Heute" />

      <div style={{ flex: 1, padding: '28px 40px', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 28 }}>
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          {/* Greeting + date */}
          <div>
            <div style={{ fontSize: 12, color: A_PALETTE.ink3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Montag · 11. Mai 2026 · KW 19
            </div>
            <h1 style={{
              fontFamily: 'Newsreader, serif', fontWeight: 400, fontSize: 38,
              margin: '6px 0 0', letterSpacing: '-0.02em', color: A_PALETTE.ink,
            }}>
              Guten Morgen, Sarah. <span style={{ fontStyle: 'italic', color: A_PALETTE.accent }}>Heute</span> sind 9 von 12 Ärzten eingeteilt.
            </h1>
          </div>

          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { v: '96%', l: 'Abdeckung', sub: 'Diese Woche' },
              { v: '4',   l: 'Offene Schichten', sub: 'KW 20' },
              { v: '2',   l: 'Regelkonflikte', sub: 'klick zum Lösen', warn: true },
              { v: '3',   l: 'Im Urlaub', sub: 'aktuell' },
            ].map((k, i) => (
              <div key={i} style={{
                background: A_PALETTE.card, borderRadius: 14, padding: '14px 16px',
                border: `1px solid ${A_PALETTE.line}`,
              }}>
                <div style={{
                  fontFamily: 'Newsreader, serif', fontSize: 32, fontWeight: 400,
                  color: k.warn ? A_PALETTE.warn : A_PALETTE.ink, letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}>{k.v}</div>
                <div style={{ fontSize: 13, marginTop: 8, color: A_PALETTE.ink }}>{k.l}</div>
                <div style={{ fontSize: 11, marginTop: 2, color: A_PALETTE.ink3 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Today by shift */}
          <div style={{
            background: A_PALETTE.card, borderRadius: 16, border: `1px solid ${A_PALETTE.line}`,
            padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'Newsreader, serif', fontWeight: 400, fontSize: 22, margin: 0, letterSpacing: '-0.01em' }}>
                Heute im Dienst
              </h2>
              <span style={{ fontSize: 12, color: A_PALETTE.ink3 }}>{todayAssignments.length} Einteilungen</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {shiftOrder.filter(s => byShift[s]).map(code => {
                const st = D.shiftTypes[code];
                const p = D.shiftPalette[st.color];
                return (
                  <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 92, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.dot }} />
                      <span style={{ fontSize: 13, color: A_PALETTE.ink }}>{st.name}</span>
                    </div>
                    <div style={{
                      fontSize: 11, fontVariantNumeric: 'tabular-nums',
                      color: A_PALETTE.ink3, width: 80, fontFamily: 'monospace',
                    }}>
                      {st.from && st.to ? `${st.from}–${st.to}` : ''}
                    </div>
                    <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {byShift[code].map(doc => (
                        <div key={doc.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '3px 10px 3px 3px', borderRadius: 999,
                          background: '#FAF5E9', border: `1px solid ${A_PALETTE.line}`,
                        }}>
                          <A_Avatar doc={doc} size={20} />
                          <span style={{ fontSize: 12, color: A_PALETTE.ink }}>{doc.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          {/* Alerts */}
          <div style={{
            background: A_PALETTE.card, borderRadius: 16, border: `1px solid ${A_PALETTE.line}`,
            padding: '18px 20px',
          }}>
            <h2 style={{ fontFamily: 'Newsreader, serif', fontWeight: 400, fontSize: 22, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
              Aufmerksamkeit
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {D.events.map((e, i) => {
                const dotColor = e.kind === 'error' ? A_PALETTE.warn : e.kind === 'warn' ? '#C99540' : A_PALETTE.ink3;
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, marginTop: 7, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: A_PALETTE.ink }}>
                        <span style={{ fontWeight: 500 }}>{e.who}</span> · {e.what}
                      </div>
                      <div style={{ fontSize: 11, color: A_PALETTE.ink3, fontVariantNumeric: 'tabular-nums' }}>{e.date}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coverage by station */}
          <div style={{
            background: A_PALETTE.card, borderRadius: 16, border: `1px solid ${A_PALETTE.line}`,
            padding: '18px 20px',
          }}>
            <h2 style={{ fontFamily: 'Newsreader, serif', fontWeight: 400, fontSize: 22, margin: '0 0 14px', letterSpacing: '-0.01em' }}>
              Abdeckung KW 19
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { name: 'Station N1', pct: 100 },
                { name: 'Station N2', pct: 100 },
                { name: 'Stroke Unit', pct: 95 },
                { name: 'INA',         pct: 90 },
                { name: 'Ambulanz',    pct: 80 },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{s.name}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: s.pct < 90 ? A_PALETTE.warn : A_PALETTE.ink3 }}>
                      {s.pct}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: A_PALETTE.line, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${s.pct}%`, height: '100%',
                      background: s.pct < 90 ? A_PALETTE.warn : A_PALETTE.ok,
                      borderRadius: 4,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick action */}
          <div style={{
            background: A_PALETTE.ink, borderRadius: 16, padding: '18px 20px',
            color: '#FBF6E8', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 18 }}>
                Mai-Plan starten
              </div>
              <div style={{ fontSize: 12, color: '#D9CFB6', marginTop: 4 }}>
                4 offene Schichten · Vorschlag bereit
              </div>
            </div>
            <div style={{
              background: A_PALETTE.accent, color: '#FFF8EF', padding: '8px 16px',
              borderRadius: 999, fontSize: 13, fontWeight: 500,
            }}>
              Generieren →
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// A2 — Plan (Monatsansicht)
// ────────────────────────────────────────────────────────────
function VariantA_Plan() {
  const D = window.DP_DATA;
  // Sort doctors by role priority
  const order = [4, 6, 1, 9, 3, 12, 7, 2, 11, 5, 8, 10];
  const sorted = order.map(id => D.doctors.find(d => d.id === id)).filter(Boolean);

  const DAY_W = 36;
  const ROW_H = 36;
  const NAME_W = 184;

  return (
    <div style={{
      width: 1440, height: 900, background: A_PALETTE.paper,
      fontFamily: 'Geist, ui-sans-serif, sans-serif', color: A_PALETTE.ink,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <A_TopBar active="Plan" />

      {/* Plan header bar */}
      <div style={{
        padding: '18px 40px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <h1 style={{
            fontFamily: 'Newsreader, serif', fontWeight: 400, fontSize: 32,
            margin: 0, letterSpacing: '-0.02em',
          }}>
            <span style={{ fontStyle: 'italic', color: A_PALETTE.accent }}>Mai</span> 2026
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
            <button style={{
              width: 28, height: 28, borderRadius: 8, background: A_PALETTE.card,
              border: `1px solid ${A_PALETTE.line}`, color: A_PALETTE.ink2, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>‹</button>
            <button style={{
              width: 28, height: 28, borderRadius: 8, background: A_PALETTE.card,
              border: `1px solid ${A_PALETTE.line}`, color: A_PALETTE.ink2, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>›</button>
          </div>
          <div style={{ fontSize: 13, color: A_PALETTE.ink3 }}>
            KW 19 – KW 22 · 28 Tage · 12 Ärzte
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* segmented view switcher */}
          <div style={{
            display: 'flex', background: A_PALETTE.card, padding: 3, borderRadius: 999,
            border: `1px solid ${A_PALETTE.line}`, fontSize: 12,
          }}>
            {['Monat', 'Woche', 'Tag', 'Person'].map((v, i) => (
              <div key={v} style={{
                padding: '5px 12px', borderRadius: 999, color: i === 0 ? '#FFF8EF' : A_PALETTE.ink2,
                background: i === 0 ? A_PALETTE.ink : 'transparent',
                fontWeight: i === 0 ? 500 : 400, cursor: 'default',
              }}>{v}</div>
            ))}
          </div>
          <button style={{
            padding: '7px 14px', borderRadius: 999, background: A_PALETTE.card,
            border: `1px solid ${A_PALETTE.line2}`, fontSize: 13, color: A_PALETTE.ink2, cursor: 'pointer',
          }}>Filter</button>
          <button style={{
            padding: '7px 14px', borderRadius: 999, background: A_PALETTE.accent,
            border: 'none', fontSize: 13, color: '#FFF8EF', fontWeight: 500, cursor: 'pointer',
          }}>+ Schicht</button>
        </div>
      </div>

      {/* Plan grid */}
      <div style={{
        flex: 1, margin: '0 40px 28px', background: A_PALETTE.card,
        borderRadius: 18, border: `1px solid ${A_PALETTE.line}`, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Day header */}
        <div style={{
          display: 'grid', gridTemplateColumns: `${NAME_W}px repeat(28, ${DAY_W}px) 1fr`,
          borderBottom: `1px solid ${A_PALETTE.line}`, fontSize: 11,
          background: '#FAF5E9',
        }}>
          <div style={{ padding: '10px 14px', color: A_PALETTE.ink3, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Arzt</div>
          {D.days.map(d => (
            <div key={d.idx} style={{
              padding: '6px 0', textAlign: 'center', borderLeft: `1px solid ${A_PALETTE.line}`,
              color: d.isWeekend ? A_PALETTE.ink3 : A_PALETTE.ink2,
              background: d.isWeekend ? '#F3ECD8' : 'transparent',
            }}>
              <div style={{ fontSize: 10, opacity: 0.7 }}>{d.dowLabel}</div>
              <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 500 }}>{d.day}</div>
            </div>
          ))}
          <div />
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {sorted.map(doc => (
            <div key={doc.id} style={{
              display: 'grid', gridTemplateColumns: `${NAME_W}px repeat(28, ${DAY_W}px) 1fr`,
              borderBottom: `1px solid ${A_PALETTE.line}`, height: ROW_H,
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', minWidth: 0 }}>
                <A_Avatar doc={doc} size={24} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: A_PALETTE.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                  <div style={{ fontSize: 10, color: A_PALETTE.ink3 }}>{doc.role}</div>
                </div>
              </div>
              {D.schedule[doc.id].map((code, i) => {
                const d = D.days[i];
                const st = D.shiftTypes[code];
                const p = st ? D.shiftPalette[st.color] : null;
                const isEmpty = !code || code === 'FR';
                return (
                  <div key={i} style={{
                    height: '100%', borderLeft: `1px solid ${A_PALETTE.line}`,
                    background: d.isWeekend && isEmpty ? '#F3ECD8' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 3,
                  }}>
                    {!isEmpty && (
                      <div style={{
                        width: '100%', height: '100%', borderRadius: 6,
                        background: p.bg, color: p.fg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 600,
                      }}>{st.code}</div>
                    )}
                  </div>
                );
              })}
              <div />
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 16, padding: '12px 18px', borderTop: `1px solid ${A_PALETTE.line}`,
          background: '#FAF5E9', alignItems: 'center', fontSize: 11, color: A_PALETTE.ink3,
        }}>
          <span style={{ letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 8 }}>Legende</span>
          {['F','S','N','I','B','A','K'].map(c => {
            const st = D.shiftTypes[c]; const p = D.shiftPalette[st.color];
            return (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 18, height: 18, borderRadius: 5, background: p.bg, color: p.fg,
                  fontSize: 10, fontWeight: 600,
                }}>{c}</span>
                <span style={{ color: A_PALETTE.ink2 }}>{st.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// A3 — Ärzte (Person-Karten statt Tabelle)
// ────────────────────────────────────────────────────────────
function VariantA_Doctors() {
  const D = window.DP_DATA;
  return (
    <div style={{
      width: 1440, height: 900, background: A_PALETTE.paper,
      fontFamily: 'Geist, ui-sans-serif, sans-serif', color: A_PALETTE.ink,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <A_TopBar active="Ärzte" />

      <div style={{ padding: '24px 40px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h1 style={{
            fontFamily: 'Newsreader, serif', fontWeight: 400, fontSize: 32,
            margin: 0, letterSpacing: '-0.02em',
          }}>
            <span style={{ fontStyle: 'italic' }}>Team</span> · 12 Ärzte
          </h1>
          <div style={{ fontSize: 13, color: A_PALETTE.ink3, marginTop: 4 }}>
            10 intern · 1 extern · 1 im Mutterschutz
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Alle', 'Fachärzte', 'WBA', 'Extern'].map((f, i) => (
            <div key={f} style={{
              padding: '6px 14px', borderRadius: 999, fontSize: 13,
              background: i === 0 ? A_PALETTE.ink : A_PALETTE.card,
              color: i === 0 ? '#FFF8EF' : A_PALETTE.ink2,
              border: `1px solid ${i === 0 ? A_PALETTE.ink : A_PALETTE.line2}`,
              cursor: 'default',
            }}>{f}</div>
          ))}
          <button style={{
            marginLeft: 12, padding: '7px 14px', borderRadius: 999, background: A_PALETTE.accent,
            border: 'none', fontSize: 13, color: '#FFF8EF', fontWeight: 500, cursor: 'pointer',
          }}>+ Neuer Arzt</button>
        </div>
      </div>

      <div style={{
        flex: 1, padding: '20px 40px 28px', display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, overflow: 'hidden',
      }}>
        {D.doctors.map(doc => {
          // Compute hours/leave proxy from schedule
          const sched = D.schedule[doc.id] || [];
          const shifts = sched.filter(c => c && c !== 'U' && c !== 'FR').length;
          const urlaub = sched.filter(c => c === 'U').length;
          return (
            <div key={doc.id} style={{
              background: A_PALETTE.card, borderRadius: 16, border: `1px solid ${A_PALETTE.line}`,
              padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
              position: 'relative', minWidth: 0,
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <A_Avatar doc={doc} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'Newsreader, serif', fontSize: 19, fontWeight: 400,
                    color: A_PALETTE.ink, letterSpacing: '-0.01em', lineHeight: 1.15,
                  }}>{doc.name}</div>
                  <div style={{ fontSize: 12, color: A_PALETTE.ink3, marginTop: 3 }}>
                    {doc.role} · {doc.pct}% {doc.type === 'EXTERNAL' && '· extern'}
                  </div>
                </div>
                {doc.leave && (
                  <span style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 999,
                    background: '#F2CFD3', color: '#6B1E2A', fontWeight: 500,
                  }}>{doc.leave}</span>
                )}
              </div>

              {/* Quals */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 22 }}>
                {doc.qual.length === 0 && (
                  <span style={{ fontSize: 11, color: A_PALETTE.ink3, fontStyle: 'italic' }}>Keine Zusatzqualifikation</span>
                )}
                {doc.qual.map(q => (
                  <span key={q} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 999,
                    background: '#F3ECD8', color: A_PALETTE.ink2,
                    border: `1px solid ${A_PALETTE.line2}`,
                  }}>{q}</span>
                ))}
              </div>

              {/* mini sparkline of next 14 days */}
              <div>
                <div style={{ fontSize: 10, color: A_PALETTE.ink3, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Nächste 14 Tage
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {sched.slice(0, 14).map((code, i) => {
                    const st = D.shiftTypes[code];
                    const p = st ? D.shiftPalette[st.color] : null;
                    const empty = !code || code === 'FR';
                    return (
                      <div key={i} title={st ? st.name : 'Frei'} style={{
                        flex: 1, height: 22, borderRadius: 4,
                        background: empty ? '#F3ECD8' : p.bg,
                        color: empty ? '#CFC7B0' : p.fg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 600,
                      }}>{empty ? '' : st.code}</div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${A_PALETTE.line}`, paddingTop: 10, marginTop: 'auto' }}>
                <div style={{ fontSize: 11, color: A_PALETTE.ink3 }}>
                  <span style={{ color: A_PALETTE.ink, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{shifts}</span> Dienste · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{urlaub}</span> Urlaub
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 11, color: A_PALETTE.accent, fontWeight: 500 }}>Details →</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.VariantA_Dashboard = VariantA_Dashboard;
window.VariantA_Plan = VariantA_Plan;
window.VariantA_Doctors = VariantA_Doctors;
