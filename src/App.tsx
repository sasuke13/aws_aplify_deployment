import React from 'react';
import './App.css';
import InterviewClient from './components/InterviewClient';

function App() {
  // You can get this token from your authentication system
  const accessToken = process.env.REACT_APP_ACCESS_TOKEN || localStorage.getItem('accessToken');

  return (
    <div className="App">
      <InterviewClient accessToken={accessToken} />
    </div>
  );
}

export default App;
