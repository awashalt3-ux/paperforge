import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  FileOutput,
  FileText,
  HelpCircle,
  Keyboard,
  Layers,
  LifeBuoy,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SHORTCUT_GROUPS, modifierLabel } from "@/lib/shortcuts";
import { TIPS } from "@/lib/tips";
import { useUIStore } from "@/store/uiStore";

interface GuideSection {
  id: string;
  title: string;
  summary: string;
  icon: typeof FileText;
  steps: string[];
  link?: { to: string; label: string };
}

const SECTIONS: GuideSection[] = [
  {
    id: "create",
    title: "Create a document",
    summary: "Start from a blank page, a template, or an imported PDF.",
    icon: FileText,
    steps: [
      "Choose New PDF in the sidebar, or press Ctrl+K and search for “new”.",
      "Pick a page size (A4, A5, US Letter, A3) or enter custom millimetres.",
      "Use the toolbar to add headings, paragraphs, images, tables, shapes, and signatures.",
    ],
    link: { to: "/templates", label: "Browse templates" },
  },
  {
    id: "import",
    title: "Import an existing PDF",
    summary: "Keep the original vectors and annotate on top.",
    icon: FileOutput,
    steps: [
      "Open Import PDF and drop a file up to 120 MB.",
      "The source pages are preserved exactly; imported text is intentionally not reflowed.",
      "Add new text, highlights, images, or signatures as overlays, then export.",
    ],
  },
  {
    id: "edit",
    title: "Edit with confidence",
    summary: "Undo is generous, autosave is automatic.",
    icon: Layers,
    steps: [
      "Double-click text to edit inline. Ctrl+Enter commits and Escape cancels.",
      "Drag to move, use the transformer handles to resize or rotate, and hold Shift for multi-select.",
      "Every change is autosaved after half a second and undo covers 60 steps.",
    ],
  },
  {
    id: "export",
    title: "Deliver the result",
    summary: "PDF, images, print, or a portable project file.",
    icon: Sparkles,
    steps: [
      "Export PDF produces vector text with embedded Inter fonts and real page geometry.",
      "Export images renders each page to PNG or JPEG, bundled as a ZIP when needed.",
      "Print sends the rendered pages straight to your system print dialog.",
    ],
    link: { to: "/tools", label: "Open the PDF tools" },
  },
  {
    id: "tools",
    title: "Use the PDF tool bench",
    summary: "Nine operations, all on-device.",
    icon: Wrench,
    steps: [
      "Merge, split, rotate, reorder, remove, or extract pages.",
      "Add watermarks and page numbers with precise placement.",
      "Turn PNG or JPEG images into clean, page-sized PDFs.",
    ],
    link: { to: "/tools", label: "Go to PDF tools" },
  },
  {
    id: "privacy",
    title: "Privacy and storage",
    summary: "Files never leave this browser.",
    icon: ShieldCheck,
    steps: [
      "Documents and imported PDFs live in IndexedDB on this device.",
      "Deleted documents rest in the trash for 30 days before they are purged.",
      "Export a project file to back up or move a document to another browser.",
    ],
    link: { to: "/settings", label: "Manage local data" },
  },
];

export function HelpPage() {
  useDocumentTitle("Help & guide");
  const modifier = modifierLabel();
  const setCommandOpen = useUIStore((state) => state.setCommandOpen);
  const setShortcutsOpen = useUIStore((state) => state.setShortcutsOpen);
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return SECTIONS;
    return SECTIONS.filter((section) =>
      `${section.title} ${section.summary} ${section.steps.join(" ")}`
        .toLowerCase()
        .includes(term),
    );
  }, [query]);

  const tips = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return TIPS;
    return TIPS.filter((tip) => `${tip.title} ${tip.body}`.toLowerCase().includes(term));
  }, [query]);

  return (
    <div className="mx-auto w-full max-w-[1150px] px-5 pb-20 pt-8 sm:px-8 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="micro-label">Help centre</p>
          <h1 className="display-serif mt-2 text-[44px] leading-none sm:text-[52px]">
            Learn the studio.
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            Everything Paperforge can do, in plain language. Search the guide, browse the shortcuts,
            or jump straight into the tools.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="bg-card/70" onClick={() => setShortcutsOpen(true)}>
            <Keyboard className="size-4" />
            Shortcuts
          </Button>
          <Button className="gap-1.5" onClick={() => setCommandOpen(true)}>
            <Search className="size-4" />
            Search everything
          </Button>
        </div>
      </header>

      <div className="relative mt-7 max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the guide, for example “export” or “trash”"
          aria-label="Search the help guide"
          className="h-10 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-[12.5px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring/50 focus:ring-2 focus:ring-ring/20"
        />
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <article
              key={section.id}
              className="flex flex-col rounded-2xl border border-border/70 bg-card/65 p-5 transition-colors hover:border-foreground/15"
            >
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-forge-600/10 text-forge-700 dark:bg-forge-300/10 dark:text-forge-300">
                  <Icon className="size-4" />
                </span>
                <h2 className="text-[13px] font-semibold tracking-[-0.01em]">{section.title}</h2>
              </div>
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {section.summary}
              </p>
              <ol className="mt-3 space-y-1.5">
                {section.steps.map((step, index) => (
                  <li key={step} className="flex gap-2 text-[11px] leading-relaxed text-foreground/80">
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-muted/70 font-mono text-[8.5px] text-muted-foreground">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {section.link && (
                <Link
                  to={section.link.to}
                  className="mt-auto inline-flex items-center gap-1 pt-3.5 text-[11px] font-medium text-forge-700 transition-colors hover:text-forge-600 dark:text-forge-300"
                >
                  {section.link.label}
                  <ArrowRight className="size-3" />
                </Link>
              )}
            </article>
          );
        })}
      </section>

      {sections.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border/80 bg-card/40 px-6 py-12 text-center">
          <HelpCircle className="mx-auto size-5 text-muted-foreground/60" />
          <p className="mt-3 text-[13px] font-medium">No guide section matches “{query}”.</p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Try “import”, “export”, “tools”, “trash”, or “print”.
          </p>
        </div>
      )}

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="micro-label">Small things that help</p>
            <h2 className="display-serif mt-1.5 text-[24px]">Tips from the studio</h2>
          </div>
          <p className="hidden text-[10.5px] text-muted-foreground sm:block">
            Hover the icons in the editor for the same hints.
          </p>
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {tips.map((tip) => (
            <div
              key={tip.id}
              className="rounded-xl border border-forge-600/12 bg-forge-600/[0.04] p-3.5 dark:border-forge-300/12 dark:bg-forge-300/[0.045]"
            >
              <div className="flex items-start gap-2">
                <BookOpen className="mt-0.5 size-3.5 shrink-0 text-forge-700 dark:text-forge-300" />
                <div>
                  <p className="text-[11.5px] font-semibold">{tip.title}</p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
                    {tip.body}
                  </p>
                  {tip.keys && (
                    <span className="mt-1.5 inline-flex items-center gap-1">
                      {tip.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded border border-border/80 bg-card px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-border/70 bg-card/65 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Keyboard className="size-4 text-forge-700 dark:text-forge-300" />
            <h2 className="text-[14px] font-semibold">Keyboard shortcuts</h2>
          </div>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Use <kbd className="rounded border border-border/80 bg-muted/60 px-1 font-mono text-[9px]">{modifier}</kbd>{" "}
            in place of Ctrl on macOS.
          </p>
          <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.group}>
                <h3 className="micro-label mb-2">{group.group}</h3>
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-3 text-[11.5px] text-muted-foreground"
                    >
                      <span>{item.label}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {item.keys.map((key, index) => (
                          <span key={key} className="flex items-center gap-1">
                            {index > 0 && (
                              <span className="text-[8px] text-muted-foreground/45">+</span>
                            )}
                            <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border/90 bg-muted/55 px-1.5 font-mono text-[9.5px] text-foreground/75">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-forge-900/10 bg-[#193b33] p-5 text-[#e9f2ee]">
            <div className="flex items-center gap-2 text-[#8cc7b8]">
              <ShieldCheck className="size-4" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Local only</p>
            </div>
            <p className="display-serif mt-3 text-[22px] leading-[1.14] text-[#f0f6f2]">
              No upload.
              <br />
              No account.
              <br />
              No tracking.
            </p>
            <p className="mt-3 text-[10.5px] leading-relaxed text-[#a9c8c0]">
              Reading, rendering, editing, and export happen in this tab. Open-source and auditable.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-5">
            <div className="flex items-center gap-2">
              <LifeBuoy className="size-4 text-muted-foreground" />
              <p className="micro-label">Troubleshooting</p>
            </div>
            <ul className="mt-2.5 space-y-2 text-[10.5px] leading-relaxed text-muted-foreground">
              <li>
                <span className="font-medium text-foreground/80">A PDF will not import.</span> Check
                the 120 MB limit and make sure it is not password protected.
              </li>
              <li>
                <span className="font-medium text-foreground/80">Text looks different after export.</span>{" "}
                Export embeds Inter. If a font cannot be loaded, standard PDF fonts are used as a
                fallback.
              </li>
              <li>
                <span className="font-medium text-foreground/80">Storage looks full.</span> Clear the
                trash or remove imported files from Settings.
              </li>
            </ul>
            <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
              <Link to="/settings">Open settings</Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/45 p-5 text-[10px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground/80">Open source</p>
            <p className="mt-1">
              Paperforge is a local-first studio you can read, fork, and self-host. Bring your own
              license before publishing a public distribution.
            </p>
          </div>
        </aside>
      </section>

      <p className="mt-10 text-center text-[10px] text-muted-foreground/60">
        Still stuck? Press <kbd className="font-mono">Ctrl+K</kbd> and search for the action you need.
      </p>
    </div>
  );
}
