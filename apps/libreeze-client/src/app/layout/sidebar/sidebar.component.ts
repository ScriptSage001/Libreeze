import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { SupabaseService } from '../../core/supabase.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  isAdmin$: Observable<boolean>;
  
  constructor(private supabaseService: SupabaseService) {
    this.isAdmin$ = this.supabaseService.isAdmin;
  }
  
  signOut(event: Event): void {
    event.preventDefault();
    this.supabaseService.signOut();
  }
}