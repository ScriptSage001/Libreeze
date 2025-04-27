import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/supabase.service';
import { User } from '@supabase/supabase-js';

@Component({
  selector: 'app-library-options',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './library-options.component.html',
  styleUrl: './library-options.component.scss'
})
export class LibraryOptionsComponent implements OnInit {
  // User details from registration
  userId: string = '';
  userEmail: string = '';
  
  // Library form
  libraryForm!: FormGroup;
  librarySubmitted = false;
  libraryLoading = false;
  libraryError = '';
  
  // Display controls
  showLibraryForm = false;
  showAdminMessage = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private supabaseService: SupabaseService
  ) {
    let user: User | null = null;
    this.supabaseService.user.subscribe((u) => {
      user = u;
      if (user) {
        this.userId = user.id || '';
        this.userEmail = user.email || '';
      } else {
        this.router.navigate(['/auth/register']);
      }
    });
  }

  ngOnInit(): void {
    // Initialize library form
    this.libraryForm = this.formBuilder.group({
      libraryName: ['', Validators.required],
      libraryAddress: ['', Validators.required],
      contactEmail: [this.userEmail, [Validators.required, Validators.email]], // Pre-fill with user email
      contactPhone: ['']
    });
  }
  
  // Convenience getter for library form controls
  public get l() {
    return this.libraryForm.controls;
  }
  
  // Show the library creation form
  public showCreateLibraryForm() {
    this.showLibraryForm = true;
    this.showAdminMessage = false;
  }
  
  // Show the contact admin message
  public showContactAdminMessage() {
    this.showLibraryForm = false;
    this.showAdminMessage = true;
  }
  
  // Create a new library
  public async createLibrary() {
    this.librarySubmitted = true;
    
    // Stop if form is invalid
    if (this.libraryForm.invalid) {
      return;
    }
    
    this.libraryLoading = true;
    this.libraryError = '';
    
    try {    
      // Create the library
      const result = await this.supabaseService.createLibrary(
        this.userId, this.libraryForm.value.libraryName, this.libraryForm.value.libraryAddress, 
        this.libraryForm.value.contactEmail, this.libraryForm.value.contactPhone
      );
      
      // Redirect to dashboard
      this.router.navigate(['/dashboard'], {
        queryParams: { 
          libraryCreated: true,
          libraryName: this.libraryForm.value.libraryName
        }
      });
    } catch (error: any) {
      this.libraryError = error.message || 'Failed to create library. Please try again.';
    } finally {
      this.libraryLoading = false;
    }
  }
  
  // Navigate to login page
  public goToLogin() {
    this.router.navigate(['/auth/login']);
  }
}