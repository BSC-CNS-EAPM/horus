import React, { Children, useState } from "react";
import { getVersion } from "../Utils/utils";
import { Route, Routes, Link } from "react-router-dom"

import Molstar from "../Components/molstar";
import FlowBuilder from "../Components/FlowBuilder/flowbuilder";
import NBDButton from "../Components/nbdbutton";
import HorusModal from "../Components/modal";
import HorusToolbar from "../Components/Toolbar/toolbar";

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
