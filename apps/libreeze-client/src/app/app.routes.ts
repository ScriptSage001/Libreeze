import { Routes } from '@angular/router';
import { adminGuard, authGuard, publicGuard } from './core/auth/auth.guard';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [authGuard]
      },
      {
        path: 'books',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/books/list-books/list-books.component').then(m => m.ListBooksComponent),
            canActivate: [authGuard]
          },
          {
            path: 'add',
            loadComponent: () =>
              import('./features/books/add-books/add-books.component').then(m => m.AddBooksComponent),
            canActivate: [authGuard]
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/books/book-details/book-details.component').then(m => m.BookDetailsComponent),
            canActivate: [authGuard]
          }
        ]
      },
      {
        path: 'lending',
        children: [
          {
            path: 'lend',
            loadComponent: () =>
              import('./features/lending/lend-book/lend-book.component').then(m => m.LendBookComponent),
            canActivate: [adminGuard]
          },
          {
            path: 'return',
            loadComponent: () =>
              import('./features/lending/return-book/return-book.component').then(m => m.ReturnBookComponent),
            canActivate: [adminGuard]
          },
          {
            path: 'history',
            loadComponent: () =>
              import('./features/lending/lending-history/lending-history.component').then(m => m.LendingHistoryComponent),
            canActivate: [adminGuard]
          }
        ]
      },
      {
        path: 'auth',
        children: [
          {
            path: 'login',
            loadComponent: () =>
              import('./features/auth/login/login.component').then(m => m.LoginComponent),
            canActivate: [publicGuard]
          },
          {
            path: 'register',
            loadComponent: () =>
              import('./features/auth/register/register.component').then(m => m.RegisterComponent),
            canActivate: [publicGuard]
          },
          {
            path: 'check-email',
            loadComponent: () =>
              import('./features/auth/check-email/check-email.component').then(m => m.CheckEmailComponent),
            canActivate: [publicGuard]
          },
          {
            path: 'library-options',
            loadComponent: () =>
              import('./features/auth/library-options/library-options.component').then(m => m.LibraryOptionsComponent),
            canActivate: [authGuard]
          },
          {
            path: 'profile',
            loadComponent: () =>
              import('./features/auth/profile/profile.component').then(m => m.ProfileComponent),
            canActivate: [authGuard]
          }
        ]
      },
      {
        path: 'test',
        children: [
            {
                path: 'card',
                loadComponent: () =>
                  import('./shared/book-card/book-card.component').then(m => m.BookCardComponent)
              },
              {
                path: 'scanner',
                loadComponent: () =>
                  import('./shared/isbn-scanner/isbn-scanner.component').then(m => m.IsbnScannerComponent)
              }
        ]
      },
      {
        path: '**',
        redirectTo: 'dashboard'
      }
];
