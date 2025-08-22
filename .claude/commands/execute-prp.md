# Execute PRP Command

## Purpose
Execute a Product Requirements Prompt (PRP) to implement email marketing features in the pitchdonkey project.

## Command
/execute-prp

## Usage
```bash
/execute-prp PRPs/advanced-segmentation-20241220.md
/execute-prp PRPs/email-templates-system.md
```

## Implementation

```markdown
I will implement the feature described in the PRP file: $ARGUMENTS

## Step 1: Load Complete Context

Read and understand the entire PRP file:
- Load all referenced documentation
- Review code examples and patterns
- Understand success criteria
- Note all gotchas and constraints
- Identify integration points

## Step 2: Create Implementation Plan

Using TodoWrite, create a comprehensive task list based on the PRP:
- Break down each implementation task
- Order tasks by dependencies
- Mark validation checkpoints
- Include testing requirements

## Step 3: Execute Implementation

For each task in the plan:

### Database Changes
- Create or modify database schemas
- Add necessary indexes
- Create migration files if needed
- Test database operations

### API Route Development
- Implement new API endpoints following Next.js App Router patterns
- Use proper Supabase client (server vs browser)
- Implement authentication checks
- Add proper error handling
- Follow existing API response formats

### Component Development
- Create React components following existing patterns
- Use Radix UI components for consistency
- Implement proper TypeScript interfaces
- Add proper error boundaries
- Ensure responsive design

### Business Logic Implementation
- Add new functions to lib/ directory
- Follow existing patterns for email campaigns
- Implement proper error handling
- Add logging and monitoring
- Ensure async/await patterns are correct

### Integration Points
- Connect new features with existing campaign system
- Ensure proper email provider integration
- Implement AI personalization if needed
- Add contact segmentation support

## Step 4: Validation at Each Stage

After implementing each component:

### Level 1: Syntax & Style
```bash
npm run build                    # Check TypeScript compilation
npm run lint                     # Check ESLint rules
```

### Level 2: Unit Testing
```bash
npm run test                     # Run existing tests
npm run test -- --testNamePattern="new-feature"  # Run specific tests
```

### Level 3: Integration Testing
- Test API endpoints with real data
- Test email campaign execution
- Verify email provider connections
- Check database operations

### Level 4: End-to-End Testing
- Test complete user workflows
- Verify email sending works
- Check campaign analytics
- Test error scenarios

## Step 5: Quality Assurance

### Code Quality Checks
- All TypeScript errors resolved
- All ESLint warnings addressed
- Proper error handling implemented
- Logging added for debugging
- Comments added for complex logic

### Functional Testing
- All success criteria met
- Edge cases handled properly
- Error scenarios tested
- Performance acceptable
- User experience intuitive

### Integration Verification
- Email campaigns execute successfully
- Contact segmentation works
- Email providers respond correctly
- Database operations complete
- Real-time updates function

## Step 6: Documentation Updates

- Update CLAUDE.md with new patterns if needed
- Add comments to complex code
- Update API documentation
- Create usage examples
- Update troubleshooting guide

## Step 7: Final Validation

Run complete validation checklist from PRP:
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] No linting warnings
- [ ] Email campaigns work end-to-end
- [ ] Database operations complete successfully
- [ ] UI components render correctly
- [ ] Authentication flows work
- [ ] Error handling is comprehensive

## Error Handling Strategy

If any step fails:
1. Read error message carefully
2. Check against known gotchas in PRP
3. Review similar implementations in codebase
4. Fix issue systematically
5. Re-run validation
6. Update TodoWrite with progress

## Success Criteria

- [ ] All PRP success criteria achieved
- [ ] Implementation follows existing patterns
- [ ] Code quality standards met
- [ ] Comprehensive testing completed
- [ ] Integration points working
- [ ] Documentation updated
- [ ] Ready for production deployment

## Iterative Improvement

If initial implementation doesn't meet all criteria:
1. Identify gaps systematically
2. Update implementation plan
3. Address issues one by one
4. Re-validate after each fix
5. Continue until all criteria met

This command ensures that PRP implementations are:
- Complete and functional
- Following project patterns
- Properly tested and validated
- Ready for production use
```