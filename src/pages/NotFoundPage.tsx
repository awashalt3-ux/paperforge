import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-forge-600/10 text-forge-700 dark:text-forge-300">
          <Compass className="size-5" />
        </div>
        <p className="micro-label mt-5">404</p>
        <h1 className="display-serif mt-2 text-4xl">This page is still blank.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The page you were looking for doesn&apos;t exist. Your documents are safe on the
          dashboard.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">
            <ArrowLeft className="size-4" />
            Return to dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
