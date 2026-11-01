const CARD_VERSION = "1.2.0";

// Which build is loaded is the first question on any bug report, and a card has
// nowhere else to say so. The release workflow keeps this in step with the tag.
console.info(
  `%c SCHWOERER-LUEFTUNG-CARDS %c ${CARD_VERSION} `,
  "color:#fff;background:#03a9f4;font-weight:700",
  "color:#03a9f4;background:#fff;font-weight:700"
);

const STOPS = [
  [-15, [29, 78, 216]],
  [0, [59, 130, 246]],
  [8, [6, 182, 212]],
  [16, [16, 185, 129]],
  [22, [234, 179, 8]],
  [28, [249, 115, 22]],
  [36, [220, 38, 38]],
];

const GREY = "var(--disabled-text-color, #bdbdbd)";

function tempColor(v) {
  if (v === null) return GREY;
  if (v <= STOPS[0][0]) return `rgb(${STOPS[0][1].join(",")})`;
  const last = STOPS[STOPS.length - 1];
  if (v >= last[0]) return `rgb(${last[1].join(",")})`;
  for (let i = 1; i < STOPS.length; i++) {
    const [hi, cHi] = STOPS[i];
    const [lo, cLo] = STOPS[i - 1];
    if (v <= hi) {
      const f = (v - lo) / (hi - lo);
      const c = cLo.map((ch, k) => Math.round(ch + (cHi[k] - ch) * f));
      return `rgb(${c.join(",")})`;
    }
  }
  return GREY;
}

// Each slot maps to one `entity_type` state attribute, which the integration
// sets from the entity description key (entity.py). Resolving through it means
// the card follows renames and works on any WGT device.
const SLOTS = {
  outdoor: { type: "temperature_t10_outdoor", tag: "T10", label: "Außen" },
  after_preheater: { type: "temperature_t2_after_preheating_coil", tag: "T2", label: "nach VHR" },
  heat_exchanger: { type: "temperature_t6_in_heat_exchanger", tag: "T6", label: "nach WT" },
  condenser: { type: "temperature_t8_condenser", tag: "T8", label: "Kondensator" },
  before_reheater: { type: "temperature_t3_before_reheater", tag: "T3", label: "vor NE" },
  after_reheater: { type: "temperature_t4_after_reheater", tag: "T4", label: "nach NE" },
  evaporator: { type: "temperature_t7_evaporator", tag: "T7", label: "Verdampfer" },
  exhaust: { type: "temperature_t5_exhaust_air", tag: "T5", label: "Abluft" },
  heat_pump: { type: "heat_pump_status", label: "Status Wärmepumpe" },
  bypass: { type: "bypass_state", label: "Bypass" },
  supply_flow: { type: "current_supply_air_flow", label: "Luftleistung Zuluft" },
  exhaust_flow: { type: "current_exhaust_air_flow", label: "Luftleistung Abluft" },
};

// Layout, after the WRG 134 BP-HK (docs/air-flow.md). Both streams run left to
// right: outdoor air enters high and leaves low as supply, room air enters low
// and leaves high as exhaust. Each stream is one horizontal run, a single turn,
// one straight diagonal through the heat exchanger where the two cross, a
// single turn back, and a second horizontal run through the heat pump. Two
// corners per stream, no more.
//
// The compact layout is the same diagram with the two rows pulled together. It
// keeps the dots, and drops the row labels and the titles.
const NODE_W = 78;
const NODE_H = 54;

// The card is drawn at its own width in px, so the type keeps one size at any
// width. It picks the widest tier that fits unstretched and spreads that tier's
// columns over the card; only below the smallest tier does the drawing scale
// down. Each tier squeezes the columns and leaves out what no longer fits:
// first the coil labels, then T2 and the coil temperatures T7 and T8, then the
// coils, and on a phone everything but the air entering and leaving the unit.
// A null column is
// not drawn. The x of a column is the centre of its node.
const TIERS = {
  full: {
    width: 1160, housing: [140, 1020], outdoor: 60, vhr: 210, preheat: 290, exhaust: 290,
    wt: [370, 580, 30], hx: 660, hp: 780, hpNodes: true, ne: 865, supply: 950, end: 1100,
    titles: true, labels: true, coilLabels: true,
  },
  narrow: {
    width: 856, housing: [106, 760], outdoor: 54, vhr: 132, preheat: 196, exhaust: 196,
    wt: [255, 405, 20], hx: 467, hp: 570, hpNodes: true, ne: 642, supply: 705, end: 808,
    titles: true, labels: true, coilLabels: false,
  },
  small: {
    width: 748, housing: [106, 654], outdoor: 54, vhr: 132, preheat: null, exhaust: 170,
    wt: [232, 352, 16], hx: 414, hp: 486, hpNodes: false, ne: 534, supply: 600, end: 702,
    titles: true, labels: true, coilLabels: false,
  },
  // Here and in mini, Abluft and Zuluft are nodes standing in for their
  // terminals. With the row labels gone the full height is only empty space,
  // so both are always compact. Both sit symmetrically in the housing: the
  // nodes 11 px outside it on either side, the two components 8 px inside.
  slim: {
    width: 470, housing: [104, 372], outdoor: 54, vhr: null, preheat: null, exhaust: 54,
    wt: [102, 212, 10], hx: 274, hp: 344, hpNodes: false, ne: null, supply: 422, end: 422,
    titles: false, labels: false, coilLabels: false, alwaysCompact: true,
  },
  mini: {
    width: 348, housing: [104, 250], outdoor: 54, vhr: null, preheat: null, exhaust: 54,
    wt: [102, 192, 10], hx: null, hp: 222, hpNodes: false, ne: null, supply: 300, end: 300,
    titles: false, labels: false, coilLabels: false, alwaysCompact: true,
  },
};

// Spreads a tier's columns over a wider card by the factor k. Only positions
// move: the nodes, coils and text keep their size.
function stretchTier(tier, keys, k) {
  const out = { ...tier };
  for (const key of keys) {
    const v = tier[key];
    out[key] = Array.isArray(v) ? v.map((x) => Math.round(x * k)) : v && Math.round(v * k);
  }
  return out;
}

function airFlowLayout(baseTier, compact, k = 1) {
  const tier = stretchTier(baseTier, [
    "width", "housing", "outdoor", "vhr", "preheat", "exhaust", "wt", "hx", "hp", "ne",
    "supply", "end",
  ], k);
  const top = compact ? 52 : 110;
  const bot = compact ? 172 : 320;
  const rise = bot - top;
  const round = (n) => Number(n.toFixed(1));
  const edge = (x) => x + NODE_W / 2;
  const [c1, c2, inset] = tier.wt;

  // Each stream is ONE continuous path, so its dots keep a single phase from
  // end to end: even spacing, nothing appearing or vanishing at a join. The
  // path runs straight behind the node boxes and coils, which are drawn on top,
  // so a dot is simply hidden while it crosses one.
  //
  // The diagonals run from corner c1 to corner c2 and cross dead centre between
  // them; in the full tier that is 45°. The turns are quadratics whose control
  // point IS the corner, with 18 px of straight on either side.
  //
  // `runs` splits each path only for COLOUR: a dot carries the reading of the
  // last sensor it passed, and the split points are where it passes one. A run
  // with a `to` blends from one reading to the other instead. That is the heat
  // exchanger, which the diagonals enter and leave `inset` inside the corners.
  // Where a sensor is not drawn, the dot changes colour at the component it
  // measures: the VHR coil, or the heat pump's link for T7 and T8.
  const span = c2 - c1;
  const ux = (18 * span) / Math.hypot(span, rise);
  const uy = (18 * rise) / Math.hypot(span, rise);
  const near = round(top + (inset / span) * rise);
  const far = round(top + ((span - inset) / span) * rise);
  const afterVhr = tier.preheat ? edge(tier.preheat) : tier.vhr && tier.vhr + 17;
  const afterHp = tier.hpNodes ? edge(tier.hp) : tier.hp;
  const streams = [
    {
      name: "supply",
      runs: [
        ...(afterVhr
          ? [{ from: "outdoor", d: `M${edge(tier.outdoor)},${top} L${afterVhr},${top}` }]
          : []),
        { from: afterVhr ? "after_preheater" : "outdoor",
          d: `${afterVhr ? "" : `M${Math.min(edge(tier.outdoor), c1 - 18)},${top} `}L${c1 - 18},${top} ` +
            `Q${c1},${top} ${round(c1 + ux)},${round(top + uy)} L${c1 + inset},${near}` },
        { from: afterVhr ? "after_preheater" : "outdoor", to: "before_reheater",
          d: `L${c2 - inset},${far}` },
        { from: "before_reheater",
          d: `L${round(c2 - ux)},${round(bot - uy)} Q${c2},${bot} ${c2 + 18},${bot} L${afterHp},${bot}` },
        // ends under the Zuluft node where that node is the terminal
        { from: "condenser",
          d: `L${tier.end > tier.supply ? edge(tier.supply) : tier.supply},${bot}` },
        ...(tier.end > tier.supply
          ? [{ from: "after_reheater", d: `L${tier.end - 6},${bot}` }]
          : []),
      ],
    },
    {
      name: "exhaust",
      runs: [
        { from: "exhaust",
          d: `M${tier.outdoor + 6},${bot} L${c1 - 18},${bot} ` +
            `Q${c1},${bot} ${round(c1 + ux)},${round(bot - uy)} L${c1 + inset},${round(top + bot - near)}` },
        { from: "exhaust", to: "heat_exchanger", d: `L${c2 - inset},${round(top + bot - far)}` },
        { from: "heat_exchanger",
          d: `L${round(c2 - ux)},${round(top + uy)} Q${c2},${top} ${c2 + 18},${top} L${afterHp},${top}` },
        { from: "evaporator", d: `L${tier.end - 6},${top}` },
      ],
    },
  ];
  for (const stream of streams) {
    stream.d = stream.runs.map((r) => r.d).join(" ");
    let acc = "";
    stream.stops = stream.runs.map((r) => {
      acc += (acc ? " " : "") + r.d;
      return pathLength(acc);
    });
    stream.len = stream.stops[stream.stops.length - 1];
  }

  const nodes = {
    outdoor: { x: tier.outdoor, y: top },
    after_preheater: tier.preheat && { x: tier.preheat, y: top },
    heat_exchanger: tier.hx && { x: tier.hx, y: top },
    evaporator: tier.hpNodes && { x: tier.hp, y: top },
    exhaust: { x: tier.exhaust, y: bot },
    before_reheater: tier.hx && { x: tier.hx, y: bot },
    condenser: tier.hpNodes && { x: tier.hp, y: bot },
    after_reheater: { x: tier.supply, y: bot },
  };
  for (const slot of Object.keys(nodes)) if (!nodes[slot]) delete nodes[slot];

  // Both enclosures share a top and a height so they read as one row of gear.
  const component = compact ? { y: 16, h: 190 } : { y: 56, h: 320 };
  const hpW = tier.hpNodes ? 106 : 40;
  const [left, right] = tier.housing;

  return {
    compact,
    width: tier.width,
    height: compact ? 222 : 415,
    housing: compact
      ? { x: left, y: 8, w: right - left, h: 206 }
      : { x: left, y: 30, w: right - left, h: 360 },
    titles: tier.titles && !compact,
    labels: tier.labels && !compact,
    coilLabels: tier.coilLabels && !compact,
    components: [
      { x: c1 + inset, w: span - 2 * inset, ...component, title: "Wärmetauscher" },
      { x: tier.hp - hpW / 2, w: hpW, ...component, title: "Wärmepumpe" },
    ],
    nodes,
    streams,
    coils: [
      tier.vhr && { x: tier.vhr, y: top, tag: "VHR", label: "Vorheizregister",
        labelY: 47, labelClass: "component-title" },
      tier.ne && { x: tier.ne, y: bot, tag: "NE", label: "Nachheizung",
        labelY: bot - 28, labelClass: "label" },
    ].filter(Boolean),
    terminals: [
      { x: tier.outdoor, y: top, caption: "Außenluft", capped: false },
      { x: tier.outdoor, y: bot, caption: "Abluft", capped: true, flow: "exhaust_flow" },
      { x: tier.end, y: top, caption: "Fortluft", capped: true },
      { x: tier.end, y: bot, caption: "Zuluft", capped: true, flow: "supply_flow" },
    ],
    // Below a node in the full layout. In the compact one only the flow rate
    // under Abluft and Zuluft is left, and those terminals have no node.
    rowLabelDy: compact && tier.exhaust !== tier.outdoor ? 32 : 46,
    // Without T7 and T8 the link runs from duct to duct.
    hpLink: tier.hpNodes
      ? { x: tier.hp, top: top + NODE_H / 2, bottom: bot - NODE_H / 2 }
      : { x: tier.hp, top, bottom: bot },
    // Both states sit at the top of their component. The compact layout has no
    // room above the heat pump's nodes, so there its state sits between them,
    // beside the link.
    bypassText: { x: (c1 + c2) / 2, y: compact ? 38 : 76 },
    heatPumpText: compact && tier.hpNodes
      ? { x: tier.hp + 26, y: (top + bot) / 2 + 4 }
      : { x: tier.hp, y: compact ? 38 : 76 },
  };
}

// Length of an M/L/Q/C path, so a dot's duration can be derived from the
// distance it covers and every duct runs at one constant speed.
function pathLength(d) {
  let cur = [0, 0];
  let len = 0;
  const sample = (fn) => {
    let px = cur[0];
    let py = cur[1];
    for (let i = 1; i <= 24; i++) {
      const [bx, by] = fn(i / 24);
      len += Math.hypot(bx - px, by - py);
      px = bx;
      py = by;
    }
  };
  for (const t of d.match(/[MLQC][^MLQC]*/g) || []) {
    const n = t.slice(1).trim().split(/[\s,]+/).map(Number);
    const [x0, y0] = cur;
    if (t[0] === "M") {
      cur = [n[0], n[1]];
    } else if (t[0] === "L") {
      len += Math.hypot(n[0] - x0, n[1] - y0);
      cur = [n[0], n[1]];
    } else if (t[0] === "Q") {
      const [x1, y1, x, y] = n;
      sample((s) => {
        const m = 1 - s;
        return [
          m * m * x0 + 2 * m * s * x1 + s * s * x,
          m * m * y0 + 2 * m * s * y1 + s * s * y,
        ];
      });
      cur = [x, y];
    } else {
      const [x1, y1, x2, y2, x, y] = n;
      sample((s) => {
        const m = 1 - s;
        return [
          m * m * m * x0 + 3 * m * m * s * x1 + 3 * m * s * s * x2 + s * s * s * x,
          m * m * m * y0 + 3 * m * m * s * y1 + 3 * m * s * s * y2 + s * s * s * y,
        ];
      });
      cur = [x, y];
    }
  }
  return len;
}


const DOT_GREY = "#9e9e9e";
// How many steps a blending run is cut into. The temperature scale bends
// through several hues, so each step is a point on the scale rather than one
// straight fade between the two end colours.
const BLEND_STEPS = 8;

// Dot colour is quantised to 0.5 K. A raw reading flickers by 0.1 K every
// poll, and rebuilding the dots for a colour shift nobody can see is churn.
// SMIL cannot animate to a var(), so an unavailable reading needs a literal.
function dotColor(v) {
  return v === null ? DOT_GREY : tempColor(Math.round(v * 2) / 2);
}

const DOT_SPACING = 88;

const BYPASS_LABELS = {
  closed: "Bypass zu",
  open_cooling: "Bypass offen · Kühlen",
  open_heating: "Bypass offen · Heizen",
  open: "Bypass offen",
};

const HEAT_PUMP_COLORS = { heating: "#ff9800", cooling: "#488fc2" };
const HEAT_PUMP_LABELS = { off: "aus", heating: "heizt", cooling: "kühlt" };

// Matches each slot against the `entity_type` state attribute the integration
// sets on all of its entities.
//
// Two wrinkles a plain type lookup gets wrong. `auxiliary_heating_enabled_room`
// is both a switch and a (disabled by default) binary_sensor, so a slot can pin
// a domain. And a room card needs a couple of readings off the main unit rather
// than the room device, so a slot can opt out of the device filter.
function resolveSlots(hass, slots, config) {
  const deviceId = config.device_id;
  const inDevice = {};
  const anywhere = {};
  for (const id of Object.keys(hass.states)) {
    const type = hass.states[id].attributes?.entity_type;
    if (!type) continue;
    const domain = id.slice(0, id.indexOf("."));
    const onDevice = deviceId && hass.entities?.[id]?.device_id === deviceId;
    for (const key of [type, `${type}|${domain}`]) {
      if (!(key in anywhere)) anywhere[key] = id;
      if (onDevice && !(key in inDevice)) inDevice[key] = id;
    }
  }
  const out = {};
  for (const [slot, meta] of Object.entries(slots)) {
    const key = meta.domain ? `${meta.type}|${meta.domain}` : meta.type;
    const pool = meta.global || !deviceId ? anywhere : inDevice;
    out[slot] = pool[key] || null;
  }
  return out;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Calls back with the element's width whenever it changes, so a card can pick
// its layout from its own width and fit a phone, a narrow column and a panel
// alike. A custom element is inline by default, and an inline box has no size
// to observe.
function observeWidth(el, callback) {
  el.style.display = "block";
  const observer = new ResizeObserver(([entry]) => callback(entry.contentRect.width));
  observer.observe(el);
  return observer;
}

// Forces the HA frontend to load ha-form and the pickers, which are only
// pulled in once some built-in card editor has been created.
async function loadHaComponents() {
  if (customElements.get("ha-form") && customElements.get("ha-entity-picker")) return;
  const helpers = await window.loadCardHelpers?.();
  if (!helpers) return;
  const card = await helpers.createCardElement({ type: "entities", entities: [] });
  await card.constructor?.getConfigElement?.();
}

class WgtAirFlowCard extends HTMLElement {
  static SLOTS = SLOTS;

  static async getConfigElement() {
    await loadHaComponents();
    return document.createElement("wgt-air-flow-card-editor");
  }

  static getStubConfig(hass) {
    const anchor = Object.keys(hass?.states || {}).find(
      (id) => hass.states[id].attributes?.entity_type === SLOTS.outdoor.type
    );
    const deviceId = anchor && hass.entities?.[anchor]?.device_id;
    return deviceId
      ? { type: "custom:wgt-air-flow-card", device_id: deviceId }
      : { type: "custom:wgt-air-flow-card" };
  }

  setConfig(config) {
    this._config = { ...config };
    this._pickLayout();
    this._resolved = null;
    this._signature = null;
    this._dotSig = null;
    this._hpSig = null;
    this._phase = this._phase || {};
  }

  connectedCallback() {
    this._resizer = observeWidth(this, (width) => {
      this._width = width;
      if (this._config && this._pickLayout() && this._hass) this._render();
    });
  }

  disconnectedCallback() {
    this._resizer?.disconnect();
  }

  // The widest tier that fits unstretched, spread over the card's width. Past
  // the full tier's width the drawing stops growing and sits centred. Returns
  // whether the layout changed, which needs a rebuild.
  _pickLayout() {
    const full = TIERS.full.width;
    const w = Math.round(Math.min(this._width || full, full));
    const name = Object.keys(TIERS).find((n) => TIERS[n].width <= w) || "mini";
    const compact = Boolean(this._config.compact || TIERS[name].alwaysCompact);
    const key = `${name}|${compact}|${w}`;
    if (key === this._layoutKey) return false;
    this._layoutKey = key;
    this._layout = airFlowLayout(TIERS[name], compact, Math.max(1, w / TIERS[name].width));
    this._built = false;
    return true;
  }

  set hass(hass) {
    this._hass = hass;
    const ids = this._entities();
    const sig = Object.values(ids)
      .map((id) => (id ? hass.states[id]?.state ?? "?" : "-"))
      .join("|");
    if (sig === this._signature) return;
    this._signature = sig;
    this._render();
  }

  // Matched by `entity_type` within the chosen device. Cached, and rebuilt
  // whenever a resolved entity goes missing.
  _entities() {
    const stale =
      this._resolved &&
      Object.values(this._resolved).some((id) => id && !this._hass.states[id]);
    if (this._resolved && !stale) return this._resolved;
    this._resolved = resolveSlots(this._hass, this.constructor.SLOTS, this._config);
    return this._resolved;
  }

  _state(slot) {
    const id = this._entities()[slot];
    return (id && this._hass.states[id]?.state) || null;
  }

  _num(slot) {
    const v = Number.parseFloat(this._state(slot));
    return Number.isFinite(v) ? v : null;
  }

  // Higher air flow means faster dots, matching how power-flow encodes rate.
  // Dots move at a constant px/s that the fan level scales, so every duct runs
  // at the same visual speed and they all speed up together when the fans do.
  //
  // The unit only spans 30 % (Stufe 1) to 73 % (Stufe 4), so a linear map with a
  // constant floor left the four levels looking nearly alike. Squaring the
  // normalised rate stretches that narrow band into a ~6x spread:
  // Stufe 1 ~15, 2 ~21, 3 ~42, 4 ~90 px/s.
  _speed(stream) {
    const pct = this._num(stream === "supply" ? "supply_flow" : "exhaust_flow");
    if (pct === null) return 40;
    if (pct <= 0) return 0;
    const f = Math.min(1, pct / 100);
    return 170 * f * f;
  }

  // The fill keyframes of one stream, as fractions of its path, so the fill
  // animation stays locked to the motion animation. A plain run holds its
  // colour from start to end; two keyframes at one time make the jump to the
  // next run. A blending run steps along the scale between its two readings,
  // and holds the first one if the second is unavailable.
  _fillKeys(stream) {
    const keyTimes = [];
    const values = [];
    stream.runs.forEach((r, i) => {
      const start = i ? stream.stops[i - 1] / stream.len : 0;
      const end = stream.stops[i] / stream.len;
      const a = this._num(r.from);
      const b = r.to ? this._num(r.to) : null;
      const steps = a !== null && b !== null ? BLEND_STEPS : 1;
      for (let k = 0; k <= steps; k++) {
        const f = k / steps;
        keyTimes.push(start + (end - start) * f);
        values.push(dotColor(b === null ? a : a + (b - a) * f));
      }
    });
    return { keyTimes, values };
  }

  // Carries dot phase across a rebuild: work out where dot 0 is right now as a
  // fraction of the path, and re-issue the negative begin offsets from there.
  // Without this every rebuild snaps all dots back to their start-of-cycle
  // positions, which is the jump.
  _phaseOf(key, dur, now) {
    const prev = this._phase[key];
    const f0 = prev ? (((now - prev.t0) / prev.dur + prev.f0) % 1 + 1) % 1 : 0;
    this._phase[key] = { t0: now, dur, f0 };
    return f0;
  }

  // calcMode MUST be paced, not linear. For animateMotion, linear splits the
  // duration evenly across path SEGMENTS regardless of their length, so the
  // short corner pieces would crawl and the long straights would race: an 18x
  // speed swing on the exhaust path. paced is constant velocity along the
  // path, which also makes time fraction equal distance fraction, which is
  // what the fill keyTimes below assume.
  _dotsMarkup(stream, now) {
    const speed = this._speed(stream.name);
    if (!speed) {
      delete this._phase[stream.name];
      return "";
    }
    // rounded once, so the phase maths and the emitted dur cannot disagree
    const dur = Number((stream.len / speed).toFixed(2));
    const count = Math.max(1, Math.round(stream.len / DOT_SPACING));
    const f0 = this._phaseOf(stream.name, dur, now);
    const { keyTimes, values } = this._fillKeys(stream);
    const times = keyTimes.map((f) => f.toFixed(4)).join(";");
    let out = "";
    for (let i = 0; i < count; i++) {
      const begin = `-${(((f0 + i / count) % 1) * dur).toFixed(3)}s`;
      out += `<circle r="4" fill="${values[0]}" class="dot">
        <animateMotion dur="${dur}s" repeatCount="indefinite" calcMode="paced"
          begin="${begin}" path="${stream.d}"/>
        <animate attributeName="fill" dur="${dur}s" repeatCount="indefinite"
          calcMode="linear" begin="${begin}"
          values="${values.join(";")}" keyTimes="${times}"/>
      </circle>`;
    }
    return out;
  }

  _hpDotsMarkup(hpState, now) {
    const on = hpState && hpState !== "off" && hpState !== "unavailable";
    if (!on) {
      delete this._phase.hp;
      return "";
    }
    // Heat leaves the evaporator (top) for the condenser (bottom) when heating,
    // the other way when cooling, so the dots follow the actual transfer.
    const link = this._layout.hpLink;
    const d =
      hpState === "cooling"
        ? `M${link.x},${link.bottom} L${link.x},${link.top}`
        : `M${link.x},${link.top} L${link.x},${link.bottom}`;
    const dur = Number(((link.bottom - link.top) / 60).toFixed(2));
    const f0 = this._phaseOf("hp", dur, now);
    const color = HEAT_PUMP_COLORS[hpState] || "#9e9e9e";
    let out = "";
    for (let i = 0; i < 2; i++) {
      const begin = `-${(((f0 + i / 2) % 1) * dur).toFixed(3)}s`;
      out += `<circle r="4" fill="${color}" class="dot">
        <animateMotion dur="${dur}s" repeatCount="indefinite" calcMode="paced"
          begin="${begin}" path="${d}"/></circle>`;
    }
    return out;
  }

  // Built once. Everything that varies is patched in place by _update, so the
  // running animations are never torn down by an unrelated state change.
  _build() {
    // a fresh <g> holds no dots, whatever the last signature says
    this._dotSig = null;
    this._hpSig = null;
    const L = this._layout;
    const link = L.hpLink;
    const linkD = `M${link.x},${link.top} L${link.x},${link.bottom}`;
    this.innerHTML = `
      <ha-card class="wgt-af">
        <style>
          .wgt-af .wrap { padding: 0; }
          .wgt-af svg { width: 100%; height: auto; display: block; max-width: 1160px; margin: 0 auto; }
          .wgt-af .warn { padding: 8px 12px 0; color: var(--warning-color, #ffa726); font-size: 14px; }
          .wgt-af .housing { fill: var(--divider-color); fill-opacity: .12;
                     stroke: var(--secondary-text-color); stroke-width: 1.2;
                     stroke-opacity: .4; }
          .wgt-af .component { fill: none; stroke: var(--secondary-text-color); stroke-width: 1.5;
                       stroke-dasharray: 6 5; opacity: .55; }
          .wgt-af .component-title { fill: var(--secondary-text-color); font-size: 14px;
                             font-weight: 500; text-anchor: middle; }
          .wgt-af .duct { stroke: var(--divider-color); stroke-width: 15; fill: none;
                  stroke-linecap: round; stroke-linejoin: round; opacity: .55; }
          .wgt-af .line { stroke: var(--disabled-text-color, #bdbdbd); stroke-width: 1; fill: none; }
          .wgt-af .hp-link { stroke-width: 2; }
          .wgt-af .hp-link.idle { stroke-dasharray: 5 5; opacity: .5; }
          .wgt-af .ring { fill: var(--card-background-color, #fff); stroke-width: 2; }
          .wgt-af .cap { fill: var(--disabled-text-color, #bdbdbd); }
          .wgt-af .coil { fill: var(--card-background-color, #fff);
                  stroke: var(--disabled-text-color, #bdbdbd); stroke-width: 1.5;
                  stroke-dasharray: 4 3; }
          .wgt-af .tag { fill: var(--secondary-text-color); font-size: 13px; text-anchor: middle; }
          .wgt-af .val { fill: var(--primary-text-color); font-size: 19px; font-weight: 500;
                 text-anchor: middle; }
          .wgt-af .label { fill: var(--secondary-text-color); font-size: 14px; text-anchor: middle; }
          .wgt-af .coil-tag { fill: var(--secondary-text-color); font-size: 13px; font-weight: 500;
                      text-anchor: middle; }
          .wgt-af .caption { fill: var(--primary-text-color); font-size: 13px; font-weight: 500;
                     text-anchor: middle; letter-spacing: 1.2px; opacity: .8; }
          .wgt-af .sub { fill: var(--secondary-text-color); font-size: 13px; text-anchor: middle; }
          .wgt-af .sub.alert { fill: var(--info-color, #039be5); }
          .wgt-af .node { cursor: pointer; }
          .wgt-af .node:hover .ring { stroke-width: 3; }
          .wgt-af .hit { fill: none; pointer-events: all; rx: 6; }
          .wgt-af .node:hover .hit { fill: var(--secondary-text-color); fill-opacity: .1; }
        </style>
        <div class="wrap">
          <svg viewBox="0 0 ${L.width} ${L.height}" role="img" aria-label="WGT Luftweg mit Temperaturen">
            <rect x="${L.housing.x}" y="${L.housing.y}" width="${L.housing.w}" height="${L.housing.h}"
                  rx="20" class="housing"/>
            ${L.streams.map((s) => `<path d="${s.d}" class="duct"/>`).join("")}
            ${L.components.map(
              (c) => `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="14" class="component"/>
                ${!L.titles ? "" : `<text x="${c.x + c.w / 2}" y="${c.y - 9}" class="component-title">${c.title}</text>`}`
            ).join("")}
            ${L.streams.map((s) => `<path d="${s.d}" class="line"/>`).join("")}
            <path d="${linkD}" class="line hp-link" data-hp-link/>
            <g data-dots></g>
            <g data-hp-dots></g>
            ${L.terminals.map(
              (t) => `${t.capped ? `<circle cx="${t.x}" cy="${t.y}" r="6" class="cap"/>` : ""}
                <text x="${t.x}" y="${t.y - 36}" class="caption">${esc(t.caption.toUpperCase())}</text>
                ${t.flow
                  ? `<g class="node" data-slot="${t.flow}">
                      <rect x="${t.x - 55}" y="${t.y + L.rowLabelDy - 17}" width="110" height="24" class="hit"/>
                      <text x="${t.x}" y="${t.y + L.rowLabelDy}" class="label" data-flow="${t.flow}"></text>
                    </g>`
                  : ""}`
            ).join("")}
            ${L.coils.map(
              (c) => `<circle cx="${c.x}" cy="${c.y}" r="17" class="coil"/>
                <text x="${c.x}" y="${c.y + 4}" class="coil-tag">${c.tag}</text>
                ${!L.coilLabels ? "" : `<text x="${c.x}" y="${c.labelY}" class="${c.labelClass}">${c.label}</text>`}`
            ).join("")}
            <g class="node" data-slot="bypass">
              <rect x="${L.bypassText.x - 70}" y="${L.bypassText.y - 16}" width="140" height="24" class="hit"/>
              <text x="${L.bypassText.x}" y="${L.bypassText.y}" class="sub" data-sub="bypass"></text>
            </g>
            <g class="node" data-slot="heat_pump">
              <rect x="${L.heatPumpText.x - 50}" y="${L.heatPumpText.y - 16}" width="100" height="24" class="hit"/>
              <text x="${L.heatPumpText.x}" y="${L.heatPumpText.y}" class="sub" data-sub="heat_pump"></text>
            </g>
            ${Object.keys(L.nodes).map((slot) => {
              const { x, y } = L.nodes[slot];
              const meta = SLOTS[slot];
              return `<g class="node" data-slot="${slot}">
                <rect x="${x - NODE_W / 2}" y="${y - NODE_H / 2}" width="${NODE_W}" height="${NODE_H}"
                      rx="13" class="ring"/>
                <text x="${x}" y="${y - 7}" class="tag">${esc(meta.tag)}</text>
                <text x="${x}" y="${y + 14}" class="val"></text>
                ${meta.label && L.labels
                  ? `<text x="${x}" y="${y + L.rowLabelDy}" class="label">${esc(meta.label)}</text>`
                  : ""}
              </g>`;
            }).join("")}
          </svg>
          <div class="warn" hidden>Kein WGT-Gerät gewählt – bitte im Karten-Editor ein Gerät auswählen.</div>
        </div>
      </ha-card>`;

    this._svgEl = this.querySelector("svg");
    this._dotsEl = this.querySelector("[data-dots]");
    this._hpDotsEl = this.querySelector("[data-hp-dots]");
    this._hpLinkEl = this.querySelector("[data-hp-link]");
    this._warnEl = this.querySelector(".warn");
    this._nodeEls = {};
    for (const g of this.querySelectorAll("[data-slot]")) {
      this._nodeEls[g.getAttribute("data-slot")] = g;
    }
    this._subEls = {};
    for (const t of this.querySelectorAll("[data-sub]")) {
      this._subEls[t.getAttribute("data-sub")] = t;
    }
    this._flowEls = {};
    for (const t of this.querySelectorAll("[data-flow]")) {
      this._flowEls[t.getAttribute("data-flow")] = t;
    }

    this.querySelector(".wrap").addEventListener("click", (ev) => {
      const g = ev.target.closest(".node");
      const entityId = g && g.getAttribute("data-entity");
      if (!entityId) return;
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          detail: { entityId },
          bubbles: true,
          composed: true,
        })
      );
    });
    this._built = true;
  }

  _update() {
    const L = this._layout;
    const ids = this._entities();
    const now = this._svgEl.getCurrentTime ? this._svgEl.getCurrentTime() : 0;

    for (const slot of Object.keys(L.nodes)) {
      const v = this._num(slot);
      const g = this._nodeEls[slot];
      g.setAttribute("data-entity", ids[slot] || "");
      g.querySelector(".ring").setAttribute("stroke", tempColor(v));
      g.querySelector(".val").textContent = v === null ? "–" : `${v.toFixed(1)}°`;
    }

    // these carry no temperature, but each is a real entity worth a history view
    for (const slot of ["heat_pump", "bypass", "supply_flow", "exhaust_flow"]) {
      const g = this._nodeEls[slot];
      if (g) g.setAttribute("data-entity", ids[slot] || "");
    }

    const bypassState = this._state("bypass");
    const bypassEl = this._subEls.bypass;
    bypassEl.textContent = BYPASS_LABELS[bypassState] || bypassState || "";
    bypassEl.classList.toggle(
      "alert",
      typeof bypassState === "string" && bypassState.startsWith("open")
    );

    const hpState = this._state("heat_pump");
    const hpOn = hpState && hpState !== "off" && hpState !== "unavailable";
    this._subEls.heat_pump.textContent = HEAT_PUMP_LABELS[hpState] || hpState || "";
    this._hpLinkEl.setAttribute("stroke", HEAT_PUMP_COLORS[hpState] || GREY);
    this._hpLinkEl.classList.toggle("idle", !hpOn);

    for (const t of L.terminals) {
      if (!t.flow) continue;
      const v = this._num(t.flow);
      this._flowEls[t.flow].textContent = v === null ? "" : `${v} %`;
    }

    // Re-issue dots only when their speed or quantised colours actually change;
    // _phaseOf then makes that swap invisible.
    const dotSig = L.streams.map(
      (s) => this._speed(s.name) + ":" + this._fillKeys(s).values.join(",")
    ).join("|");
    if (dotSig !== this._dotSig) {
      this._dotSig = dotSig;
      this._dotsEl.innerHTML = L.streams.map((s) => this._dotsMarkup(s, now)).join("");
    }
    const hpSig = hpOn ? hpState : "off";
    if (hpSig !== this._hpSig) {
      this._hpSig = hpSig;
      this._hpDotsEl.innerHTML = this._hpDotsMarkup(hpState, now);
    }

    this._warnEl.hidden = Object.keys(L.nodes).some((slot) => ids[slot]);
  }

  _render() {
    if (!this._built) this._build();
    this._update();
  }

  getCardSize() {
    return this._layout.compact ? 3 : 6;
  }
}

class WgtAirFlowCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  _schema() {
    return [
      { name: "device_id", selector: { device: { integration: "schwoerer_lueftung" } } },
      { name: "compact", selector: { boolean: {} } },
    ];
  }

  _update() {
    if (!this._config || !this._hass) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) =>
        ({ device_id: "WGT-Gerät", compact: "Kompakt" })[s.name] || s.name;
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const next = { ...ev.detail.value };
        if (!next.device_id) delete next.device_id;
        if (!next.compact) delete next.compact;
        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: next },
            bubbles: true,
            composed: true,
          })
        );
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._form.data = this._config;
  }
}

// ---------------------------------------------------------------------------
// Room card
// ---------------------------------------------------------------------------

const ROOM_SLOTS = {
  current_temperature: {
    type: "current_temperature_room", domain: "sensor", label: "Raumtemperatur",
  },
  climate: { type: "climate_room", domain: "climate", label: "Raumthermostat" },
  aux_active: {
    type: "auxiliary_heating_active_room", domain: "binary_sensor",
    label: "Zusatzheizung aktiv",
  },
  aux_enabled: {
    type: "auxiliary_heating_enabled_room", domain: "switch",
    label: "Zusatzheizung freigegeben",
  },
  scheduled: {
    type: "scheduled_heating_enabled_room", domain: "switch", label: "Zeitprogramm",
  },
  base_temperature: {
    type: "base_temperature_room", domain: "number", label: "Basistemperatur",
  },
  // Read off the main unit rather than the room device: the air arriving here
  // is what the unit last measured leaving it, and the fans set the dot speed.
  supply_air: {
    type: "temperature_t4_after_reheater", domain: "sensor", global: true,
    label: "Zuluft (T4)",
  },
  supply_flow: {
    type: "current_supply_air_flow", domain: "sensor", global: true,
    label: "Luftleistung Zuluft",
  },
  // Register 234 gates every room's auxiliary heater at once, whatever the
  // room's own permit says.
  aux_enabled_house: {
    type: "auxiliary_heating_enabled", domain: "switch", global: true,
    label: "Zusatzheizung Haus freigegeben",
  },
};

const ROOM_H = 268;
const ROOM_DUCT_Y = 78;
const ROOM_NODE = { w: 92, h: 58 };

// Like the air flow card, the room card is drawn at its own width in px and
// picks the wider tier that fits unstretched.
//
// The full tier is half the air flow card's full width, because a room card
// sits in one column of a two-column view while that one spans both.
//
// The narrow one is for a phone. The terminals and their captions give way to
// the room box, which takes the whole width. The Zuluft reading stays in front
// of the auxiliary heater, which is the air it heats, now under its own label,
// and the heater moves to the centre of the box.
const ROOM_TIERS = {
  full: { width: 580, box: [90, 490], caps: [35, 545], coil: 140, nodes: [228, 352],
    terminals: true },
  narrow: { width: 340, box: [8, 332], caps: [14, 326], coil: 170, nodes: [112, 228],
    terminals: false },
};

function roomLayout(baseTier, k = 1) {
  const tier = stretchTier(baseTier, ["width", "box", "caps", "coil", "nodes"], k);
  const box = { x: tier.box[0], y: 20, w: tier.box[1] - tier.box[0], h: 228 };
  const duct = `M${tier.caps[0] + 6},${ROOM_DUCT_Y} L${tier.caps[1] - 6},${ROOM_DUCT_Y}`;
  return {
    width: tier.width,
    box,
    // The room name and the two stream captions share this baseline.
    titleY: box.y + 22,
    caps: { left: tier.caps[0], right: tier.caps[1] },
    terminals: tier.terminals,
    duct,
    ductLen: pathLength(duct),
    coil: { x: tier.coil, y: ROOM_DUCT_Y, r: 16 },
    // Centred on the room box. Only possible because the Zusatzheizung text
    // above ends at y=133, clear of the nodes' band, and the time program sits
    // in the header.
    nodes: {
      current_temperature: { x: tier.nodes[0], y: 165, tag: "IST", label: "Raumtemperatur" },
      climate: { x: tier.nodes[1], y: 165, tag: "SOLL", label: "Solltemperatur" },
    },
    supplyText: tier.terminals
      ? { x: tier.caps[0], y: ROOM_DUCT_Y + 38 }
      : { x: tier.caps[0] + 36, y: ROOM_DUCT_Y + 52, label: ROOM_DUCT_Y + 34 },
  };
}


class WgtRoomCard extends HTMLElement {
  static SLOTS = ROOM_SLOTS;

  static async getConfigElement() {
    await loadHaComponents();
    return document.createElement("wgt-room-card-editor");
  }

  static getStubConfig(hass) {
    const anchorId = Object.keys(hass?.states || {}).find(
      (id) => hass.states[id].attributes?.entity_type === "climate_room"
    );
    const deviceId = anchorId && hass.entities?.[anchorId]?.device_id;
    return deviceId
      ? { type: "custom:wgt-room-card", device_id: deviceId }
      : { type: "custom:wgt-room-card" };
  }

  setConfig(config) {
    this._config = { ...config };
    this._pickLayout();
    this._resolved = null;
    this._signature = null;
    this._dotSig = null;
    this._phase = this._phase || {};
  }

  connectedCallback() {
    this._resizer = observeWidth(this, (width) => {
      this._width = width;
      if (this._pickLayout() && this._hass) this._render();
    });
  }

  disconnectedCallback() {
    this._resizer?.disconnect();
  }

  // The full tier until the card has been measured, as on the air flow card.
  // Returns whether the layout changed, which needs a rebuild.
  _pickLayout() {
    const full = ROOM_TIERS.full.width;
    const w = Math.round(Math.min(this._width || full, full));
    const name = full <= w ? "full" : "narrow";
    const key = `${name}|${w}`;
    if (key === this._layoutKey) return false;
    this._layoutKey = key;
    this._layout = roomLayout(ROOM_TIERS[name], Math.max(1, w / ROOM_TIERS[name].width));
    this._built = false;
    return true;
  }

  set hass(hass) {
    this._hass = hass;
    const ids = this._entities();
    const climate = ids.climate && hass.states[ids.climate];
    const sig =
      Object.values(ids)
        .map((id) => (id ? hass.states[id]?.state ?? "?" : "-"))
        .join("|") + `|${climate?.attributes?.temperature ?? "-"}`;
    if (sig === this._signature) return;
    this._signature = sig;
    this._render();
  }

  _entities() {
    const stale =
      this._resolved &&
      Object.values(this._resolved).some((id) => id && !this._hass.states[id]);
    if (this._resolved && !stale) return this._resolved;
    this._resolved = resolveSlots(this._hass, ROOM_SLOTS, this._config);
    return this._resolved;
  }

  _state(slot) {
    const id = this._entities()[slot];
    return (id && this._hass.states[id]?.state) || null;
  }

  _num(slot) {
    const v = Number.parseFloat(this._state(slot));
    return Number.isFinite(v) ? v : null;
  }

  // The setpoint lives on the climate entity rather than in its state.
  _target() {
    const id = this._entities().climate;
    const v = Number.parseFloat(this._hass.states[id]?.attributes?.temperature);
    return Number.isFinite(v) ? v : null;
  }

  _dotColor(slot) {
    return dotColor(this._num(slot));
  }

  // Same curve as the air flow card, so dots move at one speed across both.
  _speed() {
    const pct = this._num("supply_flow");
    if (pct === null) return 40;
    if (pct <= 0) return 0;
    const f = Math.min(1, pct / 100);
    return 170 * f * f;
  }

  _dotsMarkup(now) {
    const speed = this._speed();
    if (!speed) {
      delete this._phase.room;
      return "";
    }
    const { duct, ductLen } = this._layout;
    const dur = Number((ductLen / speed).toFixed(2));
    const count = Math.max(1, Math.round(ductLen / DOT_SPACING));
    const prev = this._phase.room;
    const f0 = prev ? (((now - prev.t0) / prev.dur + prev.f0) % 1 + 1) % 1 : 0;
    this._phase.room = { t0: now, dur, f0 };
    const color = this._dotColor("supply_air");
    let out = "";
    for (let i = 0; i < count; i++) {
      const begin = `-${(((f0 + i / count) % 1) * dur).toFixed(3)}s`;
      out += `<circle r="4" fill="${color}" class="dot">
        <animateMotion dur="${dur}s" repeatCount="indefinite" calcMode="paced"
          begin="${begin}" path="${duct}"/>
      </circle>`;
    }
    return out;
  }

  _build() {
    // a fresh <g> holds no dots, whatever the last signature says
    this._dotSig = null;
    const L = this._layout;
    const { box, coil } = L;
    this.innerHTML = `
      <ha-card class="wgt-room">
        <style>
          .wgt-room .wrap { padding: 0; }
          .wgt-room svg { width: 100%; height: auto; display: block; max-width: ${L.width}px; margin: 0 auto; }
          .wgt-room .warn { padding: 8px 12px 0; color: var(--warning-color, #ffa726); font-size: 14px; }
          .wgt-room .housing { fill: var(--divider-color); fill-opacity: .12;
                     stroke: var(--secondary-text-color); stroke-width: 1.2;
                     stroke-opacity: .4; }
          .wgt-room .room-title { fill: var(--primary-text-color); font-size: 14px;
                        font-weight: 500; opacity: .85; }
          .wgt-room .duct { stroke: var(--divider-color); stroke-width: 15; fill: none;
                  stroke-linecap: round; opacity: .55; }
          .wgt-room .line { stroke: var(--disabled-text-color, #bdbdbd); stroke-width: 1; fill: none; }
          .wgt-room .ring { fill: var(--card-background-color, #fff); stroke-width: 2; }
          .wgt-room .cap { fill: var(--disabled-text-color, #bdbdbd); }
          .wgt-room .coil { fill: var(--card-background-color, #fff); stroke-width: 2;
                  stroke-dasharray: 4 3; }
          .wgt-room .coil.on { stroke-dasharray: none; }
          .wgt-room .tag { fill: var(--secondary-text-color); font-size: 13px; text-anchor: middle; }
          .wgt-room .val { fill: var(--primary-text-color); font-size: 19px; font-weight: 500;
                 text-anchor: middle; }
          .wgt-room .label { fill: var(--secondary-text-color); font-size: 14px; text-anchor: middle; }
          .wgt-room .coil-tag { fill: var(--secondary-text-color); font-size: 13px; font-weight: 500;
                      text-anchor: middle; }
          .wgt-room .caption { fill: var(--primary-text-color); font-size: 13px; font-weight: 500;
                     text-anchor: middle; letter-spacing: 1.2px; opacity: .8; }
          .wgt-room .sub { fill: var(--secondary-text-color); font-size: 13px; text-anchor: middle; }
          .wgt-room .sub.warm { fill: #f4511e; }
          .wgt-room .sub.cool { fill: #039be5; }
          .wgt-room .node { cursor: pointer; }
          .wgt-room .node:hover .ring, .wgt-room .node:hover .coil { stroke-width: 3; }
          .wgt-room .hit { fill: none; pointer-events: all; rx: 6; }
          .wgt-room .node:hover .hit { fill: var(--secondary-text-color); fill-opacity: .1; }
        </style>
        <div class="wrap">
          <svg viewBox="0 0 ${L.width} ${ROOM_H}" role="img" aria-label="Raumzustand">
            <rect x="${box.x}" y="${box.y}" width="${box.w}"
                  height="${box.h}" rx="20" class="housing"/>
            <text x="${box.x + 18}" y="${L.titleY}" class="room-title" data-room-title></text>

            <path d="${L.duct}" class="duct"/>
            <path d="${L.duct}" class="line"/>
            <g data-dots></g>

            <circle cx="${L.caps.left}" cy="${ROOM_DUCT_Y}" r="6" class="cap"/>
            <circle cx="${L.caps.right}" cy="${ROOM_DUCT_Y}" r="6" class="cap"/>
            ${L.terminals
              ? `<text x="${L.caps.left}" y="${L.titleY}" class="caption">ZULUFT</text>
                <text x="${L.caps.right}" y="${L.titleY}" class="caption">ABLUFT</text>`
              : ""}
            ${L.supplyText.label
              ? `<text x="${L.supplyText.x}" y="${L.supplyText.label}" class="label">Zuluft</text>`
              : ""}
            <text x="${L.supplyText.x}" y="${L.supplyText.y}" class="sub" data-supply-air></text>

            <g class="node" data-slot="aux_active">
              <rect x="${coil.x - 56}" y="${coil.y + 20}" width="112" height="40" class="hit"/>
              <circle cx="${coil.x}" cy="${coil.y}" r="${coil.r}" class="coil"
                      data-coil stroke="var(--disabled-text-color, #bdbdbd)"/>
              <text x="${coil.x}" y="${coil.y + 4}" class="coil-tag">ZH</text>
              <text x="${coil.x}" y="${coil.y + 34}" class="label">Zusatzheizung</text>
              <text x="${coil.x}" y="${coil.y + 52}" class="sub" data-aux></text>
            </g>

            <!-- a state of the whole room, so it heads the box opposite its name -->
            <g class="node" data-slot="scheduled">
              <rect x="${box.x + box.w - 130}" y="${L.titleY - 16}"
                    width="118" height="22" class="hit"/>
              <text x="${box.x + box.w - 18}" y="${L.titleY}"
                    class="sub" style="text-anchor: end" data-scheduled></text>
            </g>

            ${Object.entries(L.nodes).map(
              ([slot, n]) => `<g class="node" data-slot="${slot}">
                <rect x="${n.x - ROOM_NODE.w / 2}" y="${n.y - ROOM_NODE.h / 2}"
                      width="${ROOM_NODE.w}" height="${ROOM_NODE.h}" rx="13" class="ring"/>
                <text x="${n.x}" y="${n.y - 8}" class="tag">${n.tag}</text>
                <text x="${n.x}" y="${n.y + 13}" class="val"></text>
                <text x="${n.x}" y="${n.y + ROOM_NODE.h / 2 + 18}" class="label">${n.label}</text>
              </g>`
            ).join("")}

            <text x="${(L.nodes.current_temperature.x + L.nodes.climate.x) / 2}"
                  y="${box.y + box.h - 14}" class="sub" data-delta></text>
          </svg>
          <div class="warn" hidden>Kein Raum gewählt – bitte im Karten-Editor ein Raumgerät auswählen.</div>
        </div>
      </ha-card>`;

    this._svgEl = this.querySelector("svg");
    this._dotsEl = this.querySelector("[data-dots]");
    this._warnEl = this.querySelector(".warn");
    this._nodeEls = {};
    for (const g of this.querySelectorAll("[data-slot]")) {
      this._nodeEls[g.getAttribute("data-slot")] = g;
    }
    this._q = (sel) => this.querySelector(sel);

    this.querySelector(".wrap").addEventListener("click", (ev) => {
      const g = ev.target.closest(".node");
      const entityId = g && g.getAttribute("data-entity");
      if (!entityId) return;
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          detail: { entityId },
          bubbles: true,
          composed: true,
        })
      );
    });
    this._built = true;
  }

  // The area is what the user actually calls the room. Fall back to the
  // thermostat's name with the integration's own prefix and suffix stripped.
  _roomName() {
    const ids = this._entities();
    const id = ids.climate || ids.current_temperature;
    if (!id) return "Raum";
    const reg = this._hass.entities?.[id];
    const areaId =
      reg?.area_id || (reg?.device_id && this._hass.devices?.[reg.device_id]?.area_id);
    const area = areaId && this._hass.areas?.[areaId]?.name;
    if (area) return area;
    const name = this._hass.states[id]?.attributes?.friendly_name || "";
    return (
      name
        .replace(/^WGT\s*[-\u2013\u00b7]?\s*/, "")
        .replace(/\s*Raumthermostat$/, "")
        .trim() || "Raum"
    );
  }

  _update() {
    const ids = this._entities();
    const now = this._svgEl.getCurrentTime ? this._svgEl.getCurrentTime() : 0;

    const climate = ids.climate && this._hass.states[ids.climate];
    this._q("[data-room-title]").textContent = this._roomName();

    for (const slot of Object.keys(ROOM_SLOTS)) {
      const g = this._nodeEls[slot];
      if (g) g.setAttribute("data-entity", ids[slot] || "");
    }

    const ist = this._num("current_temperature");
    const soll = this._target();
    const istG = this._nodeEls.current_temperature;
    istG.querySelector(".ring").setAttribute("stroke", tempColor(ist));
    istG.querySelector(".val").textContent = ist === null ? "–" : `${ist.toFixed(1)}°`;
    const sollG = this._nodeEls.climate;
    sollG.querySelector(".ring").setAttribute("stroke", tempColor(soll));
    sollG.querySelector(".val").textContent = soll === null ? "–" : `${soll.toFixed(1)}°`;

    const deltaEl = this._q("[data-delta]");
    if (ist === null || soll === null) {
      deltaEl.textContent = "";
      deltaEl.classList.remove("warm", "cool");
    } else {
      const d = ist - soll;
      deltaEl.textContent =
        Math.abs(d) < 0.3
          ? "auf Soll"
          : `${Math.abs(d).toFixed(1)} K ${d > 0 ? "über" : "unter"} Soll`;
      deltaEl.classList.toggle("warm", d >= 0.3);
      deltaEl.classList.toggle("cool", d <= -0.3);
    }

    // Register 440+i is the room's heating enable, and the climate entity's
    // hvac_mode is derived straight from it (climate.py). Reading both would
    // print one register twice under two names, so the climate entity is the
    // source and the switch only a fallback for a stripped-down setup.
    const hvac = climate?.state;
    const auxEnabled = hvac ? hvac === "heat" : this._state("aux_enabled") === "on";
    // Missing on a unit without the heating module, so only an explicit off locks.
    const houseLocked = this._state("aux_enabled_house") === "off";
    const auxActive = this._state("aux_active") === "on";
    const coil = this._q("[data-coil]");
    coil.setAttribute("stroke", auxActive ? "#ff9800" : "var(--disabled-text-color, #bdbdbd)");
    coil.classList.toggle("on", auxActive);
    this._q("[data-aux]").textContent = auxActive
      ? "heizt"
      : houseLocked
        ? "gesperrt (Haus)"
        : auxEnabled
          ? "bereit"
          : "gesperrt";

    const sched = this._state("scheduled");
    this._q("[data-scheduled]").textContent =
      sched === null ? "" : `Zeitprogramm ${sched === "on" ? "an" : "aus"}`;

    const t4 = this._num("supply_air");
    this._q("[data-supply-air]").textContent = t4 === null ? "" : `${t4.toFixed(1)}°`;

    const dotSig = `${this._speed()}|${this._dotColor("supply_air")}`;
    if (dotSig !== this._dotSig) {
      this._dotSig = dotSig;
      this._dotsEl.innerHTML = this._dotsMarkup(now);
    }

    this._warnEl.hidden = Boolean(ids.climate || ids.current_temperature);
  }

  _render() {
    if (!this._built) this._build();
    this._update();
  }

  getCardSize() {
    return 5;
  }
}

class WgtRoomCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  _update() {
    if (!this._config || !this._hass) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (sch) =>
        ({ device_id: "Raumgerät" })[sch.name] || sch.name;
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const next = { ...ev.detail.value };
        if (!next.device_id) delete next.device_id;
        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: next },
            bubbles: true,
            composed: true,
          })
        );
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = [
      { name: "device_id", selector: { device: { integration: "schwoerer_lueftung" } } },
    ];
    this._form.data = this._config;
  }
}

customElements.define("wgt-room-card-editor", WgtRoomCardEditor);
customElements.define("wgt-room-card", WgtRoomCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "wgt-room-card",
  name: "WGT Raum",
  description: "Zustand eines einzelnen Raums: Ist, Soll und Zusatzheizung",
  preview: true,
  documentationURL: "https://github.com/josa42/homeassistant-schwoerer-lueftung-cards",
});

customElements.define("wgt-air-flow-card-editor", WgtAirFlowCardEditor);
customElements.define("wgt-air-flow-card", WgtAirFlowCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "wgt-air-flow-card",
  name: "WGT Luftweg",
  description: "Schematischer Luftweg der WGT mit allen Temperaturfühlern",
  preview: true,
  documentationURL: "https://github.com/josa42/homeassistant-schwoerer-lueftung-cards",
});
