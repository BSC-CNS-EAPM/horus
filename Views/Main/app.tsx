import { Route, Routes } from "react-router-dom"

import Molstar from "../Components/Molstar/molstar";
import FlowBuilder from "../Components/FlowBuilder/flow_builder";
import HorusToolbar from "../Components/Toolbar/toolbar";
import HorusTerm from "../Components/Console/console";


function PluginPage() {
    return (
        <iframe id="plugin-page-iframe" src="/plugins/pages" style={
            {
                width: "100%",
                height: "100%",
                border: "none"
            }
        } />
    )
}

export function App() {

    return (
        <div className="grid">
            <HorusToolbar />
            <div id="root-routes" className="root-routes root-routes-console-hidden">
                <Routes>
                    <Route path="/" element={<Molstar />} />
                    <Route path="/newjob" element={<FlowBuilder />} />
                    <Route path="/plugins/pages" element={<PluginPage />} />
                </Routes>
            </div>
            <HorusTerm />
        </div>
    )
}
