"use client";

import { createContext, useContext } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { folderDotClass } from "@/lib/folder-colors";
import { cn } from "@/lib/utils";

export interface Subject {
  id: string;
  name: string;
  color: string;
}

/** The user's folders, used as "subjects" for tasks and roadmaps. Provided once in the app layout. */
const SubjectsContext = createContext<Subject[]>([]);

export function SubjectsProvider({ subjects, children }: { subjects: Subject[]; children: React.ReactNode }) {
  return <SubjectsContext.Provider value={subjects}>{children}</SubjectsContext.Provider>;
}

export function useSubjects() {
  return useContext(SubjectsContext);
}

export function SubjectDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("size-2 shrink-0 rounded-[3px]", folderDotClass(color), className)} />;
}

const NONE = "__none__";

/** Folder picker with a "No subject" option. */
export function SubjectSelect({
  value,
  onChange,
  className,
  placeholder = "No subject",
}: {
  value: string | null;
  onChange: (folderId: string | null) => void;
  className?: string;
  placeholder?: string;
}) {
  const subjects = useSubjects();
  const byId = new Map(subjects.map((s) => [s.id, s]));

  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(!v || v === NONE ? null : v)}>
      <SelectTrigger className={className} aria-label="Subject">
        <SelectValue>
          {(v: string) => {
            const subject = byId.get(v);
            return subject ? (
              <span className="flex min-w-0 items-center gap-2">
                <SubjectDot color={subject.color} />
                <span className="truncate">{subject.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>
          <span className="text-muted-foreground">No subject</span>
        </SelectItem>
        {subjects.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <span className="flex items-center gap-2">
              <SubjectDot color={s.color} />
              {s.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
