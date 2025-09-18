# Email Functionality for Organizers

## Overview
Organizers can now compose, customize, and send emails directly from the organizer dashboard to event participants, mentors, judges, and other organizers.

## Features Implemented

### 1. Email Tab in Organizer Dashboard
- Added a new "Email" tab in the organizer dashboard (`features/user/dashboards/dashboard/organizer/index.tsx`)
- Accessible to organizers and admins only

### 2. Email Composition Interface
- **Subject and Message Fields**: Simple text input for subject and textarea for message content
- **Recipient Selection**: 
  - Filter by role (Participants, Mentors, Judges, Organizers, or All)
  - Individual recipient selection with checkboxes
  - Bulk selection options (Select All/Clear All)
  - Shows recipient count and details (name, email, role)

### 3. Email Templates System
- **6 Predefined Templates**:
  - Welcome Message (for new participants)
  - Event Reminder (for upcoming deadlines)
  - Schedule Update (for event changes)
  - Submission Reminder (for project deadlines)
  - Results Announcement (for winners)
  - Feedback Available (when feedback is ready)
- **Template Categories**: General, Reminders, Updates, Results
- **One-click Application**: Templates populate subject and message fields
- **Customizable**: Templates serve as starting points and can be edited

### 4. Email Preview
- **Live Preview**: Shows how the email will look to recipients
- **HTML Formatting**: Converts line breaks to HTML and applies styling
- **Professional Template**: Consistent branding with event organizer signature

### 5. API Integration
- **New Email Type**: `organizer_custom` added to existing email API (`/app/api/email/route.ts`)
- **Security**: Verifies user is organizer/admin for the event before sending
- **Bulk Sending**: Sends to multiple recipients simultaneously
- **Error Handling**: Reports success/failure counts
- **Template Support**: Uses existing email infrastructure (Gmail/Nodemailer)

### 6. Email Template Engine
- **Custom Template**: `lib/templates/organizer-custom.ts` for organizer emails
- **Consistent Styling**: Matches existing email templates
- **HTML Generation**: Converts plain text to formatted HTML

## File Structure
```
features/user/dashboards/dashboard/organizer/
├── email/
│   ├── index.tsx          # Main email composition interface
│   └── templates.tsx      # Email templates component
├── index.tsx              # Updated to include Email tab

lib/templates/
└── organizer-custom.ts    # Email template for organizer emails

app/api/email/
└── route.ts               # Updated API with organizer_custom type
```

## Usage Instructions

1. **Access Email Tab**: Navigate to event dashboard → Email tab
2. **Choose Template (Optional)**: Click "Use Template" to browse and select predefined templates
3. **Compose Email**: 
   - Enter subject line
   - Write or customize message content
   - Use "Show Preview" to see formatted email
4. **Select Recipients**:
   - Filter by role if needed
   - Select individual recipients or use "Select All"
   - Review selected count
5. **Send Email**: Click send button (shows progress and confirmation)

## Security Features
- **Authorization**: Only organizers/admins can send emails
- **Event-Scoped**: Users can only send emails for events they organize
- **Recipient Validation**: Only sends to valid event participants
- **Error Logging**: Failed sends are logged for troubleshooting

## Technical Details
- **Email Service**: Uses existing Gmail/Nodemailer configuration
- **Database**: Queries `user_event_roles` and `user_profiles` tables
- **Real-time Updates**: Shows sending progress and results
- **Responsive Design**: Works on desktop and mobile devices
- **Accessibility**: Proper labels and keyboard navigation

## Future Enhancements
- Rich text editor for advanced formatting
- Email scheduling functionality  
- Email history and analytics
- Custom template creation and saving
- Email delivery status tracking
- Attachment support