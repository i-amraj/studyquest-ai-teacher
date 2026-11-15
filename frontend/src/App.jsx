import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Login, Register } from "./pages/Auth";
import { Shell, Dashboard } from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Syllabus from "./pages/Syllabus";
import Learn from "./pages/Learn";
import History from "./pages/History";
import { getTokens } from "./lib/api";
import Home from "./pages/Home";

const Guard = ({ children }) => (getTokens() ? children : <Navigate to="/login" replace />);
export default function App() {
  return (<BrowserRouter><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/app" element={<Guard><Shell /></Guard>}>
      <Route index element={<Dashboard />} />
      <Route path="upload" element={<Upload />} />
      <Route path="syllabus/:id" element={<Syllabus />} />
      <Route path="chapter/:id" element={<Learn />} />
      <Route path="history" element={<History />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter>);
}
