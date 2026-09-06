import { useEffect, useMemo } from "react";
import * as THREE from "three";

/**
 * La casa: dos plantas, tejado a dos aguas rojo, una fachada al sol y el
 * costado en sombra.
 *
 * Color plano a proposito, con el claroscuro pintado cara a cara. Proyectar
 * sombra no necesita material iluminado (el mapa de sombras solo usa
 * profundidad), asi que sigue arrojando su sombra sobre el prado.
 *
 * La CUMBRERA VA DE IZQUIERDA A DERECHA: en la foto lo que se ve de frente es
 * el faldon rojo, no el hastial.
 */
const CREAM = "#ded5c3";
const SHADE = "#33322f";
const ROOF = "#a63a26";
const ROOF_SHADE = "#7d2b1c";
const GLASS = "#2b2f36";

export default function House({
  width = 7,
  depth = 6,
  wallHeight = 6.2,
  roofHeight = 2.8,
}: {
  width?: number;
  depth?: number;
  wallHeight?: number;
  roofHeight?: number;
}) {
  // orden de caras de BoxGeometry: +x, -x, +y, -y, +z, -z
  const wallMats = useMemo(() => {
    const cream = new THREE.MeshBasicMaterial({ color: CREAM });
    const shade = new THREE.MeshBasicMaterial({ color: SHADE });
    return [cream, shade, cream, shade, cream, shade];
  }, []);

  /**
   * Tejado a mano y no con ExtrudeGeometry: aquel generaba el grupo de tapas
   * VACIO, o sea que los hastiales no existian y de frente se veia a traves.
   */
  const roof = useMemo(() => {
    const hx = width / 2 + 0.45;
    const hz = depth / 2 + 0.45;
    const h = roofHeight;

    const quad = (a: number[], b: number[], c: number[], d: number[]) => [
      ...a, ...b, ...c, ...a, ...c, ...d,
    ];

    // faldon delantero (+Z) y hastial derecho (+X): al sol
    const lit = [
      ...quad([-hx, 0, hz], [hx, 0, hz], [hx, h, 0], [-hx, h, 0]),
      ...[hx, 0, hz, hx, 0, -hz, hx, h, 0],
    ];
    // faldon trasero (-Z) y hastial izquierdo (-X): en sombra
    const shade = [
      ...quad([hx, 0, -hz], [-hx, 0, -hz], [-hx, h, 0], [hx, h, 0]),
      ...[-hx, 0, -hz, -hx, 0, hz, -hx, h, 0],
    ];

    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([...lit, ...shade], 3)
    );
    g.addGroup(0, lit.length / 3, 0);
    g.addGroup(lit.length / 3, shade.length / 3, 1);
    g.computeVertexNormals();
    return g;
  }, [width, depth, roofHeight]);

  const roofMats = useMemo(
    () => [
      // DoubleSide: el tejado se mira desde fuera y desde dentro al
      // atravesarlo, y asi el sentido de giro de las caras no puede ocultarlo
      new THREE.MeshBasicMaterial({ color: ROOF, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ color: ROOF_SHADE, side: THREE.DoubleSide }),
    ],
    []
  );

  const windows = useMemo(() => {
    const out: [number, number][] = [];
    for (const y of [wallHeight * 0.68, wallHeight * 0.24]) {
      for (const x of [-width * 0.19, width * 0.19]) out.push([x, y]);
    }
    return out;
  }, [width, wallHeight]);

  useEffect(
    () => () => {
      [...wallMats, ...roofMats].forEach((m) => m.dispose());
      roof.dispose();
    },
    [wallMats, roofMats, roof]
  );

  return (
    <group>
      <mesh position={[0, wallHeight / 2, 0]} material={wallMats} castShadow>
        <boxGeometry args={[width, wallHeight, depth]} />
      </mesh>

      <mesh geometry={roof} material={roofMats} position={[0, wallHeight, 0]} castShadow />

      {/* ventanas: laminas finas justo delante de la fachada */}
      {windows.map(([x, y], i) => (
        <mesh key={i} position={[x, y, depth / 2 + 0.02]}>
          <planeGeometry args={[0.95, 1.25]} />
          <meshBasicMaterial color={GLASS} />
        </mesh>
      ))}

      {/* chimenea */}
      <mesh
        position={[width * 0.1, wallHeight + roofHeight * 0.75, 0]}
        castShadow
      >
        <boxGeometry args={[0.55, 1.9, 0.55]} />
        <meshBasicMaterial color="#8a8378" />
      </mesh>
    </group>
  );
}
