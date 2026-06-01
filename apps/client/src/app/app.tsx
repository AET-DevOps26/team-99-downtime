import { RouterProvider } from 'react-router-dom';

import { Toaster } from '@/shared/ui/sonner';
import { router } from './router';

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </>
  );
}

export default App;
