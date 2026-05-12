// Shared mock data for all Dienstplaner redesign variants.
// Realistic neurology team @ UKSH Lübeck.

window.DP_DATA = (function () {
  const doctors = [
    { id: 1,  initials: 'AB', name: 'Anna Berger',    role: 'Fachärztin', wbj: null, type: 'INTERNAL', pct: 100, hue: 12,  qual: ['EEG', 'Stroke', 'INA'] },
    { id: 2,  initials: 'LH', name: 'Lukas Holm',     role: 'WBJ 3',      wbj: 3,    type: 'INTERNAL', pct: 100, hue: 30,  qual: ['EEG'] },
    { id: 3,  initials: 'MS', name: 'Marie Schubert', role: 'WBJ 5',      wbj: 5,    type: 'INTERNAL', pct: 80,  hue: 50,  qual: ['EEG', 'Stroke'] },
    { id: 4,  initials: 'TK', name: 'Tobias Krüger',  role: 'Facharzt',   wbj: null, type: 'INTERNAL', pct: 100, hue: 145, qual: ['Stroke', 'INA', 'Notfall'] },
    { id: 5,  initials: 'SW', name: 'Sarah Wagner',   role: 'WBJ 2',      wbj: 2,    type: 'INTERNAL', pct: 100, hue: 175, qual: [] },
    { id: 6,  initials: 'JH', name: 'Jan Hoffmann',   role: 'Facharzt',   wbj: null, type: 'INTERNAL', pct: 75,  hue: 205, qual: ['Stroke', 'INA'] },
    { id: 7,  initials: 'LB', name: 'Lina Becker',    role: 'WBJ 4',      wbj: 4,    type: 'INTERNAL', pct: 100, hue: 230, qual: ['EEG', 'Stroke'] },
    { id: 8,  initials: 'PV', name: 'Paul Vogel',     role: 'WBJ 1',      wbj: 1,    type: 'INTERNAL', pct: 100, hue: 265, qual: [] },
    { id: 9,  initials: 'AR', name: 'Anika Reuter',   role: 'WBJ 6',      wbj: 6,    type: 'INTERNAL', pct: 100, hue: 295, qual: ['EEG', 'Stroke', 'INA'] },
    { id: 10, initials: 'KS', name: 'Dr. K. Schmidt', role: 'Konsiliar',  wbj: null, type: 'EXTERNAL', pct: 20,  hue: 340, qual: ['Konsil'] },
    { id: 11, initials: 'NE', name: 'Nora Engel',     role: 'WBJ 3',      wbj: 3,    type: 'INTERNAL', pct: 50,  hue: 90,  qual: ['EEG'], leave: 'Schwangerschaft' },
    { id: 12, initials: 'FM', name: 'Felix März',     role: 'WBJ 5',      wbj: 5,    type: 'INTERNAL', pct: 100, hue: 120, qual: ['Stroke', 'INA'] },
  ];

  // Shift type catalog
  const shiftTypes = {
    F:  { code: 'F',  name: 'Frühdienst',      from: '07:00', to: '15:30', color: 'peach' },
    S:  { code: 'S',  name: 'Spätdienst',      from: '13:00', to: '21:30', color: 'sage'  },
    N:  { code: 'N',  name: 'Nachtdienst',     from: '20:30', to: '07:30', color: 'plum'  },
    B:  { code: 'B',  name: 'Bereitschaft',    from: '16:30', to: '08:00', color: 'sky'   },
    I:  { code: 'I',  name: 'INA',             from: '07:30', to: '16:30', color: 'rose'  },
    K:  { code: 'K',  name: 'Konsil',          from: '08:00', to: '16:00', color: 'sand'  },
    A:  { code: 'A',  name: 'Ambulanz',        from: '08:00', to: '16:00', color: 'lemon' },
    U:  { code: 'U',  name: 'Urlaub',          from: '',      to: '',      color: 'grey'  },
    FR: { code: '—',  name: 'Frei',            from: '',      to: '',      color: 'none'  },
  };

  // Shift color tokens — pastel & warm. Each: bg / fg / dot
  const shiftPalette = {
    peach: { bg: '#FBE0CE', fg: '#7A3B14', dot: '#E08A5A', solid: '#E08A5A' },
    sage:  { bg: '#D9E5C9', fg: '#3F5527', dot: '#7A9E55', solid: '#7A9E55' },
    plum:  { bg: '#DDCFE3', fg: '#3D2A48', dot: '#7B5A92', solid: '#7B5A92' },
    sky:   { bg: '#CFDFE8', fg: '#1F4358', dot: '#5489A7', solid: '#5489A7' },
    rose:  { bg: '#F2CFD3', fg: '#6B1E2A', dot: '#C45766', solid: '#C45766' },
    sand:  { bg: '#EEDFC4', fg: '#5A4220', dot: '#B59052', solid: '#B59052' },
    lemon: { bg: '#F2E8B5', fg: '#5A4B14', dot: '#B8A33D', solid: '#B8A33D' },
    grey:  { bg: '#E0DED7', fg: '#55524A', dot: '#928D80', solid: '#928D80' },
    none:  { bg: 'transparent', fg: '#94918a', dot: '#cbc7be', solid: '#cbc7be' },
  };

  // Build a deterministic Mai-2026 plan (4 weeks). Each day has assignments.
  // We render Mon-Sun, KW 19-22 (covers 04.05 - 31.05.2026).
  const monthLabel = 'Mai 2026';

  // Deterministic schedule: doctorId → code per day index (0 = Mo 04.05.2026)
  // 28 days. Indices: 0=Mo, 1=Di, 2=Mi, 3=Do, 4=Fr, 5=Sa, 6=So, repeating.
  const days = [];
  const start = new Date(2026, 4, 4); // 4. Mai 2026 (Mo)
  for (let i = 0; i < 28; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dow = (i % 7); // 0..6 from Mo
    days.push({
      idx: i,
      date: d,
      day: d.getDate(),
      dow,
      dowLabel: ['Mo','Di','Mi','Do','Fr','Sa','So'][dow],
      isWeekend: dow >= 5,
      kw: 19 + Math.floor(i/7),
      iso: d.toISOString().slice(0,10),
    });
  }

  // A small deterministic schedule. doctorId → array of 28 codes.
  // FR = frei. Designed to look plausible.
  const schedule = {
    1:  ['F','F','F','S','S','U','U','F','F','F','S','S','U','U','F','F','S','S','S','U','U','F','F','F','S','S','U','U'],
    2:  ['S','S','F','F','F','U','U','N','N','N','U','U','U','U','F','S','S','F','F','U','U','S','S','F','F','F','U','U'],
    3:  ['I','I','I','I','F','U','U','F','F','I','I','I','U','U','S','S','S','I','I','U','U','I','I','I','F','S','U','U'],
    4:  ['B','U','F','F','F','B','B','F','F','S','S','F','U','U','F','S','S','F','B','B','B','F','S','S','F','F','U','U'],
    5:  ['F','F','S','S','S','U','U','S','F','F','F','F','U','U','S','F','F','S','S','U','U','F','F','S','S','S','U','U'],
    6:  ['F','S','S','F','U','U','U','S','S','F','F','S','U','U','S','F','F','S','F','U','U','S','F','F','S','U','U','U'],
    7:  ['I','I','F','F','S','U','U','F','I','I','I','F','U','U','I','I','F','F','S','U','U','I','I','F','F','S','U','U'],
    8:  ['F','F','F','S','F','U','U','S','S','F','F','F','U','U','F','F','S','S','F','U','U','F','F','S','S','F','U','U'],
    9:  ['I','I','S','S','S','B','B','I','I','S','S','S','U','U','I','I','I','S','S','B','B','I','I','S','S','S','U','U'],
    10: ['K','U','U','U','K','U','U','K','U','U','U','K','U','U','K','U','U','U','K','U','U','K','U','U','U','K','U','U'],
    11: ['A','A','U','U','U','U','U','A','A','U','U','U','U','U','A','A','U','U','U','U','U','A','A','U','U','U','U','U'],
    12: ['N','U','N','N','U','U','U','S','S','N','N','N','U','U','N','N','U','S','S','U','U','N','N','S','S','U','U','U'],
  };

  // KPIs for dashboard
  const kpis = {
    coverage: 96,        // % der Schichten besetzt
    openShifts: 4,       // offene Stellen kommende Woche
    rulesIssues: 2,      // Konflikte mit Regeln
    onLeave: 3,          // im Urlaub diese Woche
  };

  // Upcoming notable events
  const events = [
    { date: '12.05.', who: 'Lukas Holm',     what: 'Nachtdienst → 10 Std Ruhe?', kind: 'warn' },
    { date: '15.05.', who: 'Anika Reuter',   what: 'Letzter Tag vor Urlaub',     kind: 'info' },
    { date: '20.05.', who: 'Nora Engel',     what: 'Mutterschutz beginnt',       kind: 'info' },
    { date: '22.05.', who: 'INA',            what: 'Keine Stroke-Quali besetzt', kind: 'error' },
  ];

  return { doctors, shiftTypes, shiftPalette, days, schedule, kpis, events, monthLabel };
})();
