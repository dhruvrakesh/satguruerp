import { StatCard } from "@/components/dashboard/StatCard";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { ProductionOverview } from "@/components/dashboard/ProductionOverview";
import { 
  Package, 
  Users, 
  TrendingUp, 
  DollarSign,
  Factory,
  Truck,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

const Index = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome to Satguru Engravures ERP
        </h1>
        <p className="text-muted-foreground">
          Your complete manufacturing management solution for packaging and printing operations.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Orders"
          value="148"
          change={{ value: "+12%", trend: "up" }}
          icon={Package}
          description="Active orders in system"
        />
        <StatCard
          title="Revenue (₹)"
          value="₹8,45,000"
          change={{ value: "+8.2%", trend: "up" }}
          icon={DollarSign}
          description="This month's revenue"
        />
        <StatCard
          title="Active Customers"
          value="89"
          change={{ value: "+5", trend: "up" }}
          icon={Users}
          description="Engaged customers"
        />
        <StatCard
          title="Production Units"
          value="4,250"
          change={{ value: "+15%", trend: "up" }}
          icon={Factory}
          description="Units completed today"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pending Deliveries"
          value="23"
          icon={Truck}
          description="Orders ready for dispatch"
        />
        <StatCard
          title="Quality Issues"
          value="2"
          icon={AlertTriangle}
          description="Items needing attention"
        />
        <StatCard
          title="Completed Today"
          value="12"
          icon={CheckCircle}
          description="Orders finished today"
        />
        <StatCard
          title="Efficiency"
          value="94.5%"
          change={{ value: "+2.1%", trend: "up" }}
          icon={TrendingUp}
          description="Overall production efficiency"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentOrders />
        <ProductionOverview />
      </div>
    </div>
  );
};

export default Index;