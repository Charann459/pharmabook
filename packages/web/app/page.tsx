'use client';

import { useEffect, useState } from 'react';

export default function HomePage() {
  const [backendStatus, setBackendStatus] = useState<string>('Checking connection...');

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    fetch(`${API_URL}/health`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setBackendStatus(JSON.stringify(data, null, 2));
      })
      .catch((err) => {
        setBackendStatus('Error connecting to backend: ' + err.message);
      });
  }, []);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Welcome to PharmaBook Web</h1>
      <p>The frontend application is successfully running on port 3003!</p>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
        <h2>Backend API Status</h2>
        <pre style={{ margin: 0 }}>{backendStatus}</pre>
      </div>
    </main>
  );
}