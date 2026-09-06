import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

export default function PortalBridge({
  portalWorldMatrix,
  size = [20, 30],
  onUpdateClip,
  setCamBFromA,
  onCrossFrontToBack,
  pivotA,
}: {
  portalWorldMatrix: THREE.Matrix4;
  size?: [number, number];
  onUpdateClip: (clip: string | null) => void;
  setCamBFromA: (m: THREE.Matrix4) => void;
  onCrossFrontToBack: () => void;
  pivotA: THREE.Object3D;
}) {
  const { camera, size: viewport } = useThree();
  const cam = camera as THREE.PerspectiveCamera;

  const ZERO_POLY = "polygon(0px 0px, 0px 0px, 0px 0px, 0px 0px)";
  const MIN_DOT = 0.02;
  const MIN_AREA = 80;
  const CLAMP_PAD = 2;

  const quad = useMemo(() => {
    const hw = size[0] / 2, hh = size[1] / 2;
    return [
      new THREE.Vector3(-hw,  hh, 0),
      new THREE.Vector3( hw,  hh, 0),
      new THREE.Vector3( hw, -hh, 0),
      new THREE.Vector3(-hw, -hh, 0),
    ];
  }, [size]);

  const prevPos = useRef(new THREE.Vector3());
  const plane   = useRef(new THREE.Plane());
  const tmp     = useRef(new THREE.Vector3()).current;

  useEffect(() => {
    const rot = new THREE.Matrix4().extractRotation(portalWorldMatrix);
    const n = new THREE.Vector3(0, 0, 1).applyMatrix4(rot);
    const p = new THREE.Vector3().setFromMatrixPosition(portalWorldMatrix);
    plane.current.setFromNormalAndCoplanarPoint(n, p);
  }, [portalWorldMatrix]);

  const toScreen = (w: THREE.Vector3) => {
    const v = w.clone().project(cam);
    const x = ((v.x + 1) / 2) * viewport.width;
    const y = ((-v.y + 1) / 2) * viewport.height;
    const cx = Math.min(viewport.width  + CLAMP_PAD, Math.max(-CLAMP_PAD, x));
    const cy = Math.min(viewport.height + CLAMP_PAD, Math.max(-CLAMP_PAD, y));
    return [cx, cy] as [number, number];
  };

  const orderByAngle = (pts: [number, number][]) => {
    const cx = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
    const cy = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
    return pts
      .map(p => ({ p, a: Math.atan2(p[1] - cy, p[0] - cx) }))
      .sort((A, B) => A.a - B.a)
      .map(o => o.p);
  };

  const polyArea = (pts: [number, number][]) => {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      a += x1 * y2 - x2 * y1;
    }
    return Math.abs(a * 0.5);
  };

  useFrame(() => {
    // 1) Clip-path estable
    const worldPts = quad.map(v => v.clone().applyMatrix4(portalWorldMatrix));

    const camPos = cam.getWorldPosition(new THREE.Vector3());
    const camDir = cam.getWorldDirection(new THREE.Vector3());
    const center = worldPts[0].clone().add(worldPts[2]).multiplyScalar(0.5);
    const toCenter = center.clone().sub(camPos).normalize();
    const facing = camDir.dot(toCenter) > MIN_DOT;

    if (!facing) {
      onUpdateClip(ZERO_POLY);
    } else {
      let p2d = worldPts.map(toScreen);
      p2d = orderByAngle(p2d);
      if (polyArea(p2d) < MIN_AREA) {
        onUpdateClip(ZERO_POLY);
      } else {
        const clip = `polygon(${p2d
          .map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`)
          .join(",")})`;
        onUpdateClip(clip);
      }
    }

    // 2) Sincroniza cámara B
    setCamBFromA(cam.matrixWorld);

    // 3) Detección de cruce
    const curr = pivotA.position.clone();
    const prev = prevPos.current.lengthSq() ? prevPos.current : curr;
    const dPrev = plane.current.distanceToPoint(prev);
    const dCurr = plane.current.distanceToPoint(curr);
    if (dPrev > 0 && dCurr <= 0) {
      const local = tmp.copy(curr).applyMatrix4(
        new THREE.Matrix4().copy(portalWorldMatrix).invert()
      );
      if (Math.abs(local.x) <= size[0] / 2 && Math.abs(local.y) <= size[1] / 2) {
        onCrossFrontToBack();
      }
    }
    prevPos.current.copy(curr);
  });

  return null;
}