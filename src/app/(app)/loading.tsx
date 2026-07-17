import { Skeleton } from "@/components/ui/primitives";

export default function AppLoading() {
  return (
    <div className="mx-auto grid w-full max-w-[1480px] gap-5 p-5 md:p-8" aria-label="Loading workspace">
      <div className="flex items-end justify-between gap-6">
        <div className="grid flex-1 gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-64 max-w-full" />
          <Skeleton className="h-4 w-[32rem] max-w-full" />
        </div>
        <Skeleton className="hidden h-10 w-32 sm:block" />
      </div>
      <Skeleton className="h-14 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-72 w-full" />)}
      </div>
    </div>
  );
}
