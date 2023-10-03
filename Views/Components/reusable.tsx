import React, { Fragment, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { Popover, Combobox } from "@headlessui/react";
import { useEffect } from "react";

const HorusPopover = ({ trigger, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const handleOpen = () => {
    setIsOpen(true);
  };
  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Popover className="relative">
      <Popover.Group
        onMouseOver={handleOpen}
        onMouseLeave={handleClose}
        style={{
          margin: "0",
          padding: "0",
          height: "1.25rem",
        }}
      >
        {trigger}
      </Popover.Group>
      {isOpen && (
        <Popover.Panel className="absolute" static>
          {children}
        </Popover.Panel>
      )}
    </Popover>
  );
};

function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

interface HorusModalProps {
  show: boolean;
  onHide?: () => void;
  header: React.ReactNode;
  body?: React.ReactNode;
  footer: React.ReactNode;
  size?: "sm" | "lg" | "xl" | "xxl";
  contentClassName?: string;
  children?: React.ReactNode;
}

function HorusModal(props: HorusModalProps) {
  const sizeClass = props.size ? `modal-${props.size}` : "";
  return (
    <Modal
      show={props.show}
      onHide={props.onHide}
      dialogClassName={sizeClass}
      contentClassName={props.contentClassName}
    >
      <Modal.Header>
        <Modal.Title>{props.header}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {props.body}
        {props.children}
      </Modal.Body>
      <Modal.Footer>{props.footer}</Modal.Footer>
    </Modal>
  );
}

const people = [
  { name: "Wade Cooper" },
  { name: "Arlene Mccoy" },
  { name: "Devon Webb" },
  { name: "Tom Cook" },
  { name: "Tanya Fox" },
  { name: "Hellen Schmidt" },
];

function HorusDropdown() {
  const [selected, setSelected] = useState(people[0]);

  return (
    <div className="fixed top-16 w-72">
      <Listbox value={selected} onChange={setSelected}>
        <div className="relative mt-1">
          <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
            <span className="block truncate">{selected.name}</span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {people.map((person, personIdx) => (
                <Listbox.Option
                  key={personIdx}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-10 pr-4 ${
                      active ? "bg-amber-100 text-amber-900" : "text-gray-900"
                    }`
                  }
                  value={person}
                >
                  {({ selected }) => (
                    <>
                      <span
                        className={`block truncate ${
                          selected ? "font-medium" : "font-normal"
                        }`}
                      >
                        {person.name}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-amber-600">
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
}

type HorusComboboxProps = {
  selectedData: Array<any>;
  data: any[];
  onChange: (value: any) => void;
  displayValue: (value: any) => string;
};

export { HorusModal, HorusDropdown, HorusModalProps, debounce, HorusPopover };
