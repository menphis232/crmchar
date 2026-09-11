import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/cover/cover.page').then((m) => m.CoverPage),
    title: 'Daily Hero 13/30',
  },
  {
    path: '',
    loadComponent: () => import('./shared/site-shell/site-shell').then((m) => m.SiteShell),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
        title: 'Shakky · Stralicious',
      },
      {
        path: 'shakes',
        loadComponent: () => import('./pages/shakes/shakes.page').then((m) => m.ShakesPage),
        title: 'Our Shakes · Shakky',
      },
      {
        path: 'about',
        loadComponent: () => import('./pages/about/about.page').then((m) => m.AboutPage),
        title: 'About Us · Shakky',
      },
      {
        path: 'contact',
        loadComponent: () => import('./pages/contact/contact.page').then((m) => m.ContactPage),
        title: 'Contact · Shakky',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
