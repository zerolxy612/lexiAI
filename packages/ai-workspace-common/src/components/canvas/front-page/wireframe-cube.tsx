import { memo, useEffect } from 'react';
// Define the black wireframe cube component
const WireframeCube = memo(
  ({
    size,
    top,
    left,
    right,
    bottom,
    delay = '0s',
    rotationDuration = '15s',
    moveDuration = '20s',
  }: {
    size: number;
    top?: string;
    left?: string;
    right?: string;
    bottom?: string;
    delay?: string;
    rotationDuration?: string;
    moveDuration?: string;
  }) => {
    return (
      <div
        className="absolute"
        style={{
          top,
          left,
          right,
          bottom,
          width: `${size}px`,
          height: `${size}px`,
          perspective: '600px',
          transformStyle: 'preserve-3d',
          animation: `move-position ${moveDuration} infinite alternate ease-in-out`,
          animationDelay: delay,
        }}
      >
        <div
          className="w-full h-full border-2 border-black bg-transparent rounded-sm"
          style={{
            transform: 'rotateX(45deg) rotateY(45deg)',
            animation: `rotate-cube ${rotationDuration} infinite linear`,
            boxShadow: '0 0 10px rgba(0, 0, 0, 0.2)',
          }}
        />
      </div>
    );
  },
);

WireframeCube.displayName = 'WireframeCube';

export const TechBackground = memo(() => {
  // Add animation keyframes to the document head when component mounts
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      @keyframes float {
        0% { transform: translate(0, 0); }
        25% { transform: translate(5px, 10px); }
        50% { transform: translate(-5px, 15px); }
        75% { transform: translate(-10px, 5px); }
        100% { transform: translate(0, 0); }
      }
      
      @keyframes rotate-cube {
        0% { transform: rotateX(0) rotateY(0); }
        100% { transform: rotateX(360deg) rotateY(360deg); }
      }
      
      @keyframes move-position {
        0% { transform: translate(0, 0); }
        25% { transform: translate(80px, 40px); }
        50% { transform: translate(20px, 100px); }
        75% { transform: translate(-50px, 30px); }
        100% { transform: translate(-80px, -50px); }
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Use regular style tag in head instead of dangerouslySetInnerHTML */}
      <div className="absolute top-0 left-0 w-full h-full bg-white" />

      {/* Wireframe black cubes that change position and rotate */}
      <WireframeCube
        size={60}
        top="10%"
        left="30%"
        delay="0s"
        rotationDuration="20s"
        moveDuration="25s"
      />
      <WireframeCube
        size={40}
        top="20%"
        right="15%"
        delay="5s"
        rotationDuration="25s"
        moveDuration="30s"
      />
      <WireframeCube
        size={30}
        bottom="15%"
        left="10%"
        delay="2s"
        rotationDuration="30s"
        moveDuration="35s"
      />
      <WireframeCube
        size={30}
        top="15%"
        right="30%"
        delay="8s"
        rotationDuration="18s"
        moveDuration="28s"
      />
      <WireframeCube
        size={50}
        bottom="30%"
        right="10%"
        delay="4s"
        rotationDuration="22s"
        moveDuration="32s"
      />

      <WireframeCube
        size={50}
        top="30%"
        left="5%"
        delay="4s"
        rotationDuration="26s"
        moveDuration="40s"
      />

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(21,94,239,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(21,94,239,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
    </div>
  );
});

TechBackground.displayName = 'TechBackground';
