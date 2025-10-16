/**
 * AI Persona Notification Email Template
 * Beautiful HTML email matching the reference design
 */

export interface PersonaNotificationData {
  personaName: string
  personaInitials: string
  personaAvatar?: string
  recipientEmail: string
  draftSubject: string
  draftBody: string
  timeRemaining: string // "5 minutes", "10 minutes"
  status: 'scheduled' | 'needs_approval'
  editUrl: string
  cancelUrl: string
  settingsUrl: string
  userName?: string
}

export function renderPersonaNotificationEmail(data: PersonaNotificationData): string {
  const headerTitle = data.status === 'needs_approval'
    ? 'Draft Needs Approval'
    : 'Draft Ready for Review'

  const headerSubtitle = data.status === 'needs_approval'
    ? 'AI Persona requires your review'
    : 'AI Persona preparing to send'

  const primaryButtonText = data.status === 'needs_approval'
    ? 'Review & Approve'
    : 'Edit Draft'

  const secondaryButtonText = data.status === 'needs_approval'
    ? 'Reject Draft'
    : 'Cancel Send'

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${headerTitle}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f7;
        }
        .email-container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        .header {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            padding: 24px 32px;
            color: white;
        }
        .header-title {
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            opacity: 0.9;
            margin: 0 0 8px 0;
        }
        .header-subtitle {
            font-size: 20px;
            font-weight: 600;
            margin: 0;
        }
        .content {
            padding: 32px;
        }
        .ai-info {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 24px;
            padding: 16px;
            background: #f8f9ff;
            border-radius: 8px;
            border-left: 4px solid #6366f1;
        }
        .ai-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 20px;
            flex-shrink: 0;
        }
        .ai-avatar img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
        }
        .ai-details {
            flex: 1;
        }
        .ai-name {
            font-size: 16px;
            font-weight: 600;
            color: #1a1a1a;
            margin: 0 0 4px 0;
        }
        .ai-action {
            font-size: 14px;
            color: #6b7280;
            margin: 0;
        }
        .ai-action strong {
            color: #1a1a1a;
        }
        .draft-container {
            background: #fafafa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
        }
        .draft-label {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #6b7280;
            margin: 0 0 12px 0;
        }
        .draft-content {
            font-size: 14px;
            line-height: 1.6;
            color: #1a1a1a;
            white-space: pre-line;
        }
        .draft-subject {
            font-weight: 600;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        .action-buttons {
            display: flex;
            gap: 12px;
            margin-bottom: 24px;
        }
        .btn {
            flex: 1;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            text-align: center;
            text-decoration: none;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
            display: inline-block;
        }
        .btn-primary {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
        }
        .btn-secondary {
            background: white;
            color: #6366f1;
            border: 2px solid #6366f1;
        }
        .footer {
            padding: 20px 32px;
            background: #fafafa;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
            text-align: center;
        }
        .footer a {
            color: #6366f1;
            text-decoration: none;
        }
        .timer-info {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px;
            background: #fff7ed;
            border-radius: 6px;
            margin-bottom: 24px;
            font-size: 13px;
            color: #92400e;
        }
        .timer-icon {
            font-size: 16px;
        }
        .warning-badge {
            display: inline-block;
            padding: 6px 12px;
            background: #fef3c7;
            border: 1px solid #fbbf24;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            color: #92400e;
            margin-bottom: 16px;
        }
        @media only screen and (max-width: 600px) {
            .email-container {
                margin: 20px;
            }
            .content {
                padding: 24px 16px;
            }
            .action-buttons {
                flex-direction: column;
            }
            .btn {
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="header">
            <p class="header-title">${headerTitle}</p>
            <h1 class="header-subtitle">${headerSubtitle}</h1>
        </div>

        <!-- Content -->
        <div class="content">
            <!-- AI Persona Info -->
            <div class="ai-info">
                <div class="ai-avatar">
                    ${data.personaAvatar
                      ? `<img src="${data.personaAvatar}" alt="${data.personaName}" />`
                      : data.personaInitials
                    }
                </div>
                <div class="ai-details">
                    <h2 class="ai-name">${data.personaName}</h2>
                    <p class="ai-action">sending to <strong>${data.recipientEmail}</strong></p>
                </div>
            </div>

            ${data.status === 'needs_approval' ? `
            <!-- Warning Badge -->
            <div class="warning-badge">
                ⚠️ High risk score - Manual approval required
            </div>
            ` : `
            <!-- Timer Notice -->
            <div class="timer-info">
                <span class="timer-icon">⏱️</span>
                <span><strong>Auto-sending in ${data.timeRemaining}</strong> unless you make changes</span>
            </div>
            `}

            <!-- Draft Content -->
            <div class="draft-container">
                <p class="draft-label">Draft Preview</p>
                <div class="draft-subject">
                    Subject: ${data.draftSubject}
                </div>
                <div class="draft-content">${data.draftBody}</div>
            </div>

            <!-- Action Buttons -->
            <div class="action-buttons">
                <a href="${data.editUrl}" class="btn btn-primary">${primaryButtonText}</a>
                <a href="${data.cancelUrl}" class="btn btn-secondary">${secondaryButtonText}</a>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>You're receiving this because an AI Persona in your Eisbrief account drafted an email.<br>
            <a href="${data.settingsUrl}">Manage AI Persona settings</a></p>
        </div>
    </div>
</body>
</html>
`
}
