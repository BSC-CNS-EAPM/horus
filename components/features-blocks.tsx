import Image from "next/image";

import AppleLogo from "@/public/images/Apple_logo_grey.png";
import UbuntuLogo from "@/public/images/ubuntu.png";
import LinuxLogo from "@/public/images/tux.png";

export default function FeaturesBlocks() {
  return (
    <section className="relative">
      {/* Section background (needs .relative class on parent and next sibling elements) */}
      <div
        className="absolute inset-0 md:mt-24 lg:mt-0 bg-gray-900 pointer-events-none"
        style={{
          top: "40%",
        }}
        aria-hidden="true"
      ></div>
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="py-12 md:py-20">
          {/* Section header */}
          <div className="max-w-3xl mx-auto text-center pb-12 md:pb-20">
            <h2 className="h2 mb-4" id="horus-download">
              Download the latest version
            </h2>
            <p className="text-xl text-gray-600">
              Select your operating system and start working with Horus
            </p>
          </div>

          {/* Items */}
          <div className="max-w-sm mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-start md:max-w-2xl lg:max-w-none">
            {/* 1st item */}
            <div className="border border-primary relative flex flex-col items-center p-6 bg-white rounded shadow-xl hover:scale-110 transition-all duration-500 cursor-pointer ">
              <Image src={AppleLogo} height={50} width={50} alt="macos" />
              <h4 className="text-xl font-bold leading-snug tracking-tight mb-1">
                macOS Intel
              </h4>
              <p className="text-gray-600 text-center">
                Download Horus for Intel Macs
              </p>
            </div>

            {/* 2nd item */}
            <div className="border border-primary relative flex flex-col items-center p-6 bg-white rounded shadow-xl hover:scale-110 transition-all duration-500 cursor-pointer">
              <Image src={AppleLogo} height={50} width={50} alt="macos" />
              <h4 className="text-xl font-bold leading-snug tracking-tight mb-1">
                macOS Apple Silicon
              </h4>
              <p className="text-gray-600 text-center">
                Download Horus for Apple Silicon Macs
              </p>
            </div>

            {/* 3rd item */}
            <div className="border border-primary relative flex flex-col items-center p-6 bg-white rounded shadow-xl hover:scale-110 transition-all duration-500 cursor-pointer">
              <Image src={UbuntuLogo} height={60} width={60} alt="ubuntu" />
              <h4 className="text-xl font-bold leading-snug tracking-tight mb-1">
                Ubuntu 22.04
              </h4>
              <p className="text-gray-600 text-center">
                Download Horus for Ubuntu 22.04
              </p>
            </div>

            {/* 4th item */}
            <div className="border border-primary relative flex flex-col items-center p-6 bg-white rounded shadow-xl hover:scale-110 transition-all duration-500 cursor-pointer">
              <Image src={LinuxLogo} height={50} width={50} alt="linux" />
              <h4 className="text-xl font-bold leading-snug tracking-tight mb-1">
                Linux universal
              </h4>
              <p className="text-gray-600 text-center">
                Download Horus for general Linux
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
