
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEnhancedCategoryMutations, type EnhancedCategory } from "@/hooks/useEnhancedCategories";
import { AlertCircle, Save, X } from "lucide-react";

// Constants for Select component values
const NO_PARENT_VALUE = "no_parent";

interface EnhancedCategoryFormProps {
  category?: EnhancedCategory;
  parentCategories: EnhancedCategory[];
  onClose: () => void;
  onSuccess: () => void;
}

export function EnhancedCategoryForm({ category, parentCategories, onClose, onSuccess }: EnhancedCategoryFormProps) {
  const { createCategory, updateCategory } = useEnhancedCategoryMutations();
  
  const [formData, setFormData] = useState({
    category_name: '',
    description: '',
    category_code: '',
    parent_category_id: NO_PARENT_VALUE,
    category_type: 'STANDARD' as 'STANDARD' | 'SYSTEM' | 'TEMPORARY',
    sort_order: 0,
    is_active: true
  });
  
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (category) {
      setFormData({
        category_name: category.category_name || '',
        description: category.description || '',
        category_code: category.category_code || '',
        parent_category_id: category.parent_category_id || NO_PARENT_VALUE,
        category_type: category.category_type || 'STANDARD',
        sort_order: category.sort_order || 0,
        is_active: category.is_active ?? true
      });
    }
  }, [category]);

  const validateForm = () => {
    const newErrors: string[] = [];
    
    if (!formData.category_name.trim()) {
      newErrors.push('Category name is required');
    }
    
    if (formData.category_name.length > 100) {
      newErrors.push('Category name must be less than 100 characters');
    }
    
    if (formData.category_code && formData.category_code.length > 20) {
      newErrors.push('Category code must be less than 20 characters');
    }
    
    if (formData.sort_order < 0) {
      newErrors.push('Sort order cannot be negative');
    }
    
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      // Convert form data for submission
      const submissionData = {
        ...formData,
        parent_category_id: formData.parent_category_id === NO_PARENT_VALUE ? null : formData.parent_category_id
      };

      if (category) {
        await updateCategory.mutateAsync({
          id: category.id,
          updates: submissionData
        });
      } else {
        await createCategory.mutateAsync(submissionData);
      }
      
      onSuccess();
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleParentCategoryChange = (value: string) => {
    setFormData(prev => ({ ...prev, parent_category_id: value }));
  };

  const availableParents = parentCategories.filter(p => 
    !category || p.id !== category.id
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {category ? 'Edit Category' : 'Create New Category'}
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {errors.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category_name">Category Name *</Label>
              <Input
                id="category_name"
                value={formData.category_name}
                onChange={(e) => setFormData(prev => ({ ...prev, category_name: e.target.value }))}
                placeholder="Enter category name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category_code">Category Code</Label>
              <Input
                id="category_code"
                value={formData.category_code}
                onChange={(e) => setFormData(prev => ({ ...prev, category_code: e.target.value }))}
                placeholder="Optional short code"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Category description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="parent_category">Parent Category</Label>
              <Select
                value={formData.parent_category_id}
                onValueChange={handleParentCategoryChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT_VALUE}>No Parent (Root Level)</SelectItem>
                  {availableParents.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category_type">Category Type</Label>
              <Select
                value={formData.category_type}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, category_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDARD">Standard</SelectItem>
                  <SelectItem value="SYSTEM">System</SelectItem>
                  <SelectItem value="TEMPORARY">Temporary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                placeholder="0"
                min={0}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_active" className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                Active Category
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[120px]"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Saving...' : category ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
