import {useState, useEffect} from 'react'

export default function DbTestPage() {
  const [data, setData] = useState(null);
  const BASE = process.env.REACT_APP_API_BASE

  useEffect(() => {
    fetch(`${BASE}/db_test.php`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ success: false, message: "Request failed" }));
  }, []); // no warning now

  if (!data) return <p>Loading...</p>;
  return (
    <div>
      <h3>{data.success ? "✅ Success" : "❌ Failed"}</h3>
      <p>{data.message}</p>
    </div>
  );
}