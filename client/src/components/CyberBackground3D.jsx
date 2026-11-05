/**
 * client/src/components/CyberBackground3D.jsx
 * Canvas element for Modern 3D Cyber Animated WebGL background
 */

import React, { useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function CyberBackground3D() {
  const { isModern } = useTheme();

  useEffect(() => {
    if (isModern && window.Portal3DBackground?.init) {
      // Small tick to ensure canvas is attached to DOM
      const timer = setTimeout(() => {
        window.Portal3DBackground.init();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isModern]);

  return (
    <canvas
      id="webgl-3d-bg"
      className="webgl-3d-canvas"
      aria-hidden="true"
      style={{ display: isModern ? 'block' : 'none' }}
    />
  );
}
