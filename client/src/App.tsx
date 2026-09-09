import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Home } from "./screens/Home.tsx";
import { Room } from "./screens/Room.tsx";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/r/:code" element={<Room />} />
      </Routes>
    </BrowserRouter>
  );
}
