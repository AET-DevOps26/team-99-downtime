import { Button } from '@/components/ui/button';

export function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Welcome client</h1>
      <p className="text-muted-foreground max-w-md text-center">
        Tailwind CSS v4 and shadcn/ui are wired up. Use the button below to verify styling.
      </p>
      <div className="flex gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Hello</Button>
        <Button variant="outline">Outline</Button>
      </div>
    </div>
  );
}

export default App;
