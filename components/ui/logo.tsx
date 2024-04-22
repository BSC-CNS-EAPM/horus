import Link from "next/link";
import Image from "next/image";

import HorusLogoFull from "@/public/images/horus-full.png";
import BSCLogoImage from "@/public/images/bsc_logo.png";
import EAPMLogoImage from "@/public/images/eapm.jpeg";

export function HorusLogo() {
  return (
    <Link href="/" className="block" aria-label="Cruip">
      <Image
        className="object-contain"
        src={HorusLogoFull}
        width={70}
        height={70}
        alt="Horus logo"
      ></Image>
    </Link>
  );
}

export function BSCLogo() {
  return (
    <Link href="bsc.es" className="block" aria-label="Cruip">
      <Image src={BSCLogoImage} width={250} height={100} alt="BSC logo"></Image>
    </Link>
  );
}

export function EAPMLogo() {
  return (
    <Link
      href="https://www.bsc.es/discover-bsc/organisation/scientific-structure/electronic-and-atomic-protein-modeling-eapm"
      aria-label="Cruip"
    >
      <Image src={EAPMLogoImage} width={80} height={20} alt="EAPM logo"></Image>
    </Link>
  );
}
