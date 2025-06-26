# SmartAttend User Guide

## Welcome to SmartAttend

SmartAttend is an AI-powered attendance tracking system that automatically matches student names from uploaded files to enrolled students using advanced artificial intelligence. This guide will help you get started and make the most of the system.

## Table of Contents

1. [Getting Started](#getting-started)
2. [User Roles](#user-roles)
3. [Dashboard Overview](#dashboard-overview)
4. [Managing Sessions](#managing-sessions)
5. [Uploading Attendance](#uploading-attendance)
6. [AI Matching Process](#ai-matching-process)
7. [Reviewing and Verifying](#reviewing-and-verifying)
8. [Reports and Analytics](#reports-and-analytics)
9. [Settings and Preferences](#settings-and-preferences)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#faq)

## Getting Started

### Creating Your Account

1. Navigate to the SmartAttend login page
2. Click "Sign Up" to create a new account
3. Fill in your details:
   - Email address (must be valid)
   - Password (minimum 8 characters)
   - First and Last name
   - Select your role (Teacher/Administrator)
4. Verify your email address
5. Complete your profile setup

### First Login

1. Enter your email and password
2. You'll be taken to the dashboard
3. Complete the onboarding tutorial
4. Set up your preferences

## User Roles

### Administrator
- Full system access
- User management
- System configuration
- Analytics and reporting
- Session management across all subjects

### Teacher
- Create and manage sessions
- Upload attendance files
- Review AI matching results
- Generate reports for their sessions
- Manage enrolled students

### Student
- View their attendance records
- Access personal attendance statistics
- Download attendance reports
- Update profile information

## Dashboard Overview

### Main Dashboard Components

1. **Quick Stats**
   - Total sessions
   - Recent uploads
   - Processing status
   - AI matching accuracy

2. **Recent Activity**
   - Latest file uploads
   - Recent sessions
   - Pending verifications

3. **Quick Actions**
   - Create new session
   - Upload attendance
   - View reports

4. **System Status**
   - Service health
   - Processing queue
   - System notifications

## Managing Sessions

### Creating a New Session

1. Click "Create Session" from the dashboard
2. Fill in session details:
   - **Title**: Descriptive name for the session
   - **Subject**: Course or subject name
   - **Date & Time**: When the session takes place
   - **Duration**: Length of the session in minutes
   - **Location**: Where the session takes place (optional)
   - **Description**: Additional details (optional)

3. Configure settings:
   - **Attendance Required**: Whether attendance tracking is needed
   - **Maximum Capacity**: Limit number of students
   - **Auto-enroll**: Automatically enroll students from uploads

4. Click "Create Session"

### Managing Enrolled Students

1. Go to the session details page
2. Click "Manage Students"
3. Options available:
   - **Add Students**: Manually add by email or student ID
   - **Import Students**: Upload CSV file with student details
   - **Remove Students**: Unenroll students from the session
   - **View Enrollment**: See all enrolled students

### Session Settings

- **Edit Session**: Modify session details
- **Duplicate Session**: Create a copy for recurring classes
- **Archive Session**: Move completed sessions to archive
- **Delete Session**: Permanently remove session (requires confirmation)

## Uploading Attendance

### Supported File Formats

- **CSV** (Comma-separated values) - Recommended
- **Excel** (.xlsx, .xls)
- **Plain text** (.txt with comma/tab separation)

### File Requirements

- Maximum file size: 10MB
- Must contain student names
- Optional: email addresses, student IDs
- Headers recommended for better accuracy

### Upload Process

1. Navigate to your session
2. Click "Upload Attendance"
3. Select your file or drag and drop
4. Preview the file contents
5. Map columns if needed:
   - **Name Column**: Column containing student names
   - **Email Column**: Column with email addresses (if available)
   - **ID Column**: Column with student IDs (if available)
   - **Status Column**: Attendance status (Present/Absent/Late)

6. Click "Upload and Process"

### File Format Examples

#### Basic CSV Format
```csv
Student Name,Email,Status
John Smith,john.smith@university.edu,Present
Emily Johnson,emily.johnson@university.edu,Present
Michael Brown,michael.brown@university.edu,Absent
```

#### Extended Format
```csv
Student Name,Student ID,Email,Date,Status,Notes
John Smith,ST001,john.smith@university.edu,2024-01-15,Present,On time
Emily Johnson,ST002,emily.johnson@university.edu,2024-01-15,Present,
Michael Brown,ST003,michael.brown@university.edu,2024-01-15,Absent,Excused
```

## AI Matching Process

### How AI Matching Works

1. **File Analysis**: The system analyzes your uploaded file to identify columns
2. **Name Processing**: Student names are processed and normalized
3. **Database Matching**: AI compares names against enrolled students
4. **Confidence Scoring**: Each match receives a confidence score (0-100%)
5. **Pattern Fallback**: If AI fails, pattern matching provides backup
6. **Results Generation**: Matched and unmatched records are presented

### Matching Methods

- **Exact Match**: Perfect name and/or email match (99-100% confidence)
- **AI Match**: Advanced fuzzy matching with name variations (70-99% confidence)
- **Pattern Match**: String similarity matching (60-85% confidence)
- **Manual Match**: User-verified matches (100% confidence after verification)

### Confidence Levels

- **High (90-100%)**: Very likely correct, auto-accepted
- **Medium (70-89%)**: Likely correct, review recommended
- **Low (60-69%)**: Uncertain, manual verification required
- **No Match (0%)**: No suitable match found

### Name Variations Handled

- **Nicknames**: Mike → Michael, Liz → Elizabeth
- **Name Order**: "Smith, John" → "John Smith"
- **Initials**: "J. Smith" → "John Smith"
- **Typos**: "Jon Smith" → "John Smith"
- **Partial Names**: "John" → "John Smith"
- **Hyphenated Names**: "Mary-Jane" → "Mary Jane"

## Reviewing and Verifying

### Review Interface

After processing, you'll see:

1. **Matched Records** (Green)
   - Student name from file
   - Matched database student
   - Confidence percentage
   - Matching method used

2. **Unmatched Records** (Red)
   - Names that couldn't be matched
   - Suggested matches (if any)
   - Reasons for no match

3. **Actions Available**
   - **Accept All High Confidence**: Auto-accept matches above 90%
   - **Review Individual**: Check each match manually
   - **Bulk Actions**: Accept/reject multiple items
   - **Manual Matching**: Assign unmatched names to students

### Manual Matching

For unmatched records:

1. Click "Manual Match" next to an unmatched name
2. Search for the correct student:
   - Type student name, email, or ID
   - Browse enrolled students list
   - Filter by various criteria

3. Select the correct student
4. Confirm the match
5. The system learns from your corrections

### Verification Best Practices

- Always review matches below 85% confidence
- Check for duplicate assignments
- Verify unusual name patterns
- Use the learning feedback system
- Keep an eye on processing time

## Reports and Analytics

### Available Reports

#### Attendance Summary
- Session-wise attendance rates
- Student attendance percentages
- Trend analysis over time
- Comparison across subjects

#### Detailed Attendance
- Individual student records
- Session-by-session breakdown
- Status breakdown (Present/Absent/Late/Excused)
- Time and date stamps

#### AI Performance Report
- Matching accuracy statistics
- Processing time analytics
- Confidence score distributions
- Error rate analysis

#### Student Performance
- Individual attendance tracking
- Subject-wise performance
- Attendance patterns
- Risk identification (poor attendance)

### Generating Reports

1. Go to "Reports" section
2. Select report type
3. Set parameters:
   - Date range
   - Sessions to include
   - Students to include
   - Output format (PDF, Excel, CSV)

4. Click "Generate Report"
5. Download when ready

### Analytics Dashboard

Visual analytics include:
- **Attendance Trends**: Line charts showing attendance over time
- **Subject Comparison**: Bar charts comparing attendance across subjects
- **Student Heatmaps**: Visual representation of attendance patterns
- **AI Performance**: Metrics on matching accuracy and speed

## Settings and Preferences

### Profile Settings

- **Personal Information**: Update name, email, contact details
- **Password**: Change your password
- **Notification Preferences**: Email and in-app notifications
- **Time Zone**: Set your local time zone
- **Language**: Choose interface language

### System Preferences

#### AI Settings (Admin/Teacher)
- **Confidence Threshold**: Minimum confidence for auto-acceptance
- **Processing Timeout**: Maximum time for AI processing
- **Learning Mode**: Enable/disable AI learning from corrections
- **Fallback Methods**: Configure backup matching methods

#### Upload Settings
- **Default File Format**: Preferred upload format
- **Auto-processing**: Automatically process uploads
- **Column Mapping**: Save common column configurations
- **Validation Rules**: Set data validation requirements

### Notification Settings

Configure notifications for:
- Upload completion
- Processing results
- System alerts
- Weekly summaries
- Error notifications

## Troubleshooting

### Common Issues

#### File Upload Problems

**Problem**: File upload fails
**Solutions**:
- Check file size (must be under 10MB)
- Verify file format (CSV, Excel supported)
- Ensure stable internet connection
- Try a different browser

**Problem**: Columns not detected correctly
**Solutions**:
- Ensure proper headers in first row
- Check for special characters
- Verify data formatting
- Use manual column mapping

#### AI Matching Issues

**Problem**: Low matching accuracy
**Solutions**:
- Check name formatting in your file
- Ensure enrolled students are correct
- Verify email addresses match
- Use more complete student information

**Problem**: Processing takes too long
**Solutions**:
- Reduce file size
- Check system status
- Try during off-peak hours
- Contact support if persistent

#### Login and Access Issues

**Problem**: Cannot log in
**Solutions**:
- Verify email and password
- Check if account is activated
- Try password reset
- Clear browser cache and cookies

**Problem**: Features not accessible
**Solutions**:
- Check your user role permissions
- Ensure account is verified
- Contact administrator
- Check system maintenance status

### Error Messages

#### "Processing Failed"
- File format not supported
- File corrupted or empty
- System overload
- **Solution**: Check file format and try again

#### "No Students Found"
- No enrolled students in session
- Database connection issue
- **Solution**: Ensure students are enrolled

#### "Matching Timeout"
- File too large
- AI service unavailable
- **Solution**: Try smaller file or wait and retry

### Getting Help

1. **In-App Help**: Click the help icon (?) for contextual assistance
2. **Knowledge Base**: Search our comprehensive knowledge base
3. **Contact Support**: Use the support form for specific issues
4. **Community Forum**: Connect with other users
5. **Video Tutorials**: Watch step-by-step guides

## FAQ

### General Questions

**Q: How accurate is the AI matching?**
A: Our AI typically achieves 95%+ accuracy with properly formatted data. Accuracy depends on data quality and name consistency.

**Q: What happens to my data?**
A: All data is securely stored and processed according to our privacy policy. Student data is encrypted and access is strictly controlled.

**Q: Can I use SmartAttend offline?**
A: No, SmartAttend requires an internet connection for AI processing and data synchronization.

**Q: How long does processing take?**
A: Most files process within 30 seconds. Large files may take up to 2 minutes.

### Technical Questions

**Q: What browsers are supported?**
A: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+. We recommend using the latest version.

**Q: Can I integrate with our student information system?**
A: Yes, we offer API integration options. Contact our technical team for details.

**Q: Is there a mobile app?**
A: The web interface is mobile-responsive. Native mobile apps are in development.

**Q: What's the maximum file size?**
A: 10MB per file, supporting up to 10,000 student records per upload.

### Billing and Account Questions

**Q: How is pricing determined?**
A: Pricing is based on the number of students and features required. Contact sales for custom pricing.

**Q: Can I export my data?**
A: Yes, you can export all your data in standard formats at any time.

**Q: What support is included?**
A: All plans include email support. Premium plans include phone support and dedicated account management.

### Security Questions

**Q: How secure is my data?**
A: We use enterprise-grade security including encryption, secure servers, and regular security audits.

**Q: Who can access my attendance data?**
A: Only authorized users in your organization can access your data based on their assigned roles.

**Q: Is SmartAttend FERPA compliant?**
A: Yes, SmartAttend is designed to comply with FERPA and other education privacy regulations.

---

## Support Contact

- **Email**: support@smartattend.com
- **Phone**: 1-800-SMARTATTEND
- **Web**: https://support.smartattend.com
- **Hours**: Monday-Friday, 9 AM - 6 PM EST

For technical issues, please include:
- Your account email
- Session ID (if applicable)
- File name and size
- Browser and version
- Error message (if any)

---

*Last updated: January 2024*
*Version: 1.0.0*