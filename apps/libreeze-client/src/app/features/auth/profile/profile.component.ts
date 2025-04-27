import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/supabase.service';
import { UserLibrary } from '../../../shared/models/user-library';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  profileForm!: FormGroup;
  loading = false;
  submitted = false;
  error = '';
  updateSuccess = false;
  userId = '';
  profilePhotoUrl = '';
  selectedFile: File | null = null;

  usersLibraries: UserLibrary[] = []; // List of libraries the user is a member of

  // Borrowing history
  currentBorrowings: any[] = [];
  lendingHistory: any[] = [];
  loadingHistory = false;

  constructor(
    private formBuilder: FormBuilder,
    private supabaseService: SupabaseService
  ) { }

  ngOnInit(): void {
    this.profileForm = this.formBuilder.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]]
    });

    // Load user profile data
    this.loadUserProfile();

    // Load User Library data
    this.loadUserLibraryData();

    // Load borrowing history
    this.loadBorrowingHistory();
  }

  // Convenience getter for easy access to form fields
  get f() {
    return this.profileForm.controls;
  }

  async loadUserProfile() {
    this.loading = true;

    try {
      // Get current user
      const subscription = this.supabaseService.user.subscribe(user => {
        if (user) {
          this.userId = user.id;

          // Get member profile data
          this.supabaseService.getUserById(user.id).then(user => {
            this.profileForm.patchValue({
              fullName: user.full_name,
              email: user.email
            });

            // Set profile photo URL if exists
            if (user.profile_photo_url) {
              this.profilePhotoUrl = user.profile_photo_url;
            }

            this.loading = false;
          });
        }
        subscription.unsubscribe();
      });
    } catch (error: any) {
      this.error = error.message || 'Failed to load profile';
      this.loading = false;
    }
  }

  async loadUserLibraryData() {
    try {
      // Get current user
      const subscription = this.supabaseService.user.subscribe(async user => {
        if (user) {
          // Load libraries the user is a member of
          const libraryUsers = await this.supabaseService.getUserLibraries(user.id);

          // Load library details for each library
          for (const library of libraryUsers) {
            const libraryDetails = await this.supabaseService.getLibraryById(library.library_id);
            const data: UserLibrary = {
              user_id: user.id,
              library_id: library.library_id,
              library_name: libraryDetails.name,
              membership_type: library.is_admin ? 'Administrator' : 'Reader',
              membership_start_date: library.member_since
            }
            this.usersLibraries.push(data);
          }          
        }
        subscription.unsubscribe();
      });
    } catch (error) {
      console.error('Error loading user library data:', error);
    }
  }

  async loadBorrowingHistory() {
    this.loadingHistory = true;

    try {
      // Get current user
      const subscription = this.supabaseService.user.subscribe(async user => {
        if (user) {
          // Load current borrowings
          this.currentBorrowings = await this.supabaseService.getCurrentBorrowings(user.id);

          // Load lending history (returned books)
          const allHistory = await this.supabaseService.getLendingHistory(user.id);
          this.lendingHistory = allHistory.filter(item => item.status === 'returned');

          this.loadingHistory = false;
        }
        subscription.unsubscribe();
      });
    } catch (error) {
      console.error('Error loading borrowing history:', error);
      this.loadingHistory = false;
    }
  }

  onFileSelected(event: any) {
    if (event.target.files && event.target.files[0]) {
      this.selectedFile = event.target.files[0];
      this.uploadProfilePhoto();
    }
  }

  async uploadProfilePhoto() {
    if (!this.selectedFile || !this.userId) return;

    this.loading = true;
    this.error = '';

    try {
      // Upload the photo to Supabase storage
      const photoUrl = await this.supabaseService.uploadProfilePhoto(this.selectedFile, this.userId);

      // Update member profile with new photo URL
      await this.supabaseService.updateUserProfile(this.userId, {
        profile_photo_url: photoUrl
      });

      // Update the displayed photo
      this.profilePhotoUrl = photoUrl;
      this.loading = false;
      this.updateSuccess = true;

      // Clear the success message after 3 seconds
      setTimeout(() => {
        this.updateSuccess = false;
      }, 3000);
    } catch (error: any) {
      this.error = error.message || 'Failed to upload profile photo';
      this.loading = false;
    }
  }

  async onSubmit() {
    this.submitted = true;
    this.updateSuccess = false;

    // stop here if form is invalid
    if (this.profileForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      // Update member profile
      await this.supabaseService.updateUserProfile(this.userId, {
        full_name: this.profileForm.value.fullName
      });

      this.updateSuccess = true;
      this.loading = false;

      // Clear the success message after 3 seconds
      setTimeout(() => {
        this.updateSuccess = false;
      }, 3000);
    } catch (error: any) {
      this.error = error.message || 'Failed to update profile';
      this.loading = false;
    }
  }
}