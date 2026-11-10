import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { CommandPalette } from "@/components/common/CommandPalette";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CreateDocumentDialog } from "@/components/pdf/CreateDocumentDialog";
import { ImportPdfDialog } from "@/components/pdf/ImportPdfDialog";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardPage } from "@/pages/DashboardPage";
import { TemplatesPage } from "@/pages/TemplatesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ToolsPage } from "@/pages/ToolsPage";
import { EditorPage } from "@/pages/EditorPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import {
  applyTheme,
  usePreferencesStore,
} from "@/store/preferencesStore";

function StudioEffects() {
  const theme = usePreferencesStore((state) => state.theme);
  const reduceMotion = usePreferencesStore((state) => state.reduceMotion);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system" || typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={260} skipDelayDuration={120}>
        <StudioEffects />
        <Routes>
          <Route path="/editor/:id" element={<EditorPage />} />
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        <CreateDocumentDialog />
        <ImportPdfDialog />
        <CommandPalette />
        <Toaster
          position="bottom-right"
          closeButton
          toastOptions={{
            className:
              "!rounded-xl !border-border !bg-card !text-card-foreground !shadow-lift",
            style: {
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "12px",
            },
          }}
        />
      </TooltipProvider>
    </ErrorBoundary>
  );
}
