import React, { Children, useState } from "react";
import { getVersion, getForceFields, openWindow } from "../Utils/utils";
import { Route, Routes, Link } from "react-router-dom"

import Molstar from "../Components/Molstar";

import FlowBuilder from "../Components/FlowBuilder/FlowBuilder";
import NBDButton from "../Components/NBDbutton";
import HorusModal from "../Components/modal";
import HorusToolbar from "../Components/Toolbar/Toolbar";

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
        <div className="grid">
            <HorusToolbar />
            <div className="absolute z-10">
                <nav>
                    <div className="flex flex-row">
                        <Link to="/newjob">
                            <NBDButton text="New job" action={null} />
                        </Link>
                    </div>
                </nav>
            </div>
        </div>
    );
}

export function App() {
    return (
        <div className="grid">
            <HorusToolbar />
            <Routes>
                <Route path="/" element={<Molstar />} />
                <Route path="/newjob" element={<FlowBuilder />} />
            </Routes>
        </div>
    )
}
