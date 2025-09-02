import React from 'react';

export type Theme = 'light' | 'dark';

type SkeletonProps = {
  theme: Theme;
  className?: string;
};

/**
 * Generic skeleton block. Use width/height via className.
 * Example: <Skeleton theme={theme} className="h-4 w-24" />
 */
export const Skeleton: React.FC<SkeletonProps> = ({ theme, className = '' }) => {
  return (
    <div
      className={`animate-pulse rounded-sm ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'} ${className}`}
    />
  );
};

/**
 * Slightly lighter/darker variant for text-like skeletons.
 * Example: <SkeletonText theme={theme} className="h-3 w-16" />
 */
export const SkeletonText: React.FC<SkeletonProps> = ({ theme, className = '' }) => {
  return (
    <div
      className={`animate-pulse rounded-sm ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'} ${className}`}
    />
  );
};
