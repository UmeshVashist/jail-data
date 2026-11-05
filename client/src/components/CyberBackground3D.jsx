/**
 * client/src/components/CyberBackground3D.jsx
 * Canvas element for Modern 3D Cyber Animated WebGL background
 */

import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function CyberBackground3D() {
  const { isModern } = useTheme();

  return (
    <canvas
      id="webgl-3d-bg"
      className="webgl-3d-canvas"
      aria-hidden="true"
      style={{ display: isModern ? 'block' : 'none' }}
    />
  );
}

