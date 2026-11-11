import { describe, expect, it } from 'vitest'
import en from '../src/i18n/en.json'
import zh from '../src/i18n/zh-CN.json'
import vi from '../src/i18n/vi.json'
import { detectLocale, resolveLocale } from '../src/engine/i18n'

describe('i18n', () => {
  it('detects Vietnamese and Chinese browsers and defaults to English', () => {
    expect(detectLocale(['vi-VN', 'en'])).toBe('vi')
    expect(detectLocale(['VI'])).toBe('vi')
    expect(detectLocale(['zh-CN', 'en'])).toBe('zh-CN')
    expect(detectLocale(['zh-TW'])).toBe('zh-CN')
    expect(detectLocale(['ZH'])).toBe('zh-CN')
    expect(detectLocale(['en-US', 'zh-CN'])).toBe('en')
    expect(detectLocale([])).toBe('en')
    expect(detectLocale(undefined)).toBe('en')
  })

  it('lets a saved choice win over detection', () => {
    expect(resolveLocale('en', ['zh-CN'])).toBe('en')
    expect(resolveLocale('zh-CN', ['en-US'])).toBe('zh-CN')
    expect(resolveLocale('vi', ['en-US'])).toBe('vi')
    expect(resolveLocale('', ['zh-CN'])).toBe('zh-CN')
  })

  it('keeps the requested brand and exact Vietnamese credits', () => {
    expect(vi['game.title']).toBe('Đua Xe Thú')
    expect(vi['about.developer']).toBe('Game được phát triển bởi Tín Phạm')
    expect(vi['about.copyright']).toBe('Copyright @SushiSoft 2026')
  })

  it('keeps the six requested Vietnamese racer names and both track choices', () => {
    expect([
      vi['char.bunny.name'], vi['char.bear.name'], vi['char.tiger.name'],
      vi['char.chicken.name'], vi['char.buffalo.name'], vi['char.dog.name'],
    ]).toEqual(['Bunny Thỏ', 'Panda Gấu', 'Đại Ka Kọp', 'Gà Wala', 'Ngưu Ma Vương', 'SleepingDog'])
    expect(vi['track.candy.name']).toBe('Thung lũng Kẹo Ngọt')
    expect(vi['track.halloween.name']).toBe('Đường đua Halloween')
    for (const locale of [en, zh, vi]) {
      expect(locale['track.pick.title']).toBeTruthy()
      expect(locale['track.halloween.desc']).toBeTruthy()
    }
  })

  it('has the same keys and placeholders in every language', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    expect(Object.keys(vi).sort()).toEqual(Object.keys(en).sort())
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()
    for (const [key, value] of Object.entries(en)) {
      expect(vars((zh as Record<string, string>)[key]), key).toEqual(vars(value))
      expect(vars((vi as Record<string, string>)[key]), key).toEqual(vars(value))
    }
  })
})
