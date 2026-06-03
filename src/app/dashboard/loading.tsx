import { Card, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <main className="px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <div className="h-9 w-48 animate-pulse rounded-md bg-white/10" />
          <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded-md bg-white/10" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-5">
                <div className="h-4 w-32 animate-pulse rounded-md bg-white/10" />
                <div className="mt-4 h-8 w-14 animate-pulse rounded-md bg-white/10" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
