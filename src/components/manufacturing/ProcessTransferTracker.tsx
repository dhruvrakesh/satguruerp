
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowRightLeft, 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  Truck,
  Clock
} from "lucide-react";

interface ProcessTransfer {
  id?: string;
  uiorn: string;
  from_process: string;
  to_process: string;
  material_type: string;
  quantity_sent: number;
  quantity_received?: number;
  unit_of_measure: string;
  transfer_status: 'INITIATED' | 'IN_TRANSIT' | 'RECEIVED' | 'DISCREPANCY';
  sent_by?: string;
  received_by?: string;
  sent_at: string;
  received_at?: string;
  discrepancy_notes?: string;
  quality_notes?: string;
}

interface ProcessTransferTrackerProps {
  uiorn: string;
  currentProcess: string;
  availableProcesses: string[];
}

export function ProcessTransferTracker({ 
  uiorn, 
  currentProcess, 
  availableProcesses 
}: ProcessTransferTrackerProps) {
  const [transfers, setTransfers] = useState<ProcessTransfer[]>([]);
  const [pendingReceives, setPendingReceives] = useState<ProcessTransfer[]>([]);
  const [newTransfer, setNewTransfer] = useState<Partial<ProcessTransfer>>({
    uiorn,
    from_process: currentProcess,
    to_process: '',
    material_type: '',
    quantity_sent: 0,
    unit_of_measure: 'KG',
    transfer_status: 'INITIATED',
    sent_at: new Date().toISOString()
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (uiorn && currentProcess) {
      loadTransfers();
      loadPendingReceives();
    }
  }, [uiorn, currentProcess]);

  const loadTransfers = async () => {
    try {
      const { data, error } = await supabase
        .from('process_transfers')
        .select('*')
        .eq('uiorn', uiorn)
        .eq('from_process', currentProcess)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setTransfers(data || []);
    } catch (error) {
      console.error('Error loading transfers:', error);
    }
  };

  const loadPendingReceives = async () => {
    try {
      const { data, error } = await supabase
        .from('process_transfers')
        .select('*')
        .eq('uiorn', uiorn)
        .eq('to_process', currentProcess)
        .in('transfer_status', ['INITIATED', 'IN_TRANSIT'])
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setPendingReceives(data || []);
    } catch (error) {
      console.error('Error loading pending receives:', error);
    }
  };

  const updateTransfer = (field: keyof ProcessTransfer, value: any) => {
    setNewTransfer(prev => ({ ...prev, [field]: value }));
  };

  const sendMaterial = async () => {
    setIsLoading(true);
    try {
      const user = await supabase.auth.getUser();
      const transferData = {
        ...newTransfer,
        sent_by: user.data.user?.id,
        sent_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('process_transfers')
        .insert([transferData]);

      if (error) throw error;

      toast({
        title: "Material Sent",
        description: `${newTransfer.quantity_sent} ${newTransfer.unit_of_measure} of ${newTransfer.material_type} sent to ${newTransfer.to_process}.`
      });

      await loadTransfers();
      resetTransfer();

    } catch (error) {
      console.error('Error sending material:', error);
      toast({
        title: "Error",
        description: "Failed to send material. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const receiveMaterial = async (transferId: string, quantityReceived: number, qualityNotes?: string) => {
    try {
      const user = await supabase.auth.getUser();
      const transfer = pendingReceives.find(t => t.id === transferId);
      
      if (!transfer) return;

      const discrepancy = Math.abs(quantityReceived - transfer.quantity_sent) > 0.01;
      
      const { error } = await supabase
        .from('process_transfers')
        .update({
          quantity_received: quantityReceived,
          received_by: user.data.user?.id,
          received_at: new Date().toISOString(),
          transfer_status: discrepancy ? 'DISCREPANCY' : 'RECEIVED',
          quality_notes,
          discrepancy_notes: discrepancy ? 
            `Sent: ${transfer.quantity_sent}, Received: ${quantityReceived}` : null
        })
        .eq('id', transferId);

      if (error) throw error;

      toast({
        title: discrepancy ? "Material Received - Discrepancy" : "Material Received",
        description: discrepancy ? 
          "Material received with quantity discrepancy. Please review." :
          "Material successfully received and verified.",
        variant: discrepancy ? "destructive" : "default"
      });

      await loadPendingReceives();

    } catch (error) {
      console.error('Error receiving material:', error);
      toast({
        title: "Error",
        description: "Failed to receive material. Please try again.",
        variant: "destructive"
      });
    }
  };

  const resetTransfer = () => {
    setNewTransfer({
      uiorn,
      from_process: currentProcess,
      to_process: '',
      material_type: '',
      quantity_sent: 0,
      unit_of_measure: 'KG',
      transfer_status: 'INITIATED',
      sent_at: new Date().toISOString()
    });
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      'INITIATED': 'bg-blue-100 text-blue-800 border-blue-200',
      'IN_TRANSIT': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'RECEIVED': 'bg-green-100 text-green-800 border-green-200',
      'DISCREPANCY': 'bg-red-100 text-red-800 border-red-200'
    };
    return statusStyles[status as keyof typeof statusStyles] || statusStyles.INITIATED;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'INITIATED': return <Clock className="h-4 w-4" />;
      case 'IN_TRANSIT': return <Truck className="h-4 w-4" />;
      case 'RECEIVED': return <CheckCircle className="h-4 w-4" />;
      case 'DISCREPANCY': return <AlertTriangle className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Send Material */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Send Material to Next Process
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">To Process</label>
              <select
                className="w-full px-3 py-2 border rounded-md"
                value={newTransfer.to_process || ''}
                onChange={(e) => updateTransfer('to_process', e.target.value)}
              >
                <option value="">Select Process</option>
                {availableProcesses.filter(p => p !== currentProcess).map(process => (
                  <option key={process} value={process}>{process}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Material Type</label>
              <Input
                value={newTransfer.material_type || ''}
                onChange={(e) => updateTransfer('material_type', e.target.value)}
                placeholder="e.g., Printed Film"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Quantity</label>
              <Input
                type="number"
                value={newTransfer.quantity_sent || ''}
                onChange={(e) => updateTransfer('quantity_sent', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Unit</label>
              <select
                className="w-full px-3 py-2 border rounded-md"
                value={newTransfer.unit_of_measure || 'KG'}
                onChange={(e) => updateTransfer('unit_of_measure', e.target.value)}
              >
                <option value="KG">KG</option>
                <option value="METERS">METERS</option>
                <option value="ROLLS">ROLLS</option>
                <option value="SHEETS">SHEETS</option>
              </select>
            </div>
          </div>
          <Button 
            onClick={sendMaterial} 
            disabled={isLoading || !newTransfer.to_process || !newTransfer.material_type || !newTransfer.quantity_sent}
            className="w-full"
          >
            {isLoading ? 'Sending...' : 'Send Material'}
          </Button>
        </CardContent>
      </Card>

      {/* Pending Receives */}
      {pendingReceives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-500" />
              Pending Material Receipts ({pendingReceives.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingReceives.map((transfer) => (
                <PendingReceiveItem 
                  key={transfer.id} 
                  transfer={transfer} 
                  onReceive={receiveMaterial}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transfer History */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {transfers.map((transfer) => (
              <div key={transfer.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{transfer.material_type}</span>
                    <Badge className={getStatusBadge(transfer.transfer_status)}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(transfer.transfer_status)}
                        {transfer.transfer_status}
                      </div>
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    To: {transfer.to_process}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Sent:</span> {transfer.quantity_sent} {transfer.unit_of_measure}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Received:</span> {transfer.quantity_received || 'Pending'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sent At:</span> {new Date(transfer.sent_at).toLocaleString()}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Received At:</span> {transfer.received_at ? new Date(transfer.received_at).toLocaleString() : 'Pending'}
                  </div>
                </div>
                {transfer.discrepancy_notes && (
                  <div className="text-sm text-red-600 mt-2">
                    Discrepancy: {transfer.discrepancy_notes}
                  </div>
                )}
              </div>
            ))}
            {transfers.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No transfers recorded yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PendingReceiveItem({ 
  transfer, 
  onReceive 
}: { 
  transfer: ProcessTransfer; 
  onReceive: (id: string, quantity: number, notes?: string) => void;
}) {
  const [quantityReceived, setQuantityReceived] = useState(transfer.quantity_sent);
  const [qualityNotes, setQualityNotes] = useState('');

  return (
    <div className="p-4 border-2 border-orange-200 rounded-lg bg-orange-50">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-medium">{transfer.material_type}</h4>
          <p className="text-sm text-muted-foreground">
            From: {transfer.from_process} • Sent: {transfer.quantity_sent} {transfer.unit_of_measure}
          </p>
        </div>
        <Badge className="bg-orange-100 text-orange-800 border-orange-200">
          Pending Receipt
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium">Quantity Received</label>
          <Input
            type="number"
            value={quantityReceived}
            onChange={(e) => setQuantityReceived(parseFloat(e.target.value) || 0)}
            placeholder="Actual quantity received"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Quality Notes</label>
          <Input
            value={qualityNotes}
            onChange={(e) => setQualityNotes(e.target.value)}
            placeholder="Quality observations..."
          />
        </div>
        <div className="flex items-end">
          <Button 
            onClick={() => onReceive(transfer.id!, quantityReceived, qualityNotes)}
            className="w-full"
          >
            Confirm Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
