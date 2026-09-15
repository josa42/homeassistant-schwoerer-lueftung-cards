const CARD_VERSION = "0.0.0";

// Which build is loaded is the first question on any bug report, and a card has
// nowhere else to say so. scripts/release.sh keeps this in step with the tag.
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
  heat_exchanger: { type: "temperature_t6_in_heat_exchanger", tag: "T6", label: "im WT" },
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

// Layout. Outdoor air enters low on the left and leaves high on the right as
// supply; room air enters low on the right and leaves high on the left as
// exhaust. Each stream is one horizontal run, a single turn, one straight
// diagonal through the heat exchanger where the two cross, a single turn back,
// and a second horizontal run. Two corners per stream, no more.
const NODE_W = 78;
const NODE_H = 54;
const TOP_Y = 110;
const BOT_Y = 320;
const ROW_LABEL_DY = 46;

const HOUSING = { x: 140, y: 30, w: 880, h: 360 };
const ZONES = [
  { x: 0, y: 30, w: 120, h: 360 },
  { x: 1040, y: 30, w: 120, h: 360 },
];

// Both enclosures share a top and a height so they read as one row of gear.
const COMPONENTS = [
  { x: 420, y: 56, w: 160, h: 320, title: "Wärmetauscher", state: "bypass" },
  { x: 647, y: 56, w: 106, h: 320, title: "Wärmepumpe", state: "heat_pump" },
];

const NODES = {
  outdoor: { x: 60, y: BOT_Y },
  after_preheater: { x: 300, y: BOT_Y },
  heat_exchanger: { x: 500, y: 215 },
  condenser: { x: 700, y: TOP_Y },
  before_reheater: { x: 808, y: TOP_Y },
  after_reheater: { x: 964, y: TOP_Y },
  evaporator: { x: 700, y: BOT_Y },
  exhaust: { x: 964, y: BOT_Y },
};

// Each stream is ONE continuous path, so its dots keep a single phase from end
// to end: even spacing, nothing appearing or vanishing at a join. The path runs
// straight behind the node boxes and coils, which are drawn on top, so a dot is
// simply hidden while it crosses one.
//
// The turns are quadratics whose control point IS the corner. The diagonals run
// 380,320 -> 620,110 and 620,320 -> 380,110, crossing dead centre at 500,215.
//
// `runs` splits each path only for COLOUR: a dot carries the reading of the last
// sensor it passed, and the split points are where it passes one.
const STREAMS = [
  {
    name: "supply",
    runs: [
      { from: "outdoor", d: "M99,320 L339,320" },
      { from: "after_preheater", d: "L362,320 Q380,320 393.5,308.2 L539,181" },
      { from: "heat_exchanger", d: "L606.5,121.8 Q620,110 638,110 L739,110" },
      { from: "condenser", d: "L847,110" },
      { from: "before_reheater", d: "L1003,110" },
      { from: "after_reheater", d: "L1094,110" },
    ],
  },
  {
    name: "exhaust",
    runs: [
      { from: "exhaust", d: "M1094,320 L661,320" },
      { from: "evaporator", d: "L638,320 Q620,320 606.5,308.2 L461,181" },
      { from: "heat_exchanger", d: "L393.5,121.8 Q380,110 362,110 L66,110" },
    ],
  },
];

const COILS = [
  { x: 200, y: BOT_Y, tag: "VHR", label: "Vorheizregister",
    labelY: BOT_Y + ROW_LABEL_DY + 16, labelClass: "label" },
  { x: 886, y: TOP_Y, tag: "NE", label: "Nachheizregister",
    labelY: 47, labelClass: "component-title" },
];

const TERMINALS = [
  { x: 60, y: TOP_Y, caption: "Fortluft", capped: true },
  { x: 60, y: BOT_Y, caption: "Außenluft", capped: false },
  { x: 1100, y: TOP_Y, caption: "Zuluft", capped: true, flow: "supply_flow" },
  { x: 1100, y: BOT_Y, caption: "Abluft", capped: true, flow: "exhaust_flow" },
];

const HP_LINK = { x: 700, top: 137, bottom: 293 };

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

for (const stream of STREAMS) {
  stream.d = stream.runs.map((r) => r.d).join(" ");
  let acc = "";
  stream.stops = stream.runs.map((r) => {
    acc += (acc ? " " : "") + r.d;
    return pathLength(acc);
  });
  stream.len = stream.stops[stream.stops.length - 1];
  // A colour is held from the previous stop to its own, as a fraction of the
  // whole path, so the fill animation stays locked to the motion animation.
  stream.keyTimes = [0, ...stream.stops.slice(0, -1).map((v) => v / stream.len)]
    .map((f) => f.toFixed(4))
    .join(";");
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

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    this._config = { title: "WGT Temperaturen", ...config };
    this._resolved = null;
    this._signature = null;
    this._dotSig = null;
    this._hpSig = null;
    this._phase = this._phase || {};
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

  // Explicit overrides win; otherwise match `entity_type` within the chosen
  // device. Cached, and rebuilt whenever a resolved entity goes missing.
  _entities() {
    const stale =
      this._resolved &&
      Object.values(this._resolved).some((id) => id && !this._hass.states[id]);
    if (this._resolved && !stale) return this._resolved;

    const cfg = this._config;
    const overrides = cfg.sensors || {};
    const deviceId = cfg.device_id;
    const byType = {};
    for (const id of Object.keys(this._hass.states)) {
      const type = this._hass.states[id].attributes?.entity_type;
      if (!type || type in byType) continue;
      if (deviceId && this._hass.entities?.[id]?.device_id !== deviceId) continue;
      byType[type] = id;
    }

    this._resolved = {};
    for (const [slot, meta] of Object.entries(SLOTS)) {
      this._resolved[slot] = overrides[slot] || cfg[slot] || byType[meta.type] || null;
    }
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

  _node(slot) {
    const { x, y } = NODES[slot];
    const meta = SLOTS[slot];
    const v = this._num(slot);
    const id = this._entities()[slot];
    return `
      <g class="node" data-entity="${esc(id || "")}">
        <rect x="${x - NODE_W / 2}" y="${y - NODE_H / 2}" width="${NODE_W}" height="${NODE_H}"
              rx="13" class="ring" stroke="${tempColor(v)}"/>
        <text x="${x}" y="${y - 7}" class="tag">${esc(meta.tag)}</text>
        <text x="${x}" y="${y + 14}" class="val">${v === null ? "–" : `${v.toFixed(1)}°`}</text>
        ${meta.label
          ? `<text x="${x}" y="${y + ROW_LABEL_DY}" class="label">${esc(meta.label)}</text>`
          : ""}
      </g>`;
  }

  // Dot colour is quantised to 0.5 K. A raw reading flickers by 0.1 K every
  // poll, and rebuilding the dots for a colour shift nobody can see is churn.
  _dotColor(slot) {
    const v = this._num(slot);
    // SMIL cannot animate to a var(), so an unavailable reading needs a literal.
    return v === null ? "#9e9e9e" : tempColor(Math.round(v * 2) / 2);
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
    const colors = stream.runs.map((r) => this._dotColor(r.from));
    let out = "";
    for (let i = 0; i < count; i++) {
      const begin = `-${(((f0 + i / count) % 1) * dur).toFixed(3)}s`;
      out += `<circle r="4" fill="${colors[0]}" class="dot">
        <animateMotion dur="${dur}s" repeatCount="indefinite" calcMode="paced"
          begin="${begin}" path="${stream.d}"/>
        <animate attributeName="fill" dur="${dur}s" repeatCount="indefinite"
          calcMode="discrete" begin="${begin}"
          values="${colors.join(";")}" keyTimes="${stream.keyTimes}"/>
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
    // Heat leaves the evaporator for the condenser when heating, the other way
    // when cooling, so the dots follow the actual transfer.
    const d =
      hpState === "cooling"
        ? `M${HP_LINK.x},${HP_LINK.top} L${HP_LINK.x},${HP_LINK.bottom}`
        : `M${HP_LINK.x},${HP_LINK.bottom} L${HP_LINK.x},${HP_LINK.top}`;
    const dur = Number(((HP_LINK.bottom - HP_LINK.top) / 60).toFixed(2));
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
    const linkD = `M${HP_LINK.x},${HP_LINK.top} L${HP_LINK.x},${HP_LINK.bottom}`;
    this.innerHTML = `
      <ha-card>
        <style>
          .wrap { padding: 0; }
          svg { width: 100%; height: auto; display: block; max-width: 1160px; margin: 0 auto; }
          .warn { padding: 8px 12px 0; color: var(--warning-color, #ffa726); font-size: 14px; }
          .zone { fill: var(--divider-color); opacity: .22; }
          .housing { fill: var(--divider-color); fill-opacity: .12;
                     stroke: var(--secondary-text-color); stroke-width: 1.2;
                     stroke-opacity: .4; }
          .component { fill: none; stroke: var(--secondary-text-color); stroke-width: 1.5;
                       stroke-dasharray: 6 5; opacity: .55; }
          .component-title { fill: var(--secondary-text-color); font-size: 14px;
                             font-weight: 500; text-anchor: middle; }
          .duct { stroke: var(--divider-color); stroke-width: 15; fill: none;
                  stroke-linecap: round; stroke-linejoin: round; opacity: .55; }
          .line { stroke: var(--disabled-text-color, #bdbdbd); stroke-width: 1; fill: none; }
          .hp-link { stroke-width: 2; }
          .hp-link.idle { stroke-dasharray: 5 5; opacity: .5; }
          .ring { fill: var(--card-background-color, #fff); stroke-width: 2; }
          .cap { fill: var(--disabled-text-color, #bdbdbd); }
          .coil { fill: var(--card-background-color, #fff);
                  stroke: var(--disabled-text-color, #bdbdbd); stroke-width: 1.5;
                  stroke-dasharray: 4 3; }
          .tag { fill: var(--secondary-text-color); font-size: 13px; text-anchor: middle; }
          .val { fill: var(--primary-text-color); font-size: 19px; font-weight: 500;
                 text-anchor: middle; }
          .label { fill: var(--secondary-text-color); font-size: 14px; text-anchor: middle; }
          .coil-tag { fill: var(--secondary-text-color); font-size: 13px; font-weight: 500;
                      text-anchor: middle; }
          .caption { fill: var(--primary-text-color); font-size: 13px; font-weight: 500;
                     text-anchor: middle; letter-spacing: 1.2px; opacity: .8; }
          .sub { fill: var(--secondary-text-color); font-size: 13px; text-anchor: middle; }
          .sub.alert { fill: var(--info-color, #039be5); }
          .node { cursor: pointer; }
          .node:hover .ring { stroke-width: 3; }
          .hit { fill: none; pointer-events: all; rx: 6; }
          .node:hover .hit { fill: var(--secondary-text-color); fill-opacity: .1; }
        </style>
        <div class="wrap">
          <svg viewBox="0 0 1160 415" role="img" aria-label="WGT Luftweg mit Temperaturen">
            ${ZONES.map(
              (z) => `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="16" class="zone"/>`
            ).join("")}
            <rect x="${HOUSING.x}" y="${HOUSING.y}" width="${HOUSING.w}" height="${HOUSING.h}"
                  rx="20" class="housing"/>
            ${STREAMS.map((s) => `<path d="${s.d}" class="duct"/>`).join("")}
            ${COMPONENTS.map(
              (c) => `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="14" class="component"/>
                <text x="${c.x + c.w / 2}" y="${c.y - 9}" class="component-title">${c.title}</text>`
            ).join("")}
            ${STREAMS.map((s) => `<path d="${s.d}" class="line"/>`).join("")}
            <path d="${linkD}" class="line hp-link" data-hp-link/>
            <g data-dots></g>
            <g data-hp-dots></g>
            ${TERMINALS.map(
              (t) => `${t.capped ? `<circle cx="${t.x}" cy="${t.y}" r="6" class="cap"/>` : ""}
                <text x="${t.x}" y="${t.y - 36}" class="caption">${esc(t.caption.toUpperCase())}</text>
                ${t.flow
                  ? `<g class="node" data-slot="${t.flow}">
                      <rect x="${t.x - 55}" y="${t.y + ROW_LABEL_DY - 17}" width="110" height="24" class="hit"/>
                      <text x="${t.x}" y="${t.y + ROW_LABEL_DY}" class="label" data-flow="${t.flow}"></text>
                    </g>`
                  : ""}`
            ).join("")}
            ${COILS.map(
              (c) => `<circle cx="${c.x}" cy="${c.y}" r="17" class="coil"/>
                <text x="${c.x}" y="${c.y + 4}" class="coil-tag">${c.tag}</text>
                <text x="${c.x}" y="${c.labelY}" class="${c.labelClass}">${c.label}</text>`
            ).join("")}
            <g class="node" data-slot="bypass">
              <rect x="425" y="60" width="150" height="24" class="hit"/>
              <text x="500" y="76" class="sub" data-sub="bypass"></text>
            </g>
            <g class="node" data-slot="heat_pump">
              <rect x="${HP_LINK.x - 50}" y="60" width="100" height="24" class="hit"/>
              <text x="${HP_LINK.x}" y="76" class="sub" data-sub="heat_pump"></text>
            </g>
            ${Object.keys(NODES).map((slot) => {
              const { x, y } = NODES[slot];
              const meta = SLOTS[slot];
              return `<g class="node" data-slot="${slot}">
                <rect x="${x - NODE_W / 2}" y="${y - NODE_H / 2}" width="${NODE_W}" height="${NODE_H}"
                      rx="13" class="ring"/>
                <text x="${x}" y="${y - 7}" class="tag">${esc(meta.tag)}</text>
                <text x="${x}" y="${y + 14}" class="val"></text>
                ${meta.label
                  ? `<text x="${x}" y="${y + ROW_LABEL_DY}" class="label">${esc(meta.label)}</text>`
                  : ""}
              </g>`;
            }).join("")}
          </svg>
          <div class="warn" hidden>Kein WGT-Gerät gewählt – bitte im Karten-Editor ein Gerät auswählen.</div>
        </div>
      </ha-card>`;

    this._card = this.querySelector("ha-card");
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
    const ids = this._entities();
    const now = this._svgEl.getCurrentTime ? this._svgEl.getCurrentTime() : 0;

    if (this._config.title) this._card.setAttribute("header", this._config.title);
    else this._card.removeAttribute("header");

    for (const slot of Object.keys(NODES)) {
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

    for (const t of TERMINALS) {
      if (!t.flow) continue;
      const v = this._num(t.flow);
      this._flowEls[t.flow].textContent = v === null ? "" : `${v} %`;
    }

    // Re-issue dots only when their speed or quantised colours actually change;
    // _phaseOf then makes that swap invisible.
    const dotSig = STREAMS.map(
      (s) => this._speed(s.name) + ":" + s.runs.map((r) => this._dotColor(r.from)).join(",")
    ).join("|");
    if (dotSig !== this._dotSig) {
      this._dotSig = dotSig;
      this._dotsEl.innerHTML = STREAMS.map((s) => this._dotsMarkup(s, now)).join("");
    }
    const hpSig = hpOn ? hpState : "off";
    if (hpSig !== this._hpSig) {
      this._hpSig = hpSig;
      this._hpDotsEl.innerHTML = this._hpDotsMarkup(hpState, now);
    }

    this._warnEl.hidden = Object.keys(NODES).some((slot) => ids[slot]);
  }

  _render() {
    if (!this._built) this._build();
    this._update();
  }

  getCardSize() {
    return 6;
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
      { name: "title", selector: { text: {} } },
      { name: "device_id", selector: { device: { integration: "schwoerer_lueftung" } } },
      {
        name: "sensors",
        type: "expandable",
        title: "Fühler einzeln überschreiben",
        schema: Object.keys(SLOTS).map((slot) => ({
          name: slot,
          selector: { entity: { integration: "schwoerer_lueftung" } },
        })),
      },
    ];
  }

  _update() {
    if (!this._config || !this._hass) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => {
        const meta = SLOTS[s.name];
        if (meta) return meta.tag ? `${meta.tag} · ${meta.label}` : meta.label;
        return { title: "Titel", device_id: "WGT-Gerät",
                 sensors: "Fühler einzeln überschreiben" }[s.name] || s.name;
      };
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const next = { ...ev.detail.value };
        // ha-form hands back empty strings for cleared pickers; drop them so
        // the slot falls back to entity_type resolution again.
        if (next.sensors) {
          next.sensors = Object.fromEntries(
            Object.entries(next.sensors).filter(([, v]) => v)
          );
          if (!Object.keys(next.sensors).length) delete next.sensors;
        }
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
    this._form.schema = this._schema();
    this._form.data = this._config;
  }
}

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
