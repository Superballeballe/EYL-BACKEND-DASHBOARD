import Nav from "@/components/Nav";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-7xl px-6 py-7">{children}</div>
      </main>
    </div>
  );
}
