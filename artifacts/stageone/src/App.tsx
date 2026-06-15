import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { ErrorBoundary } from "@/components/error-boundary";
import { ProductTour } from "@/components/dashboard/product-tour";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "@/lib/auth-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { BusinessContextProvider } from "@/lib/business-context";
import { OSProvider } from "@/lib/os-context";
import { ProtectedRoute } from "@/lib/protected-route";
import { CopilotPanel } from "@/components/copilot/copilot-panel";
import { CopilotProvider } from "@/lib/copilot-context"
import { WorkspaceControllerProvider } from "@/lib/workspace-controller-context";
import { UpgradeModalProvider } from "@/lib/upgrade-modal-context";
import { UpgradeModal } from "@/components/upgrade-modal";
import { ThemeProvider } from "@/lib/theme-context";
import { LangProvider } from "@/lib/i18n";
import { Toaster } from "sonner";
import { ImpersonationProvider } from "@/lib/impersonation-context";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import DashboardPage from "@/pages/dashboard";
import ProjectPage from "@/pages/project";
import SettingsPage from "@/pages/settings";
import WebsiteGeneratorPage from "@/pages/website-generator";
import ChatbotGeneratorPage from "@/pages/chatbot-generator";
import AutomationBuilderPage from "@/pages/automation-builder";
import OrchestratorPage from "@/pages/orchestrator";
import AnalyticsPage from "@/pages/analytics";
import IntegrationsPage from "@/pages/integrations";
import AdminPage from "@/pages/admin";
import TemplatesMarketplacePage from "@/pages/templates-marketplace";
import DeploymentsPage from "@/pages/deployments";
import AiMemoryPage from "@/pages/ai-memory";
import DeveloperPage from "@/pages/developer";
import AgentStorePage from "@/pages/agent-store";
import AgentMonitorPage from "@/pages/agent-monitor";
import WebhooksPage from "@/pages/webhooks";
import ExecutionEnginePage from "@/pages/execution-engine";
import IntelligencePage from "@/pages/intelligence";
import EnterprisePage from "@/pages/enterprise";
import ShowcasePage from "@/pages/showcase";
import PublicProjectPage from "@/pages/public-project";
import OSHubPage from "@/pages/os-hub";
import PricingPage from "@/pages/pricing";
import AiBuilderPage from "@/pages/ai-builder";
import AboutMarcusPage from "@/pages/about-marcus";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AnimatedRoutes() {
  const [location] = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeInOut" }}
        style={{ minHeight: "100vh" }}
      >
        <Router />
      </motion.div>
    </AnimatePresence>
  )
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/showcase" component={ShowcasePage} />
      <Route path="/p/:token">
        {(params) => <PublicProjectPage token={params.token} />}
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      </Route>
      <Route path="/projects/:id">
        {(params) => (
          <ProtectedRoute><ProjectPage id={params.id} /></ProtectedRoute>
        )}
      </Route>
      <Route path="/settings">
        <ProtectedRoute><SettingsPage /></ProtectedRoute>
      </Route>
      <Route path="/website-generator">
        <ProtectedRoute><WebsiteGeneratorPage /></ProtectedRoute>
      </Route>
      <Route path="/chatbot-generator">
        <ProtectedRoute><ChatbotGeneratorPage /></ProtectedRoute>
      </Route>
      <Route path="/automation-builder">
        <ProtectedRoute><AutomationBuilderPage /></ProtectedRoute>
      </Route>
      <Route path="/orchestrator">
        <ProtectedRoute><OrchestratorPage /></ProtectedRoute>
      </Route>
      <Route path="/analytics">
        <ProtectedRoute><AnalyticsPage /></ProtectedRoute>
      </Route>
      <Route path="/integrations">
        <ProtectedRoute><IntegrationsPage /></ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute><AdminPage /></ProtectedRoute>
      </Route>
      <Route path="/templates">
        <ProtectedRoute><TemplatesMarketplacePage /></ProtectedRoute>
      </Route>
      <Route path="/deployments">
        <ProtectedRoute><DeploymentsPage /></ProtectedRoute>
      </Route>
      <Route path="/memory">
        <ProtectedRoute><AiMemoryPage /></ProtectedRoute>
      </Route>
      <Route path="/developer">
        <ProtectedRoute><DeveloperPage /></ProtectedRoute>
      </Route>
      <Route path="/agents">
        <ProtectedRoute><AgentStorePage /></ProtectedRoute>
      </Route>
      <Route path="/webhooks">
        <ProtectedRoute><WebhooksPage /></ProtectedRoute>
      </Route>
      <Route path="/agent-monitor">
        <ProtectedRoute><AgentMonitorPage /></ProtectedRoute>
      </Route>
      <Route path="/execution-engine">
        <ProtectedRoute><ExecutionEnginePage /></ProtectedRoute>
      </Route>
      <Route path="/intelligence">
        <ProtectedRoute><IntelligencePage /></ProtectedRoute>
      </Route>
      <Route path="/enterprise">
        <ProtectedRoute><EnterprisePage /></ProtectedRoute>
      </Route>
      <Route path="/os">
        <ProtectedRoute><OSHubPage /></ProtectedRoute>
      </Route>
      <Route path="/ai-builder">
        <ProtectedRoute><AiBuilderPage /></ProtectedRoute>
      </Route>
      <Route path="/about-marcus" component={AboutMarcusPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ImpersonationProvider>
              <BusinessContextProvider>
                <OSProvider>
                  <NotificationsProvider>
                    <CopilotProvider>
                      <WorkspaceControllerProvider>
                        <UpgradeModalProvider>
                          <ErrorBoundary>
                            <ImpersonationBanner />
                            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                              <AnimatedRoutes />
                              <CopilotPanel />
                              <ProductTour />
                            </WouterRouter>
                            <UpgradeModal />
                            <Toaster position="bottom-right" richColors theme="dark" />
                          </ErrorBoundary>
                        </UpgradeModalProvider>
                      </WorkspaceControllerProvider>
                    </CopilotProvider>
                  </NotificationsProvider>
                </OSProvider>
              </BusinessContextProvider>
            </ImpersonationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
