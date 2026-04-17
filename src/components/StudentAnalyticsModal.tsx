import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  TrendingUp,
  BookOpen,
  Award,
  Zap,
  AlertCircle,
  CheckCircle,
  Target,
  Calendar,
} from "lucide-react";
import { apiClient } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";

interface StudentAnalyticsResponse {
  student_id: string;
  average_ia: number;
  performance_level: string;
  performance_score: number;
  weak_topics: string[];
  moderate_topics: string[];
  strong_topics: string[];
  topics_study_info: {
    topic_name: string;
    performance_level: string;
    estimated_hours: number;
    priority: number;
  }[];
  overall_score: number;
  total_study_hours_needed: number;
  attendance_percentage: number;
  five_day_study_plan: {
    day: number;
    topics: string[];
    daily_hours: number;
    focus_areas: string[];
  }[];
  key_recommendations: string[];
  next_milestones: string[];
}

interface StudentAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
}

export default function StudentAnalyticsModal({
  isOpen,
  onClose,
  studentId,
  studentName,
}: StudentAnalyticsModalProps) {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<StudentAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch analytics when modal opens
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAnalytics(null);
    const url = `/student-analytics/${studentId}/quick`;
    console.log(`📡 Fetching from URL: ${url}`);
    try {
      const { data, error } = await apiClient.get(url);
      
      console.log(`📡 API Response:`, {
        url: url,
        hasData: !!data,
        hasError: !!error,
        dataType: typeof data,
        dataKeys: data ? Object.keys(data).slice(0, 5) : 'N/A',
        error: error
      });
      
      if (error) {
        console.error("Analytics API error:", error);
        throw new Error(error?.message || error || "Failed to load analytics");
      }
      if (!data) {
        throw new Error("No analytics data received from server");
      }
      
      // Validate required fields
      const requiredFields = ['student_id', 'average_ia', 'performance_level', 'weak_topics'];
      const missingFields = requiredFields.filter(f => !(f in data));
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      console.log("✅ Analytics data loaded:", {
        student_id: data.student_id,
        performance_level: data.performance_level,
        average_ia: data.average_ia,
        topics_study_info: data.topics_study_info,
        weak_topics: data.weak_topics,
        five_day_study_plan: data.five_day_study_plan
      });
      setAnalytics(data);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("❌ Analytics error:", errorMessage);
      const errorMsg = errorMessage || "Failed to load analytics. Please try again.";
      setError(errorMsg);
      toast({
        title: "Error loading analytics",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [studentId, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchAnalytics();
    }
  }, [isOpen, fetchAnalytics]);

  const handleOpenChange = (open: boolean) => {
    console.log(`🎯 StudentAnalyticsModal openChange:`, {
      isOpen: open,
      studentId: studentId,
      studentName: studentName
    });
    if (!open) {
      onClose();
    }
    // When opening, useEffect will trigger the fetch
  };

  const getPerformanceBadgeColor = (level: string) => {
    switch (level) {
      case "Poor":
        return "bg-red-100 text-red-800";
      case "Average":
        return "bg-yellow-100 text-yellow-800";
      case "Good":
        return "bg-blue-100 text-blue-800";
      case "Excellent":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTopicColor = (level: string) => {
    switch (level) {
      case "Weak":
        return "bg-red-50 border-red-200";
      case "Moderate":
        return "bg-yellow-50 border-yellow-200";
      case "Strong":
        return "bg-green-50 border-green-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Student Analytics Report: {studentName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        ) : error ? (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <p className="font-semibold mb-2">Could not load analytics</p>
              <p className="text-sm">{error}</p>
              <p className="text-xs mt-2">Make sure the student has performance data entered by their teacher.</p>
            </AlertDescription>
          </Alert>
        ) : !analytics ? (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              No analytics data available. Performance data may not be fully initialized.
            </AlertDescription>
          </Alert>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="topics">Topics</TabsTrigger>
              <TabsTrigger value="plan">5-Day Plan</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            </TabsList>

            {/* ─── OVERVIEW TAB ─── */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Performance Level */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Performance Level
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Badge className={getPerformanceBadgeColor(analytics.performance_level)}>
                        {analytics.performance_level}
                      </Badge>
                      <p className="text-2xl font-bold">{analytics.performance_score.toFixed(1)}/100</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Overall Score */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Overall Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${analytics.overall_score}%` }}
                        />
                      </div>
                      <p className="text-2xl font-bold">{analytics.overall_score.toFixed(1)}/100</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Average IA */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Average IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{analytics.average_ia.toFixed(1)}/20</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Calculated from IA1 + IA2
                    </p>
                  </CardContent>
                </Card>

                {/* Study Hours */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Study Hours Needed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{analytics.total_study_hours_needed.toFixed(1)}h</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Total recommended study time
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Attendance Alert */}
              {analytics.attendance_percentage < 75 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    Attendance is {analytics.attendance_percentage}%. Improve it to 85%+ for better learning outcomes.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* ─── TOPICS TAB ─── */}
            <TabsContent value="topics" className="space-y-4">
              {analytics.topics_study_info && analytics.topics_study_info.length > 0 ? (
                <div className="space-y-3">
                  {analytics.topics_study_info.map((info, idx) => {
                    const levelColor = info.performance_level === "Weak" ? "bg-red-50 border-red-200" :
                                       info.performance_level === "Moderate" ? "bg-yellow-50 border-yellow-200" :
                                       "bg-green-50 border-green-200";
                    const priorityLabel = info.priority === 1 ? "🔴 High" : 
                                         info.priority === 2 ? "🟡 Medium" : 
                                         "🟢 Low";
                    
                    return (
                      <Card key={idx} className={`border ${levelColor}`}>
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold text-base">{info.topic_name}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs text-muted-foreground">Performance Level</p>
                                <Badge className={
                                  info.performance_level === "Weak" ? "bg-red-100 text-red-800" :
                                  info.performance_level === "Moderate" ? "bg-yellow-100 text-yellow-800" :
                                  "bg-green-100 text-green-800"
                                }>
                                  {info.performance_level}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Study Hours</p>
                                <p className="font-semibold text-sm">{info.estimated_hours.toFixed(1)}h</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Priority</p>
                              <Badge variant="outline">{priorityLabel}</Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No topic information available.</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* ─── 5-DAY PLAN TAB ─── */}
            <TabsContent value="plan" className="space-y-4">
              <Alert>
                <Target className="h-4 w-4" />
                <AlertDescription>
                  Auto-generated study plan distributed across 5 days with balanced daily workload.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                {analytics.five_day_study_plan.map((day) => (
                  <Card key={day.day}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>Day {day.day}</span>
                        <Badge variant="outline">{day.daily_hours.toFixed(1)} hours</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-2">
                          Topics:
                        </p>
                        <ul className="space-y-1">
                          {day.topics.map((topic) => (
                            <li key={topic} className="text-sm">
                              • {topic}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-2">
                          Focus Areas:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {day.focus_areas.map((area) => (
                            <Badge key={area} variant="secondary">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* ─── RECOMMENDATIONS TAB ─── */}
            <TabsContent value="recommendations" className="space-y-4">
              {/* Key Recommendations */}
              {analytics.key_recommendations.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-600" />
                    Key Recommendations
                  </h4>
                  <div className="space-y-2">
                    {analytics.key_recommendations.map((rec, idx) => (
                      <div key={idx} className="flex gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0 text-blue-700 text-xs font-semibold">
                          {idx + 1}
                        </div>
                        <p className="text-sm">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Milestones */}
              {analytics.next_milestones.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-green-600" />
                    Next Milestones
                  </h4>
                  <div className="space-y-2">
                    {analytics.next_milestones.map((milestone, idx) => (
                      <div key={idx} className="flex gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0 text-green-700 text-xs font-semibold">
                          {idx + 1}
                        </div>
                        <p className="text-sm">{milestone}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
