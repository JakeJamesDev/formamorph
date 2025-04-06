import React from 'react';

const IndeterminateProgress = () => {
  return (
    <div className="relative w-full h-1">
      <div
        role="progressbar"
        aria-label="Loading..."
        aria-valuemin="0"
        aria-valuemax="1"
        className="absolute inset-0 overflow-hidden bg-gray-800"
      >
        <div 
          className="absolute top-0 bottom-0 left-0 w-1/3"
          style={{
            backgroundColor: 'rgb(178, 216, 216)',
            animation: 'indeterminate 1s infinite linear'
          }}
        />
      </div>
      <style>
        {`
          @keyframes indeterminate {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(400%);
            }
          }
        `}
      </style>
    </div>
  );
};

export default IndeterminateProgress;
