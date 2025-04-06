import React, { useState, useEffect } from 'react';

export const TypeWriter = ({ text, speed = 30 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (speed === 0) {
      setDisplayedText(text);
      setIsComplete(true);
      return;
    }

    setDisplayedText('');
    setIsComplete(false);
    
    let currentIndex = 0;
    const textLength = text.length;

    const timer = setInterval(() => {
      setDisplayedText(text.slice(0, currentIndex + 1));
      currentIndex++;
      
      if (currentIndex >= textLength) {
        setIsComplete(true);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <pre className={`whitespace-pre-wrap ${!isComplete ? 'typing-cursor' : ''}`}>
      {displayedText.replace(/\\n\\n/g, '\n\n')}
    </pre>
  );
};
