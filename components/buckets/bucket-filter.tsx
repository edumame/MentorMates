"use client";

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EventBucket } from "@/lib/types";

interface BucketFilterProps {
  onBucketChange: (bucketId: string | null) => void;
  selectedBucketId?: string | null;
}

export function BucketFilter({ onBucketChange, selectedBucketId }: BucketFilterProps) {
  const [buckets, setBuckets] = useState<EventBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    fetchBuckets();
  }, []);

  const selectedBucket = buckets.find(b => b.bucket_id === selectedBucketId);

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
        <span className="text-sm text-gray-500">Loading buckets...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <label className="text-sm font-medium text-gray-700">Filter by bucket:</label>
      <div className="flex items-center gap-2">
        <Select value={selectedBucketId || "all"} onValueChange={(value) => onBucketChange(value === "all" ? null : value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select bucket">
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
                "All buckets"
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span>All buckets</span>
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
                  {bucket.event_count !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      {bucket.event_count}
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}