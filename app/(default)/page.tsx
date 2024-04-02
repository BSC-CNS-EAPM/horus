export const metadata = {
  title: "Horus",
  description: "Next generation workflow manager",
};

import Hero from "@/components/hero";
import Features from "@/components/features";
import FeaturesBlocks from "@/components/features-blocks";

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <FeaturesBlocks />
    </>
  );
}
