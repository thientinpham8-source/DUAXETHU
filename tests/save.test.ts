import { describe, expect, it } from 'vitest'
import { defaultSave, insertEntry, LEADERBOARD_SIZE, parseSave, SAVE_KEY, SaveStore } from '../src/engine/save'

describe('save', () => {
  it('falls back to defaults for missing, corrupt or foreign data', () => {
    expect(parseSave(null)).toEqual(defaultSave())
    expect(parseSave('{nope')).toEqual(defaultSave())
    expect(parseSave('[]')).toEqual(defaultSave())
    expect(parseSave(JSON.stringify({ version: 99, musicVolume: 0.1 }))).toEqual(defaultSave())
  })

  it('clamps and validates fields', () => {
    const s = parseSave(JSON.stringify({ version: 2, musicVolume: 5, sfxVolume: -1, locale: 'fr', quality: 'ultra', sensitivity: 9, playerName: '  a very long player name here ' }))
    expect(s.musicVolume).toBe(1)
    expect(s.sfxVolume).toBe(0)
    expect(s.locale).toBe('')
    expect(s.quality).toBe('high')
    expect(s.sensitivity).toBe(1)
    expect(s.playerName).toBe('a very long play')
  })

  it('keeps a bounded, time-ordered leaderboard', () => {
    let board = [] as ReturnType<typeof defaultSave>['leaderboard']
    for (let i = 0; i < LEADERBOARD_SIZE + 3; i += 1) {
      board = insertEntry(board, { name: `p${i}`, character: 'bunny', time: 100 - i, place: 6, bestLap: 30, at: i }).board
    }
    expect(board).toHaveLength(LEADERBOARD_SIZE)
    expect(board[0].time).toBe(88)
    const fast = insertEntry(board, { name: 'fast', character: 'bear', time: 1, place: 1, bestLap: 30, at: 999 })
    expect(fast.rank).toBe(0)
    expect(insertEntry(board, { name: 'slow', character: 'dog', time: 999, place: 6, bestLap: 300, at: 1 }).rank).toBe(-1)
  })

  it('persists through storage and survives storage errors', () => {
    const mem = new Map<string, string>()
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    new SaveStore(storage).update({ musicVolume: 0.3, locale: 'zh-CN' })
    expect(JSON.parse(mem.get(SAVE_KEY)!).musicVolume).toBe(0.3)
    expect(new SaveStore(storage).data.locale).toBe('zh-CN')
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('quota') } }
    const store = new SaveStore(broken)
    expect(() => store.update({ muted: true })).not.toThrow()
    expect(store.data.muted).toBe(true)
  })

  it('defaults new players to Vietnamese and the bunny racer', () => {
    const data = defaultSave()
    expect(data.locale).toBe('vi')
    expect(data.character).toBe('bunny')
  })

  it('maps old roster ids in player saves and leaderboard entries', () => {
    const data = parseSave(JSON.stringify({
      version: 2,
      locale: 'vi',
      character: 'sloth',
      leaderboard: [{ name: 'ACE', character: 'frog', time: 95, place: 2, bestLap: 30, at: 1 }],
    }))
    expect(data.character).toBe('buffalo')
    expect(data.leaderboard[0].character).toBe('chicken')
    expect(data.locale).toBe('vi')
  })

  it('falls back safely for unknown characters', () => {
    const data = parseSave(JSON.stringify({ version: 2, character: 'unlisted' }))
    expect(data.character).toBe('bunny')
  })
})
