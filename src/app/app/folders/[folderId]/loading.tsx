import { Bone } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8" aria-busy="true" aria-label="Loading folder">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Bone className="h-8 w-56" />
          <Bone className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-8 w-20" />
          <Bone className="h-8 w-24" />
          <Bone className="h-8 w-24" />
        </div>
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-px overflow-hidden rounded-xl border">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Bone className="size-4" />
              <Bone className="h-4 flex-1" />
              <Bone className="h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-6">
          <Bone className="h-36 rounded-xl" />
          <Bone className="h-44 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
