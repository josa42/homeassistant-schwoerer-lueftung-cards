// Renders each card's animation to a frame sequence by computing every dot's
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

await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
const geo = await import(
  'data:text/javascript;base64,' +
    Buffer.from(
      src.replace(/customElements\.define\([^)]*\);/g, '') +
        '\nexport { STREAMS, HP_LINK, ROOM_DUCT, ROOM_DUCT_LEN, DOT_SPACING };'
    ).toString('base64')
);

const FPS = 12;

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

// A hass stub the cards can resolve against. The entity ids are synthetic; only
// the entity_type attribute and the device id matter to resolveSlots.
function makeHass(entries) {
  const states = {};
  const entities = {};
  for (const [type, state, attrs] of entries) {
    const { domain = 'sensor', ...rest } = attrs || {};
    const id = `${domain}.${type}`;
    states[id] = { state, attributes: { entity_type: type, ...rest } };
    entities[id] = { device_id: 'demo', area_id: 'a1' };
  }
  return { states, entities, areas: { a1: { name: 'Wohnzimmer' } } };
}

function mount(tag, hass) {
  const Card = customElements.get(tag);
  const el = document.createElement('div');
  Object.setPrototypeOf(el, Card.prototype);
  el.setConfig({ device_id: 'demo' });
  el.hass = hass;
  return el;
}

const css = src
  .match(/<style>[\s\S]*?<\/style>/g)
  .map((b) => b.replace(/<\/?style>/g, ''))
  .join('\n')
  .replace(/var\(--divider-color\)/g, '#d4d4d8')
  .replace(/var\(--secondary-text-color\)/g, '#6b7280')
  .replace(/var\(--primary-text-color\)/g, '#1f2937')
  .replace(/var\(--disabled-text-color, #bdbdbd\)/g, '#bdbdbd')
  .replace(/var\(--card-background-color, #fff\)/g, '#fff')
  .replace(/var\(--info-color, #039be5\)/g, '#039be5')
  .replace(/var\(--warning-color, #ffa726\)/g, '#ffa726');

// A winter state, so the colour scale and the heat pump's transfer direction
// are both visible. Fan level 3 throughout.
const AIR_FLOW = mount(
  'wgt-air-flow-card',
  makeHass([
    ['temperature_t10_outdoor', '-2.0'],
    ['temperature_t2_after_preheating_coil', '1.5'],
    ['temperature_t6_in_heat_exchanger', '12.4'],
    ['temperature_t8_condenser', '21.0'],
    ['temperature_t3_before_reheater', '20.4'],
    ['temperature_t4_after_reheater', '22.0'],
    ['temperature_t7_evaporator', '4.8'],
    ['temperature_t5_exhaust_air', '22.6'],
    ['heat_pump_status', 'heating'],
    ['bypass_state', 'closed'],
    ['current_supply_air_flow', '50'],
    ['current_exhaust_air_flow', '50'],
  ])
);

// The same winter afternoon in one room: just under its setpoint, with the
// auxiliary heater running.
const ROOM = mount(
  'wgt-room-card',
  makeHass([
    ['current_temperature_room', '20.8'],
    ['climate_room', 'heat', { domain: 'climate', temperature: 21.5 }],
    ['auxiliary_heating_active_room', 'on', { domain: 'binary_sensor' }],
    ['auxiliary_heating_enabled_room', 'on', { domain: 'switch' }],
    ['scheduled_heating_enabled_room', 'on', { domain: 'switch' }],
    ['base_temperature_room', '21.5', { domain: 'number' }],
    ['temperature_t4_after_reheater', '22.0'],
    ['current_supply_air_flow', '50'],
  ])
);

const targets = [
  {
    name: 'wgt-air-flow-card',
    card: AIR_FLOW,
    width: 1000,
    scope: 'wgt-af',
    plans: geo.STREAMS.map((s) => ({
      path: sampler(s.d),
      len: s.len,
      stops: s.stops,
      speed: AIR_FLOW._speed(s.name),
      count: Math.max(1, Math.round(s.len / geo.DOT_SPACING)),
      colors: s.runs.map((r) => AIR_FLOW._dotColor(r.from)),
    })),
    hp: { len: geo.HP_LINK.bottom - geo.HP_LINK.top, x: geo.HP_LINK.x, bottom: geo.HP_LINK.bottom },
  },
  {
    name: 'wgt-room-card',
    card: ROOM,
    width: 580,
    scope: 'wgt-room',
    plans: [
      {
        path: sampler(geo.ROOM_DUCT),
        len: geo.ROOM_DUCT_LEN,
        stops: [geo.ROOM_DUCT_LEN],
        speed: ROOM._speed(),
        count: Math.max(1, Math.round(geo.ROOM_DUCT_LEN / geo.DOT_SPACING)),
        colors: [ROOM._dotColor('supply_air')],
      },
    ],
    hp: null,
  },
];

await rm('.preview-frames', { recursive: true, force: true });

for (const t of targets) {
  // The pattern repeats once every dot has moved into its neighbour's place, so
  // one spacing-period is the shortest seamless loop.
  const lead = t.plans[0];
  const period = lead.len / lead.count / lead.speed;
  const frames = Math.round(period * FPS);
  console.log(`${t.name}: loop ${period.toFixed(3)}s, ${frames} frames at ${FPS}fps`);
  for (const p of t.plans) {
    const own = p.len / p.count / p.speed;
    const seam = ((period % own) / own) * (p.len / p.count);
    console.log(`  ${p.count} dots, period ${own.toFixed(3)}s, loop seam ${seam.toFixed(1)}px`);
  }

  const dir = `.preview-frames/${t.name}`;
  await mkdir(dir, { recursive: true });

  const svgEl = t.card.querySelector('svg');
  svgEl.querySelector('[data-dots]').innerHTML = '';
  const hpEl = svgEl.querySelector('[data-hp-dots]');
  if (hpEl) hpEl.innerHTML = '';
  const vb = svgEl.getAttribute('viewBox').split(' ').map(Number);
  // linkedom parses innerHTML in HTML mode, where <circle> is not a void
  // element, so assigning dot markup there nests every circle inside the last.
  // Serialise once with the groups empty and substitute as text instead.
  // Each card scopes its CSS under a class on its ha-card, so a standalone
  // svg needs that class on itself to be an ancestor of what the rules target.
  const template = svgEl.outerHTML
    .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" class="${t.scope}" width="${vb[2]}" height="${vb[3]}" `)
    .replace('>', `><style>text{font-family:-apple-system,Helvetica,sans-serif}${css}</style>`);
  if (!template.includes('<g data-dots="" />')) {
    throw new Error(`${t.name}: dots placeholder missing`);
  }

  for (let f = 0; f < frames; f++) {
    const time = (f / frames) * period;
    let dots = '';
    for (const p of t.plans) {
      const spacing = p.len / p.count;
      for (let i = 0; i < p.count; i++) {
        const dist = i * spacing + time * p.speed;
        const [x, y] = p.path.at(dist);
        const along = ((dist % p.len) + p.len) % p.len;
        let ci = p.stops.findIndex((stop) => along <= stop);
        if (ci < 0) ci = p.colors.length - 1;
        dots += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4" fill="${p.colors[ci]}"/>`;
      }
    }
    let svg = template.replace('<g data-dots="" />', `<g>${dots}</g>`);
    if (t.hp) {
      // heating moves heat up, from the evaporator to the condenser
      let hp = '';
      for (let i = 0; i < 2; i++) {
        const d = (i * (t.hp.len / 2) + time * 60) % t.hp.len;
        hp += `<circle cx="${t.hp.x}" cy="${(t.hp.bottom - d).toFixed(2)}" r="4" fill="#ff9800"/>`;
      }
      svg = svg.replace('<g data-hp-dots="" />', `<g>${hp}</g>`);
    }
    await writeFile(`${dir}/f${String(f).padStart(3, '0')}.svg`, svg);
  }
  await writeFile(`${dir}/width.txt`, String(t.width));
}
console.log('frames written');
