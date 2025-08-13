'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, MessageSquare, CheckCircle, XCircle } from 'lucide-react';

interface TestResult {
  success: boolean;
  message?: string;
  error?: string;
  result?: any;
  config?: any;
}

export default function TwilioTestComponent() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [testType, setTestType] = useState('welcome');
  const [userName, setUserName] = useState('Test User');
  const [isLoading, setIsLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [configStatus, setConfigStatus] = useState<TestResult | null>(null);

  // Check Twilio configuration
  const checkConfig = async () => {
    setConfigLoading(true);
    try {
      const response = await fetch('/api/twilio/test', {
        method: 'GET',
      });

      const data = await response.json();
      setConfigStatus(data);
    } catch (error) {
      setConfigStatus({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check config',
      });
    } finally {
      setConfigLoading(false);
    }
  };

  // Send test SMS
  const sendTestSMS = async () => {
    if (!phoneNumber.trim()) {
      setTestResult({
        success: false,
        error: 'Phone number is required',
      });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/twilio/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          testType,
          userName: userName.trim() || 'Test User',
        }),
      });

      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test SMS',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testTypes = [
    { value: 'welcome', label: 'Welcome Message' },
    { value: 'project_submission', label: 'Project Submission' },
    { value: 'feedback', label: 'Feedback Notification' },
    { value: 'team_invitation', label: 'Team Invitation' },
    { value: 'event_reminder', label: 'Event Reminder' },
  ];

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Twilio Integration Test
          </CardTitle>
          <CardDescription>
            Test the Twilio SMS integration by checking configuration and sending test messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration Check */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Configuration Status</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={checkConfig}
                disabled={configLoading}
              >
                {configLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Check Config'
                )}
              </Button>
            </div>

            {configStatus && (
              <Alert className={configStatus.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-start gap-2">
                  {configStatus.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <AlertDescription>
                      {configStatus.success ? (
                        <div>
                          <div className="font-medium text-green-800 mb-2">Configuration Status:</div>
                          <ul className="text-sm text-green-700 space-y-1">
                            <li>• Enabled: {configStatus.config?.isEnabled ? '✅' : '❌'}</li>
                            <li>• Account SID: {configStatus.config?.hasAccountSid ? '✅' : '❌'}</li>
                            <li>• Auth Token: {configStatus.config?.hasAuthToken ? '✅' : '❌'}</li>
                            <li>• Phone Number: {configStatus.config?.hasPhoneNumber ? '✅' : '❌'}</li>
                            <li>• Messaging Service: {configStatus.config?.hasMessagingServiceSid ? '✅' : '➖'}</li>
                          </ul>
                        </div>
                      ) : (
                        <div className="text-red-800">
                          <div className="font-medium mb-1">Configuration Error:</div>
                          {configStatus.error}
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}
          </div>

          {/* Test SMS Form */}
          <div className="space-y-4 pt-4 border-t">
            <Label className="text-base font-medium">Send Test SMS</Label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="+1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter phone number in E.164 format (e.g., +1234567890)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="testType">Message Type</Label>
                <Select value={testType} onValueChange={setTestType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select test type" />
                  </SelectTrigger>
                  <SelectContent>
                    {testTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {testType === 'welcome' && (
              <div className="space-y-2">
                <Label htmlFor="userName">User Name (for welcome message)</Label>
                <Input
                  id="userName"
                  type="text"
                  placeholder="Test User"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </div>
            )}

            <Button
              onClick={sendTestSMS}
              disabled={isLoading || !phoneNumber.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                'Send Test SMS'
              )}
            </Button>
          </div>

          {/* Test Results */}
          {testResult && (
            <Alert className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <AlertDescription>
                    {testResult.success ? (
                      <div className="text-green-800">
                        <div className="font-medium mb-2">✅ SMS Sent Successfully!</div>
                        {testResult.result?.sms && (
                          <div className="text-sm space-y-1">
                            <div>Message SID: {testResult.result.sms.messageSid}</div>
                            <div>Phone: {testResult.phoneNumber}</div>
                            <div>Type: {testResult.testType}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-red-800">
                        <div className="font-medium mb-1">❌ SMS Failed:</div>
                        {testResult.error || testResult.details}
                      </div>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>1. Get Twilio Credentials:</strong></p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Sign up at <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">twilio.com</a></li>
              <li>Get your Account SID and Auth Token from the Console</li>
              <li>Purchase a phone number for sending SMS</li>
            </ul>

            <p><strong>2. Configure Environment Variables:</strong></p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>TWILIO_ACCOUNT_SID=your_account_sid</li>
              <li>TWILIO_AUTH_TOKEN=your_auth_token</li>
              <li>TWILIO_PHONE_NUMBER=+1234567890</li>
            </ul>

            <p><strong>3. Run Database Migration:</strong></p>
            <code className="block bg-gray-100 p-2 rounded text-xs">
              npm run setup-db
            </code>

            <p><strong>4. Test the Integration:</strong></p>
            <p>Use this form to verify SMS sending works correctly.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}