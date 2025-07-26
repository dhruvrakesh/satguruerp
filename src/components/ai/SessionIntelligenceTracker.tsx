import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  User, 
  Brain, 
  Target, 
  TrendingUp, 
  Clock, 
  Eye,
  CheckCircle,
  Settings,
  Bookmark,
  Star,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EnhancedCategoryIntelligenceService, ENHANCED_MATERIAL_CATEGORIES } from '@/services/enhancedCategoryIntelligence';

interface SessionIntelligenceTrackerProps {
  className?: string;
}

interface UserPreferences {
  preferredCategories: string[];
  insightTypes: string[];
  alertThresholds: {
    healthScore: number;
    criticalAlerts: number;
  };
  autoRefresh: boolean;
  notifications: boolean;
}

interface SessionActivity {
  id: string;
  timestamp: string;
  action: string;
  category?: string;
  insightId?: string;
  recommendation?: string;
  actionTaken?: boolean;
}

interface PersonalizedInsight {
  id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  recommendation: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  relevanceScore: number;
  isBookmarked: boolean;
  actionTaken: boolean;
  timestamp: string;
}

export function SessionIntelligenceTracker({ className }: SessionIntelligenceTrackerProps) {
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    preferredCategories: ['BOPP', 'INK'],
    insightTypes: ['performance', 'quality', 'optimization'],
    alertThresholds: {
      healthScore: 70,
      criticalAlerts: 3
    },
    autoRefresh: true,
    notifications: true
  });

  const [sessionActivity, setSessionActivity] = useState<SessionActivity[]>([]);
  const [personalizedInsights, setPersonalizedInsights] = useState<PersonalizedInsight[]>([]);
  const [learningProgress, setLearningProgress] = useState({
    actionsTracked: 42,
    recommendationsFollowed: 28,
    accuracyScore: 85,
    sessionDuration: '2h 15m'
  });

  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load user session data
  const loadSessionData = async () => {
    setIsLoading(true);
    try {
      // Simulate loading user session data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate sample personalized insights
      const sampleInsights: PersonalizedInsight[] = [
        {
          id: '1',
          type: 'optimization',
          category: 'BOPP',
          title: 'BOPP Film Quality Optimization',
          message: 'Based on your recent actions, BOPP films are showing 15% improvement in clarity metrics',
          recommendation: 'Continue current process parameters and consider extending to other product lines',
          priority: 'HIGH',
          relevanceScore: 92,
          isBookmarked: false,
          actionTaken: false,
          timestamp: new Date().toISOString()
        },
        {
          id: '2',
          type: 'performance',
          category: 'INK',
          title: 'Ink Viscosity Pattern Recognition',
          message: 'Your preferred ink categories show consistent viscosity patterns that correlate with print quality',
          recommendation: 'Implement automated viscosity monitoring for these specific ink types',
          priority: 'MEDIUM',
          relevanceScore: 78,
          isBookmarked: true,
          actionTaken: true,
          timestamp: new Date(Date.now() - 3600000).toISOString()
        }
      ];

      setPersonalizedInsights(sampleInsights);
      
      // Generate sample session activity
      const sampleActivity: SessionActivity[] = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          action: 'viewed_insight',
          category: 'BOPP',
          insightId: '1'
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          action: 'bookmark_insight',
          category: 'INK',
          insightId: '2'
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          action: 'followed_recommendation',
          category: 'BOPP',
          recommendation: 'Implement quality control measures'
        }
      ];

      setSessionActivity(sampleActivity);
      
    } catch (error) {
      console.error('Failed to load session data:', error);
      toast({
        title: "Error",
        description: "Failed to load session intelligence data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessionData();
  }, []);

  // Update user preferences
  const updatePreferences = async (newPreferences: Partial<UserPreferences>) => {
    setUserPreferences(prev => ({ ...prev, ...newPreferences }));
    
    // Track preference changes
    const activity: SessionActivity = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      action: 'updated_preferences'
    };
    setSessionActivity(prev => [activity, ...prev]);
    
    toast({
      title: "Preferences Updated",
      description: "Your intelligence preferences have been saved",
    });
  };

  // Toggle category preference
  const toggleCategoryPreference = (category: string) => {
    const newCategories = userPreferences.preferredCategories.includes(category)
      ? userPreferences.preferredCategories.filter(c => c !== category)
      : [...userPreferences.preferredCategories, category];
    
    updatePreferences({ preferredCategories: newCategories });
  };

  // Bookmark insight
  const toggleBookmark = (insightId: string) => {
    setPersonalizedInsights(prev => 
      prev.map(insight => 
        insight.id === insightId 
          ? { ...insight, isBookmarked: !insight.isBookmarked }
          : insight
      )
    );

    // Track bookmark action
    const activity: SessionActivity = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      action: 'bookmark_insight',
      insightId
    };
    setSessionActivity(prev => [activity, ...prev]);
  };

  // Mark action as taken
  const markActionTaken = (insightId: string) => {
    setPersonalizedInsights(prev => 
      prev.map(insight => 
        insight.id === insightId 
          ? { ...insight, actionTaken: true }
          : insight
      )
    );

    // Track action
    const activity: SessionActivity = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      action: 'followed_recommendation',
      insightId
    };
    setSessionActivity(prev => [activity, ...prev]);

    toast({
      title: "Action Recorded",
      description: "Your action has been tracked for learning purposes",
    });
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-500 text-white';
      case 'MEDIUM': return 'bg-yellow-500 text-black';
      case 'LOW': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  // Get action icon
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'viewed_insight': return <Eye className="h-4 w-4" />;
      case 'bookmark_insight': return <Bookmark className="h-4 w-4" />;
      case 'followed_recommendation': return <CheckCircle className="h-4 w-4" />;
      case 'updated_preferences': return <Settings className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className={className}>
      <Tabs defaultValue="personalized" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="personalized">Personalized Insights</TabsTrigger>
          <TabsTrigger value="learning">Learning Analytics</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="activity">Session Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="personalized" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Personalized Intelligence
              </CardTitle>
              <CardDescription>
                AI-generated insights tailored to your preferences and behavior
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {personalizedInsights.map((insight) => (
                    <Card key={insight.id} className="border-l-4 border-l-primary">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge className={getPriorityColor(insight.priority)}>
                                {insight.priority}
                              </Badge>
                              <Badge variant="outline">{insight.category}</Badge>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Target className="h-3 w-3" />
                                {insight.relevanceScore}% relevance
                              </div>
                            </div>
                            <h4 className="font-semibold">{insight.title}</h4>
                            <p className="text-sm text-muted-foreground">{insight.message}</p>
                            <div className="bg-muted p-3 rounded-md">
                              <p className="text-sm font-medium">💡 Personalized Recommendation:</p>
                              <p className="text-sm">{insight.recommendation}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleBookmark(insight.id)}
                              >
                                <Bookmark className={`h-4 w-4 mr-1 ${insight.isBookmarked ? 'fill-current' : ''}`} />
                                {insight.isBookmarked ? 'Bookmarked' : 'Bookmark'}
                              </Button>
                              <Button
                                size="sm"
                                variant={insight.actionTaken ? "secondary" : "default"}
                                onClick={() => markActionTaken(insight.id)}
                                disabled={insight.actionTaken}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                {insight.actionTaken ? 'Action Taken' : 'Mark as Done'}
                              </Button>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                            {new Date(insight.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learning" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Actions Tracked</p>
                    <p className="text-2xl font-bold">{learningProgress.actionsTracked}</p>
                  </div>
                  <Activity className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Recommendations Followed</p>
                    <p className="text-2xl font-bold">{learningProgress.recommendationsFollowed}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Accuracy Score</p>
                    <p className="text-2xl font-bold">{learningProgress.accuracyScore}%</p>
                  </div>
                  <Target className="h-8 w-8 text-muted-foreground" />
                </div>
                <Progress value={learningProgress.accuracyScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Session Duration</p>
                    <p className="text-2xl font-bold">{learningProgress.sessionDuration}</p>
                  </div>
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Learning Analytics</CardTitle>
              <CardDescription>
                How the AI is learning from your interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Category Engagement</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    {Object.entries(ENHANCED_MATERIAL_CATEGORIES).map(([code, info]) => {
                      const isPreferred = userPreferences.preferredCategories.includes(code);
                      const engagementScore = Math.floor(Math.random() * 100);
                      
                      return (
                        <div key={code} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${isPreferred ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span className="font-medium">{code}</span>
                            <span className="text-sm text-muted-foreground">{info.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={engagementScore} className="w-20" />
                            <span className="text-sm w-8">{engagementScore}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Recommendation Success Rate</h4>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">78%</div>
                      <div className="text-sm text-muted-foreground">Quality Improvements</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">65%</div>
                      <div className="text-sm text-muted-foreground">Process Optimizations</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">82%</div>
                      <div className="text-sm text-muted-foreground">Alert Accuracy</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Intelligence Preferences
              </CardTitle>
              <CardDescription>
                Customize your AI intelligence experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-3">Preferred Material Categories</h4>
                <div className="grid gap-2 md:grid-cols-2">
                  {Object.entries(ENHANCED_MATERIAL_CATEGORIES).map(([code, info]) => (
                    <div key={code} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{code}</div>
                        <div className="text-sm text-muted-foreground">{info.name}</div>
                      </div>
                      <Switch
                        checked={userPreferences.preferredCategories.includes(code)}
                        onCheckedChange={() => toggleCategoryPreference(code)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Alert Thresholds</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Health Score Alert Threshold</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="50"
                        max="90"
                        value={userPreferences.alertThresholds.healthScore}
                        onChange={(e) => updatePreferences({
                          alertThresholds: {
                            ...userPreferences.alertThresholds,
                            healthScore: parseInt(e.target.value)
                          }
                        })}
                        className="flex-1"
                      />
                      <span className="text-sm w-8">{userPreferences.alertThresholds.healthScore}%</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Critical Alerts Threshold</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={userPreferences.alertThresholds.criticalAlerts}
                        onChange={(e) => updatePreferences({
                          alertThresholds: {
                            ...userPreferences.alertThresholds,
                            criticalAlerts: parseInt(e.target.value)
                          }
                        })}
                        className="flex-1"
                      />
                      <span className="text-sm w-8">{userPreferences.alertThresholds.criticalAlerts}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">General Settings</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Auto Refresh</div>
                      <div className="text-sm text-muted-foreground">Automatically refresh intelligence data</div>
                    </div>
                    <Switch
                      checked={userPreferences.autoRefresh}
                      onCheckedChange={(checked) => updatePreferences({ autoRefresh: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Push Notifications</div>
                      <div className="text-sm text-muted-foreground">Receive alerts for critical insights</div>
                    </div>
                    <Switch
                      checked={userPreferences.notifications}
                      onCheckedChange={(checked) => updatePreferences({ notifications: checked })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Session Activity Timeline
              </CardTitle>
              <CardDescription>
                Track your interactions with the intelligence system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {sessionActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-shrink-0">
                        {getActionIcon(activity.action)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">
                            {activity.action.replace('_', ' ')}
                          </span>
                          {activity.category && (
                            <Badge variant="outline">{activity.category}</Badge>
                          )}
                        </div>
                        {activity.recommendation && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {activity.recommendation}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}