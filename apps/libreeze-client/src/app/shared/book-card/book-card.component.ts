import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-book-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './book-card.component.html',
  styleUrls: ['./book-card.component.scss']
})
export class BookCardComponent {
  @Input() book: any;
  @Input() showLendButton = false;
  @Input() showReturnButton = false;
  
  @Output() onLend = new EventEmitter<any>();
  @Output() onReturn = new EventEmitter<any>();
}