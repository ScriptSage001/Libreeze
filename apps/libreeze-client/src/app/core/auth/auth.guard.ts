import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);
  
  return supabaseService.getSessionUser().then(user => {
    const isAuth = !!user;
    if (!isAuth) {
      sessionStorage.setItem('redirectUrl', state.url);
      
      // Redirect to login page
      router.navigate(['/auth/login']);
      return false;
    }
    
    return true;
  });
};

export const adminGuard: CanActivateFn = (route, state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);
  
  return supabaseService.isAdmin.pipe(
    take(1),
    map(isAdmin => {
      if (!isAdmin) {
        router.navigate(['/dashboard']);
        return false;
      }      
      return true;
    })
  );
};

export const publicGuard: CanActivateFn = (route, state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);
  
  return supabaseService.getSessionUser().then(user => {
    const isAuth = !!user;
    if (isAuth) {
      // If already logged in, redirect to dashboard
      router.navigate(['/dashboard']);
      return false;
    }
    
    return true;
  });
};