
import { LegacyDataIntegration } from "@/components/stock-operations/LegacyDataIntegration";

export default function LegacyDataManagement() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Legacy Data Management</h1>
          <p className="text-muted-foreground">Safely integrate legacy opening stock data without breaking existing calculations</p>
        </div>
      </div>

      <LegacyDataIntegration />
    </div>
  );
}
