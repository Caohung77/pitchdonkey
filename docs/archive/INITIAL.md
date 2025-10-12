# Feature Request Template for PitchDonkey

Use this template to describe new email marketing features you want to implement in PitchDonkey.

## FEATURE:
[Describe what you want to build - be specific about email marketing functionality, campaign features, contact management, or integration requirements]

**Example**: "Build an advanced contact segmentation system that allows users to create dynamic segments based on engagement metrics, custom fields, and campaign interaction history. Include real-time segment updates and integration with the campaign targeting system."

## EXAMPLES:
[List any example files in the examples/ directory and explain how they should be used as patterns]

**Examples to reference:**
- `examples/api-routes/campaign-api.ts` - Shows API route patterns for CRUD operations
- `examples/business-logic/email-campaign-service.ts` - Demonstrates service layer patterns
- `examples/components/` - UI component patterns with proper typing
- `lib/campaigns.ts` - Campaign management and validation patterns
- `lib/campaign-execution.ts` - Email job processing patterns
- `lib/contacts.ts` - Contact management patterns

## DOCUMENTATION:
[Include links to relevant documentation, APIs, or resources needed]

**Key Documentation:**
- [Supabase Documentation](https://supabase.com/docs) - Database operations and real-time subscriptions
- [Next.js App Router](https://nextjs.org/docs/app) - API routes and server components
- [Radix UI](https://www.radix-ui.com/primitives/docs) - UI component patterns
- [Zod Documentation](https://zod.dev/) - Schema validation patterns

**Email Provider APIs:**
- [Gmail API](https://developers.google.com/gmail/api) - For Gmail OAuth integration
- [Microsoft Graph](https://docs.microsoft.com/en-us/graph/) - For Outlook integration

**AI Provider APIs:**
- [OpenAI API](https://platform.openai.com/docs) - For email personalization
- [Anthropic API](https://docs.anthropic.com/) - Alternative AI provider

## OTHER CONSIDERATIONS:
[Mention any gotchas, specific requirements, or things AI assistants commonly miss]

**PitchDonkey-Specific Considerations:**
- **Authentication**: All features must respect plan-based permissions (Starter, Professional, Agency)
- **Database**: Follow existing schema patterns with UUID primary keys and soft deletes
- **Email Integration**: Consider multi-provider support (Gmail OAuth, Outlook OAuth, SMTP)
- **Campaign Execution**: Features should integrate with the campaign execution engine
- **Real-time Updates**: Use Supabase real-time subscriptions for live data updates
- **Rate Limiting**: Respect email provider rate limits and daily sending quotas
- **Data Privacy**: Handle user data according to privacy requirements
- **Error Handling**: Implement comprehensive error handling with proper user feedback
- **Testing**: Include unit tests and integration tests following existing patterns
- **Performance**: Optimize for large contact lists and high-volume email sending

**Common Gotchas:**
- Use correct Supabase client (server vs browser) for the context
- Encrypt sensitive data (OAuth tokens, SMTP credentials) before storage
- Handle email provider authentication token refresh
- Implement proper campaign sequence logic with conditional branching
- Ensure UI components handle loading and error states
- Test email sending functionality with real providers
- Validate input data with Zod schemas before database operations

**Integration Points to Consider:**
- How does this feature integrate with existing campaigns?
- Does this affect contact management or segmentation?
- Are there any email provider-specific considerations?
- Does this require new database tables or schema changes?
- How will this feature appear in the dashboard UI?
- Are there any subscription plan limitations to implement?