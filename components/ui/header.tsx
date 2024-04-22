"use client";

import { useState, useEffect } from "react";

import Link from "next/link";
import { HorusLogo, BSCLogo, EAPMLogo } from "./logo";
import Dropdown from "@/components/utils/dropdown";
import MobileMenu from "./mobile-menu";

export default function Header() {
  const [top, setTop] = useState<boolean>(true);

  // detect whether user has scrolled the page down by 10px
  const scrollHandler = () => {
    window.pageYOffset > 10 ? setTop(false) : setTop(true);
  };

  useEffect(() => {
    scrollHandler();
    window.addEventListener("scroll", scrollHandler);
    return () => window.removeEventListener("scroll", scrollHandler);
  }, [top]);

  return (
    <header
      className={`fixed w-full z-30 md:bg-opacity-90 transition duration-300 ease-in-out ${
        !top ? "bg-white backdrop-blur-sm shadow-lg" : ""
      }`}
    >
      <div className="mx-auto px-5 sm:px-6">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Site branding */}
          <HorusLogo />
          <h1 className="absolute mx-auto w-full text-center text-2xl font-bold">
            Horus
          </h1>
          <div className="flex flex-row gap-4 items-center justify-center">
            <EAPMLogo />
            <BSCLogo />
          </div>
        </div>
      </div>
    </header>
  );
}
