import { Providers } from './providers';
import { AppRouter } from './router';

// The root component of the React tree. It wraps the entire application
// with necessary global providers (like Theme, Auth context, etc.) 
// and renders the main router to handle page navigation.
export default function App() {
  return (
    <Providers>
      <AppRouter />
    </Providers>
  );
}
