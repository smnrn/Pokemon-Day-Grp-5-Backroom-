export function camcorderTime(milliseconds: number) {
  const time = Math.max(0, Math.floor(milliseconds))
  return [
    Math.floor(time / 3600000) % 100,
    Math.floor(time / 60000) % 60,
    Math.floor(time / 1000) % 60,
    Math.floor(time / 10) % 100,
  ]
    .map((value) => String(value).padStart(2, "0"))
    .join(":")
}

export function pointerEnergy(distance: number, elapsed: number) {
  return Math.min(1, Math.max(0, distance / Math.max(8, elapsed) / 2.5))
}

export const DOSSIERS = [
  {
    id: "025",
    cluster: "A",
    name: "HIGH-EMF ANOMALY",
    alias: "THE STATIC",
    signal: "82.6 mG",
    descriptor: "ELECTROMAGNETIC SIGNATURE",
    action:
      "Which of your devices could influence this electromagnetic signature? Propose a one-variable test and compare the next sensor reading.",
  },
  {
    id: "094",
    cluster: "B",
    name: "ZERO-KELVIN SHADOW",
    alias: "THE AFTERIMAGE",
    signal: "−273.1 °C",
    descriptor: "THERMAL SIGNATURE COLLAPSE",
    action:
      "With a strong temperature drop but little sound, which observation channel could distinguish a spectral hypothesis from an acoustic one?",
  },
  {
    id: "934",
    cluster: "C",
    name: "ACOUSTIC TITAN",
    alias: "THE LISTENER",
    signal: "88.4 dB",
    descriptor: "ACOUSTIC RESPONSE SIGNATURE",
    action:
      "Which movement or equipment choice changes the acoustic signal you generate? Consider the trade-off between speed, sound, and exposure.",
  },
] as const

export const SILHOUETTES = {
  "025":
    "M37 143 29 119 35 91 23 39 32 18 54 71 76 67 96 13 106 28 94 86 103 107 103 124 128 104 115 83 144 77 151 103 134 126 115 125 102 147 109 167 90 171 78 149 61 152 55 172 36 169Z",
  "094":
    "M18 151 32 130 18 113 35 104 28 77 47 83 49 48 68 63 82 24 96 61 119 44 119 77 141 70 135 102 151 111 138 130 154 151 130 146 116 167 92 161 78 176 59 162 37 170 32 148Z",
  "934":
    "M38 164 38 136 20 136 20 96 39 96 39 60 56 60 56 33 104 33 104 60 121 60 121 96 142 96 142 136 124 136 124 164 105 164 101 142 61 142 58 164ZM61 60 101 60 101 96 61 96Z",
} as const
