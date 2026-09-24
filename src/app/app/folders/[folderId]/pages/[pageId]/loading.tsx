import { Bone } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[45rem] flex-col gap-4 pt-10" aria-busy="true" aria-label="Loading page">
      <Bone className="h-11 w-2/3" />
      <Bone className="mt-4 h-6 w-1/3" />
      <Bone className="h-4 w-full" />
      <Bone className="h-4 w-11/12" />
      <Bone className="h-4 w-4/5" />
    </div>
  );
}
