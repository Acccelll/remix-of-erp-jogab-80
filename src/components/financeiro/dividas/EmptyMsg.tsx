export function EmptyMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground py-8">
      {children}
    </div>
  );
}
