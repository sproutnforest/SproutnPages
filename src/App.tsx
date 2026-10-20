import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import BookDetail from "./pages/BookDetail";

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/book/:title" element={<BookDetail />} />
        <Route path="*" element={<main className="page"><section className="panel"><h3 className="panel-title">Page not found</h3></section></main>} />
      </Routes>
    </>
  );
}