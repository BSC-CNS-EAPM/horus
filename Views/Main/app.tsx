import React, { Children, useState } from "react";
import { Molstar } from "../Components/molstar";
import { getVersion, getForceFields, openWindow } from "../Utils/utils";
import { Route, Routes, Link } from "react-router-dom"

import FlowBuilder from "../Components/FlowBuilder/flowbuilder";
import NBDButton from "../Components/NBDButton";
import HorusModal from "../Components/Modal";


const Main = () => {
    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalBody, setModalBody] = useState(<div></div>);


    const openVersionModal = () => {
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

    const openForceFieldsModal = () => {
        getForceFields().then((ff) => {
            const versionsChildren = (
                <div>
                    <p key="version">Installed force fields: {ff}</p>
                </div>);
            setModalBody(versionsChildren);
        });
        setShowModal(true);
    }

    return (
        <div className="App">
            <HorusModal show={showModal} onHide={handleCloseModal} title="About Horus" body={modalBody} />
            <div className="grid h-screen place-items-center">
                <nav>
                    <div className="grid gap-3">
                        <h1>Horus</h1>
                        <Link to="/newjob">
                            <NBDButton text="New job" action={null} />
                        </Link>
                        <NBDButton text="Open..." action={null} />
                        <Link to="/molstar">
                            <NBDButton text="Molstar" action={null} />
                        </Link>
                        <NBDButton text="About Horus" action={openVersionModal} />
                    </div>
                </nav>
            </div>
        </div>
    );
}

export function App() {
    return (
        <Routes>
            <Route path="/" element={<Main />} />
            <Route path="/newjob" element={<FlowBuilder />} />
            <Route path="/molstar" element={<Molstar />} />
        </Routes>
    )
}
