// Variant A2+ — A's warm editorial look applied to B's plan layout.
// Mini-rail · top command bar · filter chips · KPI bar with sparkline ·
// right context pane · in-cell conflict highlight.
// Aesthetic strictly from A: Newsreader serif, Geist UI, cream/terracotta.

const AB_P = {
  paper:   '#F6F1E6',
  card:    '#FFFCF5',
  ink:     '#26221C',
  ink2:    '#5C544A',
  ink3:    '#8A8275',
  line:    '#E8E0CF',
  line2:   '#D6CCB6',
  accent:  '#C66A3D',
  accent2: '#E69E66',
  ok:      '#5A7A3A',
  warn:    '#B85B22',
};

function AB_Rail({ d, active }) {
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 12, cursor: 'default',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? AB_P.ink : 'transparent',
      color: active ? '#FBF6E8' : AB_P.ink2,
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
    </div>
  );
}

function AB_Chip({ children, active, accent }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 12px', borderRadius: 999, fontSize: 12,
      background: active ? AB_P.ink : (accent ? '#FBE5D6' : AB_P.card),
      color: active ? '#FBF6E8' : (accent ? '#7A3414' : AB_P.ink2),
      border: `1px solid ${active ? AB_P.ink : (accent ? '#F0C3A2' : AB_P.line2)}`,
      fontWeight: 500,
    }}>{children}</span>
  );
}

function AB_Avatar({ doc, size = 24 }) {
  const bg = `oklch(0.86 0.08 ${doc.hue})`;
  const fg = `oklch(0.32 0.12 ${doc.hue})`;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600, flexShrink: 0, letterSpacing: '0.02em',
    }}>{doc.initials}</div>
  );
}

function VariantAB_Plan() {
  const D = window.DP_DATA;
  const order = [4, 6, 1, 9, 3, 12, 7, 2, 11, 5, 8, 10];
  const sorted = order.map(id => D.doctors.find(d => d.id === id)).filter(Boolean);

  const DAY_W = 44;
  const visibleDays = D.days.slice(0, 14);
  const ROW_H = 42;
  const NAME_W = 210;

  const coverage = visibleDays.map(d => {
    let needed = 8, filled = 0;
    Object.values(D.schedule).forEach(arr => {
      const c = arr[d.idx];
      if (c && c !== 'U' && c !== 'FR') filled += 1;
    });
    return Math.min(100, Math.round((filled / needed) * 100));
  });

  return (
    <div style={{
      width: 1440, height: 900, background: AB_P.paper,
      fontFamily: 'Geist, ui-sans-serif, sans-serif',
      color: AB_P.ink, overflow: 'hidden', display: 'flex',
    }}>
      {/* Left mini rail */}
      <div style={{
        width: 60, background: AB_P.card, borderRight: `1px solid ${AB_P.line}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: 6,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12, background: AB_P.accent,
          color: '#FFF8EF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontWeight: 500, fontSize: 18,
        }}>D</div>
        <div style={{ width: 24, height: 1, background: AB_P.line, margin: '8px 0' }} />
        <AB_Rail d="M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <AB_Rail active d="M3 12h18M3 6h18M3 18h18" />
        <AB_Rail d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
        <AB_Rail d="M3 9.5h18M3 14.5h18M9 4v16M15 4v16" />
        <AB_Rail d="M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        <AB_Rail d="M12 2 15.09 8.26 22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
        <div style={{ flex: 1 }} />
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E8DCC4', color: AB_P.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500 }}>SW</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top command bar */}
        <div style={{
          padding: '14px 24px', borderBottom: `1px solid ${AB_P.line}`,
          display: 'flex', alignItems: 'center', gap: 14, background: AB_P.paper,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{
              fontFamily: 'Newsreader, serif', fontWeight: 400, fontSize: 24,
              letterSpacing: '-0.02em', color: AB_P.ink,
            }}>
              <span style={{ fontStyle: 'italic', color: AB_P.accent }}>Mai</span> 2026
            </span>
            <span style={{ fontSize: 13, color: AB_P.ink3 }}>· KW 19–20 · 12 Ärzte</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
            <button style={{ width: 28, height: 28, borderRadius: 8, background: AB_P.card, border: `1px solid ${AB_P.line}`, color: AB_P.ink2, cursor: 'pointer' }}>‹</button>
            <button style={{ width: 28, height: 28, borderRadius: 8, background: AB_P.card, border: `1px solid ${AB_P.line}`, color: AB_P.ink2, cursor: 'pointer' }}>›</button>
          </div>
          <div style={{ width: 1, height: 22, background: AB_P.line, margin: '0 4px' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <AB_Chip active>2 Wochen</AB_Chip>
            <AB_Chip>Alle Stationen</AB_Chip>
            <AB_Chip>Alle Schichten</AB_Chip>
            <AB_Chip accent>2 Konflikte</AB_Chip>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
            border: `1px solid ${AB_P.line2}`, borderRadius: 999, background: AB_P.card,
            fontSize: 13, color: AB_P.ink3, minWidth: 260,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <span style={{ flex: 1 }}>"krüger nacht 12.5" oder Befehl …</span>
            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>⌘K</span>
          </div>
          <button style={{
            padding: '8px 16px', borderRadius: 999, border: 'none', background: AB_P.accent,
            color: '#FFF8EF', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>Plan generieren</button>
        </div>

        {/* KPI sub-bar */}
        <div style={{
          padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 24,
          borderBottom: `1px solid ${AB_P.line}`, background: AB_P.card,
          fontSize: 12, color: AB_P.ink2,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: 'Newsreader, serif', fontSize: 22, fontWeight: 400, color: AB_P.ink, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>96%</span>
            <span>Abdeckung</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22 }}>
            {coverage.map((v, i) => (
              <div key={i} style={{
                width: 5, height: `${Math.max(6, v / 100 * 22)}px`,
                background: v < 80 ? AB_P.warn : AB_P.accent2,
                borderRadius: 2,
              }} />
            ))}
          </div>
          <div style={{ width: 1, height: 18, background: AB_P.line }} />
          <div><span style={{ fontFamily: 'Newsreader, serif', fontSize: 18, color: AB_P.ink, fontVariantNumeric: 'tabular-nums', marginRight: 4 }}>4</span> offen</div>
          <div><span style={{ fontFamily: 'Newsreader, serif', fontSize: 18, color: AB_P.warn, fontVariantNumeric: 'tabular-nums', marginRight: 4 }}>2</span> Konflikte</div>
          <div><span style={{ fontFamily: 'Newsreader, serif', fontSize: 18, color: AB_P.ink, fontVariantNumeric: 'tabular-nums', marginRight: 4 }}>9</span> heute im Dienst</div>
          <div><span style={{ fontFamily: 'Newsreader, serif', fontSize: 18, color: AB_P.ink, fontVariantNumeric: 'tabular-nums', marginRight: 4 }}>312</span> Std diese Woche</div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {['Plan', 'Wunsch', 'Konflikte', 'Bilanz'].map((t, i) => (
              <span key={t} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 12,
                background: i === 0 ? '#FBE5D6' : 'transparent',
                color: i === 0 ? '#7A3414' : AB_P.ink3,
                fontWeight: i === 0 ? 500 : 400,
                border: i === 0 ? '1px solid #F0C3A2' : '1px solid transparent',
              }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Grid + context */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: AB_P.card }}>
            <div style={{
              display: 'grid', gridTemplateColumns: `${NAME_W}px repeat(14, ${DAY_W}px) 1fr`,
              borderBottom: `1px solid ${AB_P.line}`, background: '#FAF5E9',
            }}>
              <div style={{ padding: '10px 14px', fontSize: 11, color: AB_P.ink3, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>Arzt</div>
              {visibleDays.map(d => {
                const isToday = d.idx === 7;
                return (
                  <div key={d.idx} style={{
                    padding: '7px 0', textAlign: 'center', borderLeft: `1px solid ${AB_P.line}`,
                    background: isToday ? '#FBE5D6' : (d.isWeekend ? '#F3ECD8' : 'transparent'),
                  }}>
                    <div style={{ fontSize: 10, color: AB_P.ink3 }}>{d.dowLabel}</div>
                    <div style={{ fontFamily: 'Newsreader, serif', fontSize: 16, color: isToday ? '#7A3414' : AB_P.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{d.day}</div>
                  </div>
                );
              })}
              <div />
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
              {sorted.map((doc, ri) => {
                const selected = doc.id === 2;
                return (
                  <div key={doc.id} style={{
                    display: 'grid', gridTemplateColumns: `${NAME_W}px repeat(14, ${DAY_W}px) 1fr`,
                    borderBottom: `1px solid ${AB_P.line}`, height: ROW_H,
                    alignItems: 'center', background: selected ? '#FAF0DC' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', minWidth: 0 }}>
                      <AB_Avatar doc={doc} size={26} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                        <div style={{ fontSize: 10, color: AB_P.ink3 }}>{doc.role} · {doc.pct}%</div>
                      </div>
                    </div>
                    {visibleDays.map((d, i) => {
                      const code = D.schedule[doc.id][d.idx];
                      const st = D.shiftTypes[code];
                      const p = st ? D.shiftPalette[st.color] : null;
                      const isEmpty = !code || code === 'FR';
                      const isToday = d.idx === 7;
                      const isConflict = doc.id === 2 && d.idx === 8;
                      return (
                        <div key={i} style={{
                          height: '100%', borderLeft: `1px solid ${AB_P.line}`,
                          background: isToday ? 'rgba(251,229,214,0.4)' : (d.isWeekend && isEmpty ? '#F3ECD8' : 'transparent'),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: 3, position: 'relative',
                        }}>
                          {!isEmpty && (
                            <div style={{
                              width: '100%', height: '100%', borderRadius: 7,
                              background: p.bg, color: p.fg,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 600,
                              border: isConflict ? `1.5px solid ${AB_P.warn}` : 'none',
                            }}>{st.code}</div>
                          )}
                          {isConflict && (
                            <div style={{
                              position: 'absolute', top: -2, right: -2,
                              width: 11, height: 11, borderRadius: '50%',
                              background: AB_P.warn, color: 'white',
                              fontSize: 8, fontWeight: 700, lineHeight: '11px',
                              textAlign: 'center', border: `1.5px solid ${AB_P.paper}`,
                            }}>!</div>
                          )}
                        </div>
                      );
                    })}
                    <div />
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{
              display: 'flex', gap: 14, padding: '10px 18px', borderTop: `1px solid ${AB_P.line}`,
              background: '#FAF5E9', alignItems: 'center', fontSize: 11, color: AB_P.ink3,
            }}>
              <span style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Legende</span>
              {['F','S','N','I','B','A','K'].map(c => {
                const st = D.shiftTypes[c]; const p = D.shiftPalette[st.color];
                return (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 17, height: 17, borderRadius: 5, background: p.bg, color: p.fg, fontSize: 10, fontWeight: 600 }}>{c}</span>
                    <span style={{ color: AB_P.ink2 }}>{st.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right context pane */}
          <div style={{
            width: 290, borderLeft: `1px solid ${AB_P.line}`,
            background: AB_P.paper, padding: '18px 20px',
            display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden',
          }}>
            <div>
              <div style={{ fontSize: 10, color: AB_P.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>Ausgewählt</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <AB_Avatar doc={D.doctors[1]} size={40} />
                <div>
                  <div style={{ fontFamily: 'Newsreader, serif', fontSize: 19, fontWeight: 400, letterSpacing: '-0.01em', lineHeight: 1.15 }}>Lukas Holm</div>
                  <div style={{ fontSize: 12, color: AB_P.ink3, marginTop: 2 }}>WBJ 3 · 100% · intern</div>
                </div>
              </div>
            </div>

            <div style={{ background: '#FBE5D6', border: `1px solid #F0C3A2`, borderRadius: 14, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 500, color: '#7A3414' }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', background: AB_P.warn, color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>!</span>
                Regelkonflikt · 12.05.
              </div>
              <div style={{ fontSize: 12, color: '#5A2710', marginTop: 8, lineHeight: 1.55 }}>
                Nach Nachtdienst nur <strong>9h Ruhe</strong> bis Frühdienst. ArbZG verlangt mind. 11h.
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <span style={{ padding: '5px 12px', borderRadius: 999, background: AB_P.ink, color: '#FBF6E8', fontSize: 11, fontWeight: 500 }}>Vorschlag</span>
                <span style={{ padding: '5px 12px', borderRadius: 999, background: AB_P.card, color: AB_P.ink2, border: `1px solid ${AB_P.line2}`, fontSize: 11 }}>Ignorieren</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: AB_P.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>Stunden Mai</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                <span style={{ fontFamily: 'Newsreader, serif', fontSize: 30, fontWeight: 400, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>168</span>
                <span style={{ fontSize: 13, color: AB_P.ink3 }}>/ 168 Soll</span>
              </div>
              <div style={{ height: 4, background: AB_P.line, borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: AB_P.ok }} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: AB_P.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 8 }}>Schichten Mai</div>
              {[
                { code: 'F', n: 8 }, { code: 'S', n: 5 }, { code: 'N', n: 3 }, { code: 'B', n: 0 },
              ].map(r => {
                const st = D.shiftTypes[r.code]; const p = D.shiftPalette[st.color];
                return (
                  <div key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: p.bg, color: p.fg, fontWeight: 600, fontSize: 11 }}>{r.code}</span>
                    <span style={{ flex: 1 }}>{st.name}</span>
                    <span style={{ fontFamily: 'Newsreader, serif', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{r.n}</span>
                  </div>
                );
              })}
            </div>

            <div>
              <div style={{ fontSize: 10, color: AB_P.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 8 }}>Wünsche</div>
              <div style={{ fontSize: 12, color: AB_P.ink2, padding: '10px 12px', background: AB_P.card, borderRadius: 10, border: `1px solid ${AB_P.line}` }}>
                <div>15.05. → <strong>kein N</strong></div>
                <div style={{ color: AB_P.ink3, marginTop: 2 }}>23.–26.05. Urlaub</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.VariantAB_Plan = VariantAB_Plan;
