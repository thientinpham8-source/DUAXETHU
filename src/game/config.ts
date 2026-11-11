import type { KartSpec } from '../engine/kart'

export type TrackTheme = 'candy' | 'halloween'

/**
 * All gameplay tuning in one place. Change numbers here before touching game code; tests read
 * the same values so rule changes stay covered.
 */
export const BASE_KART: KartSpec = {
  radius: 0.62,
  rideHeight: 0.62,
  mass: 1,
  maxSpeed: 25,
  accel: 17,
  reverseSpeed: 8,
  brakeDecel: 32,
  coastDecel: 5,
  turnRate: 2.05,
  grip: 11,
  driftGrip: 2.4,
  driftWide: 0.2,
  driftTight: 0.82,
  driftMinSpeed: 10,
  hopSpeed: 5.4,
  gravity: -34,
  maxFall: -42,
  tiers: [0.75, 1.65, 2.7],
  tierBoost: [0.55, 1.0, 1.5],
  boostSpeed: 32,
  boostAccel: 46,
  wallGlance: 0.6,
}

export const CONFIG = {
  race: {
    laps: 3,
    racers: 6,
    countdown: 3,
    /** Throttle held within this window before GO earns a start boost. */
    startBoostWindow: 0.45,
    /** Throttle held earlier than this (seconds before GO) stalls the engine briefly. */
    stallBefore: 1.6,
    killDepth: 14,
    respawnSeconds: 1.1,
    /** Seconds after the player finishes before the results screen. */
    resultsDelay: 3.2,
  },
  surface: {
    offroadSpeed: 0.74,
    offroadGrip: 0.85,
    fluffSpeed: 0.5,
  },
  items: {
    boxRespawn: 3.2,
    roulette: 1.1,
    shieldSeconds: 8,
    pepperSeconds: 1.7,
    pepperPower: 1.2,
    trapStick: 1.35,
    trapLife: 40,
    maxTraps: 10,
    beeSpeed: 40,
    beeLife: 9,
    beeSpin: 1.25,
    /** Distance at which a bee stops following the track and dives at its target. */
    beeHoming: 22,
    missileSpeed: 46,
    missileLife: 8,
    missileSpin: 1.45,
    sonicRadius: 19,
    sonicSpin: 0.9,
    lightningSpin: 1.15,
  },
  ai: {
    /** Catch-up: top-speed multiplier range relative to the player's track distance. */
    catchUpMax: 0.07,
    slowDownMax: 0.06,
    catchUpRange: 140,
    shortcutChance: [0.15, 0.35, 0.55, 0.7, 0.85],
  },
  camera: {
    fov: 64,
    boostFov: 80,
    distance: 6.2,
    height: 2.35,
    lookAhead: 5,
    follow: 9,
  },
  // Kept only so unused generic platformer helpers from the initialized scaffold continue to type-check.
  player: {
    radius: 0.32,
    halfHeight: 0.48,
    walkSpeed: 8,
    sprintSpeed: 13,
    acceleration: 38,
    airControl: 0.35,
    jumpSpeed: 9.2,
    lowJumpGravity: -24,
    gravity: -28,
    maxFall: -40,
    coyoteTime: 0.1,
    jumpBuffer: 0.12,
    dashSpeed: 20,
    dashTime: 0.18,
    dashCooldown: 0.85,
    turnSpeed: 12,
  },
  drones: { radius: 1.1, speed: 4.5, rageSpeed: 7.5 },
} as const

export type ItemKind = 'shield' | 'pepper' | 'taffy' | 'bee' | 'missile' | 'sonic' | 'lightning'
export const ITEM_KINDS: ItemKind[] = ['shield', 'pepper', 'taffy', 'bee', 'missile', 'sonic', 'lightning']

/** Character stats on a 1..5 scale; mapped to small spec deltas so every pick is viable. */
export type Stats = { speed: number; accel: number; handling: number; weight: number }

export function specFor(stats: Stats): KartSpec {
  const d = (v: number) => (v - 3) / 2 // -1..1
  return {
    ...BASE_KART,
    maxSpeed: BASE_KART.maxSpeed * (1 + d(stats.speed) * 0.035),
    boostSpeed: BASE_KART.boostSpeed * (1 + d(stats.speed) * 0.025),
    accel: BASE_KART.accel * (1 + d(stats.accel) * 0.14),
    turnRate: BASE_KART.turnRate * (1 + d(stats.handling) * 0.07),
    driftTight: BASE_KART.driftTight * (1 + d(stats.handling) * 0.05),
    grip: BASE_KART.grip * (1 + d(stats.handling) * 0.12),
    mass: 1 + d(stats.weight) * 0.35,
  }
}
