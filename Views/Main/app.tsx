import { Route, Routes } from "react-router-dom"

import Molstar from "../Components/molstar";
import FlowBuilder from "../Components/FlowBuilder/flowbuilder";
import HorusToolbar from "../Components/Toolbar/toolbar";
import HorusTerm from "../Components/Console/console";


export function App() {

    return (
        <div className="grid">
            <HorusToolbar />
            <div id="root-routes" className="root-routes root-routes-console-hidden">
            <Routes>
                <Route path="/" element={<Molstar />} />
                <Route path="/newjob" element={<FlowBuilder openFlow={false}/>} />
            </Routes>
            </div>
            <HorusTerm />
        </div>
    )
}
