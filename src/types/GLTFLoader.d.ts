declare module 'three/examples/jsm/loaders/GLTFLoader' {
    import { Loader, LoadingManager, Group, AnimationClip, Camera } from 'three';
  
    export class GLTFLoader extends Loader {
      constructor(manager?: LoadingManager);
      load(
        url: string,
        onLoad: (gltf: GLTF) => void,
        onProgress?: (event: ProgressEvent<EventTarget>) => void,
        onError?: (event: ErrorEvent) => void
      ): void;
      parse(
        data: ArrayBuffer | string,
        path: string,
        onLoad: (gltf: GLTF) => void
      ): void;
    }
  
    export interface GLTF {
      scene: Group;                // La escena principal del archivo GLTF
      scenes: Group[];              // Otras escenas posibles
      animations: AnimationClip[];  // Clips de animación
      cameras: Camera[];            // Cámaras definidas en el modelo
      asset: {                     // Información sobre el archivo
        version: string;
        generator: string;
      };
    }
  }
  
  