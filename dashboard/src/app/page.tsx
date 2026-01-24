export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="bg-card rounded-[8px] pixel-border border-border pixel-shadow p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          The Revenue Council
        </h1>
        <p className="text-muted-foreground mb-6">
          Welcome to your guild dashboard. Authentication required.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-foreground font-semibold rounded-[8px] pixel-shadow-gold">
          <span>Gold Theme Active</span>
        </div>
      </div>
    </main>
  );
}
