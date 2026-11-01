# Reference

## How entities are found

Neither card holds a list of entity IDs. You pick a device, and each position on
the card is matched against the `entity_type` state attribute that the
integration sets on every one of its entities.

Renaming an entity therefore does not break a card, and one card config works on
any WGT unit.

Two slots are matched by domain as well as type, because
`auxiliary_heating_enabled_room` exists as both a switch and a binary sensor.
Three more ignore the chosen device, because a room card needs the Zuluft
temperature, the fan rate and the house-wide heating permit, and all three
live on the main unit.

## WGT Luftweg

The order of the components and where each sensor sits are documented, with
sources and measurements, in [Air path](air-flow.md).

| Slot | `entity_type` | Shown as |
|------|---------------|----------|
| `outdoor` | `temperature_t10_outdoor` | T10, Außen |
| `after_preheater` | `temperature_t2_after_preheating_coil` | T2, nach VHR |
| `heat_exchanger` | `temperature_t6_in_heat_exchanger` | T6, nach WT |
| `condenser` | `temperature_t8_condenser` | T8, Kondensator |
| `before_reheater` | `temperature_t3_before_reheater` | T3, vor NE |
| `after_reheater` | `temperature_t4_after_reheater` | T4, nach NE |
| `evaporator` | `temperature_t7_evaporator` | T7, Verdampfer |
| `exhaust` | `temperature_t5_exhaust_air` | T5, Abluft |
| `heat_pump` | `heat_pump_status` | Wärmepumpe state |
| `bypass` | `bypass_state` | Wärmetauscher bypass state |
| `supply_flow` | `current_supply_air_flow` | Zuluft percentage, dot speed |
| `exhaust_flow` | `current_exhaust_air_flow` | Abluft percentage, dot speed |

T1 and T9 are absent on purpose. T1 only exists on units with a ground heat
exchanger, and T9 is an undocumented register the integration disables by
default.

## WGT Raum

| Slot | `entity_type` | Domain | Shown as |
|------|---------------|--------|----------|
| `current_temperature` | `current_temperature_room` | sensor | IST |
| `climate` | `climate_room` | climate | SOLL, and whether heating is permitted |
| `aux_active` | `auxiliary_heating_active_room` | binary_sensor | Zusatzheizung, firing |
| `aux_enabled` | `auxiliary_heating_enabled_room` | switch | fallback for the permit |
| `scheduled` | `scheduled_heating_enabled_room` | switch | Zeitprogramm |
| `base_temperature` | `base_temperature_room` | number | not drawn, reserved |
| `supply_air` | `temperature_t4_after_reheater` | sensor | Zuluft, dot colour (main unit) |
| `supply_flow` | `current_supply_air_flow` | sensor | dot speed (main unit) |
| `aux_enabled_house` | `auxiliary_heating_enabled` | switch | Zusatzheizung, house-wide permit (main unit) |

The Zusatzheizung line reads `heizt`, `bereit` or `gesperrt`. Whether heating is
permitted and whether it is firing are two different registers, but the climate
entity's `hvac_mode` is derived from the permit register rather than being one
of its own, so the card states it once instead of twice.

The room's permit only counts if the house-wide one is on too. When the main
unit's `auxiliary_heating_enabled` switch is off, the line reads
`gesperrt (Haus)`, so it is clear which switch to turn on.

The room name comes from the area, falling back to the thermostat's name with
the integration's prefix and suffix stripped.

## Widths

Both cards are drawn at their own width in px, so the text keeps one size. A
card picks the widest form that fits and spreads it over its width. Only below
the narrowest form does the drawing scale down.

| Luftweg card width | Shows |
|--------------------|-------|
| 1160 px and more | everything |
| 856 to 1159 px | everything but the VHR and NE labels |
| 748 to 855 px | without T2, T7 and T8; the heat pump is the link between the ducts |
| 470 to 747 px | T10, T5, T6, T3 and T4, always compact |
| below 470 px | T10, T5 and T4, always compact; scaled down below 348 px |

`compact: true` applies to every form. The two narrowest are compact anyway,
because without the labels under the sensors the full height is empty space.

| Room card width | Shows |
|-----------------|-------|
| 580 px and more | everything, with Zuluft and Abluft outside the room |
| below 580 px | the room across the whole width, the Zuluft temperature in front of the auxiliary heater; scaled down below 340 px |

Past 1160 px and 580 px the drawings stop growing and sit centred.

## Troubleshooting

**The card says no device is selected.** Nothing matched the chosen device.
Check that the integration is loaded, and that you picked the WGT unit for the
air flow card or a room device for the room card.

**The card does not appear at all.** The browser cached the old resource. Hard
refresh. If you installed manually, check the `?v=` query differs from last
time.

**Dots do not move.** The air performance sensors read 0, so the fans are off.
The card hides the dots rather than crawling them.

**The Zusatzheizung coil never turns orange.** Fixed in the release that scoped
each card's CSS. Before that, both cards wrote global styles and the air flow
card's grey coil stroke won over the room card's.
