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
- **Visual editor.** Pick the device, and that is the entire configuration.
  Both cards work everything else out from it, so there is no card title, no
  name and no per-entity override to get wrong.
- **WGT Raum card.** The state of a single room in the same visual language:
  supply air arriving, the room's measured and target temperature side by side,
  the auxiliary heater with its own state, and how far the room sits from its
  setpoint. Rooms are separate devices, so one card is one room.
- **Card styles are scoped.** Both cards write their CSS into the light DOM,
  so generic class names like `.coil` leaked between them. With both on one
  dashboard the air flow card's grey coil stroke won over the room card's
  presentation attribute, and the auxiliary heater could never show as firing.
- **Clickable readouts.** Every sensor, the bypass state, the heat pump state
  and both air performance values open their more-info dialog with history.
