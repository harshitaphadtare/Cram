"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  BlockNoteContext,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from "@blocknote/react";
import { useTheme } from "next-themes";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  BlockNoteSchema,
  combineByGroup,
  createCodeBlockSpec,
  defaultBlockSpecs,
  filterSuggestionItems,
  type Block,
} from "@blocknote/core";
import { codeBlockOptions, syntaxHighlighter } from "@blocknote/code-block";
import * as coreLocales from "@blocknote/core/locales";
import {
  getMultiColumnSlashMenuItems,
  locales as multiColumnLocales,
  multiColumnDropCursor,
  withMultiColumn,
} from "@blocknote/xl-multi-column";
import type { Theme } from "@blocknote/mantine";
import { FolderInput, Link2, Loader2, MoreHorizontal, Plus } from "lucide-react";
import { createPage, updatePageContent, renamePage, updatePageLayout } from "@/app/actions/pages";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assertUploadSize } from "@/lib/uploads";
import { PageOutline, extractHeadings } from "@/components/page-outline";
import { ListenPlayer } from "@/components/listen-player";
import { SubPages } from "@/components/sub-pages";
import { PageIconPicker } from "@/components/page-icon";
import { MovePageDialog } from "@/components/move-page-dialog";
import { detectLanguageUpdates, enhanceCodeBlock } from "@/lib/code-block";
import { fixDashBulletsInHtml, shouldPasteAsMarkdown } from "@/lib/markdown-paste";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Code blocks get a language picker and syntax highlighting; Mermaid blocks show their diagram
// (Notion-style), with the source editable when the block is selected.
const codeLanguages = {
  ...codeBlockOptions.supportedLanguages,
  mermaid: { name: "Mermaid", aliases: ["mmd"] },
};
const codeBlock = enhanceCodeBlock(
  // New blocks start as Plain Text; the language is then detected from what's typed or pasted.
  createCodeBlockSpec({ ...codeBlockOptions, defaultLanguage: "text", supportedLanguages: codeLanguages }),
  codeLanguages,
);

// Default blocks plus Notion-style columns (type "/columns", or drag a block to another's side).
const schema = withMultiColumn(
  BlockNoteSchema.create({ blockSpecs: { ...defaultBlockSpecs, codeBlock } }),
);

// Points at our own CSS custom properties (see globals.css) instead of hardcoded colors, so the
// editor follows the app's palette and light/dark theme automatically — no JS theme switching needed.
const editorTheme: Theme = {
  fontFamily: "var(--font-sans)",
  borderRadius: 8,
  colors: {
    editor: { text: "var(--foreground)", background: "var(--background)" },
    menu: { text: "var(--popover-foreground)", background: "var(--popover)" },
    tooltip: { text: "var(--popover-foreground)", background: "var(--popover)" },
    hovered: { text: "var(--accent-foreground)", background: "var(--accent)" },
    selected: { text: "var(--primary-foreground)", background: "var(--primary)" },
    disabled: { text: "var(--muted-foreground)", background: "var(--muted)" },
    shadow: "var(--border)",
    border: "var(--border)",
    sideMenu: "var(--muted-foreground)",
  },
};

async function uploadImage(file: File): Promise<string> {
  try {
    assertUploadSize(file);
  } catch (err) {
    toast.error((err as Error).message);
    throw err;
  }
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Upload failed");
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

const AUTOSAVE_DELAY_MS = 1000;

/** Visual-only switch for menu rows (a real <Switch> is a button, which can't nest in a menu item). */
function ToggleIndicator({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors",
        on ? "bg-primary" : "bg-muted-foreground/30",
      )}
    >
      <span className={cn("size-3 rounded-full bg-white shadow-sm transition-transform", on && "translate-x-3")} />
    </span>
  );
}

export function PageEditor({
  pageId,
  initialTitle,
  initialContent,
  editable,
  initialFullWidth,
  initialSmallText,
  folder,
  initialIcon = null,
}: {
  pageId: string;
  initialTitle: string;
  initialContent: Block[];
  editable: boolean;
  initialFullWidth: boolean;
  initialSmallText: boolean;
  /** The page's subject and its page tree — for "Pages inside" and "Move to…". */
  folder?: {
    id: string;
    name: string;
    pages: { id: string; title: string; parentId: string | null; icon: string | null }[];
  };
  /** The page's emoji icon, if it has one. */
  initialIcon?: string | null;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [creatingSubPage, startCreatingSubPage] = useTransition();
  const router = useRouter();

  function addSubPage() {
    if (!folder) return;
    startCreatingSubPage(async () => {
      try {
        const page = await createPage(folder.id, pageId);
        router.push(`/app/folders/${folder.id}/pages/${page.id}`);
      } catch {
        toast.error("Couldn't create the page.");
      }
    });
  }
  const [title, setTitle] = useState(initialTitle);
  const [fullWidth, setFullWidth] = useState(initialFullWidth);
  const [smallText, setSmallText] = useState(initialSmallText);
  const [savedIndicator, setSavedIndicator] = useState<"idle" | "saving" | "saved">("idle");
  // BlockNote otherwise follows the OS color scheme, which clashes with the app's own theme toggle
  // (e.g. a dark editor on a light page when the OS is in dark mode).
  const { resolvedTheme } = useTheme();
  const colorScheme = resolvedTheme === "dark" ? "dark" : "light";
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useCreateBlockNote({
    schema,
    dropCursor: multiColumnDropCursor,
    dictionary: { ...coreLocales.en, multi_column: multiColumnLocales.en },
    initialContent:
      initialContent.length > 0
        ? (initialContent as unknown as (typeof schema.PartialBlock)[])
        : undefined,
    uploadFile: uploadImage,
    extensions: [syntaxHighlighter],
    // Notes copied from Notion/Claude/ChatGPT: read the Markdown version of the clipboard when the
    // HTML version has lost the bullets and code blocks (see lib/markdown-paste.ts).
    pasteHandler: ({ event, editor, defaultPasteHandler }) => {
      if (editor.getTextCursorPosition().block.type === "codeBlock") return defaultPasteHandler();
      const markdown = shouldPasteAsMarkdown(event.clipboardData);
      if (markdown) {
        editor.pasteMarkdown(markdown);
        return true;
      }
      // Otherwise prefer the rich text when there is some (BlockNote's own fallback would re-read the
      // raw plain text as Markdown, spacing quirks and all) — fixing bullets that arrived as
      // "- item" paragraphs on the way.
      const types = event.clipboardData?.types ?? [];
      const html = event.clipboardData?.getData("text/html") ?? "";
      const handledByDefault = ["blocknote/html", "Files", "vscode-editor-data"].some((t) => types.includes(t));
      if (html && !handledByDefault) {
        editor.pasteHTML(fixDashBulletsInHtml(html) ?? html);
        return true;
      }
      return defaultPasteHandler();
    },
  });
  const detectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [headings, setHeadings] = useState(() => extractHeadings(editor.document as unknown as Block[]));

  const handleChange = useCallback(() => {
    setHeadings(extractHeadings(editor.document as unknown as Block[]));
    // Pick code block languages from their contents once typing/pasting settles.
    if (detectTimer.current) clearTimeout(detectTimer.current);
    detectTimer.current = setTimeout(() => {
      const updates = detectLanguageUpdates(editor.document as never, codeLanguages);
      if (updates.length === 0) return;
      editor.transact(() => {
        for (const u of updates) editor.updateBlock(u.id, { props: { language: u.language } });
      });
    }, 400);
  }, [editor]);

  function changeLayout(patch: { fullWidth?: boolean; smallText?: boolean }) {
    if (patch.fullWidth !== undefined) setFullWidth(patch.fullWidth);
    if (patch.smallText !== undefined) setSmallText(patch.smallText);
    updatePageLayout(pageId, patch).catch(() => {
      toast.error("Couldn't save that setting.");
      if (patch.fullWidth !== undefined) setFullWidth(!patch.fullWidth);
      if (patch.smallText !== undefined) setSmallText(!patch.smallText);
    });
  }

  const scheduleContentSave = useCallback(() => {
    setSavedIndicator("saving");
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        await updatePageContent(pageId, JSON.parse(JSON.stringify(editor.document)));
        setSavedIndicator("saved");
      } catch {
        toast.error("Couldn't save your changes.");
        setSavedIndicator("idle");
      }
    }, AUTOSAVE_DELAY_MS);
  }, [editor, pageId]);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (titleSaveTimeout.current) clearTimeout(titleSaveTimeout.current);
    titleSaveTimeout.current = setTimeout(() => {
      renamePage(pageId, value).catch(() => toast.error("Couldn't save the title."));
    }, AUTOSAVE_DELAY_MS);
  }

  const statusLabel = useMemo(() => {
    if (savedIndicator === "saving") return "Saving…";
    if (savedIndicator === "saved") return "Saved";
    return "";
  }, [savedIndicator]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-3 pt-10 pb-32",
        fullWidth ? "max-w-none md:px-6 xl:pr-16" : "max-w-[45rem]",
        smallText && "cram-small-text",
      )}
    >
      {/* Title area: page icon (click for the emoji picker), title, then "Add sub-page". */}
      <div className="group/title flex flex-col gap-1">
      <div className="-ml-1.5">
        <PageIconPicker pageId={pageId} icon={initialIcon} editable={editable} size="lg" />
      </div>
      <div data-tour="editor" className="flex items-center justify-between gap-3">
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          disabled={!editable}
          placeholder="Untitled"
          // Already well over 16px, so exempt from the phone "no zoom on focus" input rule.
          data-large-text
          className="w-full min-w-0 bg-transparent text-[2rem] leading-[1.2] font-bold sm:text-[2.5rem] text-foreground outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-70"
        />
        <span className="shrink-0 text-xs text-muted-foreground">{statusLabel}</span>
        <ListenPlayer pageId={pageId} getBlocks={() => editor.document} anchorRef={containerRef} />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" aria-label="Page options">
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            {/* Base UI requires a group label to live inside a Menu.Group. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">Page</DropdownMenuLabel>
              <DropdownMenuItem
                closeOnClick={false}
                disabled={!editable}
                onClick={() => changeLayout({ fullWidth: !fullWidth })}
              >
                Full width
                <ToggleIndicator on={fullWidth} />
              </DropdownMenuItem>
              <DropdownMenuItem
                closeOnClick={false}
                disabled={!editable}
                onClick={() => changeLayout({ smallText: !smallText })}
              >
                Small text
                <ToggleIndicator on={smallText} />
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {folder && editable && (
              <DropdownMenuItem onClick={() => setMoveOpen(true)}>
                <FolderInput />
                Move to…
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied");
              }}
            >
              <Link2 />
              Copy link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {folder && editable && (
        <div className="flex items-center">
          <button
            type="button"
            onClick={addSubPage}
            disabled={creatingSubPage}
            className="-ml-2 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[0.8125rem] font-medium text-muted-foreground/75 transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none disabled:opacity-60"
          >
            {creatingSubPage ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Add sub-page
          </button>
        </div>
      )}
      </div>

      <div className="min-h-16">
        <BlockNoteContext.Provider value={{ colorSchemePreference: colorScheme }}>
          <BlockNoteView
            editor={editor}
            editable={editable}
            theme={editorTheme}
            slashMenu={false}
            onChange={() => {
              handleChange();
              scheduleContentSave();
            }}
          >
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) =>
                filterSuggestionItems(
                  combineByGroup(getDefaultReactSlashMenuItems(editor), getMultiColumnSlashMenuItems(editor)),
                  query,
                )
              }
            />
          </BlockNoteView>
        </BlockNoteContext.Provider>
      </div>

      {folder && (
        <SubPages folderId={folder.id} pageId={pageId} pages={folder.pages} editable={editable} />
      )}
      {folder && editable && (
        <MovePageDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          pageId={pageId}
          folderName={folder.name}
          pages={folder.pages}
        />
      )}

      <PageOutline headings={headings} />
    </div>
  );
}
