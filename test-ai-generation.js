// Simple test script to verify AI generation workflow
// Run with: node test-ai-generation.js

const testAIGeneration = async () => {
  const testData = {
    purpose: "Introduce our new productivity software that helps companies streamline their workflow",
    language: "English",
    signature: "Best regards,\nYour Team",
    tone: "professional",
    length: "medium",
    use_enrichment: false
  };

  console.log("🧪 Testing AI Generation Workflow");
  console.log("📊 Test Data:", testData);
  
  try {
    const response = await fetch('http://localhost:3001/api/ai/generate-outreach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This will fail without proper auth, but we can see the structure
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    console.log("📋 Response Status:", response.status);
    console.log("📋 Response Structure:", {
      success: result.success,
      hasData: !!result.data,
      dataKeys: result.data ? Object.keys(result.data) : [],
      error: result.error
    });
    
    if (result.data) {
      console.log("✅ Subject:", result.data.subject);
      console.log("✅ Content Length:", result.data.htmlContent?.length || 0);
      console.log("✅ Has Personalization:", !!result.data.personalization);
    }
    
  } catch (error) {
    console.error("❌ Test Error:", error.message);
  }
};

// Run the test
testAIGeneration();