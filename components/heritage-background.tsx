import ArchBand from "@/components/heritage/arch-band";
import BackdropImage from "@/components/heritage/backdrop-image";
import JaaliPattern from "@/components/heritage/jaali-pattern";
import SandstoneGrain from "@/components/heritage/sandstone-grain";
import VastuMandala from "@/components/heritage/vastu-mandala";

export default function HeritageBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f6efe2_0%,#f4ecdd_40%,#eadcca_100%)]" />
      <BackdropImage />
      <JaaliPattern />
      <SandstoneGrain />
      <div className="absolute inset-x-0 bottom-[-10vh] flex items-end justify-center">
        <VastuMandala />
      </div>
      <ArchBand />
    </div>
  );
}
