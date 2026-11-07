import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Paperforge render error", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-7 text-center shadow-lift">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <h1 className="display-serif mt-4 text-2xl text-foreground">
            Something interrupted the forge.
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Your saved documents are still in this browser. Reload the studio to continue where
            you left off.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-muted/60 p-3 text-left text-[10px] leading-relaxed text-muted-foreground">
            {this.state.error.message}
          </pre>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" />
              Reload studio
            </Button>
            <Button variant="outline" onClick={() => window.location.assign("/")}>
              Go to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
