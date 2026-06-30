import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

export default [
  layout('app/guards/GuestLayout.tsx', [
    route('/login', 'pages/LoginPage.tsx'),
    route('/signup', 'pages/SignupPage.tsx'),
  ]),
  layout('app/guards/ProtectedLayout.tsx', [
    layout('shared/layout/AppLayout.tsx', [
      index('pages/DashboardPage.tsx'),
      route('/transactions', 'pages/TransactionsPage.tsx'),
    ]),
  ]),
] satisfies RouteConfig;
