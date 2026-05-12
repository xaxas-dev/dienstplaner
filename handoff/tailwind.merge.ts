/**
 * Dienstplaner — Tailwind config patch
 *
 * Merge these blocks into the existing `frontend/tailwind.config.ts`.
 * Don't replace the file wholesale — keep whatever shadcn already set up.
 */

import type { Config } from 'tailwindcss'

export const tailwindMerge: Partial<Config['theme']> = {
  extend: {
    colors: {
      paper:    '#F6F1E6',
      card:     '#FFFCF5',
      ink: {
        DEFAULT: '#26221C',
        2:       '#5C544A',
        3:       '#8A8275',
      },
      line: {
        DEFAULT: '#E8E0CF',
        2:       '#D6CCB6',
      },
      accent: {
        DEFAULT: '#C66A3D',
        2:       '#E69E66',
      },
      ok:       '#5A7A3A',
      warn: {
        DEFAULT: '#B85B22',
        bg:      '#FBE5D6',
        line:    '#F0C3A2',
        ink:     '#7A3414',
      },
      today:    '#FAF0DC',
      weekend:  '#F3ECD8',
    },
    fontFamily: {
      sans:  ['Geist', 'ui-sans-serif', 'system-ui'],
      serif: ['Newsreader', 'ui-serif', 'Georgia'],
    },
    borderRadius: {
      cell: '7px',
      tile: '14px',
      rail: '12px',
    },
    fontFeatureSettings: {
      tabular: '"tnum"',
    },
  },
}

/**
 * CSS — add to frontend/src/index.css at the very top:
 *
 *   @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
 *   @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600&display=swap');
 *
 *   @tailwind base;
 *   @tailwind components;
 *   @tailwind utilities;
 *
 *   @layer base {
 *     html, body { background: theme(colors.paper); color: theme(colors.ink.DEFAULT); }
 *     body { font-family: theme(fontFamily.sans); }
 *     .dp-h1 { font-family: theme(fontFamily.serif); font-weight: 400; letter-spacing: -0.01em; }
 *     .dp-num { font-variant-numeric: tabular-nums; }
 *   }
 */
