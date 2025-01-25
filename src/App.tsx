import React from 'react';
import './App.css';
import InterviewClient from './components/InterviewClient';

function App() {
  // Convert null to undefined if token doesn't exist
  const accessToken = process.env.REACT_APP_ACCESS_TOKEN || localStorage.getItem('accessToken') || undefined;

  return (
    <div className="App">
      <InterviewClient accessToken={accessToken} />
    </div>
  );
}

export default App;
