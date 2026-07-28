import { Skeleton } from "@/components/ui/primitives";

export default function AppLoading() {
  return (
    <div className="workspace-loading" aria-label="Loading workspace">
      <div className="workspace-loading__header">
        <div className="workspace-loading__title">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-64 max-w-full" />
          <Skeleton className="h-4 w-[32rem] max-w-full" />
        </div>
        <Skeleton className="hidden h-10 w-32 sm:block" />
      </div>
      <Skeleton className="h-14 w-full" />
      <div className="workspace-loading__grid">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-72 w-full" />)}
      </div>
    </div>
  );
}
