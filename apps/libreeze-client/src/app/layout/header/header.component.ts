import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../core/supabase.service';
import { Observable } from 'rxjs';
import { User } from '@supabase/supabase-js';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, NgbDropdownModule]
})

export class HeaderComponent {
  user$: Observable<User | null>;
  isAdmin$: Observable<boolean>;
  
  constructor(private supabaseService: SupabaseService) {
    this.user$ = this.supabaseService.user;
    this.isAdmin$ = this.supabaseService.isAdmin;
  }
  
  public getUserInitials(user: User): string {
    return user.email?.charAt(0).toUpperCase() || 'U';
  }
  
  public signOut(): void {
    this.supabaseService.signOut();
  }
}