import Terrain from "./terrain/Terrain";
import Beacon from "./terrain/Beacon";
import type { Phase } from "./terrain/timeline";
import type { AudioLevels } from "../audio/usePortalAudio";

export default function SceneB({
  phase,
  levels,
  showBeacon,
}: {
  phase: Phase;
  levels: React.MutableRefObject<AudioLevels>;
  showBeacon: boolean;
}) {
  return (
    <>
      <Terrain phase={phase} />
      <Beacon levels={levels} visible={showBeacon} />
    </>
  );
}
