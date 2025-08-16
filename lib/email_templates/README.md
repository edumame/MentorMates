# Email Templates Configuration

This directory contains a comprehensive email template system that supports both legacy hardcoded templates and new configurable templates through server-side configuration.

## Architecture Overview

The email template system consists of several key components:

### Core Files

- **`config.ts`** - Defines template configuration interfaces and default settings
- **`renderer.ts`** - Template rendering engine with Handlebars-like syntax support
- **`service.ts`** - High-level service for generating emails with validation
- **`constants.ts`** - Email types, mappings, and configuration constants
- **`index.ts`** - Main export file providing clean API access

### Legacy Files (Backward Compatibility)

- **`project-submission.ts`** - Legacy project submission template
- **`project-teammate.ts`** - Legacy teammate notification template  
- **`feedback-notification.ts`** - Legacy feedback notification template
- **`event-notifications.ts`** - Legacy event notification templates

## Configuration System

### Environment Variables

Configure email templates through environment variables:

#### SMTP Configuration
```env
EMAIL_SERVICE=gmail                    # Email service provider
EMAIL_HOST=smtp.gmail.com             # SMTP host (if not using service)
EMAIL_PORT=587                        # SMTP port
EMAIL_SECURE=true                     # Use TLS/SSL
EMAIL_USER=your-email@gmail.com       # SMTP username
EMAIL_APP_PASSWORD=your-app-password  # SMTP password
```

#### From Address Configuration
```env
EMAIL_FROM_NAME=MentorMates           # Sender name
EMAIL_FROM_ADDRESS=notifications@mentormates.ai  # Sender email
```

#### Branding Configuration
```env
COMPANY_NAME=MentorMates              # Company name used in templates
COMPANY_LOGO_URL=https://example.com/logo.png  # Logo URL for emails
COMPANY_WEBSITE_URL=https://mentormates.ai     # Website URL
SUPPORT_EMAIL=support@mentormates.ai           # Support contact email
```

#### Styling Configuration
```env
EMAIL_PRIMARY_COLOR=#2563eb           # Primary brand color
EMAIL_BACKGROUND_COLOR=#ffffff        # Email background color
EMAIL_FONT_FAMILY=Arial, sans-serif   # Font family
EMAIL_MAX_WIDTH=600px                 # Email max width
EMAIL_BORDER_RADIUS=8px               # Border radius for elements

# Button styling
EMAIL_BUTTON_BACKGROUND_COLOR=#2563eb # Button background color
EMAIL_BUTTON_COLOR=#ffffff            # Button text color
EMAIL_BUTTON_PADDING=12px 24px        # Button padding
EMAIL_BUTTON_BORDER_RADIUS=6px        # Button border radius
```

#### Feature Flags
```env
ENABLE_CONFIGURABLE_TEMPLATES=true    # Enable new template system
ENABLE_TEMPLATE_PREVIEW=true          # Enable template preview API
ENABLE_BULK_EMAIL=true                # Enable bulk email features
```

#### Template-Specific Overrides
```env
# Override specific templates
EMAIL_TEMPLATE_PROJECT_SUBMISSION_ENABLED=true
EMAIL_TEMPLATE_PROJECT_SUBMISSION_SUBJECT=Custom Subject for {{projectName}}
EMAIL_TEMPLATE_WELCOME_ENABLED=false  # Disable welcome emails
```

## Usage Examples

### Basic Usage (New System)

```typescript
import { getEmailTemplateService } from '@/lib/email_templates';

const emailService = getEmailTemplateService();

// Generate project submission email
const email = emailService.generateProjectSubmissionEmail(
  'My Awesome Project',
  'https://example.com/project/123'
);

// Generate welcome email
const welcomeEmail = emailService.generateWelcomeEmail(
  'John Doe',
  'https://example.com/dashboard'
);
```

### Advanced Usage with Custom Settings

```typescript
import { getEmailTemplateService } from '@/lib/email_templates';

const customSettings = {
  branding: {
    companyName: 'Custom Company',
    logoUrl: 'https://custom.com/logo.png',
  },
  styling: {
    primaryColor: '#ff6b6b',
    buttonStyle: {
      backgroundColor: '#ff6b6b',
      borderRadius: '12px',
    },
  },
};

const emailService = getEmailTemplateService({ customSettings });
const email = emailService.generateProjectSubmissionEmail('Project Name');
```

### API Integration

#### Send Email with Configurable Templates

```javascript
// POST /api/email
{
  "type": "project_submission",
  "useConfigurableTemplates": true,
  "to": "user@example.com",
  "projectName": "My Project",
  "leadName": "John Doe",
  "projectUrl": "https://example.com/project/123"
}
```

#### Test Template Rendering

```javascript
// POST /api/email-templates
{
  "action": "test_template",
  "templateKey": "project_submission",
  "variables": {
    "projectName": "Test Project",
    "projectUrl": "https://example.com/test"
  }
}
```

#### Get Template Configuration

```javascript
// GET /api/email-templates
// Returns current template settings and available types
```

## Template Types

### Available Email Types

- **`project_submission`** - Sent when a project is submitted
- **`project_teammate`** - Sent when someone is added to a project team
- **`feedback_notification`** - Sent when feedback is provided on a project
- **`event_update`** - Sent for general event updates
- **`event_schedule_update`** - Sent when event schedule changes
- **`event_custom_update`** - Sent for custom event messages
- **`checkin_qr_code`** - Sent with check-in QR codes/tickets
- **`welcome`** - Sent to new users
- **`password_reset`** - Sent for password reset requests

### Template Variables

Each template type supports specific variables:

#### Project Submission
- `projectName` (required)
- `projectUrl` (optional)
- `leadName` (optional)

#### Feedback Notification
- `projectName` (required)
- `feedback` (required)
- `mentorName` (optional)
- `projectUrl` (optional)

#### Event Updates
- `eventName` (required)
- `eventId` (required)
- `eventUrl` (auto-generated)
- `scheduleHtml` (for schedule updates)
- `customTitle` (for custom updates)
- `customContent` (for custom updates)

#### User-Specific
- `userName` (required for welcome/password reset)
- `resetUrl` (required for password reset)
- `dashboardUrl` (optional for welcome)
- `ticketUrl` (auto-generated for QR codes)

## Template Syntax

Templates support Handlebars-like syntax:

### Variable Substitution
```html
<h1>Welcome {{userName}}!</h1>
<p>Your project "{{projectName}}" has been submitted.</p>
```

### Conditional Blocks
```html
{{#if logoUrl}}
<img src="{{logoUrl}}" alt="{{companyName}}" />
{{/if}}

{{#unless mentorName}}
<p>Anonymous feedback received.</p>
{{/unless}}
```

### Nested Variables
```html
<button style="background-color: {{buttonStyle.backgroundColor}};">
  Click me
</button>
```

## Migration Guide

### From Legacy Templates

The new system maintains backward compatibility. To migrate:

1. **Immediate**: Add `useConfigurableTemplates: true` to API calls
2. **Gradual**: Update environment variables to customize templates
3. **Complete**: Remove legacy template files once fully migrated

### Example Migration

Before (Legacy):
```typescript
import { getProjectSubmissionEmailTemplate } from '@/lib/email_templates/project-submission';
const email = getProjectSubmissionEmailTemplate('Project Name');
```

After (Configurable):
```typescript
import { getEmailTemplateService } from '@/lib/email_templates';
const emailService = getEmailTemplateService();
const email = emailService.generateProjectSubmissionEmail('Project Name');
```

## Development

### Adding New Template Types

1. Add new type to `EMAIL_TYPES` enum in `constants.ts`
2. Add template configuration to `DEFAULT_EMAIL_TEMPLATE_SETTINGS` in `config.ts`
3. Add generation method to `EmailTemplateService` in `service.ts`
4. Add required variables to `EMAIL_CONFIG.REQUIRED_VARIABLES` in `constants.ts`

### Testing Templates

Use the template testing API:

```bash
curl -X POST /api/email-templates \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test_template",
    "templateKey": "project_submission",
    "variables": {
      "projectName": "Test Project"
    }
  }'
```

## Security Considerations

- Template content is not exposed through the API for security
- Admin authentication required for template management
- Environment variables should be used for sensitive configuration
- Template validation prevents malicious template injection

## Performance

- Templates are rendered on-demand
- Singleton pattern for service instances
- Caching of parsed templates (future enhancement)
- Bulk email support through feature flags