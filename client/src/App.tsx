import { Suspense, lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";

const Home = lazy(() => import("@/pages/home"));
const History = lazy(() => import("@/pages/history"));
const AnalysisDetail = lazy(() => import("@/pages/analysis-detail"));
const Managers = lazy(() => import("@/pages/managers"));
const NotFound = lazy(() => import("@/pages/not-found"));

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/history" component={History} />
      <Route path="/history/:id" component={AnalysisDetail} />
      <Route path="/managers" component={Managers} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
                Загрузка интерфейса...
              </div>
            }
          >
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
