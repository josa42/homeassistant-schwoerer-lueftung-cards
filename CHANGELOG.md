# Changelog

## Unreleased

### Added

- **`reheater: false` for a unit without a Nachheizregister.** The Luftweg
  card then leaves out the NE and labels T4 "nach WP". The register reads
  inactive with or without one, so the card cannot tell by itself.
- **Every value opens its detail view.** The VHR and NE on the Luftweg card and
  the Zuluft temperature on the room card now open their entity too.

### Changed

- **T3 reads "vor WP".** The register list calls it "vor NE", which skips the
  whole heat pump between them.

## 1.3.0 - 2026-11-01

### Added

- **Both cards fit any width.** They are drawn at their own width in px, so the
  text keeps one size, and they leave out what no longer fits. On a phone the
  Luftweg card shows T10, T5 and T4, and the room card gives the whole width to
  the room. [Reference](docs/reference.md#widths) lists the widths.
- **Compact Luftweg card.** `compact: true`, or Kompakt in the editor, shows
  the same diagram at about half the height, without the labels under the
  sensors and the component titles.

### Changed

- **T6 reads "nach WT".** The register list calls it "im WT", but it measures
  the exhaust air leaving the heat exchanger.
- **The Nachheizregister is labelled "Nachheizung".** The long name ran over
  the heat pump's border.
- **The room card shows the time program in its header**, opposite the room
  name.

### Fixed

- **T4 sits inside the Luftweg card's housing.** It straddled the right edge.

## 1.2.0 - 2026-11-01

### Fixed

- **The Luftweg card draws the components in the order the air passes them.**
  The heat pump now sits behind the heat exchanger on both streams, as in the
  WRG 134 BP-HK: T3 comes before the condenser, and T6 sits on the exhaust
  side between the heat exchanger and the evaporator. Außenluft and Abluft
  both enter on the left. The supply dots behind the heat exchanger now take
  T3's colour instead of T6's. [Air path](docs/air-flow.md) lists the sources
  and measurements.

### Changed

- **Dots change colour inside the heat exchanger.** On the Luftweg card the
  supply dots fade from T2 to T3 and the exhaust dots from T5 to T6 while they
  cross it, instead of switching colour at the next sensor.

## 1.1.1 - 2026-10-21

### Fixed

- **The room card respects the house-wide Zusatzheizung permit.** With the
  main unit's `auxiliary_heating_enabled` switch off, the Zusatzheizung line
  reads `gesperrt (Haus)` instead of `bereit`.

### Changed

- **Releases are built by the release workflow.** It runs CI, bumps the
  version, dates this changelog and publishes the release. Start it from the
  Actions tab or with `gh workflow run release -f version=<version>`.
  `scripts/release.sh` is gone.

- **CI calls the shared workflows in josa42/actions.** They moved there from
  josa42/gha-workflows.

- **`make release` starts the release workflow.** It releases a minor version
  when a `feat` commit landed since the last release and a patch otherwise.
  Pass `VERSION=major`, `VERSION=minor`, `VERSION=patch` or `VERSION=1.2.3`
  to choose yourself. Without a release yet, it asks for the first version.
  It refuses to start while local changes are not pushed, since the workflow
  releases what is on GitHub.

## 1.1.0

- Updated styling

## 1.0.0 - 2026-09-15

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
