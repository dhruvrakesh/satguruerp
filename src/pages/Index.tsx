import { StatCard } from "@/components/dashboard/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { useStockMetrics } from "@/hooks/useStockMetrics";
import { StockMovementChart } from "@/components/dashboard/StockMovementChart";
import { StockDistributionChart } from "@/components/dashboard/StockDistributionChart";
import { CategoryAnalysisChart } from "@/components/dashboard/CategoryAnalysisChart";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import { StockAlertsPanel } from "@/components/dashboard/StockAlertsPanel";
import { 
  Package, 
  AlertTriangle,
  Archive,
  Activity
} from "lucide-react";

const Index = () => {
  const { profile, isAdmin } = useAuth();
  const { data: metrics, isLoading: metricsLoading } = useStockMetrics();
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          {getGreeting()}, {profile?.full_name || 'User'}!
        </h1>
        <p className="text-muted-foreground">
          Welcome to Satguru Engravures ERP - Your complete manufacturing management solution for packaging and printing operations.
          {isAdmin() && ' You have administrator privileges.'}
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Active Items"
          value={metricsLoading ? "..." : metrics?.totalItems?.toLocaleString() || "0"}
          icon={Package}
          description="Items in inventory catalog"
        />
        <StatCard
          title="Low Stock Alerts"
          value={metricsLoading ? "..." : metrics?.lowStockItems?.toString() || "0"}
          icon={AlertTriangle}
          description="Items below threshold"
        />
        <StatCard
          title="Total Stock Quantity"
          value={metricsLoading ? "..." : metrics?.totalStockQty?.toLocaleString() || "0"}
          icon={Archive}
          description="Units in stock"
        />
        <StatCard
          title="Recent Transactions"
          value={metricsLoading ? "..." : ((metrics?.recentGrnCount || 0) + (metrics?.recentIssueCount || 0)).toString() || "0"}
          icon={Activity}
          description="GRN + Issues (7 days)"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StockMovementChart />
        <StockDistributionChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryAnalysisChart />
        <StockAlertsPanel />
      </div>

      {/* Recent Activity */}
      <RecentActivityFeed />
    </div>
  );
};

export default Index;