import { useState } from "react";
import { HorusLogo } from "./logo";
import Modal from "./modal";

export default function Footer() {
  const [openLicense, setOpenLicense] = useState(false);
  const [modalContents, setModalContents] = useState(
    <pre>Horus MIT license</pre>
  );

  return (
    <>
      <Modal
        isOpen={openLicense}
        onClose={() => {
          setOpenLicense(false);
        }}
      >
        {modalContents}
      </Modal>
      <footer>
        {/* Top area: Blocks */}
        <div className="flex flex-row w-full items-center justify-center gap-8 py-8 md:py-12 border-t border-gray-200">
          {/* 1st block */}
          <div className="mb-2">
            <HorusLogo />
          </div>
          <div className="text-sm text-gray-600">
            <button
              onClick={(e) => {
                fetch("/license")
                  .then((response) => response.text())
                  .then((contents) => setModalContents(<pre>{contents}</pre>));

                setOpenLicense(true);
              }}
              className="text-gray-600 hover:text-gray-900 hover:underline transition duration-150 ease-in-out"
            >
              LICENSE
            </button>{" "}
            ·{" "}
            <a
              href="https://www.bsc.es/discover-bsc/organisation/scientific-structure/electronic-and-atomic-protein-modeling-eapm"
              className="text-gray-600 hover:text-gray-900 hover:underline transition duration-150 ease-in-out"
            >
              EAPM group
            </a>
          </div>
          <span className="text-sm text-gray-600 mr-4 flex flex-row">
            &copy; BSC. All rights reserved.
          </span>
        </div>
      </footer>
    </>
  );
}
