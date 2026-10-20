"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EventBucket, EventRole } from "@/lib/types";
import { Folder, Save } from "lucide-react";

interface EventBucketAssignmentProps {
  eventId: string;
  currentBucketId?: string | null;
  userRole?: EventRole;
  onAssignmentChange?: (bucketId: string | null) => void;
}

export function EventBucketAssignment({ 
  eventId, 
  currentBucketId, 
  userRole,
  onAssignmentChange 
}: EventBucketAssignmentProps) {
  const [buckets, setBuckets] = useState<EventBucket[]>([]);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(currentBucketId || null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canAssignBucket = userRole === EventRole.Admin || userRole === EventRole.Organizer;

  useEffect(() => {
    fetchBuckets();
  }, []);

  useEffect(() => {
    setSelectedBucketId(currentBucketId || null);
  }, [currentBucketId]);

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

  async function saveBucketAssignment() {
    setSaving(true);
    try {
      const response = await fetch(`/api/events/${eventId}/bucket`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket_id: selectedBucketId }),
      });

      if (response.ok) {
        onAssignmentChange?.(selectedBucketId);
        alert(selectedBucketId ? "Event assigned to bucket successfully" : "Event removed from bucket successfully");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update bucket assignment");
      }
    } catch (error) {
      console.error("Error updating bucket assignment:", error);
      alert("Failed to update bucket assignment");
    } finally {
      setSaving(false);
    }
  }

  const currentBucket = buckets.find(b => b.bucket_id === currentBucketId);
  const selectedBucket = buckets.find(b => b.bucket_id === selectedBucketId);
  const hasChanges = selectedBucketId !== currentBucketId;

  if (!canAssignBucket) {
    return currentBucket ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Event Bucket
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {currentBucket.bucket_icon && (
              <span className="text-lg">{currentBucket.bucket_icon}</span>
            )}
            <div 
              className="w-4 h-4 rounded-full" 
              style={{ backgroundColor: currentBucket.bucket_color }}
            />
            <span className="font-medium">{currentBucket.bucket_name}</span>
          </div>
          {currentBucket.bucket_description && (
            <p className="text-sm text-gray-600 mt-2">{currentBucket.bucket_description}</p>
          )}
        </CardContent>
      </Card>
    ) : null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Event Bucket
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="text-sm text-gray-500">Loading buckets...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Folder className="w-5 h-5" />
          Event Bucket
        </CardTitle>
        <CardDescription>
          Assign this event to a bucket for better organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="bucket-select">Select Bucket</Label>
          <Select 
            value={selectedBucketId || "none"} 
            onValueChange={(value) => setSelectedBucketId(value === "none" ? null : value)}
          >
            <SelectTrigger id="bucket-select">
              <SelectValue placeholder="Choose a bucket">
                {selectedBucket ? (
                  <div className="flex items-center gap-2">
                    {selectedBucket.bucket_icon && (
                      <span className="text-sm">{selectedBucket.bucket_icon}</span>
                    )}
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: selectedBucket.bucket_color }}
                    />
                    <span>{selectedBucket.bucket_name}</span>
                  </div>
                ) : (
                  "No bucket assigned"
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <span>No bucket</span>
                </div>
              </SelectItem>
              {buckets.map((bucket) => (
                <SelectItem key={bucket.bucket_id} value={bucket.bucket_id}>
                  <div className="flex items-center gap-2">
                    {bucket.bucket_icon && (
                      <span className="text-sm">{bucket.bucket_icon}</span>
                    )}
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: bucket.bucket_color }}
                    />
                    <span>{bucket.bucket_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasChanges && (
          <Button 
            onClick={saveBucketAssignment} 
            disabled={saving}
            className="w-full"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Assignment"}
          </Button>
        )}

        {currentBucket && !hasChanges && (
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              Currently assigned to: <span className="font-medium">{currentBucket.bucket_name}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}