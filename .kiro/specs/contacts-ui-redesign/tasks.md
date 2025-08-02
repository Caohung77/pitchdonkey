# Implementation Plan

- [x] 1. Create new contacts route and basic page structure

  - Create new page at `src/app/contacts/page.tsx` with basic layout
  - Implement direct Supabase session checking without AuthProvider wrapper
  - Add basic error boundary and loading states
  - _Requirements: 1.1, 8.1_

- [x] 2. Implement core contact data fetching and display

  - Create ContactsList component with grid layout using existing Contact interface
  - Integrate with existing `/api/contacts` endpoint for data fetching
  - Add loading skeletons and empty state handling
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Add contact statistics display

  - Create ContactsStats component with card layout
  - Integrate with existing `/api/contacts/stats` endpoint
  - Display total, active, unsubscribed, and bounced counts
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 4. Implement search and filtering functionality

  - Add search input with real-time filtering
  - Create status filter dropdown (all, active, unsubscribed, bounced)
  - Implement client-side filtering logic with API integration
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Create contact creation functionality

  - Build AddContactModal component with form validation
  - Integrate with existing `/api/contacts` POST endpoint
  - Add form validation using existing contact schema
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Add individual contact actions

  - Implement edit contact functionality in ContactCard component
  - Add delete contact action with confirmation
  - Create tag management for individual contacts
  - _Requirements: 2.1, 3.3_

- [x] 7. Implement bulk contact operations

  - Add contact selection checkboxes and select-all functionality
  - Create BulkActionsBar component with delete and tag actions
  - Integrate with existing `/api/contacts/bulk` endpoint
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 8. Add CSV import functionality

  - Create ImportContactsModal component with file upload
  - Integrate with existing `/api/contacts/import` endpoint
  - Display import progress and results summary
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 9. Implement comprehensive error handling

  - Add error boundaries for component-level error handling
  - Create toast notification system for API errors
  - Implement retry mechanisms for failed requests
  - _Requirements: 8.2, 8.3, 8.4_

- [ ] 10. Add pagination and performance optimizations

  - Implement pagination controls for large contact lists
  - Add debounced search to reduce API calls
  - Optimize re-renders with React.memo where appropriate
  - _Requirements: 2.1, 4.1_

- [ ] 11. Create responsive mobile layout

  - Adapt ContactsList grid for mobile screens
  - Make ContactsStats cards stack on mobile
  - Ensure all modals work properly on mobile devices
  - _Requirements: 2.1, 5.1_

- [ ] 12. Add loading states and animations

  - Implement skeleton loading for all data fetching
  - Add smooth transitions for filtering and search
  - Create loading indicators for bulk operations
  - _Requirements: 2.4, 5.3_

- [ ] 13. Implement session persistence and recovery

  - Add session refresh logic for expired sessions
  - Create in-page login prompt instead of redirects
  - Handle session errors gracefully without breaking the UI
  - _Requirements: 8.1, 8.4_

- [ ] 14. Add comprehensive testing

  - Write unit tests for all new components
  - Create integration tests for API interactions
  - Add end-to-end tests for complete workflows
  - _Requirements: All requirements_

- [ ] 15. Final polish and accessibility
  - Add proper ARIA labels and keyboard navigation
  - Ensure color contrast meets accessibility standards
  - Test with screen readers and keyboard-only navigation
  - _Requirements: All requirements_
