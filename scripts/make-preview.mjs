// Renders the card's animation to a frame sequence by computing each dot's
// position directly, using the same constant-velocity model the browser applies
// for calcMode="paced". No browser or screen recording involved.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { parseHTML } from 'linkedom';

const src = await readFile(new URL('../schwoerer-lueftung-cards.js', import.meta.url), 'utf8');
const { document, HTMLElement, customElements, CustomEvent } = parseHTML(
  '<!doctype html><html><body></body></html>'
);
Object.assign(global, { document, HTMLElement, customElements, CustomEvent });
global.window = { customCards: [] };

// A winter state: the heat pump is running, so the GIF shows the transfer
// direction the README describes, and the air spans most of the colour scale.
const DEV = 'wgt';
const DEMO = {
  temperature_t10_outdoor: '-2.0',
  temperature_t2_after_preheating_coil: '1.5',
  temperature_t6_in_heat_exchanger: '12.4',
  temperature_t8_condenser: '21.0',
  temperature_t3_before_reheater: '20.4',
  temperature_t4_after_reheater: '22.0',
  temperature_t7_evaporator: '4.8',
  temperature_t5_exhaust_air: '22.6',
  heat_pump_status: 'heating',
  bypass_state: 'closed',
  current_supply_air_flow: '50',
  current_exhaust_air_flow: '50',
};
const states = {};
const entities = {};
for (const [type, state] of Object.entries(DEMO)) {
  const id = `sensor.${type}`;
  states[id] = { state, attributes: { entity_type: type } };
  entities[id] = { device_id: DEV };
}

await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
const Card = customElements.get('wgt-air-flow-card');
const mod = await import(
  'data:text/javascript;base64,' +
    Buffer.from(
      src.replace(/customElements\.define\([^)]*\);/g, '') +
        '\nexport { STREAMS, HP_LINK };'
    ).toString('base64')
);
const { STREAMS, HP_LINK } = mod;

const card = document.createElement('div');
Object.setPrototypeOf(card, Card.prototype);
card.setConfig({ device_id: DEV, title: null });
card.hass = { states, entities };
const svgEl = card.querySelector('svg');

// Walk a path into a dense polyline so a point can be found by arc length.
// This is what "paced" means: distance advances at a constant rate with time.
function sampler(d) {
  const pts = [];
  let cur = [0, 0];
  for (const t of d.match(/[MLQC][^MLQC]*/g)) {
    const n = t.slice(1).trim().split(/[\s,]+/).map(Number);
    const [x0, y0] = cur;
    if (t[0] === 'M') {
      cur = [n[0], n[1]];
      pts.push(cur);
    } else if (t[0] === 'L') {
      const steps = Math.max(2, Math.ceil(Math.hypot(n[0] - x0, n[1] - y0) / 2));
      for (let i = 1; i <= steps; i++) {
        const s = i / steps;
        pts.push([x0 + (n[0] - x0) * s, y0 + (n[1] - y0) * s]);
      }
      cur = [n[0], n[1]];
    } else {
      const [x1, y1, x, y] = n;
      for (let i = 1; i <= 80; i++) {
        const s = i / 80;
        const m = 1 - s;
        pts.push([m * m * x0 + 2 * m * s * x1 + s * s * x, m * m * y0 + 2 * m * s * y1 + s * s * y]);
      }
      cur = [x, y];
    }
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  return {
    total,
    at(dist) {
      const dd = ((dist % total) + total) % total;
      let lo = 0;
      let hi = cum.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= dd) lo = mid;
        else hi = mid;
      }
      const seg = cum[hi] - cum[lo];
      const f = seg > 0 ? (dd - cum[lo]) / seg : 0;
      return [
        pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f,
        pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f,
      ];
    },
  };
}

const plans = STREAMS.map((s) => {
  const speed = card._speed(s.name);
  const count = Math.max(1, Math.round(s.len / 88));
  return {
    s,
    speed,
    count,
    path: sampler(s.d),
    colors: s.runs.map((r) => card._dotColor(r.from)),
  };
});

// The pattern repeats once every dot has moved into its neighbour's place, so
// one spacing-period is the shortest seamless loop.
const period = plans[0].s.len / plans[0].count / plans[0].speed;
const FPS = 12;
const FRAMES = Math.round(period * FPS);
console.log(`loop ${period.toFixed(3)}s, ${FRAMES} frames at ${FPS}fps`);
for (const p of plans) {
  const own = p.s.len / p.count / p.speed;
  console.log(`  ${p.s.name}: ${p.count} dots, period ${own.toFixed(3)}s,`
    + ` loop seam ${(((period % own) / own) * (p.s.len / p.count)).toFixed(1)}px`);
}

const hpLen = HP_LINK.bottom - HP_LINK.top;
const hpSpeed = hpLen / (hpLen / 60);

const css = src
  .match(/<style>([\s\S]*?)<\/style>/)[1]
  .replace(/var\(--divider-color\)/g, '#d4d4d8')
  .replace(/var\(--secondary-text-color\)/g, '#6b7280')
  .replace(/var\(--primary-text-color\)/g, '#1f2937')
  .replace(/var\(--disabled-text-color, #bdbdbd\)/g, '#bdbdbd')
  .replace(/var\(--card-background-color, #fff\)/g, '#fff')
  .replace(/var\(--info-color, #039be5\)/g, '#039be5')
  .replace(/var\(--warning-color, #ffa726\)/g, '#ffa726');

const dotsG = card.querySelector('[data-dots]');
const hpG = card.querySelector('[data-hp-dots]');

await rm('.preview-frames', { recursive: true, force: true });
await mkdir('.preview-frames', { recursive: true });

// linkedom parses innerHTML in HTML mode, where <circle> is not a void element,
// so assigning dot markup there nests every circle inside the last. Serialise
// the document once with both groups empty and substitute as text instead.
dotsG.innerHTML = '';
hpG.innerHTML = '';
const template = svgEl.outerHTML
  .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1160" height="415" ')
  .replace('>', `><style>text{font-family:-apple-system,Helvetica,sans-serif}${css}</style>`);
if (!template.includes('<g data-dots="" />')) throw new Error('dots placeholder not found');
if (!template.includes('<g data-hp-dots="" />')) throw new Error('hp placeholder not found');

for (let f = 0; f < FRAMES; f++) {
  const t = (f / FRAMES) * period;
  let out = '';
  for (const p of plans) {
    const spacing = p.s.len / p.count;
    for (let i = 0; i < p.count; i++) {
      const dist = i * spacing + t * p.speed;
      const [x, y] = p.path.at(dist);
      const along = ((dist % p.s.len) + p.s.len) % p.s.len;
      let ci = p.s.stops.findIndex((stop) => along <= stop);
      if (ci < 0) ci = p.colors.length - 1;
      out += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4" fill="${p.colors[ci]}"/>`;
    }
  }

  // heat pump: heating moves heat up, from the evaporator to the condenser
  let hp = '';
  for (let i = 0; i < 2; i++) {
    const d = (i * (hpLen / 2) + t * hpSpeed) % hpLen;
    hp += `<circle cx="${HP_LINK.x}" cy="${(HP_LINK.bottom - d).toFixed(2)}" r="4" fill="#ff9800"/>`;
  }

  const svg = template
    .replace('<g data-dots="" />', `<g>${out}</g>`)
    .replace('<g data-hp-dots="" />', `<g>${hp}</g>`);
  await writeFile(`.preview-frames/f${String(f).padStart(3, '0')}.svg`, svg);
}
console.log(`wrote ${FRAMES} frames`);
