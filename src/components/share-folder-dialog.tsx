"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FolderRole } from "@/generated/prisma/enums";
import { inviteMember, removeMember, updateMemberRole } from "@/app/actions/members";

export interface FolderMemberView {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: FolderRole;
}

const ROLE_LABEL: Record<FolderRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

const ROLE_DESCRIPTION: Record<FolderRole, string> = {
  OWNER: "Full control, can't be changed here",
  ADMIN: "Can edit and manage members",
  EDITOR: "Can add and edit pages",
  VIEWER: "Can view only",
};

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function ShareFolderDialog({
  folderId,
  folderName,
  owner,
  members,
  canManage,
}: {
  folderId: string;
  folderName: string;
  owner: { name: string | null; email: string; avatarUrl: string | null };
  members: FolderMemberView[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<FolderRole, "OWNER">>(FolderRole.VIEWER);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    startTransition(async () => {
      try {
        await inviteMember(folderId, email, role);
        toast.success(`Shared with ${email}`);
        setEmail("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't share the folder.");
      }
    });
  }

  function handleRoleChange(userId: string, newRole: FolderRole) {
    startTransition(async () => {
      try {
        await updateMemberRole(folderId, userId, newRole);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update role.");
      }
    });
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      try {
        await removeMember(folderId, userId);
        toast.success("Removed");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't remove member.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Share2 className="size-4" />
            Share
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share &ldquo;{folderName}&rdquo;</DialogTitle>
          <DialogDescription>
            Invite people who already have a Cram account. Their own quizzes and streaks stay
            private.
          </DialogDescription>
        </DialogHeader>

        {canManage && (
          <form onSubmit={handleInvite} className="flex items-end gap-2">
            <div className="flex-1 flex flex-col gap-1.5">
              <Label htmlFor="invite-email" className="text-xs">
                Email
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FolderRole.VIEWER}>Viewer</SelectItem>
                <SelectItem value={FolderRole.EDITOR}>Editor</SelectItem>
                <SelectItem value={FolderRole.ADMIN}>Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={pending || !email.trim()}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Invite
            </Button>
          </form>
        )}

        <Separator />

        <div className="flex flex-col gap-3 max-h-72 overflow-y-auto">
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              {owner.avatarUrl && <AvatarImage src={owner.avatarUrl} alt={owner.name ?? owner.email} />}
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {initials(owner.name, owner.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{owner.name ?? owner.email}</p>
              <p className="truncate text-xs text-muted-foreground">{owner.email}</p>
            </div>
            <span className="text-xs text-muted-foreground">Owner</span>
          </div>

          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-3">
              <Avatar className="size-8">
                {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name ?? m.email} />}
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {initials(m.name, m.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name ?? m.email}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              {canManage ? (
                <>
                  <Select
                    value={m.role}
                    onValueChange={(v) => handleRoleChange(m.userId, v as FolderRole)}
                  >
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FolderRole.VIEWER}>Viewer</SelectItem>
                      <SelectItem value={FolderRole.EDITOR}>Editor</SelectItem>
                      <SelectItem value={FolderRole.ADMIN}>Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRemove(m.userId)}
                    aria-label={`Remove ${m.email}`}
                  >
                    <X className="size-3.5" />
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">{ROLE_LABEL[m.role]}</span>
              )}
            </div>
          ))}

          {members.length === 0 && (
            <p className="text-sm text-muted-foreground">Not shared with anyone yet.</p>
          )}
        </div>

        {canManage && (
          <p className="text-xs text-muted-foreground">
            {ROLE_DESCRIPTION.VIEWER} · {ROLE_DESCRIPTION.EDITOR} · {ROLE_DESCRIPTION.ADMIN}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
