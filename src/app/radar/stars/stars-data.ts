export type StarObject = {
    id: string;
    kind: "star";
    name: string;
    designation?: string;
    constellation: string;
    ra: number;
    dec: number;
    magnitude: number;
    spectral?: string;
    distanceLy?: number;
    color?: string;
};

export type DeepSkyObject = {
    id: string;
    kind: "dso";
    name: string;
    catalog: string;
    constellation: string;
    ra: number;
    dec: number;
    magnitude: number;
    objectType: string;
    distanceLy?: number;
};

export type SkyObject = StarObject | DeepSkyObject;

export const STARS: StarObject[] = [
    { id: "sirius", kind: "star", name: "Sirius", designation: "α CMa", constellation: "Canis Major", ra: 6.7525, dec: -16.7161, magnitude: -1.46, spectral: "A1V", distanceLy: 8.6, color: "#dfe9ff" },
    { id: "canopus", kind: "star", name: "Canopus", designation: "α Car", constellation: "Carina", ra: 6.3992, dec: -52.6957, magnitude: -0.74, spectral: "A9II", distanceLy: 310, color: "#fff2d6" },
    { id: "arcturus", kind: "star", name: "Arcturus", designation: "α Boo", constellation: "Boötes", ra: 14.261, dec: 19.1825, magnitude: -0.05, spectral: "K1.5III", distanceLy: 36.7, color: "#ffd2a1" },
    { id: "vega", kind: "star", name: "Vega", designation: "α Lyr", constellation: "Lyra", ra: 18.6156, dec: 38.7837, magnitude: 0.03, spectral: "A0V", distanceLy: 25, color: "#dfe9ff" },
    { id: "capella", kind: "star", name: "Capella", designation: "α Aur", constellation: "Auriga", ra: 5.2782, dec: 45.998, magnitude: 0.08, spectral: "G8III", distanceLy: 42.9, color: "#fff0c2" },
    { id: "rigel", kind: "star", name: "Rigel", designation: "β Ori", constellation: "Orion", ra: 5.2423, dec: -8.2016, magnitude: 0.13, spectral: "B8Ia", distanceLy: 860, color: "#cfe1ff" },
    { id: "procyon", kind: "star", name: "Procyon", designation: "α CMi", constellation: "Canis Minor", ra: 7.655, dec: 5.225, magnitude: 0.34, spectral: "F5IV-V", distanceLy: 11.5, color: "#fff7ea" },
    { id: "betelgeuse", kind: "star", name: "Betelgeuse", designation: "α Ori", constellation: "Orion", ra: 5.9195, dec: 7.4071, magnitude: 0.42, spectral: "M1-2Ia", distanceLy: 548, color: "#ffb07c" },
    { id: "achernar", kind: "star", name: "Achernar", designation: "α Eri", constellation: "Eridanus", ra: 1.6286, dec: -57.2368, magnitude: 0.46, spectral: "B6V", distanceLy: 139, color: "#cbdcff" },
    { id: "hadar", kind: "star", name: "Hadar", designation: "β Cen", constellation: "Centaurus", ra: 14.0637, dec: -60.373, magnitude: 0.61, spectral: "B1III", distanceLy: 390, color: "#c8dcff" },
    { id: "altair", kind: "star", name: "Altair", designation: "α Aql", constellation: "Aquila", ra: 19.8464, dec: 8.8683, magnitude: 0.77, spectral: "A7V", distanceLy: 16.7, color: "#edf2ff" },
    { id: "acrux", kind: "star", name: "Acrux", designation: "α Cru", constellation: "Crux", ra: 12.4433, dec: -63.0991, magnitude: 0.76, spectral: "B0.5IV", distanceLy: 320, color: "#c5d9ff" },
    { id: "aldebaran", kind: "star", name: "Aldebaran", designation: "α Tau", constellation: "Taurus", ra: 4.5987, dec: 16.5093, magnitude: 0.85, spectral: "K5III", distanceLy: 65.3, color: "#ffbf8a" },
    { id: "antares", kind: "star", name: "Antares", designation: "α Sco", constellation: "Scorpius", ra: 16.4901, dec: -26.432, magnitude: 0.96, spectral: "M1.5Iab", distanceLy: 550, color: "#ff9b72" },
    { id: "spica", kind: "star", name: "Spica", designation: "α Vir", constellation: "Virgo", ra: 13.4199, dec: -11.1613, magnitude: 0.98, spectral: "B1V", distanceLy: 250, color: "#c8d9ff" },
    { id: "pollux", kind: "star", name: "Pollux", designation: "β Gem", constellation: "Gemini", ra: 7.7553, dec: 28.0262, magnitude: 1.14, spectral: "K0III", distanceLy: 33.8, color: "#ffd0a3" },
    { id: "fomalhaut", kind: "star", name: "Fomalhaut", designation: "α PsA", constellation: "Piscis Austrinus", ra: 22.9608, dec: -29.6222, magnitude: 1.16, spectral: "A3V", distanceLy: 25.1, color: "#e8efff" },
    { id: "deneb", kind: "star", name: "Deneb", designation: "α Cyg", constellation: "Cygnus", ra: 20.6905, dec: 45.2803, magnitude: 1.25, spectral: "A2Ia", distanceLy: 2615, color: "#e5edff" },
    { id: "regulus", kind: "star", name: "Regulus", designation: "α Leo", constellation: "Leo", ra: 10.1395, dec: 11.9672, magnitude: 1.35, spectral: "B7V", distanceLy: 79.3, color: "#d6e3ff" },
    { id: "adhara", kind: "star", name: "Adhara", designation: "ε CMa", constellation: "Canis Major", ra: 6.9771, dec: -28.9721, magnitude: 1.5, spectral: "B2II", distanceLy: 430, color: "#c4d8ff" },
    { id: "castor", kind: "star", name: "Castor", designation: "α Gem", constellation: "Gemini", ra: 7.5767, dec: 31.8883, magnitude: 1.58, spectral: "A1V", distanceLy: 51.5, color: "#e1eaff" },
    { id: "bellatrix", kind: "star", name: "Bellatrix", designation: "γ Ori", constellation: "Orion", ra: 5.4189, dec: 6.3497, magnitude: 1.64, spectral: "B2III", distanceLy: 250, color: "#c5d7ff" },
    { id: "elnath", kind: "star", name: "Elnath", designation: "β Tau", constellation: "Taurus", ra: 5.4382, dec: 28.6075, magnitude: 1.65, spectral: "B7III", distanceLy: 134, color: "#d1dfff" },
    { id: "alnilam", kind: "star", name: "Alnilam", designation: "ε Ori", constellation: "Orion", ra: 5.6036, dec: -1.2019, magnitude: 1.69, spectral: "B0Ia", distanceLy: 2000, color: "#bfd5ff" },
    { id: "alnitak", kind: "star", name: "Alnitak", designation: "ζ Ori", constellation: "Orion", ra: 5.6793, dec: -1.9426, magnitude: 1.74, spectral: "O9.5Iab", distanceLy: 1260, color: "#bcd2ff" },
    { id: "alioth", kind: "star", name: "Alioth", designation: "ε UMa", constellation: "Ursa Major", ra: 12.9005, dec: 55.9598, magnitude: 1.76, spectral: "A1III", distanceLy: 82.6, color: "#e4ebff" },
    { id: "dubhe", kind: "star", name: "Dubhe", designation: "α UMa", constellation: "Ursa Major", ra: 11.0621, dec: 61.7508, magnitude: 1.79, spectral: "K0III", distanceLy: 123, color: "#ffd4aa" },
    { id: "mirfak", kind: "star", name: "Mirfak", designation: "α Per", constellation: "Perseus", ra: 3.4054, dec: 49.8612, magnitude: 1.79, spectral: "F5Ib", distanceLy: 510, color: "#fff1dc" },
    { id: "alkaid", kind: "star", name: "Alkaid", designation: "η UMa", constellation: "Ursa Major", ra: 13.7923, dec: 49.3133, magnitude: 1.85, spectral: "B3V", distanceLy: 104, color: "#c9d9ff" },
    { id: "sargas", kind: "star", name: "Sargas", designation: "θ Sco", constellation: "Scorpius", ra: 17.6219, dec: -42.9978, magnitude: 1.86, spectral: "F0II", distanceLy: 300, color: "#fff0dd" },
    { id: "mintaka", kind: "star", name: "Mintaka", designation: "δ Ori", constellation: "Orion", ra: 5.5334, dec: -0.2991, magnitude: 2.23, spectral: "O9.5II", distanceLy: 1200, color: "#bad0ff" },
    { id: "kochab", kind: "star", name: "Kochab", designation: "β UMi", constellation: "Ursa Minor", ra: 14.8451, dec: 74.1555, magnitude: 2.08, spectral: "K4III", distanceLy: 131, color: "#ffc18e" },
    { id: "polaris", kind: "star", name: "Polaris", designation: "α UMi", constellation: "Ursa Minor", ra: 2.5303, dec: 89.2641, magnitude: 1.98, spectral: "F7Ib", distanceLy: 433, color: "#fff0d8" },
    { id: "merak", kind: "star", name: "Merak", designation: "β UMa", constellation: "Ursa Major", ra: 11.0307, dec: 56.3824, magnitude: 2.37, spectral: "A1V", distanceLy: 79.7, color: "#e0e8ff" },
    { id: "phecda", kind: "star", name: "Phecda", designation: "γ UMa", constellation: "Ursa Major", ra: 11.8972, dec: 53.6948, magnitude: 2.44, spectral: "A0V", distanceLy: 83.2, color: "#e3ebff" },
    { id: "megrez", kind: "star", name: "Megrez", designation: "δ UMa", constellation: "Ursa Major", ra: 12.257, dec: 57.0326, magnitude: 3.31, spectral: "A3V", distanceLy: 80.5, color: "#e5ecff" },
    { id: "mizar", kind: "star", name: "Mizar", designation: "ζ UMa", constellation: "Ursa Major", ra: 13.3987, dec: 54.9254, magnitude: 2.23, spectral: "A2V", distanceLy: 82.9, color: "#e2eaff" },
    { id: "saiph", kind: "star", name: "Saiph", designation: "κ Ori", constellation: "Orion", ra: 5.7959, dec: -9.6696, magnitude: 2.06, spectral: "B0.5Ia", distanceLy: 650, color: "#bed3ff" }
];

export const DEEP_SKY: DeepSkyObject[] = [
    { id: "m31", kind: "dso", name: "Andromeda Galaxy", catalog: "M31", constellation: "Andromeda", ra: 0.712, dec: 41.269, magnitude: 3.44, objectType: "Spiral galaxy", distanceLy: 2537000 },
    { id: "m42", kind: "dso", name: "Orion Nebula", catalog: "M42", constellation: "Orion", ra: 5.588, dec: -5.391, magnitude: 4, objectType: "Emission nebula", distanceLy: 1344 },
    { id: "m45", kind: "dso", name: "Pleiades", catalog: "M45", constellation: "Taurus", ra: 3.79, dec: 24.117, magnitude: 1.6, objectType: "Open cluster", distanceLy: 444 },
    { id: "m13", kind: "dso", name: "Hercules Globular Cluster", catalog: "M13", constellation: "Hercules", ra: 16.695, dec: 36.467, magnitude: 5.8, objectType: "Globular cluster", distanceLy: 25100 },
    { id: "m57", kind: "dso", name: "Ring Nebula", catalog: "M57", constellation: "Lyra", ra: 18.893, dec: 33.03, magnitude: 8.8, objectType: "Planetary nebula", distanceLy: 2570 },
    { id: "m27", kind: "dso", name: "Dumbbell Nebula", catalog: "M27", constellation: "Vulpecula", ra: 19.993, dec: 22.721, magnitude: 7.5, objectType: "Planetary nebula", distanceLy: 1360 },
    { id: "m51", kind: "dso", name: "Whirlpool Galaxy", catalog: "M51", constellation: "Canes Venatici", ra: 13.497, dec: 47.195, magnitude: 8.4, objectType: "Spiral galaxy", distanceLy: 31000000 },
    { id: "m81", kind: "dso", name: "Bode's Galaxy", catalog: "M81", constellation: "Ursa Major", ra: 9.926, dec: 69.065, magnitude: 6.9, objectType: "Spiral galaxy", distanceLy: 11800000 }
];

export const CONSTELLATION_LINES: Record<string, [string, string][]> = {
    Orion: [
        ["betelgeuse", "bellatrix"], ["betelgeuse", "alnitak"], ["bellatrix", "mintaka"], ["alnitak", "alnilam"], ["alnilam", "mintaka"], ["alnitak", "saiph"], ["mintaka", "rigel"], ["saiph", "rigel"]
    ],
    "Ursa Major": [
        ["dubhe", "merak"], ["merak", "phecda"], ["phecda", "megrez"], ["megrez", "dubhe"], ["megrez", "alioth"], ["alioth", "mizar"], ["mizar", "alkaid"]
    ]
};

export const SKY_OBJECTS: SkyObject[] = [...STARS, ...DEEP_SKY];
