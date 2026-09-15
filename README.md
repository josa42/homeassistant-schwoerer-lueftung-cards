# Schwörer Lüftung Cards

[![GitHub Release](https://img.shields.io/github/v/release/josa42/homeassistant-schwoerer-lueftung-cards?style=flat-square)](https://github.com/josa42/homeassistant-schwoerer-lueftung-cards/releases)
[![License](https://img.shields.io/github/license/josa42/homeassistant-schwoerer-lueftung-cards?style=flat-square)](LICENSE)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=flat-square)](https://hacs.xyz/)

Dashboard cards for the [Schwörer Lüftung integration](https://github.com/josa42/homeassistant-schwoerer-lueftung).

<br><br>

## WGT Luftweg

![The WGT Luftweg card, showing air moving through the unit](assets/wgt-air-flow-card.gif)

A schematic of the ventilation unit showing every temperature sensor at its real
position in the air path.

Outdoor air enters low on the left and leaves high on the right as supply air.
Room air enters low on the right and leaves high on the left as exhaust. The two
streams cross inside the heat exchanger, which is what the X in the middle is.

Animated dots follow the air. They travel at one constant speed across the whole
diagram, scaled by the unit's current air performance, and each dot carries the
colour of the last sensor it passed. The heat pump link between the condenser
and the evaporator animates in the direction heat is actually moving, upward
when heating and downward when cooling.

Tapping any sensor, the bypass state, the heat pump state, or either air
performance value opens its more-info dialog with history.

The recording above shows a winter state at fan level 3, with the heat pump
heating, so that the colour scale and the heat transfer direction are both
visible. Regenerate it after changing the card with `npm run preview`, which
needs `librsvg` and `imagemagick`. It regenerates both cards' recordings.

<br><br>

## WGT Raum

![The WGT Raum card, showing supply air reaching a room below its setpoint](assets/wgt-room-card.gif)

The state of one room, in the same visual language. Supply air arrives from the
unit on the left, passes the room's auxiliary heating coil, and leaves as
exhaust on the right. Inside sit the measured and the target temperature, how
far apart they are, and whether the thermostat is heating or only ventilating.

Each room is its own device in the integration, so one card shows one room. The
card names itself after the room's area.

The Zusatzheizung line reads `heizt`, `bereit` or `gesperrt`. Whether heating is
permitted and whether it is firing are two different registers, but the climate
entity's `hvac_mode` is derived from the permit register rather than being one
of its own, so the card states it once instead of twice.

```yaml
type: custom:wgt-room-card
device_id: 28d672dcbceff92601287789cdffb7bb
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | required | `custom:wgt-room-card` |
| `device_id` | string | auto | The room device. The visual editor fills this in. |

Two of its slots deliberately read from the main unit rather than the room:
the Zuluft temperature (T4) and the air performance that sets the dot speed.
Neither exists on a room device.

<br><br>

## Requirements

- Home Assistant **2026.9.0** or newer
- The [Schwörer Lüftung integration](https://github.com/josa42/homeassistant-schwoerer-lueftung), version 2.1.0 or newer
- A WGT device (the card reads sensors that WRT units do not expose)

<br><br>

## Installation

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=josa42&repository=homeassistant-schwoerer-lueftung-cards&category=plugin)

This repository is not in the HACS default store, so the button carries
`category=plugin`. That is what lets HACS offer to add it as a custom
repository rather than reporting it as not found.

Click the button, confirm the prompt, then Download, then reload your browser
with a hard refresh.

Adding the repository by hand, or installing without HACS:
[manual installation](docs/manual_installation.md).

<br><br>

## Usage

Add the card from the dashboard card picker and choose your WGT device. That is
the whole configuration:

```yaml
type: custom:wgt-air-flow-card
device_id: 1642a8c262a6172354e757a7be8f2f48
```

The card is wide. Give it a full-width section so it is not squeezed:

```yaml
type: sections
max_columns: 2
sections:
  - type: grid
    column_span: 2
    cards:
      - type: custom:wgt-air-flow-card
        device_id: 1642a8c262a6172354e757a7be8f2f48
```

<br><br>

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | required | `custom:wgt-air-flow-card` |
| `device_id` | string | auto | The WGT device. The visual editor fills this in. |

That is the whole configuration. Everything else the card needs it works out
from the device.

### How sensors are found

The card does not hold a list of entity IDs. It takes the device you picked and
matches each position in the diagram against the `entity_type` state attribute
that the integration sets on every one of its entities.

This means renaming an entity does not break the card, and the same card config
works on any WGT unit.

The positions it fills:

| Slot | `entity_type` | Shown as |
|------|---------------|----------|
| `outdoor` | `temperature_t10_outdoor` | T10, Außen |
| `after_preheater` | `temperature_t2_after_preheating_coil` | T2, nach VHR |
| `heat_exchanger` | `temperature_t6_in_heat_exchanger` | T6, im WT |
| `condenser` | `temperature_t8_condenser` | T8, Kondensator |
| `before_reheater` | `temperature_t3_before_reheater` | T3, vor NE |
| `after_reheater` | `temperature_t4_after_reheater` | T4, nach NE |
| `evaporator` | `temperature_t7_evaporator` | T7, Verdampfer |
| `exhaust` | `temperature_t5_exhaust_air` | T5, Abluft |
| `heat_pump` | `heat_pump_status` | Wärmepumpe state |
| `bypass` | `bypass_state` | Wärmetauscher bypass state |
| `supply_flow` | `current_supply_air_flow` | Zuluft percentage, dot speed |
| `exhaust_flow` | `current_exhaust_air_flow` | Abluft percentage, dot speed |

T1 and T9 are deliberately absent. T1 only exists on units with a ground heat
exchanger, and T9 is an undocumented register that the integration disables by
default.

<br><br>

## Troubleshooting

**The card says no device is selected.** Nothing matched the chosen device. Check
that the integration is loaded and that the device you picked is the WGT unit
itself rather than one of its room devices.

**The card does not appear at all.** The browser cached the old resource. Hard
refresh, and if you installed manually, check the `?v=` query is different from
last time.

**Dots do not move.** The air performance sensors read 0, so the fans are off.
The card hides the dots rather than crawling them.

<br><br>

## License

[MIT](LICENSE)
