import React, { useState, useEffect } from 'react';

export default function EventImage({ src, alt, className, style, aspectRatio, containerStyle = {} }) {
  const [error, setError] = useState(false);

  // Reset error state whenever src changes so a new URL is always attempted
  useEffect(() => {
    setError(false);
  }, [src]);

  const mergedContainerStyle = {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...(aspectRatio ? { aspectRatio } : {}),
    ...containerStyle
  };

  const renderPlaceholder = () => {
    const isSquare = aspectRatio === '1/1';
    return (
      <div style={{
        ...mergedContainerStyle,
        background: 'linear-gradient(135deg, var(--brand-primary) 0%, #3d7a6e 100%)',
        color: 'rgba(255, 255, 255, 0.5)'
      }}>
        <svg 
          width={isSquare ? '64' : '48'} 
          height={isSquare ? '64' : '48'} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.5"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </div>
    );
  };

  let normalizedSrc = src;
  if (src && !src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) {
    normalizedSrc = `/${src}`;
  }

  if (!normalizedSrc || error) {
    return renderPlaceholder();
  }

  return (
    <div style={mergedContainerStyle}>
      <img
        src={normalizedSrc}
        alt={alt}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          ...style
        }}
        onError={() => setError(true)}
      />
    </div>
  );
}
