import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEnhancedCategoryMutations, type EnhancedCategory } from "@/hooks/useEnhancedCategories";
import { 
  Trash2, Power, PowerOff, CheckSquare, 
  AlertTriangle, Loader2, RefreshCw 
} from "lucide-react";

interface BulkOperationsPanelProps {
  categories: EnhancedCategory[];
  selectedCategories: string[];
  onClearSelection: () => void;
  onRefresh: () => void;
}

type BulkAction = 'ACTIVATE' | 'DEACTIVATE' | 'DELETE';

export function BulkOperationsPanel({ 
  categories, 
  selectedCategories, 
  onClearSelection,
  onRefresh 
}: BulkOperationsPanelProps) {
  const { bulkUpdateCategories } = useEnhancedCategoryMutations();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastOperation, setLastOperation] = useState<{ action: string; result?: any } | null>(null);

  const selectedCategoryData = categories.filter(cat => selectedCategories.includes(cat.id));
  const hasSelection = selectedCategories.length > 0;

  const handleBulkAction = async (action: BulkAction) => {
    if (!hasSelection) return;

    setIsProcessing(true);
    setLastOperation({ action });

    try {
      const operations = selectedCategories.map(categoryId => ({
        id: categoryId,
        action: action
      }));

      const result = await bulkUpdateCategories.mutateAsync(operations);
      setLastOperation({ action, result });
      
      // Clear selection and refresh after successful operation
      if ((result as any).success > 0) {
        onClearSelection();
        onRefresh();
      }
    } catch (error) {
      console.error(`Bulk ${action} failed:`, error);
      setLastOperation({ action, result: { success: 0, failed: selectedCategories.length } });
    } finally {
      setIsProcessing(false);
    }
  };

  const getActionButtonConfig = (action: BulkAction) => {
    const configs = {
      ACTIVATE: {
        icon: Power,
        label: 'Activate',
        variant: 'default' as const,
        description: 'Make selected categories active and available for use'
      },
      DEACTIVATE: {
        icon: PowerOff,
        label: 'Deactivate',
        variant: 'secondary' as const,
        description: 'Disable selected categories (soft delete)'
      },
      DELETE: {
        icon: Trash2,
        label: 'Delete',
        variant: 'destructive' as const,
        description: 'Permanently remove selected categories (use with caution)'
      }
    };
    return configs[action];
  };

  const renderOperationResult = () => {
    if (!lastOperation?.result) return null;

    const { success, failed, errors } = lastOperation.result;
    const isSuccess = success > 0;
    const hasErrors = failed > 0;

    return (
      <Alert variant={hasErrors ? "destructive" : "default"}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p>
              <strong>Operation: {lastOperation.action}</strong>
            </p>
            {isSuccess && (
              <p className="text-green-600">
                ✅ Successfully processed {success} categories
              </p>
            )}
            {hasErrors && (
              <p className="text-red-600">
                ❌ Failed to process {failed} categories
              </p>
            )}
            {errors && errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium">
                  View Error Details ({errors.length})
                </summary>
                <div className="mt-2 space-y-1">
                  {errors.slice(0, 5).map((error: any, index: number) => (
                    <p key={index} className="text-xs text-muted-foreground">
                      • {error.error_message || 'Unknown error'}
                    </p>
                  ))}
                  {errors.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      ... and {errors.length - 5} more errors
                    </p>
                  )}
                </div>
              </details>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Bulk Operations
            {hasSelection && (
              <Badge variant="secondary">
                {selectedCategories.length} selected
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasSelection ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Select categories from the main table to perform bulk operations.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Selected Categories Summary */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Selected Categories:</h4>
                <div className="max-h-32 overflow-y-auto space-y-1 p-2 border rounded">
                  {selectedCategoryData.map(category => (
                    <div key={category.id} className="flex items-center justify-between text-sm">
                      <span>{category.category_name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={category.is_active ? "default" : "secondary"} className="text-xs">
                          {category.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <span className="text-muted-foreground">
                          {category.total_items} items
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bulk Action Buttons */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Available Actions:</h4>
                <div className="grid gap-2">
                  {(['ACTIVATE', 'DEACTIVATE', 'DELETE'] as BulkAction[]).map(action => {
                    const config = getActionButtonConfig(action);
                    const Icon = config.icon;
                    
                    return (
                      <div key={action} className="space-y-2">
                        <Button
                          variant={config.variant}
                          onClick={() => handleBulkAction(action)}
                          disabled={isProcessing}
                          className="w-full justify-start"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Icon className="w-4 h-4 mr-2" />
                          )}
                          {config.label} ({selectedCategories.length})
                        </Button>
                        <p className="text-xs text-muted-foreground px-2">
                          {config.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Operation Results */}
              {renderOperationResult()}

              {/* Warning for bulk operations */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Bulk operations affect multiple categories at once. 
                  Make sure you have selected the correct categories before proceeding.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}