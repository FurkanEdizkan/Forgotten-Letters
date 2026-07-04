import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Navbar } from "./components/chrome/Navbar";
import { Footer } from "./components/chrome/Footer";
import { ProfilePage } from "./pages/ProfilePage";
import { DesignSystemPage } from "./pages/DesignSystemPage";

export function App() {
  return (
    <BrowserRouter>
      <div className="fl" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/profile" replace />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/design-system" element={<DesignSystemPage />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
