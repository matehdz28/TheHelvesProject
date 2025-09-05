import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { MovementController } from '../../controllers/MovementController';
import { MouseLookController } from '../../controllers/MouseLookController';

interface ParticlesProps {
  count: number;
}

const Particles: React.FC<ParticlesProps> = ({ count }) => {
  const points = useRef<THREE.Points>(null!);
  const positions = useRef<Float32Array>(new Float32Array(count * 3));

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 50;
    const y = (Math.random() - 0.5) * 50;
    const z = (Math.random() - 0.5) * 50;
    
    positions.current.set([x, y, z], i * 3);
  }

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const pos = positions.current;

    for (let i = 0; i < count; i++) {
      const index = i * 3;
      pos[index] += Math.sin(time + i * 0.01) * 0.001;  
      pos[index + 1] += Math.cos(time + i * 0.01) * 0.001;  
      pos[index + 2] += Math.sin(time + i * 0.01) * 0.001;  
    }

    if (points.current) {
      points.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions.current}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.05} />
    </points>
  );
};

const BackgroundSquare: React.FC<{ texturePath: string, position: [number, number, number], size: [number, number], opacity?: number }> = ({ texturePath, position, size, opacity = 0.7 }) => {
  const texture = useLoader(THREE.TextureLoader, texturePath);

  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} transparent={true} opacity={opacity} />
    </mesh>
  );
};

const WhiteSquare: React.FC = () => {
  return (
    <mesh position={[0, 0, -15]}>
      <planeGeometry args={[8, 6]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  );
};

const WhiteSquare2: React.FC = () => {
  return (
    <mesh position={[0, 0, -15]}>
      <planeGeometry args={[10, 8]} />
      <meshBasicMaterial color="#ffffff" transparent={true} opacity={0.1} />
    </mesh>
  );
};

export const Room1: React.FC = () => {
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pivotRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const collidableMeshes = useRef<THREE.Mesh[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
      const requestPointerLock = () => {
        document.body.requestPointerLock();
      };
  
      document.addEventListener("click", requestPointerLock);
  
      return () => {
        document.removeEventListener("click", requestPointerLock);
      };
    }, []);
  
    useEffect(() => {
      if (cameraRef.current && collidableMeshes.current.length > 0) {
        setIsReady(true);
      }
    }, [collidableMeshes.current.length]);
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000000' }}>
      <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
        <WhiteSquare />
        <WhiteSquare2 />

        <BackgroundSquare texturePath="/noise4.png" position={[4, -2, -14]} size={[5, 5]} />
        <BackgroundSquare texturePath="/noise4.png" position={[0, 0, -14]} size={[2, 3]} />
        <BackgroundSquare texturePath="/noise1.png" position={[0, 0, -5]} size={[32, 18]} />
        <BackgroundSquare texturePath="/noise2.png" position={[-10, 5, -2]} size={[16, 13]} />
        <BackgroundSquare texturePath="/noise2.png" position={[-10, 0, -2]} size={[16, 13]} />
        <BackgroundSquare texturePath="/noise2.png" position={[-10, -5, -2]} size={[16, 13]} />
        <BackgroundSquare texturePath="/noise2.png" position={[15, -5, -2]} size={[16, 13]} />
        <BackgroundSquare texturePath="/noise2.png" position={[15, 0, -2]} size={[16, 13]} />
        <BackgroundSquare texturePath="/noise2.png" position={[15, 5, -2]} size={[16, 13]} />
        <BackgroundSquare texturePath="/noise3.png" position={[0, 0, -2]} size={[40, 30]} />

        <Particles count={15000} />
        {isReady && cameraRef.current && pivotRef.current && (
                  <>
                    <MovementController
                      camera={cameraRef.current}
                      collidableMeshes={collidableMeshes}
                      pivot={pivotRef.current}
                    />
                    <MouseLookController
                      camera={cameraRef.current}
                      pivot={pivotRef.current}
                    />
                  </>
                )}
      </Canvas>
    </div>
  );
}


