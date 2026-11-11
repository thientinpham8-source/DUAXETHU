import type { Stats } from './config'

export type Species = 'bunny' | 'bear' | 'tiger' | 'chicken' | 'buffalo' | 'dog'

export type Character = {
  id: Species
  /** i18n keys: `char.<id>.name`, `char.<id>.species`, `char.<id>.blurb`. */
  stats: Stats
  fur: string
  furDark: string
  belly: string
  kart: string
  kartAccent: string
  /** Minimap / UI accent. */
  ui: string
}

/** Six baby critter racers. Stats sum to 13 so every pick has a distinct, viable feel. */
export const ROSTER: Character[] = [
  { id: 'bunny', stats: { speed: 2, accel: 5, handling: 4, weight: 2 }, fur: '#fff7f1', furDark: '#d6b5aa', belly: '#ffe0eb', kart: '#52c6e8', kartAccent: '#ff8fc7', ui: '#52c6e8' },
  { id: 'bear', stats: { speed: 3, accel: 3, handling: 2, weight: 5 }, fur: '#f8f6ef', furDark: '#22212b', belly: '#fffdf8', kart: '#292535', kartAccent: '#fff7ec', ui: '#65516d' },
  { id: 'tiger', stats: { speed: 5, accel: 4, handling: 3, weight: 1 }, fur: '#ff9d3d', furDark: '#572d28', belly: '#fff0d7', kart: '#f45f4a', kartAccent: '#ffd452', ui: '#ff9d3d' },
  { id: 'chicken', stats: { speed: 3, accel: 5, handling: 4, weight: 1 }, fur: '#ffe27a', furDark: '#d88b3d', belly: '#fff9e8', kart: '#8fd978', kartAccent: '#ff755e', ui: '#f0bd38' },
  { id: 'buffalo', stats: { speed: 4, accel: 2, handling: 2, weight: 5 }, fur: '#9b735d', furDark: '#543b37', belly: '#f0d5b6', kart: '#8b79df', kartAccent: '#f6d46f', ui: '#9b86ef' },
  { id: 'dog', stats: { speed: 3, accel: 4, handling: 4, weight: 2 }, fur: '#e9bd7c', furDark: '#79503c', belly: '#fff0d5', kart: '#ff78a8', kartAccent: '#78dcce', ui: '#ff78a8' },
]

export function characterById(id: string): Character {
  return ROSTER.find(c => c.id === id) ?? ROSTER[0]
}
