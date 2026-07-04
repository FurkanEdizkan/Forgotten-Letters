import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// C1 scaffold: placeholder routes. Nav/footer + real pages wire in later tasks.
export function App() {
  return (
    <BrowserRouter>
      <div className="fl" style={{ minHeight: "100vh", padding: 40 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/profile" element={<h1 className="fl-display">Profile (todo)</h1>} />
          <Route
            path="/design-system"
            element={<h1 className="fl-display">Design System (todo)</h1>}
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
