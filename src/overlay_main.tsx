import React from 'react';
import ReactDOM from 'react-dom/client';
import { Overlay } from './components/Overlay';
import { WalkthroughPanel } from './components/WalkthroughPanel';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Overlay />
    <WalkthroughPanel />
  </React.StrictMode>
);
