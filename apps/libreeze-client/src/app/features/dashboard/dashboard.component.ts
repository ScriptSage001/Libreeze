import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../core/supabase.service';
import { LendedBook } from '../../shared/models/lended-books';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private user: any = null;

  public loading = true;
  public userProfile: any = null;
  public isAdmin = false;
  
  // Borrowing stats
  public lendedBooks: LendedBook[] = [];
  public currentBorrowings: LendedBook[] = [];
  public overdueBooks: LendedBook[] = [];
  public totalBorrowed = 0;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe to user changes
    this.supabaseService.user.subscribe(user => {
      if (user) {
        this.user = user;
      }
    });

    if (this.user) {
      this.loadUserProfile(this.user.id);
      this.loadBorrowingStats(this.user.id);
    }
    
    // Subscribe to admin status
    this.supabaseService.isAdmin.subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });
  }

  private async loadUserProfile(userId: string) {
    try {
      this.userProfile = await this.supabaseService.getUserById(userId);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }
  
  private async loadBorrowingStats(userId: string) {
    this.loading = true;
    
    try {
      // Get total borrowing history
      this.lendedBooks = await this.supabaseService.getAllLendingHistory(userId);
      this.totalBorrowed = this.lendedBooks.length; 

      // Get current borrowings
      this.currentBorrowings = this.lendedBooks.filter(item => item.status === 'borrowed' || item.status === 'overdue');
      
      // Filter for overdue books
      this.overdueBooks = this.lendedBooks.filter(item => item.status === 'overdue');     

      this.loading = false;
    } catch (error) {
      console.error('Error loading borrowing stats:', error);
      this.loading = false;
    }
  }
  
  public async logout() {
    try {
      await this.supabaseService.signOut();
      this.router.navigate(['/auth/login']);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }
}