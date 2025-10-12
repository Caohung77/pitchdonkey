# Custom Personas Guide

## Overview
Create fully customized AI personas with your own role definitions, responsibilities, and communication styles. Perfect for specialized roles like Technical Writer, Product Manager, HR Specialist, or any unique position in your organization.

---

## What is a Custom Persona?

A Custom Persona lets you define **your own employee role** rather than choosing from pre-built templates. You specify:

- **Role Name**: What the persona is (e.g., "Technical Writer", "Product Manager")
- **Role Description**: What they do
- **Responsibilities**: Key duties and tasks
- **Communication Guidelines**: How they should interact
- **Example Interactions**: Sample conversations showing their style

---

## Creating a Custom Persona

### Step 1: Choose Custom Type

When creating a new persona, select **"Custom"** as the persona type.

### Step 2: Define the Role

```typescript
{
  custom_persona_name: "Technical Writer",
  custom_persona_description: "Create clear, comprehensive documentation for technical products",
  custom_role_definition: "A technical writer specializing in developer documentation, API references, and user guides.",
  custom_responsibilities: [
    "Write and maintain API documentation",
    "Create user guides and tutorials",
    "Develop code examples",
    "Review technical content for accuracy"
  ],
  custom_communication_guidelines: "Use clear, concise language. Break down complex topics. Include practical examples.",
  custom_example_interactions: [
    {
      scenario: "User asks about API",
      userInput: "How do I authenticate?",
      expectedResponse: "Here's a step-by-step guide with code examples...",
      notes: "Always provide code examples"
    }
  ]
}
```

### Step 3: Configure Personality

Even with custom roles, you still configure the 6 personality dimensions:
- Communication style
- Response length
- Empathy level
- Formality
- Expertise depth
- Proactivity

---

## Example Custom Personas

### Technical Writer
**Best for**: Documentation, API guides, technical content
```yaml
Name: Technical Documentation Specialist
Role: Create developer-focused documentation
Personality:
  - Communication: Direct
  - Response Length: Detailed
  - Empathy: Moderate
  - Formality: Professional
  - Expertise: Expert
  - Proactivity: Proactive
```

**Sample Interaction**:
```
User: How do I use your API?

Persona: Great question! Let me walk you through the authentication process step by step.

1. First, register your application at dashboard.yourapp.com/apps
2. You'll receive a client_id and client_secret
3. Make a POST request to /oauth/token

Here's a code example:
\```javascript
const response = await fetch('https://api.yourapp.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: 'your_client_id',
    client_secret: 'your_secret',
    grant_type: 'client_credentials'
  })
});
\```

Need help with any specific step?
```

### Product Manager
**Best for**: Feature prioritization, roadmap planning, stakeholder communication
```yaml
Name: Product Strategy Lead
Role: Guide product vision and prioritization
Personality:
  - Communication: Consultative
  - Response Length: Balanced
  - Empathy: High
  - Formality: Professional
  - Expertise: Advanced
  - Proactivity: Very Proactive
```

**Sample Interaction**:
```
User: We have 10 feature requests. Which should we build?

Persona: Let's prioritize based on impact and effort. First, I need to understand:

1. What user pain point does each feature solve?
2. How many users are affected?
3. Does it align with our Q4 OKRs?

From the recent user survey, I saw 60% of users requesting better export functionality. That's showing strong signal. Can you share the full list so we can score them using our RICE framework?
```

### HR Specialist
**Best for**: Employee support, policy guidance, benefits questions
```yaml
Name: People Operations Specialist
Role: Support employees with HR matters
Personality:
  - Communication: Empathetic
  - Response Length: Balanced
  - Empathy: Very High
  - Formality: Professional
  - Expertise: Advanced
  - Proactivity: Proactive
```

**Sample Interaction**:
```
User: I'm expecting a baby in 3 months. What leave am I entitled to?

Persona: Congratulations on your growing family! 🎉

I'm happy to help you understand your leave options. You're entitled to:

📋 **Leave Benefits:**
- 12 weeks paid parental leave
- Additional unpaid FMLA leave if needed
- Flexible return-to-work schedule options

Let's schedule a call to discuss your specific situation, timeline, and any questions. I want to make sure you feel fully supported during this exciting time.

Would next week work for a 30-minute conversation?
```

---

## How Custom Personas Work

### AI Prompt Generation

When you create a custom persona, the system builds a specialized AI prompt:

```
You are [Name], a [Custom Role Name].

Role Description:
[Your description]

Detailed Role Definition:
[Your detailed definition]

Your Key Responsibilities:
1. [Responsibility 1]
2. [Responsibility 2]
3. [Responsibility 3]

Communication Guidelines:
[Your guidelines]

Example Interactions:
[Your examples showing expected behavior]

Personality & Style:
[Generated from your personality trait selections]

Core Guidelines:
- Stay in character at all times
- Apply personality traits consistently
- Be helpful and authentic
- Acknowledge when you don't know something
```

### Testing Your Custom Persona

After creating a custom persona, test it by:

1. **Chat Testing**: Have a conversation to verify personality
2. **Email Testing**: Send a test email to see responses
3. **Edge Cases**: Test with unusual or challenging scenarios
4. **Refinement**: Adjust guidelines and examples based on results

---

## API Usage

### Create Custom Persona

```typescript
POST /api/ai-personas

{
  "name": "Alex the Technical Writer",
  "persona_type": "custom",
  "custom_persona_name": "Technical Documentation Specialist",
  "custom_persona_description": "Create clear, comprehensive technical documentation",
  "custom_role_definition": "A technical writer who specializes in developer-focused content, API documentation, and user guides. Expert at translating complex concepts into accessible language.",
  "custom_responsibilities": [
    "Write and maintain API reference documentation",
    "Create step-by-step user guides and tutorials",
    "Develop code examples and samples",
    "Review technical content for accuracy and clarity",
    "Collaborate with engineering teams on documentation"
  ],
  "custom_communication_guidelines": "Use clear, concise language. Break complex topics into digestible sections. Always include practical code examples. Anticipate common questions. Focus on helping users succeed.",
  "custom_example_interactions": [
    {
      "scenario": "User asks about API authentication",
      "userInput": "How do I authenticate with your API?",
      "expectedResponse": "Great question! Our API uses OAuth 2.0...",
      "notes": "Always provide step-by-step instructions with code examples"
    }
  ],
  "personality_traits": {
    "communication_style": "direct",
    "response_length": "detailed",
    "empathy_level": "moderate",
    "formality": "professional",
    "expertise_depth": "expert",
    "proactivity": "proactive"
  },
  "status": "active",
  "chat_enabled": true
}
```

### Chat with Custom Persona

```typescript
POST /api/ai-personas/{personaId}/chat

{
  "message": "How do I set up OAuth for your API?"
}

// Response will follow custom guidelines and personality
```

---

## Personality Templates

Save your custom persona definitions as reusable templates:

### Save Template

```typescript
// Using custom-persona-builder library
import { savePersonalityTemplate } from '@/lib/custom-persona-builder'

const template = {
  name: "Technical Writer Template",
  description: "For developer-focused documentation",
  personaType: "custom",
  personalityTraits: { /* ... */ },
  customRoleDefinition: "...",
  customResponsibilities: ["..."],
  customCommunicationGuidelines: "...",
  isPublic: false  // Keep private or share with team
}

await savePersonalityTemplate(supabase, userId, template)
```

### Use Template

```typescript
// Load templates
const templates = await listPersonalityTemplates(supabase, userId, true)

// Apply template when creating new persona
const techWriterTemplate = templates.find(t => t.name === "Technical Writer Template")
```

---

## Best Practices

### 1. Be Specific

**Bad**: "Helps customers"
**Good**: "Resolves technical issues by providing step-by-step troubleshooting guides, code examples, and workarounds"

### 2. Provide Examples

Include 2-3 example interactions showing exactly how the persona should respond. The AI learns from these examples.

### 3. Define Communication Style

**Bad**: "Be helpful"
**Good**: "Use bullet points for clarity. Start with empathy. Provide code examples. Ask clarifying questions. End with next steps."

### 4. List Responsibilities Clearly

```
✓ "Write API documentation"
✓ "Review pull requests for technical accuracy"
✓ "Create code examples in multiple languages"
✓ "Maintain changelog and migration guides"

✗ "Do documentation stuff"
✗ "Help with writing"
```

### 5. Test and Iterate

1. Create initial version
2. Test with real scenarios
3. Review responses
4. Refine guidelines and examples
5. Test again

---

## Use Cases

### Internal Tools
- **IT Support Specialist**: Help desk automation
- **HR Administrator**: Benefits and policy questions
- **Finance Assistant**: Expense approval and reimbursement
- **Legal Advisor**: Contract questions and compliance

### Customer-Facing
- **Community Manager**: Forum moderation and engagement
- **Solutions Engineer**: Technical pre-sales support
- **Implementation Specialist**: Onboarding and setup guidance
- **Training Coordinator**: Educational content and workshops

### Specialized Roles
- **Data Analyst**: SQL queries and dashboard interpretation
- **Security Analyst**: Vulnerability assessment and remediation
- **DevOps Engineer**: CI/CD and infrastructure questions
- **UX Researcher**: User feedback analysis and insights

---

## Limitations

1. **Knowledge Boundaries**: Personas don't have access to private data unless provided
2. **Complex Decisions**: Best for guidance, not autonomous decision-making
3. **Verification**: Always verify critical information
4. **Updates**: Update guidelines as your needs evolve

---

## Troubleshooting

### Persona Not Responding as Expected

**Problem**: Responses don't match guidelines
**Solution**:
- Add more specific examples
- Refine communication guidelines
- Adjust personality traits
- Test with different scenarios

### Too Generic Responses

**Problem**: Responses lack specific knowledge
**Solution**:
- Add detailed role definition
- Include domain-specific terminology
- Provide more example interactions
- Add knowledge base items

### Inconsistent Behavior

**Problem**: Sometimes follows guidelines, sometimes doesn't
**Solution**:
- Make guidelines more explicit
- Remove conflicting instructions
- Add "always" and "never" rules
- Increase example interactions

---

## Migration from Standard Personas

Convert existing personas to custom:

```typescript
// Get existing persona
const persona = await getAIPersona(supabase, userId, personaId)

// Update to custom type
await updateAIPersona(supabase, userId, personaId, {
  persona_type: 'custom',
  custom_persona_name: 'My Custom Role',
  custom_persona_description: persona.purpose,
  custom_role_definition: '...',
  custom_responsibilities: ['...'],
  custom_communication_guidelines: persona.custom_prompt,
  custom_example_interactions: []
})
```

---

## Examples Library

Pre-built examples available in code:

```typescript
import { getCustomPersonaExamples } from '@/lib/custom-persona-builder'

const examples = getCustomPersonaExamples()
// Returns: Technical Writer, Product Manager, HR Specialist
```

Use these as starting points for your own custom personas!

---

**Version**: v0.23.1
**Last Updated**: October 12, 2025
