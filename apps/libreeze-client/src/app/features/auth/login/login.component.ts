import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  loading = false;
  submitted = false;
  error = '';

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private supabaseService: SupabaseService
  ) { }

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    // Check if there's a redirect URL in sessionStorage
    const redirectUrl = sessionStorage.getItem('redirectUrl');
    if (redirectUrl) {
      // We'll use this later if login is successful
      console.log('Redirect URL found:', redirectUrl);
    }
  }

  // Convenience getter for easy access to form fields
  public get f() {
    return this.loginForm.controls;
  }

  public async onSubmit() {
    this.submitted = true;

    // stop here if form is invalid
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      await this.supabaseService.signIn(
        this.loginForm.value.email,
        this.loginForm.value.password
      );

      // Check if we should redirect to a specific URL
      const redirectUrl = sessionStorage.getItem('redirectUrl') || '/dashboard';

      // Clear the redirectUrl from sessionStorage
      sessionStorage.removeItem('redirectUrl');

      // Navigate to the redirect URL
      this.router.navigateByUrl(redirectUrl);
    } catch (error: any) {
      this.error = error.message || 'Login failed. Please check your credentials.';
      this.loading = false;
    }
  }
}