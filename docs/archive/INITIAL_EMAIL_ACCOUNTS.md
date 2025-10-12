# Enhanced Email Account Management with Domain Validation

## FEATURE:
Build a comprehensive email account management system that allows users to add, configure, and manage email accounts for outbound campaigns with integrated domain authentication validation. The system should support multi-provider OAuth (Gmail, Outlook), SMTP configuration, real-time domain verification (SPF, DKIM, DMARC), account health monitoring, and seamless integration with the campaign execution engine.

**Core Requirements:**
- **Multi-Provider Support**: Gmail OAuth, Outlook OAuth, and custom SMTP configuration
- **Domain Authentication**: Real-time SPF, DKIM, DMARC verification and guidance
- **Account Health Monitoring**: Reputation tracking, bounce rates, deliverability scores
- **Warmup Integration**: Automated email warmup for new accounts
- **Campaign Integration**: Seamless connection with existing campaign execution system
- **Plan-Based Limits**: Respect subscription limits for email accounts
- **Security**: Encrypted storage of OAuth tokens and SMTP credentials
- **Real-time Updates**: Live status updates and domain verification results
- **Testing & Validation**: Connection testing and email sending validation

## EXAMPLES:
**Reference these existing patterns:**
- `lib/email-providers.ts` - Current EmailAccountService and provider configurations
- `lib/domain-auth.ts` - Existing domain authentication service and validation
- `components/email-accounts/AddEmailAccountDialog.tsx` - Current UI for adding accounts
- `src/app/api/email-accounts/route.ts` - Current API endpoint patterns
- `examples/api-routes/campaign-api.ts` - API route structure with authentication
- `examples/business-logic/email-campaign-service.ts` - Service layer patterns
- `lib/campaign-execution.ts` - How email accounts are used in campaigns
- `lib/oauth-providers.ts` - OAuth flow implementations
- `lib/encryption.ts` - Token encryption patterns

**Database patterns to follow:**
- `lib/database-schema.sql` - Current email_accounts table structure
- Existing domain_auth table structure for SPF/DKIM/DMARC validation
- UUID primary keys and soft delete patterns
- JSONB fields for flexible configuration storage

**UI patterns to reference:**
- `components/email-accounts/` - Existing email account UI components
- `components/ui/` - Radix UI components for consistency
- Real-time status updates and loading states

## DOCUMENTATION:
**OAuth Provider Documentation:**
- [Gmail API OAuth](https://developers.google.com/gmail/api/auth/web-server) - Server-side OAuth flow
- [Microsoft Graph OAuth](https://docs.microsoft.com/en-us/graph/auth-v2-service) - Outlook OAuth implementation
- [OAuth 2.0 Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics-19) - Security considerations

**Domain Authentication:**
- [SPF Record Specification](https://tools.ietf.org/html/rfc7208) - SPF validation rules
- [DKIM Specification](https://tools.ietf.org/html/rfc6376) - DKIM signature validation
- [DMARC Specification](https://tools.ietf.org/html/rfc7489) - DMARC policy validation
- [Email Deliverability Guide](https://sendgrid.com/blog/email-deliverability-guide/) - Best practices

**SMTP Configuration:**
- [SMTP Protocol](https://tools.ietf.org/html/rfc5321) - SMTP standards
- [STARTTLS](https://tools.ietf.org/html/rfc3207) - Secure SMTP connections
- [Provider Settings](https://blog.mailtrap.io/smtp-settings/) - Common SMTP configurations

**Technical Implementation:**
- [Supabase Real-time](https://supabase.com/docs/guides/realtime) - For live status updates
- [Node.js OAuth Libraries](https://www.npmjs.com/package/simple-oauth2) - OAuth implementation
- [DNS Lookup Libraries](https://www.npmjs.com/package/dns-over-http-resolver) - Domain verification
- [Email Validation](https://www.npmjs.com/package/email-validator) - Email format validation

## OTHER CONSIDERATIONS:

**PitchDonkey-Specific Requirements:**
- **Plan Integration**: Email account limits based on subscription (Starter: 1, Professional: 3, Agency: 10)
- **Campaign Integration**: Email accounts must work seamlessly with `CampaignExecutionEngine`
- **Database Consistency**: Use existing `email_accounts` table structure and domain_auth integration
- **Authentication**: Follow existing Supabase auth patterns (server vs client)
- **Encryption**: Use existing encryption service for sensitive data storage
- **Real-time**: Implement live updates for verification status and account health

**Domain Validation Requirements:**
- **SPF Validation**: Check SPF records and provide setup guidance
- **DKIM Validation**: Verify DKIM signatures and key rotation
- **DMARC Validation**: Check DMARC policies and alignment
- **Real-time Checking**: Allow manual re-verification of domain records
- **Setup Guidance**: Provide DNS record examples and setup instructions
- **Health Scoring**: Calculate overall domain authentication health

**OAuth Implementation Requirements:**
- **Gmail OAuth**: Implement server-side OAuth flow with proper scopes
- **Outlook OAuth**: Microsoft Graph API integration with mail.send permission
- **Token Management**: Secure token storage with automatic refresh
- **Scope Validation**: Request minimal necessary permissions
- **Error Handling**: Handle OAuth errors and re-authorization flows

**SMTP Configuration Requirements:**
- **Provider Templates**: Pre-configured settings for common providers (Gmail, Outlook, Yahoo)
- **Connection Testing**: Real-time SMTP connection validation
- **Security**: Support for SSL/TLS and STARTTLS
- **Authentication**: Support for various auth methods (plain, login, OAuth)
- **Error Reporting**: Clear error messages for connection issues

**Account Health Monitoring:**
- **Reputation Tracking**: Monitor sending reputation and deliverability
- **Bounce Rate Monitoring**: Track and alert on high bounce rates
- **Complaint Tracking**: Monitor spam complaints and feedback loops
- **Warmup Progress**: Track email warmup status and progression
- **Usage Metrics**: Daily/monthly sending limits and current usage

**Integration Points:**
- **Campaign Execution**: Email accounts must integrate with existing job processing
- **Contact Management**: Account health affects contact validation and segmentation
- **Analytics**: Account performance feeds into campaign analytics
- **Warmup System**: New accounts automatically enter warmup process
- **Rate Limiting**: Respect provider-specific sending limits

**Security Considerations:**
- **Token Encryption**: All OAuth tokens and SMTP credentials encrypted at rest
- **Scope Limitation**: Request minimal OAuth scopes required
- **Token Rotation**: Implement automatic token refresh and rotation
- **Audit Logging**: Log all account access and configuration changes
- **Data Privacy**: Handle user credentials according to privacy requirements

**Common Gotchas:**
- **OAuth Redirect URIs**: Must match exactly between config and provider
- **Token Expiration**: Handle expired tokens gracefully with refresh flow
- **SMTP Authentication**: Different providers require different auth methods
- **Domain Verification**: DNS propagation can take time for record updates
- **Rate Limits**: Each provider has different sending limits and throttling
- **Warmup Requirements**: New accounts need gradual volume increases
- **Provider Policies**: Each provider has specific requirements for bulk sending

**Success Metrics:**
- Users can successfully add Gmail, Outlook, and SMTP accounts
- Domain authentication status is accurately verified and displayed
- Account health metrics are tracked and displayed in real-time
- OAuth flows complete successfully with proper error handling
- SMTP connections are validated before account creation
- Email accounts integrate seamlessly with campaign execution
- Account limits are enforced based on subscription plans
- Domain verification provides actionable setup guidance