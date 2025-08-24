// Test script to reproduce the JavaScript ReferenceError in simple campaigns
console.log('=== SIMPLE CAMPAIGN ERROR REPRODUCTION TEST ===');

// Step 1: Simulate the exact scenario that triggers the error
console.log('Step 1: Testing template variable processing');

// Reproduce the getPreviewContent function exactly
function getPreviewContent(editorContent) {
    if (!editorContent) return '';
    
    let previewContent = editorContent;
    
    const replacements = [
        // HTML entity encoded variables (from templates)
        { pattern: /&#123;&#123;\s*first_name\s*&#125;&#125;/g, value: 'John' },
        { pattern: /&#123;&#123;\s*last_name\s*&#125;&#125;/g, value: 'Smith' },
        { pattern: /&#123;&#123;\s*email\s*&#125;&#125;/g, value: 'john.smith@example.com' },
        { pattern: /&#123;&#123;\s*company\s*&#125;&#125;/g, value: 'Acme Corp' },
        { pattern: /&#123;&#123;\s*sender_name\s*&#125;&#125;/g, value: 'Your Name' },
        { pattern: /&#123;&#123;\s*company_name\s*&#125;&#125;/g, value: 'Your Company' },
        
        // Regular curly braces (user input)
        { pattern: /\{\{\s*first_name\s*\}\}/g, value: 'John' },
        { pattern: /\{\{\s*last_name\s*\}\}/g, value: 'Smith' },
        { pattern: /\{\{\s*email\s*\}\}/g, value: 'john.smith@example.com' },
        { pattern: /\{\{\s*company\s*\}\}/g, value: 'Acme Corp' },
        { pattern: /\{\{\s*sender_name\s*\}\}/g, value: 'Your Name' },
        { pattern: /\{\{\s*company_name\s*\}\}/g, value: 'Your Company' }
    ];
    
    // Apply all replacements safely
    replacements.forEach(({ pattern, value }) => {
        previewContent = previewContent.replace(pattern, value);
    });
    
    // Sanitize any remaining template variables to prevent JavaScript execution
    previewContent = previewContent.replace(/\{\{\s*[^}]*\s*\}\}/g, '[VARIABLE]');
    previewContent = previewContent.replace(/&#123;&#123;\s*[^}]*\s*&#125;&#125;/g, '[VARIABLE]');
    
    return previewContent;
}

// Step 2: Test scenarios that user might encounter
const testScenarios = [
    {
        name: "User's Basic Template",
        content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Hello &#123;&#123;first_name&#125;&#125;,</h1><p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">I hope this email finds you well. I wanted to reach out because...</p></div>`
    },
    {
        name: "User Types Variables Manually",
        content: `<p>Hello {{first_name}}, welcome to {{company}}!</p>`
    },
    {
        name: "POTENTIAL ERROR CASE: User types single braces",
        content: `<p>Hello {first_name}, welcome to {company}!</p>`
    },
    {
        name: "Mixed content that might cause issues",
        content: `<p>Hello {{first_name}} and {last_name} from {company}!</p>`
    }
];

let errorDetected = false;

// Step 3: Process each scenario
testScenarios.forEach((scenario, index) => {
    console.log(`\n--- Testing Scenario ${index + 1}: ${scenario.name} ---`);
    console.log('Original:', scenario.content);
    
    try {
        const processed = getPreviewContent(scenario.content);
        console.log('Processed:', processed);
        
        // Check for dangerous patterns
        if (processed.includes('{first_name}') || processed.includes('{company}') || processed.includes('{last_name}')) {
            console.warn('⚠️ DANGER: Found unprocessed single-brace variables!');
            console.warn('These could cause JavaScript ReferenceError if rendered by React');
            errorDetected = true;
        }
        
        // Simulate what happens when this gets to dangerouslySetInnerHTML
        const testDiv = document.createElement('div');
        testDiv.innerHTML = processed;
        console.log('✅ HTML rendering successful');
        
    } catch (error) {
        console.error('❌ Error processing scenario:', error);
        errorDetected = true;
    }
});

// Step 4: Test the exact sequence a user would follow
console.log('\n=== STEP-BY-STEP USER WORKFLOW SIMULATION ===');

// User creates a campaign
console.log('1. User creates new simple campaign');

// User selects a contact list with "first_name" data
console.log('2. User selects contact list with contacts containing first_name field');

// User clicks "Basic Template" button
console.log('3. User clicks Basic Template button');
const basicTemplate = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Hello &#123;&#123;first_name&#125;&#125;,</h1><p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">I hope this email finds you well. I wanted to reach out because...</p><p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">[Your message content here]</p><div style="margin: 30px 0;"><a href="#" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Call to Action</a></div><p style="color: #555; font-size: 16px; line-height: 1.6;">Best regards,<br>&#123;&#123;sender_name&#125;&#125;</p></div>`;

// User switches to preview mode
console.log('4. User switches to Preview mode');
try {
    const previewContent = getPreviewContent(basicTemplate);
    console.log('Preview content generated:', previewContent.substring(0, 100) + '...');
    
    // This is where the error might occur - when React renders it
    console.log('5. React renders preview using dangerouslySetInnerHTML');
    
    // Check if there are any unprocessed single braces
    if (previewContent.includes('{') && previewContent.includes('}')) {
        const singleBraceMatches = previewContent.match(/\{[^}]*\}/g);
        if (singleBraceMatches) {
            console.error('🚨 FOUND THE PROBLEM!');
            console.error('Unprocessed single braces found:', singleBraceMatches);
            console.error('These will cause React to treat them as JSX expressions!');
            console.error('This is why the user sees: "Can\'t find variable: first_name"');
            errorDetected = true;
        }
    }
    
} catch (error) {
    console.error('❌ Error in preview generation:', error);
    errorDetected = true;
}

// Summary
console.log('\n=== ANALYSIS COMPLETE ===');
if (errorDetected) {
    console.log('🚨 ERROR PATTERN IDENTIFIED:');
    console.log('- Template variables with single braces {variable} are not being processed');
    console.log('- React interprets {variable} as JSX expressions');
    console.log('- JavaScript engine throws ReferenceError when variable doesn\'t exist');
    console.log('- Solution: Ensure all single braces are converted to safe text');
} else {
    console.log('✅ No error patterns detected in template processing');
    console.log('The issue might be elsewhere in the workflow');
}

console.log('\n=== POTENTIAL FIXES ===');
console.log('1. Enhanced sanitization in getPreviewContent()');
console.log('2. Pre-process all content to escape single braces');
console.log('3. Add validation to prevent single-brace variables');
console.log('4. Use textContent instead of innerHTML where possible');