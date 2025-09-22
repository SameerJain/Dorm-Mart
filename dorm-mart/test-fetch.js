// Simple test to verify fetch capability
const testFetch = async () => {
  console.log('🚀 Testing fetch capability...');
  
  try {
    // Test with a public API
    const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data = await response.json();
    console.log('✅ Fetch works! Sample data:', data.title);
  } catch (error) {
    console.log('❌ Fetch failed:', error.message);
  }
};

testFetch();