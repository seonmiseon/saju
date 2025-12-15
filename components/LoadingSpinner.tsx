import React from 'react';

const LoadingSpinner: React.FC<{ message?: string }> = ({ message = "도사님이 만세력을 짚어보고 계십니다..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-6">
      <div className="relative w-24 h-24">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-oriental-gold border-opacity-20 rounded-full animate-pulse"></div>
        <div className="absolute top-0 left-0 w-full h-full border-t-4 border-oriental-red rounded-full animate-spin"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl">
          🧧
        </div>
      </div>
      <p className="text-oriental-black font-serif text-lg animate-pulse">{message}</p>
    </div>
  );
};

export default LoadingSpinner;