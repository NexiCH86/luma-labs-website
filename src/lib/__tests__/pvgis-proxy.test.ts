import { describe, expect, it } from "vitest";
import { kompaktTmy, parseKoordinaten } from "../pvgis-proxy";

describe("parseKoordinaten", () => {
  it("rundet gueltige Koordinaten auf zwei Stellen", () => {
    expect(parseKoordinaten(new URLSearchParams("lat=47.3812&lon=8.5391"))).toEqual({ lat: 47.38, lon: 8.54 });
  });

  it("lehnt fehlende, ungueltige und ausserhalb liegende Werte ab", () => {
    expect(parseKoordinaten(new URLSearchParams("lat=47"))).toBeNull();
    expect(parseKoordinaten(new URLSearchParams("lat=abc&lon=8"))).toBeNull();
    expect(parseKoordinaten(new URLSearchParams("lat=80&lon=8"))).toBeNull();
    expect(parseKoordinaten(new URLSearchParams("lat=47&lon=200"))).toBeNull();
  });
});

describe("kompaktTmy", () => {
  it("behaelt nur Zeit, Temperatur, Global- und Diffusstrahlung", () => {
    const zeile = { "time(UTC)": "20160101:1200", T2m: 7.2, RH: 80, "G(h)": 131, "Gb(n)": 15, "Gd(h)": 126, WS10m: 2 };
    const r = kompaktTmy({
      inputs: { location: { latitude: 47.38, longitude: 8.54, elevation: 412 } },
      outputs: { tmy_hourly: Array.from({ length: 8760 }, () => zeile) },
    });
    expect(r.outputs.tmy_hourly).toHaveLength(8760);
    expect(r.outputs.tmy_hourly[0]).toEqual({ "time(UTC)": "20160101:1200", T2m: 7.2, "G(h)": 131, "Gd(h)": 126 });
    expect(r.inputs.location.elevation).toBe(412);
  });

  it("wirft bei unvollstaendigen Antworten", () => {
    expect(() => kompaktTmy({ outputs: { tmy_hourly: [] } })).toThrow();
  });
});
