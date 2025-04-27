import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LibraryOptionsComponent } from './library-options.component';

describe('LibraryOptionsComponent', () => {
  let component: LibraryOptionsComponent;
  let fixture: ComponentFixture<LibraryOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LibraryOptionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LibraryOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
