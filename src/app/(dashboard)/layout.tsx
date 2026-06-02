import { Sidebar } from "@/components/layout/sidebar";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";

// Force dynamic rendering — sidebar uses useUser which needs ClerkProvider at runtime
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <ServiceWorkerRegistrar />
      <OfflineBanner />
      <Sidebar />
      <main className="md:pl-64 pt-14 md:pt-0 pb-20 md:pb-0 safe-pb safe-pl safe-pr">
        <div className="p-4 md:p-8 max-w-7xl mx-auto min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}
