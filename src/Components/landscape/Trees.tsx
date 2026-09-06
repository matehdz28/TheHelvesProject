import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PALETTE, REVEAL_GLSL, type RevealUniforms } from "./reveal";

/**
 * Arboles instanciados. Dos InstancedMesh (tronco y copa) que COMPARTEN el
 * mismo array de matrices: las dos geometrias estan autoradas en el mismo
 * "espacio de arbol unitario" (base en y=0, punta en y~1.3), asi que una
 * sola matriz de instancia coloca y escala ambas piezas de forma coherente.
 * Eso evita tener que fusionar geometrias.
 *
 * No se registran como colisionables: raycastear 600 instancias por frame
 * costaria mas de lo que aporta. Se atraviesan.
 */

// PRNG deterministico: el bosque es el mismo en cada carga
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inyecta el frente de onda en un material estandar. */
function patchReveal(mat: THREE.Material, uniforms: RevealUniforms) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = `varying vec3 vWP;\n${REVEAL_GLSL}\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      /* glsl */ `
      #include <begin_vertex>

      // columna de traslacion de la instancia = posicion del arbol
      vec3 iOrigin = vec3(0.0);
      #ifdef USE_INSTANCING
        iOrigin = instanceMatrix[3].xyz;
      #endif
      vWP = iOrigin;

      // crece desde la base cuando el frente lo alcanza
      float grow = revealAt(iOrigin);
      grow = grow * grow * (3.0 - 2.0 * grow);
      transformed *= grow;

      // viento: desfasado por posicion para que no ondulen en bloque
      float phase = iOrigin.x * 0.7 + iOrigin.z * 0.5;
      transformed.x += sin(uTime * 1.1 + phase) * 0.03 * transformed.y;
      transformed.z += cos(uTime * 0.9 + phase) * 0.02 * transformed.y;
      `
    );

    shader.fragmentShader = `varying vec3 vWP;\n${REVEAL_GLSL}\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      /* glsl */ `
      #include <color_fragment>
      // el arbol entero vira de blanco a su color como una sola unidad
      diffuseColor.rgb = mix(vec3(1.0), diffuseColor.rgb, revealAt(vWP));
      `
    );
  };
  mat.needsUpdate = true;
}

export default function Trees({
  uniforms,
  count = 620,
  innerRadius = 11,
  outerRadius = 290,
  seed = 20260822,
}: {
  uniforms: RevealUniforms;
  count?: number;
  innerRadius?: number;
  outerRadius?: number;
  seed?: number;
}) {
  const trunk = useRef<THREE.InstancedMesh>(null!);
  const canopy = useRef<THREE.InstancedMesh>(null!);

  const matrices = useMemo(() => {
    const rnd = mulberry32(seed);
    const out: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      // sqrt para densidad uniforme por area, no apelotonada en el centro
      const r = Math.sqrt(rnd()) * (outerRadius - innerRadius) + innerRadius;
      const a = rnd() * Math.PI * 2;
      const s = 2.4 + rnd() * 3.6;

      pos.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
      scl.set(s * (0.85 + rnd() * 0.3), s, s * (0.85 + rnd() * 0.3));

      out.push(m.clone().compose(pos, q, scl));
    }
    return out;
  }, [count, innerRadius, outerRadius, seed]);

  const trunkMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#5b4a3a", roughness: 0.95 });
    patchReveal(m, uniforms);
    return m;
  }, [uniforms]);

  const canopyMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: PALETTE.tree, roughness: 0.9, flatShading: true });
    patchReveal(m, uniforms);
    return m;
  }, [uniforms]);

  useEffect(() => {
    for (const mesh of [trunk.current, canopy.current]) {
      if (!mesh) continue;
      matrices.forEach((mx, i) => mesh.setMatrixAt(i, mx));
      mesh.instanceMatrix.needsUpdate = true;
      // el viento y el crecimiento mueven vertices fuera del bounding original
      mesh.frustumCulled = false;
    }
  }, [matrices]);

  // construidas una sola vez: `translate` muta la geometria, y aplicarla
  // dos veces dejaria los arboles flotando sobre el suelo
  const trunkGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.022, 0.038, 0.7, 6);
    g.translate(0, 0.35, 0); // base en y=0, punta en y=0.7
    return g;
  }, []);

  const canopyGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.26, 0.75, 7);
    g.translate(0, 0.92, 0); // y = 0.545 .. 1.295
    return g;
  }, []);

  useEffect(
    () => () => {
      trunkMat.dispose();
      canopyMat.dispose();
      trunkGeo.dispose();
      canopyGeo.dispose();
    },
    [trunkMat, canopyMat, trunkGeo, canopyGeo]
  );

  return (
    <group>
      <instancedMesh ref={trunk} args={[trunkGeo, trunkMat, matrices.length]} />
      <instancedMesh ref={canopy} args={[canopyGeo, canopyMat, matrices.length]} />
    </group>
  );
}
