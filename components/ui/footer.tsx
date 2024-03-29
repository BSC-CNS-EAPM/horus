import { HorusLogo } from "./logo";

export default function Footer() {
  return (
    <footer>
      {/* Top area: Blocks */}
      <div className="flex flex-row w-full items-center justify-center gap-8 py-8 md:py-12 border-t border-gray-200">
        {/* 1st block */}
        <div className="mb-2">
          <HorusLogo />
        </div>
        <div className="text-sm text-gray-600">
          <a
            href="#0"
            className="text-gray-600 hover:text-gray-900 hover:underline transition duration-150 ease-in-out"
          >
            Terms
          </a>{" "}
          ·{" "}
          <a
            href="#0"
            className="text-gray-600 hover:text-gray-900 hover:underline transition duration-150 ease-in-out"
          >
            Privacy Policy
          </a>
        </div>
        <span className="text-sm text-gray-600 mr-4 flex flex-row">
          &copy; BSC. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
