import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import "@getpara/react-sdk/styles.css";
// Create root only once and store reference
const container = document.getElementById('root')!;
let root: ReactDOM.Root;

// Check if root already exists to prevent double creation
if (!(container as any)._reactRoot) {
  root = ReactDOM.createRoot(container);
  (container as any)._reactRoot = root;
} else {
  root = (container as any)._reactRoot;
}

// Render without StrictMode to prevent double mounting issues with Para
root.render(<App />);