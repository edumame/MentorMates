"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EventBucket, EventVisibility, BucketPermission } from "@/lib/types";
import { Trash2, Edit, Users, Plus, Folder } from "lucide-react";

interface BucketManagementProps {
  userRole?: string;
}

export function BucketManagement({ userRole }: BucketManagementProps) {
  const [buckets, setBuckets] = useState<EventBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<EventBucket | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    bucket_name: "",
    bucket_description: "",
    bucket_slug: "",
    bucket_color: "#3B82F6",
    bucket_icon: "",
    visibility: "private" as EventVisibility,
  });

  const canManageBuckets = userRole === "admin" || userRole === "organizer";

  useEffect(() => {
    fetchBuckets();
  }, []);

  async function fetchBuckets() {
    try {
      const response = await fetch("/api/buckets");
      if (response.ok) {
        const data = await response.json();
        setBuckets(data.buckets || []);
      }
    } catch (error) {
      console.error("Error fetching buckets:", error);
    } finally {
      setLoading(false);
    }
  }

  async function createBucket() {
    try {
      const response = await fetch("/api/buckets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchBuckets();
        setIsCreateDialogOpen(false);
        resetForm();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create bucket");
      }
    } catch (error) {
      console.error("Error creating bucket:", error);
      alert("Failed to create bucket");
    }
  }

  async function updateBucket() {
    if (!selectedBucket) return;

    try {
      const response = await fetch(`/api/buckets/${selectedBucket.bucket_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchBuckets();
        setIsEditDialogOpen(false);
        setSelectedBucket(null);
        resetForm();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update bucket");
      }
    } catch (error) {
      console.error("Error updating bucket:", error);
      alert("Failed to update bucket");
    }
  }

  async function deleteBucket(bucketId: string) {
    if (!confirm("Are you sure you want to delete this bucket? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/buckets/${bucketId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchBuckets();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete bucket");
      }
    } catch (error) {
      console.error("Error deleting bucket:", error);
      alert("Failed to delete bucket");
    }
  }

  function resetForm() {
    setFormData({
      bucket_name: "",
      bucket_description: "",
      bucket_slug: "",
      bucket_color: "#3B82F6",
      bucket_icon: "",
      visibility: EventVisibility.Private,
    });
  }

  function openEditDialog(bucket: EventBucket) {
    setSelectedBucket(bucket);
    setFormData({
      bucket_name: bucket.bucket_name,
      bucket_description: bucket.bucket_description || "",
      bucket_slug: bucket.bucket_slug,
      bucket_color: bucket.bucket_color,
      bucket_icon: bucket.bucket_icon || "",
      visibility: bucket.visibility,
    });
    setIsEditDialogOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Loading buckets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Event Buckets</h2>
          <p className="text-gray-600">Organize events into buckets for better management</p>
        </div>
        {canManageBuckets && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Bucket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Bucket</DialogTitle>
                <DialogDescription>
                  Create a new bucket to organize your events
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="bucket_name">Bucket Name</Label>
                  <Input
                    id="bucket_name"
                    value={formData.bucket_name}
                    onChange={(e) => setFormData({ ...formData, bucket_name: e.target.value })}
                    placeholder="Enter bucket name"
                  />
                </div>
                <div>
                  <Label htmlFor="bucket_slug">Bucket Slug</Label>
                  <Input
                    id="bucket_slug"
                    value={formData.bucket_slug}
                    onChange={(e) => setFormData({ ...formData, bucket_slug: e.target.value })}
                    placeholder="bucket-slug"
                  />
                </div>
                <div>
                  <Label htmlFor="bucket_description">Description</Label>
                  <Textarea
                    id="bucket_description"
                    value={formData.bucket_description}
                    onChange={(e) => setFormData({ ...formData, bucket_description: e.target.value })}
                    placeholder="Describe this bucket"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bucket_color">Color</Label>
                    <Input
                      id="bucket_color"
                      type="color"
                      value={formData.bucket_color}
                      onChange={(e) => setFormData({ ...formData, bucket_color: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bucket_icon">Icon (emoji)</Label>
                    <Input
                      id="bucket_icon"
                      value={formData.bucket_icon}
                      onChange={(e) => setFormData({ ...formData, bucket_icon: e.target.value })}
                      placeholder="📁"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="visibility">Visibility</Label>
                  <Select value={formData.visibility} onValueChange={(value) => setFormData({ ...formData, visibility: value as EventVisibility })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createBucket}>Create Bucket</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buckets.map((bucket) => (
          <Card key={bucket.bucket_id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {bucket.bucket_icon && (
                    <span className="text-lg">{bucket.bucket_icon}</span>
                  )}
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: bucket.bucket_color }}
                  />
                  <CardTitle className="text-lg">{bucket.bucket_name}</CardTitle>
                </div>
                {canManageBuckets && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(bucket)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteBucket(bucket.bucket_id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              {bucket.bucket_description && (
                <CardDescription>{bucket.bucket_description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {bucket.event_count || 0} events
                  </span>
                </div>
                <Badge 
                  variant={bucket.visibility === 'public' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {bucket.visibility}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bucket</DialogTitle>
            <DialogDescription>
              Update bucket information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_bucket_name">Bucket Name</Label>
              <Input
                id="edit_bucket_name"
                value={formData.bucket_name}
                onChange={(e) => setFormData({ ...formData, bucket_name: e.target.value })}
                placeholder="Enter bucket name"
              />
            </div>
            <div>
              <Label htmlFor="edit_bucket_description">Description</Label>
              <Textarea
                id="edit_bucket_description"
                value={formData.bucket_description}
                onChange={(e) => setFormData({ ...formData, bucket_description: e.target.value })}
                placeholder="Describe this bucket"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_bucket_color">Color</Label>
                <Input
                  id="edit_bucket_color"
                  type="color"
                  value={formData.bucket_color}
                  onChange={(e) => setFormData({ ...formData, bucket_color: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_bucket_icon">Icon (emoji)</Label>
                <Input
                  id="edit_bucket_icon"
                  value={formData.bucket_icon}
                  onChange={(e) => setFormData({ ...formData, bucket_icon: e.target.value })}
                  placeholder="📁"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit_visibility">Visibility</Label>
              <Select value={formData.visibility} onValueChange={(value) => setFormData({ ...formData, visibility: value as EventVisibility })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateBucket}>Update Bucket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}