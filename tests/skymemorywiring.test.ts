// Brief 3p: the wiring of the sky memory (source checks, like the other wiring tests) and the one fact it rests on: at take-off and at the end
// of a landing the dock sits straight (no turn), so the sky turn can be handed between the flight scene and the docked scene as it is.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { outpostExitPose, stationEntryState, stationEntryTransform, stationExitPose } from "../src/render/integration";
import { DOCKED_STATION_PLANET_RADIUS, FLIGHT_STATION_PLANET_ALTITUDE, OUTPOST_EXIT, STATION_ENTRY, STATION_EXIT } from "../src/render/settings";

const read = (file: string): string => readFileSync(file, "utf8");

describe("3p: the dock sits straight where the sky is handed over", () => {
  const r0 = DOCKED_STATION_PLANET_RADIUS + FLIGHT_STATION_PLANET_ALTITUDE;

  it("at take-off (a station and an outpost) the dock has no turn", () => {
    expect(Math.abs(stationExitPose(0, r0, STATION_EXIT).pitch)).toBeLessThan(1e-9);
    expect(Math.abs(outpostExitPose(0, OUTPOST_EXIT).pitch)).toBeLessThan(1e-9);
  });

  it("at the end of a landing at a station the dock has no turn either", () => {
    const end = stationEntryTransform(stationEntryState(1, r0, STATION_EXIT, STATION_ENTRY));
    expect(Math.abs(end.rotX)).toBeLessThan(1e-9);
    expect(Math.abs(end.yaw)).toBeLessThan(1e-9);
  });
});

describe("3p: the screens use the remembered sky", () => {
  it("the flight screen remembers the sky at the end of a trip and starts the next trip from it", () => {
    const src = read("src/render/flight.ts");
    expect(src).toContain("this.opts.skyMemory?.remember(this.skyEnd, this.skyDest);");
    expect(src).toContain("begin(info: FlightInfo, orbitStartSeconds = 0, dockedSky: THREE.Quaternion | null = null): void {");
    expect(src).toContain("const start: Quat | null = dockedSky ?? this.opts.skyMemory?.frameFor(fromSystem) ?? null;");
    expect(src).toContain("this.turnSkyForLaunch(phase, p);");
  });

  it("floating at a planet and the docked view use what the trip left, not the default sky", () => {
    const flight = read("src/render/flight.ts");
    const floatAt = flight.indexOf("beginFloat(planetId: string)");
    expect(flight.slice(floatAt, floatAt + 1200)).toContain("this.opts.skyMemory?.frameFor(planet.systemId)");
    const docked = read("src/render/docked.ts");
    expect(docked).toContain("this.opts.skyMemory?.frameFor(planet.systemId)");
    expect(docked).toContain("this.sky?.view.setSkyFrame(this.skyFrame(turned));");
    expect(docked).toContain("currentSkyFrame(dockId: string)");
  });

  it("the app gives both screens the same memory and tells the flight what the docked sky looks like at take-off", () => {
    const src = read("src/render/index.ts");
    expect(src).toContain("const skyMemory = new SkyMemory();");
    expect(src).toContain("new DockedScreen({\n    skyMemory,");
    expect(src).toContain("new FlightScreen({ orbitSeconds, skyMemory,");
    expect(src).toContain("flight.begin(info, docked.stationSeconds(info.originDockId), docked.currentSkyFrame(info.originDockId));");
  });
});
