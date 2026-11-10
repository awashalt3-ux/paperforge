import { useEffect, useState } from "react";
import {
  Check,
  Database,
  HardDrive,
  Loader2,
  Monitor,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sun,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useDocumentStore } from "@/store/documentStore";
import {
  usePreferencesStore,
  applyTheme,
  type DefaultPageSize,
  type ThemeMode,
} from "@/store/preferencesStore";
import { clearAllData, db } from "@/db/database";
import { cn, formatBytes } from "@/lib/utils";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const themeOptions: { value: ThemeMode; label: string; description: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", description: "Warm paper", icon: Sun },
  { value: "dark", label: "Dark", description: "Ink at night", icon: Moon },
  { value: "system", label: "System", description: "Match device", icon: Monitor },
];

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/65 p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-[14px] font-semibold tracking-[-0.015em]">{title}</h2>
        {description && (
          <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border/55 py-3.5 last:border-b-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-[12px] font-medium">{label}</p>
        {description && (
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  useDocumentTitle("Settings");
  const preferences = usePreferencesStore();
  const documents = useDocumentStore((state) => state.documents);
  const refreshDocuments = useDocumentStore((state) => state.refreshDocuments);
  const [assetBytes, setAssetBytes] = useState(0);
  const [assetCount, setAssetCount] = useState(0);
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadStorage = async () => {
    setLoadingStorage(true);
    try {
      const assets = await db.pdfAssets.toArray();
      setAssetCount(assets.length);
      setAssetBytes(assets.reduce((total, asset) => total + asset.bytes.byteLength, 0));
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        setQuota({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 });
      }
    } catch {
      setQuota(null);
    } finally {
      setLoadingStorage(false);
    }
  };

  useEffect(() => {
    void loadStorage();
  }, [documents.length]);

  const setTheme = (theme: ThemeMode) => {
    preferences.setTheme(theme);
    applyTheme(theme);
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearAllData();
      useDocumentStore.setState({
        activeDocument: null,
        historyPast: [],
        historyFuture: [],
        documents: [],
        saveStatus: "idle",
        lastSavedAt: null,
      });
      await refreshDocuments();
      toast.success("All local documents were removed");
      setClearOpen(false);
      void loadStorage();
    } catch {
      toast.error("The local database could not be cleared.");
    } finally {
      setClearing(false);
    }
  };

  const storagePercent =
    quota && quota.quota > 0 ? Math.min(100, (quota.usage / quota.quota) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 pb-20 pt-8 sm:px-8 lg:px-10">
      <header>
        <p className="micro-label">Studio settings</p>
        <h1 className="display-serif mt-2 text-[42px] leading-none sm:text-[50px]">
          Make it yours.
        </h1>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          Preferences for your workspace, editor, and the local data Paperforge keeps on this
          device.
        </p>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_330px] lg:items-start">
        <div className="space-y-5">
          <SettingsSection
            title="Appearance"
            description="Paperforge uses a warm, low-contrast palette designed for long editing sessions."
          >
            <div className="grid grid-cols-3 gap-2.5">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const active = preferences.theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "relative flex flex-col items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                      active
                        ? "border-forge-600/40 bg-forge-600/[0.055] shadow-[inset_0_0_0_1px_hsl(var(--primary)/.12)]"
                        : "border-border/70 bg-background/30 hover:border-foreground/15 hover:bg-accent/30",
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div
                        className={cn(
                          "grid size-8 place-items-center rounded-lg",
                          active
                            ? "bg-forge-600 text-white dark:bg-forge-300 dark:text-forge-950"
                            : "bg-muted/80 text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      {active && (
                        <span className="grid size-4 place-items-center rounded-full bg-forge-600 text-white dark:bg-forge-300 dark:text-forge-950">
                          <Check className="size-2.5" />
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-[12px] font-medium">{option.label}</p>
                      <p className="mt-0.5 text-[9.5px] text-muted-foreground">{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </SettingsSection>

          <SettingsSection
            title="New documents"
            description="These defaults apply whenever you create a blank PDF."
          >
            <SettingRow label="Default page size" description="A4, A5, or US Letter.">
              <Select
                value={preferences.defaultPageSize}
                onValueChange={(value) =>
                  preferences.setDefaultPageSize(value as DefaultPageSize)
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4 · 210 × 297 mm</SelectItem>
                  <SelectItem value="a5">A5 · 148 × 210 mm</SelectItem>
                  <SelectItem value="letter">Letter · 8.5 × 11 in</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow label="Default orientation" description="Portrait is best for most documents.">
              <div className="flex rounded-lg border border-border/70 bg-muted/40 p-0.5">
                {(["portrait", "landscape"] as const).map((orientation) => (
                  <button
                    key={orientation}
                    type="button"
                    onClick={() => preferences.setDefaultOrientation(orientation)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-[10.5px] font-medium capitalize transition-colors",
                      preferences.defaultOrientation === orientation
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {orientation}
                  </button>
                ))}
              </div>
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            title="Editor"
            description="Fine-tune how the canvas behaves while you work."
          >
            <SettingRow
              label="Show grid"
              description="Display a subtle alignment grid on each page."
            >
              <Switch
                checked={preferences.showGrid}
                onCheckedChange={preferences.setShowGrid}
                aria-label="Show grid"
              />
            </SettingRow>
            <SettingRow
              label="Snap to grid"
              description="Align elements to the grid while dragging."
            >
              <Switch
                checked={preferences.snapToGrid}
                onCheckedChange={preferences.setSnapToGrid}
                aria-label="Snap to grid"
              />
            </SettingRow>
            <SettingRow
              label="Grid size"
              description={`${preferences.gridSize} points between grid lines.`}
            >
              <div className="flex w-[172px] items-center gap-3">
                <Slider
                  value={[preferences.gridSize]}
                  onValueChange={([value]) => preferences.setGridSize(value)}
                  min={4}
                  max={40}
                  step={2}
                  aria-label="Grid size"
                />
                <span className="w-7 text-right font-mono text-[10px] text-muted-foreground">
                  {preferences.gridSize}
                </span>
              </div>
            </SettingRow>
            <SettingRow
              label="Autosave"
              description="Save changes to this browser 500 ms after you stop typing."
            >
              <Switch
                checked={preferences.autosave}
                onCheckedChange={preferences.setAutosave}
                aria-label="Autosave"
              />
            </SettingRow>
            <SettingRow
              label="Reduce motion"
              description="Minimise interface transitions and animations."
            >
              <Switch
                checked={preferences.reduceMotion}
                onCheckedChange={preferences.setReduceMotion}
                aria-label="Reduce motion"
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            title="Local data"
            description="Paperforge is local-first. Documents, imported PDF pages, and generated previews stay in this browser."
          >
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-8 place-items-center rounded-lg bg-card text-muted-foreground shadow-sm ring-1 ring-border/60">
                    <HardDrive className="size-3.5" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium">Browser storage</p>
                    <p className="text-[10px] text-muted-foreground">
                      {loadingStorage
                        ? "Measuring local data…"
                        : `${documents.length} document${documents.length === 1 ? "" : "s"} · ${assetCount} imported file${assetCount === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[12px] font-medium">{formatBytes(assetBytes)}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    PDF assets
                  </p>
                </div>
              </div>
              {quota && quota.quota > 0 && (
                <div className="mt-4">
                  <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
                    <div
                      className="h-full rounded-full bg-forge-600 transition-[width] duration-500 dark:bg-forge-300"
                      style={{ width: `${Math.max(1, storagePercent)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
                    <span>{formatBytes(quota.usage)} used by this site</span>
                    <span>{formatBytes(quota.quota)} available</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/15 bg-destructive/[0.035] px-4 py-3.5">
              <div>
                <p className="text-[12px] font-medium">Delete all local documents</p>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                  Removes every document and imported PDF. Preferences are kept.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/25 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setClearOpen(true)}
                disabled={documents.length === 0}
              >
                <Trash2 className="size-3.5" />
                Clear library
              </Button>
            </div>
          </SettingsSection>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6">
          <div className="overflow-hidden rounded-2xl border border-forge-900/10 bg-[#193b33] p-5 text-[#e9f2ee]">
            <div className="flex items-center gap-2 text-[#8cc7b8]">
              <ShieldCheck className="size-4" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                Private by design
              </p>
            </div>
            <p className="display-serif mt-3 text-[24px] leading-[1.12] text-[#f0f6f2]">
              No account.
              <br />
              No upload.
              <br />
              No cloud.
            </p>
            <p className="mt-3 text-[10.5px] leading-relaxed text-[#a9c8c0]">
              PDF reading, rendering, editing, and export all happen in this tab. Your files are
              never sent to a server by Paperforge.
            </p>
            <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-[9.5px] text-[#8fb6a9]">
              <Database className="size-3" />
              IndexedDB · paperforge-db
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/65 p-5">
            <p className="micro-label">Maintenance</p>
            <p className="mt-2 text-[12px] font-medium">Reset workspace preferences</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
              Restore the original theme, page defaults, and editor behaviour. Documents are not
              affected.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => {
                usePreferencesStore.setState({
                  theme: "light",
                  defaultPageSize: "a4",
                  defaultOrientation: "portrait",
                  showGrid: false,
                  snapToGrid: true,
                  gridSize: 10,
                  autosave: true,
                  reduceMotion: false,
                });
                applyTheme("light");
                toast.success("Preferences reset");
              }}
            >
              <RotateCcw className="size-3.5" />
              Reset preferences
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/40 p-5 text-[10px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground/80">Export project files</p>
            <p className="mt-1">
              To move a document to another browser, open it and choose{" "}
              <span className="font-medium text-foreground/70">Project file → Export</span>. It
              includes the document and any original PDF pages as one portable file.
            </p>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Delete all local documents?"
        description={`This will permanently remove ${documents.length} document${documents.length === 1 ? "" : "s"} and every imported PDF from this browser. This cannot be undone.`}
        confirmLabel="Delete everything"
        destructive
        loading={clearing || loadingStorage}
        onConfirm={handleClear}
      />
      {loadingStorage && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/70 bg-card/90 px-3 py-1.5 text-[10px] text-muted-foreground shadow-lift backdrop-blur">
          <Loader2 className="size-3 animate-spin" />
          Measuring local storage
        </div>
      )}
    </div>
  );
}
