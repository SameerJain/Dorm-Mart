import React, { useState, useEffect } from 'react';
import ItemCard from './components/ItemCard';
import './index.css';

function App() {
  const [items, setItems] = useState([]);

  // Sample data (later replace with API call)
  useEffect(() => {
    const sampleItems = [
      {
        id: 1,
        title: "Freedom on My Mind - 3rd Edition",
        price: 40,
        condition: "Used",
        seller: "Sameer J.",
        rating: 4.7,
        location: "North Campus",
        category: "Textbook",
        timePosted: "JUST POSTED",
        onSale: false
      },
      {
        id: 2,
        title: "Spatula",
        price: 15,
        condition: "Good Condition",
        seller: "Chris K.",
        rating: 5.0,
        location: "North Campus", 
        category: "Kitchen",
        timePosted: "2d ago",
        onSale: true
      },
      {
        id: 3,
        title: "Small Carpet",
        price: 10,
        condition: "Excellent Condition",
        seller: "Ajinkya A.",
        rating: 4.9,
        location: "South Campus",
        category: "Living Room",
        timePosted: "2d ago",
        onSale: true
      }
    ];
    setItems(sampleItems);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse Listings</h1>
        <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full mb-6 inline-block">
          Showing Recommended Categories
        </span>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

useEffect(() => {
  // Fetch data from PHP API
  fetch('http://localhost/dorm-mart-api/items.php')
    .then(response => response.json())
    .then(data => {
      setItems(data.items);
    })
    .catch(error => {
      console.error('Error fetching data:', error);
      // Fallback to sample data if API fails
      const sampleItems = [/* your sample data here */];
      setItems(sampleItems);
    });
}, []);

export default App;