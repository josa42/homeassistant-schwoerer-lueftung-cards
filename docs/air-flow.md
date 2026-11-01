# WGT air path

The WGT Luftweg card claims to show every sensor at its real position in the
air path. This page records what that position is and how we know.

## The path

```
Außenluft  T10 → VHR → T2 → [WT] → T3 → Kondensator T8 → NE → T4 → Zuluft
Abluft     T5               → [WT] → T6 → Verdampfer  T7             → Fortluft
```

The heat pump sits behind the heat exchanger on both streams. Its condenser
heats supply air that the heat exchanger has already warmed, and its evaporator
cools exhaust air that has already left the heat exchanger.

The card follows the layout of the flat unit WRG 134 BP-HK. Außenluft and
Abluft enter on the left, both streams cross once in the heat exchanger, and
the heat pump is one block to its right with the evaporator on the exhaust row
above the condenser on the supply row. Fortluft and Zuluft leave on the right.

## Documents

| Claim | Source |
|-------|--------|
| The heat pump is downstream of the heat exchanger. The evaporator takes heat from the exhaust air leaving the heat exchanger, the condenser passes it to the supply air the heat exchanger already warmed. | DIBt Z-51.4-390 (2023), section 1.1, and the same wording in the 2017 approval |
| A sensor in the exhaust tract of the heat exchanger measures the exhaust temperature that switches on the preheater at 0 °C. That is T6. | DIBt Z-51.4-390 (2023), section 2.1.6 |
| The heat exchanger's mean temperature ratio is 0.81. | DIBt Z-51.4-390 (2023), Anlage 9 |
| Air path through both unit types: WT first, then the heat pump coils. | DIBt Z-51.4-390 (2023), Anlage 5 |
| Layout of the WRG 134 BP-HK: Außenluft top left, Abluft low on the left, heat exchanger on the left, evaporator, exhaust fan and Fortluft on the upper level, compressor, condenser, supply fan and Zuluft on the lower level. | BIC WRG 134BP-HK Produktblatt (06/2006), page 2 |

The approval says:

> Durch die dem Wärmeübertrager nachgeschaltete Wärmepumpe wird der den
> Wärmeübertrager verlassenden Abluft beim Durchströmen des Verdampfers
> nochmals Wärme entzogen und im Kondensator auf die im Wärmeübertrager bereits
> vorgewärmte Zuluft übertragen.

> [...] dazu wird über einen im Ablufttrakt des Wärmeübertragers angeordneten
> Temperaturfühler die Fortlufttemperatur ermittelt. Erreicht die Temperatur
> der Fortluft 0 °C, schaltet die Zusatzheizung ein.

Sources:

- [DIBt Z-51.4-390 (2023)](https://www.dibt.de/pdf_storage/2023/Z-51.4-390(1.51.4-19!22).pdf)
- [DIBt Z-51.4-390 (2017)](https://www.dibt.de/pdf_storage/2017/Z-51.4-390(1.51.4-45!11).pdf)
- [BIC WRG 134BP-HK Produktblatt](https://www.schwoererhaus.de/wp-content/uploads/BIC_WRG134BPHK.pdf)

The integration repository keeps these and the manufacturer's register list in
[`docs/references/`](https://github.com/josa42/homeassistant-schwoerer-lueftung/tree/main/docs/references).

## Measurements

No document says where T3 and T4 sit relative to the condenser. The register
list only names them "vor NE" and "nach NE". The history of a running unit
answers it: switching the heat pump on or off moves every sensor behind the
condenser or evaporator and leaves the ones in front of them alone.

Recorded on 2026-10-31 at fan level 2, with the Nachheizregister off the whole
time, so any change in T4 comes from the condenser.

Heat pump on at 10:43:29:

| Sensor | 10:43 | 10:54 | |
|--------|-------|-------|---|
| T3 vor NE | 19.3 | 19.7 | unchanged |
| T8 Kondensator | 18.1 | 45.3 | +27 K |
| T4 nach NE | 18.0 | 43.4 | +25 K |
| T6 im WT | 12.0 | 12.2 | unchanged |
| T7 Verdampfer | 14.2 | −1.3 | −16 K |

Heat pump off at 12:21:

| Sensor | 12:21 | 12:35 | |
|--------|-------|-------|---|
| T3 vor NE | 21.0 | 20.9 | unchanged |
| T4 nach NE | 49.4 | 21.8 | −28 K |
| T6 im WT | 13.5 | 13.6 | unchanged |
| T7 Verdampfer | 1.7 | 11.6 | +10 K |

T3 therefore sits between the heat exchanger and the condenser, and T6
between the heat exchanger and the evaporator.

The heat exchanger's temperature ratio confirms both. At 10:40, with the heat
pump off, T2 read 10.0 and T5 21.5:

- supply leaving the WT: 10.0 + 0.81 × (21.5 − 10.0) ≈ 19.3, T3 read 19.3
- exhaust leaving the WT: 21.5 − 0.81 × (21.5 − 10.0) ≈ 12.2, T6 read 12.0

T7 and T8 are coil temperatures, not air temperatures. The air leaving the
condenser is a little cooler than T8, which is why T4 stays just below it.

## Cooling

On HK units the heat pump can cool. The refrigerant circuit then runs the other
way: the supply coil works as the evaporator and the exhaust coil as the
condenser. The names T7 Verdampfer and T8 Kondensator are the heating-mode
names. The card keeps them and only reverses the direction of the dots between
the two coils.
