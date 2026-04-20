import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register').then(m => m.Register)
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login').then(m => m.Login)
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./pages/verify-email/verify-email').then(m => m.VerifyEmailComponent)
  },
  {
    path: '', 
    redirectTo: 'login', 
    pathMatch: 'full' 
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'generate-exam',
        loadComponent: () =>
          import('./pages/generate-exam/generate-exam.component').then(m => m.GenerateExamComponent)
      },
      {
        path: 'classes',
        loadComponent: () =>
          import('./pages/classes/classes.component').then(m => m.ClassesComponent)
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./pages/history/history.component').then(m => m.HistoryComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
