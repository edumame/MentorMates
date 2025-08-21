"use client";

import { JobPosting } from "@/lib/types/careers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, DollarSign, Calendar, Mail } from "lucide-react";
import { motion } from "framer-motion";

interface JobCardProps {
  job: JobPosting;
  onApply?: (job: JobPosting) => void;
}

export function JobCard({ job, onApply }: JobCardProps) {
  const formatSalary = (salary: JobPosting['salary']) => {
    if (!salary) return null;
    
    const { min, max, currency, period } = salary;
    const formatAmount = (amount: number) => {
      if (period === 'per-episode') return amount.toString();
      return new Intl.NumberFormat().format(amount);
    };
    
    const periodText = period === 'per-episode' ? 'per episode' : period;
    
    if (min && max && min !== max) {
      return `${currency} ${formatAmount(min)} - ${formatAmount(max)} ${periodText}`;
    }
    return `${currency} ${formatAmount(min || max)} ${periodText}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleApply = () => {
    if (job.contactEmail) {
      const subject = encodeURIComponent(`Application for ${job.title} Position`);
      const body = encodeURIComponent(`Hello,

I am interested in applying for the ${job.title} position at MentorMates. Please find my application details below.

Best regards,`);
      
      window.open(`mailto:${job.contactEmail}?subject=${subject}&body=${body}`, '_blank');
    } else if (onApply) {
      onApply(job);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="h-full hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-blue-600">
        <CardHeader>
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <CardTitle className="text-xl font-bold text-gray-900 mb-2">
                {job.title}
              </CardTitle>
              <CardDescription className="text-gray-600 mb-3">
                {job.department}
              </CardDescription>
            </div>
            <Badge 
              variant={job.isActive ? "default" : "secondary"}
              className={job.isActive ? "bg-green-100 text-green-800" : ""}
            >
              {job.isActive ? "Open" : "Closed"}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {job.type}
            </Badge>
            {job.remote && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Remote Friendly
              </Badge>
            )}
            {job.salary && (
              <Badge variant="outline" className="flex items-center gap-1 text-green-700 border-green-200">
                <DollarSign className="h-3 w-3" />
                {formatSalary(job.salary)}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-700 leading-relaxed line-clamp-3">
              {job.description}
            </p>

            {job.requirements.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Key Requirements:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {job.requirements.slice(0, 3).map((req, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                  {job.requirements.length > 3 && (
                    <li className="text-blue-600 font-medium">
                      +{job.requirements.length - 3} more requirements
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Posted {formatDate(job.postedDate)}
                </span>
                {job.applicationDeadline && (
                  <span className="flex items-center gap-1 text-orange-600">
                    <Clock className="h-4 w-4" />
                    Apply by {formatDate(job.applicationDeadline)}
                  </span>
                )}
              </div>
              
              <Button 
                onClick={handleApply}
                disabled={!job.isActive}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {job.contactEmail ? (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Apply Now
                  </>
                ) : (
                  "Apply Now"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}