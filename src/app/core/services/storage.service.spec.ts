import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  StorageKey,
  type CampaignProgress,
  type DailyStreak,
  type GameSettings,
  type OverallStats,
} from '../models/storage-types';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [StorageService] });
    service = TestBed.inject(StorageService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns null for missing keys', () => {
    expect(service.get<GameSettings>(StorageKey.GameSettings)).toBeNull();
  });

  it('round-trips game settings via set/get', () => {
    const settings: GameSettings = { volume: 0.75, muted: false, darkMode: true };
    service.set<GameSettings>(StorageKey.GameSettings, settings);
    expect(service.get<GameSettings>(StorageKey.GameSettings)).toEqual(settings);
    // Underlying value is JSON-encoded.
    expect(localStorage.getItem(StorageKey.GameSettings)).toBe(JSON.stringify(settings));
  });

  it('round-trips campaign progress with nested records', () => {
    const progress: CampaignProgress = {
      completedLevels: {
        'w1-l1': {
          levelId: 'w1-l1',
          stars: 3,
          bestMoves: 7,
          completedAt: '2026-04-14T10:00:00.000Z',
        },
      },
      totalStars: 3,
    };
    service.set(StorageKey.CampaignProgress, progress);
    const loaded = service.get<CampaignProgress>(StorageKey.CampaignProgress);
    expect(loaded).not.toBeNull();
    expect(loaded?.totalStars).toBe(3);
    expect(loaded?.completedLevels['w1-l1'].stars).toBe(3);
  });

  it('round-trips daily streak and overall stats', () => {
    const streak: DailyStreak = {
      currentStreak: 5,
      longestStreak: 12,
      lastCompletedDate: '2026-04-13',
    };
    const stats: OverallStats = {
      totalLevelsCompleted: 42,
      totalMoves: 1337,
      totalPlayTimeSeconds: 3600,
      perfectCompletions: 10,
    };
    service.set(StorageKey.DailyStreak, streak);
    service.set(StorageKey.OverallStats, stats);
    expect(service.get<DailyStreak>(StorageKey.DailyStreak)).toEqual(streak);
    expect(service.get<OverallStats>(StorageKey.OverallStats)).toEqual(stats);
  });

  it('remove deletes a single entry without affecting others', () => {
    service.set(StorageKey.GameSettings, { volume: 1, muted: false, darkMode: false });
    service.set(StorageKey.DailyStreak, {
      currentStreak: 1,
      longestStreak: 1,
      lastCompletedDate: null,
    });
    service.remove(StorageKey.GameSettings);
    expect(service.get(StorageKey.GameSettings)).toBeNull();
    expect(service.get<DailyStreak>(StorageKey.DailyStreak)).not.toBeNull();
  });

  it('clear wipes all entries', () => {
    service.set(StorageKey.GameSettings, { volume: 1, muted: false, darkMode: false });
    service.set(StorageKey.OverallStats, {
      totalLevelsCompleted: 1,
      totalMoves: 1,
      totalPlayTimeSeconds: 1,
      perfectCompletions: 0,
    });
    service.clear();
    expect(service.get(StorageKey.GameSettings)).toBeNull();
    expect(service.get(StorageKey.OverallStats)).toBeNull();
  });

  it('returns null when the stored value is malformed JSON', () => {
    localStorage.setItem(StorageKey.GameSettings, '{not valid json');
    expect(service.get<GameSettings>(StorageKey.GameSettings)).toBeNull();
  });

  it('swallows setItem errors (e.g. quota exceeded)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() =>
      service.set(StorageKey.GameSettings, { volume: 1, muted: false, darkMode: false }),
    ).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });

  it('persists data across service instances (simulated reload)', () => {
    const settings: GameSettings = { volume: 0.5, muted: true, darkMode: false };
    service.set(StorageKey.GameSettings, settings);

    // Reset the injector to simulate a fresh app bootstrap.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [StorageService] });
    const fresh = TestBed.inject(StorageService);

    expect(fresh.get<GameSettings>(StorageKey.GameSettings)).toEqual(settings);
  });

  it('typed helpers enforce value shape at compile time and round-trip', () => {
    const settings: GameSettings = { volume: 0.3, muted: true, darkMode: true };
    service.setTyped(StorageKey.GameSettings, settings);
    const loaded = service.getTyped(StorageKey.GameSettings);
    expect(loaded).toEqual(settings);
  });
});
