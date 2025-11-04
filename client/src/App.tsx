import { Suspense, lazy } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { DropdownProvider } from "@/contexts/dropdown-provider";
import { AuthProvider, useAuth } from "@/contexts/auth-provider";

const Home = lazy(() => import("@/pages/home"));
const History = lazy(() => import("@/pages/history"));
const AnalysisDetail = lazy(() => import("@/pages/analysis-detail"));
const Managers = lazy(() => import("@/pages/managers"));
const Login = lazy(() => import("@/pages/login"));
const NotFound = lazy(() => import("@/pages/not-found"));

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Проверка авторизации...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Загрузка...
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <Login />}
      </Route>
      <Route path="/">
        <ProtectedRoute component={Home} />
      </Route>
      <Route path="/history">
        <ProtectedRoute component={History} />
      </Route>
      <Route path="/history/:id">
        <ProtectedRoute component={AnalysisDetail} />
      </Route>
      <Route path="/managers">
        <ProtectedRoute component={Managers} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <DropdownProvider>
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
            </DropdownProvider>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
