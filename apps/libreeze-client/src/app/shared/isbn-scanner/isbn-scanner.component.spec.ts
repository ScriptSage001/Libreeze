import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IsbnScannerComponent } from './isbn-scanner.component';

describe('IsbnScannerComponent', () => {
  let component: IsbnScannerComponent;
  let fixture: ComponentFixture<IsbnScannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IsbnScannerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IsbnScannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
