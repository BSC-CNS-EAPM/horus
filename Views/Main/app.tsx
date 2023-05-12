import React, { Children, useState } from "react";
import { Molstar } from "../Molstar/molstar";
import NBDButton from "../Components/NBDButton";
import HorusModal from "../Components/Modal";
import getVersion from "./Utils/utils";

export function App() {

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalBody, setModalBody] = useState(<div></div>);


    const handleOpenModal = () => {
        getVersion().then((version) => {
            const versionsChildren = (
                <div>
                    <p key="version">NBDSuite: {version.nbdsuite}</p>
                    <p key="horus">Horus: {version.horus}</p>
                </div>);
            setModalBody(versionsChildren);
        });
        setShowModal(true);
    }
    const handleCloseModal = () => setShowModal(false);

    return (
        <div className="App">
            <NBDButton text="About Horus" action={handleOpenModal} />
            <HorusModal show={showModal} onHide={handleCloseModal} title="About Horus" body={modalBody} />
        </div>
    );
}

function About() {
    return (
        <div>
            <h1>About</h1>
            <p>This is the about page</p>
        </div>
    );
}
