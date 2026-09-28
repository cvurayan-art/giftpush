import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/src/tailwind.css';
import WorksWheelDemo from '@/components/ui/works-wheel-demo';

const container = document.getElementById('works-wheel-root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <WorksWheelDemo />
    </React.StrictMode>
  );
}
