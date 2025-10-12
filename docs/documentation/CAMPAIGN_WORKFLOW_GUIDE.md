# Campaign Workflow Guide

## 🚀 Complete Campaign Creation Workflow

### Step 1: Access Campaign Creation
1. Navigate to `/dashboard/campaigns`
2. Click "New Campaign" button
3. You'll enter the 5-step campaign wizard

### Step 2: Campaign Details (Step 1/5)
- **Campaign Name**: Enter a descriptive name (required)
- **Description**: Optional description of campaign goals
- Click "Next" to proceed

### Step 3: Select Contacts (Step 2/5)
- **View Available Segments**: See pre-defined contact segments
- **Select Segments**: Click on segments to include in campaign
- **Create New Segment**: If you need a new segment:
  1. Click "New Segment" or "Create Contact Segment"
  2. Modal opens with segment creation form
  3. Fill in segment name and description
  4. Set filter criteria (company, job title, location, industry, date)
  5. See estimated contact count in real-time
  6. Click "Create Segment"
  7. New segment is automatically selected for campaign

### Step 4: Email Sequence (Step 3/5)
- **Build Email Flow**: Use the SequenceBuilder component
- **Add Email Steps**: Each step includes:
  - Subject line (required)
  - Email content (required)
  - Delay between emails
  - Conditional logic
- **Multiple Steps**: Add follow-up emails with delays

### Step 5: Settings (Step 4/5)
- **AI Personalization**:
  - Enable/disable AI personalization
  - Add custom prompts for AI
- **Scheduling Options**:
  - Time zone detection
  - Business hours only
  - Avoid weekends
  - Daily email limits

### Step 6: Review & Launch (Step 5/5)
- **Review All Settings**: Check campaign details, segments, sequence
- **Save as Draft**: Save without launching
- **Launch Campaign**: Start sending emails immediately

## 🔧 Technical Implementation

### API Endpoints Used
- `GET /api/contacts/segments` - Fetch available segments
- `POST /api/contacts/segments` - Create new segment
- `DELETE /api/contacts/segments/[id]` - Delete segment
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns` - List campaigns

### Key Components
- `CreateSegmentModal` - Inline segment creation
- `SegmentManager` - Segment organization in contacts page
- `SequenceBuilder` - Email sequence creation
- `CampaignWizard` - Multi-step campaign creation

### Data Flow
1. User starts campaign creation
2. Segments loaded from API
3. User can create segments inline (no page redirect)
4. New segments automatically added to selection
5. Email sequence built with validation
6. Settings configured
7. Campaign saved/launched via API

## 🎯 Key Features

### Seamless Workflow
- ✅ No page redirects during segment creation
- ✅ Modal-based segment creation
- ✅ Automatic segment selection after creation
- ✅ Real-time contact count estimation
- ✅ Form validation at each step

### Segment Management
- ✅ Filter by company, job title, location, industry
- ✅ Date-based filtering (recently added contacts)
- ✅ Real-time contact count estimation
- ✅ Organized segment management in contacts page

### Campaign Features
- ✅ Multi-step email sequences
- ✅ AI personalization options
- ✅ Advanced scheduling settings
- ✅ Draft and launch modes
- ✅ Campaign analytics preparation

## 🐛 Troubleshooting

### Common Issues
1. **"Plus icon not found"** - Fixed: Added Plus import to campaign page
2. **"contactSegments.map is not a function"** - Fixed: Added array validation
3. **Segment creation redirects** - Fixed: Modal-based creation
4. **Lost campaign progress** - Fixed: No more page redirects

### Testing the Workflow
Run the test script to verify everything works:
```bash
node test-campaign-workflow.js
```

### Browser Testing
1. Open `/dashboard/campaigns/new`
2. Go through each step of the wizard
3. Try creating a new segment in step 2
4. Verify the segment appears and is selected
5. Complete the campaign creation

## 📱 User Experience

### Before (Broken Workflow)
1. Start campaign → Need segment → Redirect to contacts → Lose progress ❌

### After (Fixed Workflow)
1. Start campaign → Need segment → Modal opens → Create segment → Continue campaign ✅

The workflow is now seamless and user-friendly!