import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LegendDialogComponent } from './legend-dialog.component';

describe('LegendDialogComponent', () => {
  it('creates the component with default invisible state', () => {
    TestBed.configureTestingModule({
      imports: [LegendDialogComponent],
    });
    const fixture = TestBed.createComponent(LegendDialogComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('emits visibleChange(false) when onClose is invoked', () => {
    TestBed.configureTestingModule({
      imports: [LegendDialogComponent],
    });
    const fixture = TestBed.createComponent(LegendDialogComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const emitted: boolean[] = [];
    fixture.componentInstance.visibleChange.subscribe((v: boolean) => emitted.push(v));

    // Access protected onClose through a cast for test purposes.
    (fixture.componentInstance as unknown as { onClose(): void }).onClose();
    expect(emitted).toEqual([false]);
  });
});
