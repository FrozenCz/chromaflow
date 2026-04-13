import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameEngineService } from '../../../core/services/game-engine.service';
import { DEMO_LEVEL } from '../../../data/levels/demo';
import { GameBoardComponent } from './game-board.component';

describe('GameBoardComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [GameBoardComponent] });
    TestBed.inject(GameEngineService).initLevel(DEMO_LEVEL);
  });

  it('creates and renders a canvas element', () => {
    const fixture = TestBed.createComponent(GameBoardComponent);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });
});
