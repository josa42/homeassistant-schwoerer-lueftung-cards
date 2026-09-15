# Changelog

## Unreleased

### Added

- **WGT Luftweg card.** A schematic of the ventilation unit with every
  temperature sensor at its real position in the air path. Supply and exhaust
  cross inside the heat exchanger, and animated dots follow the air at one
  constant speed scaled by the unit's current air performance, each carrying the
  colour of the last sensor it passed.
- **Sensors resolve from a device, not an entity list.** The card matches each
  position against the `entity_type` state attribute the integration sets, so
  renaming an entity does not break it and one config works on any WGT unit.
  Individual positions can still be overridden.
- **Visual editor.** Pick the WGT device from a device picker; everything else
  has a working default.
- **Clickable readouts.** Every sensor, the bypass state, the heat pump state
  and both air performance values open their more-info dialog with history.
