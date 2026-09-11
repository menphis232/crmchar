import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/cover/cover.page').then((m) => m.CoverPage),
    title: 'Daily Hero 28/30',
  },
  {
    path: 'drive',
    loadComponent: () => import('./pages/drive/drive.page').then((m) => m.DrivePage),
    title: 'Velocity · Beyond Limits',
  },
  {
    path: 'performance',
    loadComponent: () => import('./pages/section/section.page').then((m) => m.SectionPage),
    title: 'Performance · Velocity',
    data: { page: 'performance' },
  },
  {
    path: 'technology',
    loadComponent: () => import('./pages/section/section.page').then((m) => m.SectionPage),
    title: 'Technology · Velocity',
    data: { page: 'technology' },
  },
  {
    path: 'interior',
    loadComponent: () => import('./pages/section/section.page').then((m) => m.SectionPage),
    title: 'Interior · Velocity',
    data: { page: 'interior' },
  },
  {
    path: 'experience',
    loadComponent: () => import('./pages/section/section.page').then((m) => m.SectionPage),
    title: 'Experience · Velocity',
    data: { page: 'experience' },
  },
  { path: '**', redirectTo: '' },
];
