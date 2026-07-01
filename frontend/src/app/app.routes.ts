import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'autos', pathMatch: 'full' },
  { path: 'autos', loadComponent: () => import('./features/autos/autos-list.component').then(m => m.AutosListComponent) },
  { path: 'autos/:id', loadComponent: () => import('./features/autos/auto-detail.component').then(m => m.AutoDetailComponent) },
  { path: 'concesionarias/:slug', loadComponent: () => import('./features/autos/dealer-profile.component').then(m => m.DealerProfileComponent) },
  { path: 'gestores', loadComponent: () => import('./features/gestores/gestores-list.component').then(m => m.GestoresListComponent) },
  { path: 'gestores/:slug', loadComponent: () => import('./features/gestores/gestor-detail.component').then(m => m.GestorDetailComponent) },
  { path: 'review/:dealId', loadComponent: () => import('./features/site/pages/review.component').then(m => m.ReviewComponent) },
  { path: 'pay/success', loadComponent: () => import('./features/site/pay-success.component').then(m => m.PaySuccessComponent) },
  { path: 'pay/mp/:token', loadComponent: () => import('./features/payment/mp-checkout.component').then(m => m.MpCheckoutComponent) },
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  { path: 'login/gestor', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent), data: { role: 'gestor' } },
  { path: 'login/concesionaria', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent), data: { role: 'concesionaria' } },
  { path: 'login/cliente', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent), data: { role: 'cliente' } },
  { path: 'login/perito', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent), data: { role: 'perito' } },
  { path: 'login/admin', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent), data: { role: 'admin' } },
  { path: 'registro-pendiente', loadComponent: () => import('./features/auth/registro-pendiente.component').then(m => m.RegistroPendienteComponent) },
  { path: 'subscription/success', loadComponent: () => import('./features/auth/subscription-success.component').then(m => m.SubscriptionSuccessComponent) },
  {
    path: 'panel/gestor',
    canActivate: [authGuard, roleGuard(['gestor'])],
    loadComponent: () => import('./features/panel/panel-gestor.component').then(m => m.PanelGestorComponent),
  },
  {
    path: 'panel/concesionaria',
    canActivate: [authGuard, roleGuard(['concesionaria'])],
    loadComponent: () => import('./features/panel/panel-concesionaria.component').then(m => m.PanelConcesionariaComponent),
  },
  {
    path: 'panel/admin',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () => import('./features/panel/panel-admin.component').then(m => m.PanelAdminComponent),
  },
  {
    path: 'panel/cliente',
    canActivate: [authGuard, roleGuard(['cliente'])],
    loadComponent: () => import('./features/panel-cliente/panel-cliente.component').then(m => m.PanelClienteComponent),
  },
  {
    path: 'panel/perito',
    canActivate: [authGuard, roleGuard(['perito'])],
    loadComponent: () => import('./features/panel/panel-perito.component').then(m => m.PanelPeritoComponent),
  },
  { path: '**', redirectTo: 'autos' },
];
