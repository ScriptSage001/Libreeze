import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LendBookComponent } from './lend-book.component';

describe('LendBookComponent', () => {
  let component: LendBookComponent;
  let fixture: ComponentFixture<LendBookComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LendBookComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LendBookComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
